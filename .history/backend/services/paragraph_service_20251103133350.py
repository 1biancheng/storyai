"""段落拆分与入库服务
遵循统一技术栈与规范:
- 段落拆分:以语义为单位进行分割(空行、标点、长度阈值综合规则)
- 向量化:调用 AIService.get_embeddings(默认 text-embedding-3-small / 1536 维)
- 入库:调用 DatabaseService.insert_paragraphs 存储到 pgvector 段落库
- Redis缓存:使用混合缓存策略优化重复向量计算
"""

import re
import math
import asyncio
import hashlib
import logging
from typing import List, Dict, Any, Optional

from services.ai_service import AIService, ModelConfig
from services.db_service import get_db_service
from services.cache_service import get_cache
from config import get_settings
from services.classify_service import classify_paragraphs

logger = logging.getLogger(__name__)


def _normalize_text(text: str) -> str:
    # 统一换行与空白
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # 去除多余空白行
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _is_chapter_title(line: str) -> bool:
    r"""判断是否为章节标题
    
    识别规则:
    1. 正则匹配:第[一二三...百]章|Chapter \d+|\d+\.
    2. 独立成行且字数<30
    3. 不包含多个句子
    """
    line = line.strip()
    if not line or len(line) > 30:
        return False
    
    # 中文章节标题模式
    chinese_patterns = [
        r'^\u7b2c[一二三四五六七八九十百千]+[章回节集]',  # 第一章、第二十回
        r'^[一二三四五六七八九十百千]+[、,]',  # 一、 二,
    ]
    
    # 英文/数字章节标题模式
    english_patterns = [
        r'^Chapter\s+\d+',  # Chapter 1
        r'^\d+\.\s*[A-Z\u4e00-\u9fa5]',  # 1. Title
        r'^[A-Z][a-z]+\s+\d+',  # Part 1
    ]
    
    for pattern in chinese_patterns + english_patterns:
        if re.match(pattern, line, re.IGNORECASE):
            return True
    
    return False


def _is_scene_marker(line: str) -> bool:
    """判断是否为场景分隔符
    
    常见分隔符: ***, ---, _—, ===
    """
    line = line.strip()
    if not line:
        return False
    
    # 纯特殊字符组成(重复3次以上)
    if re.match(r'^[*\-—=]{3,}$', line):
        return True
    
    return False


def _calculate_semantic_completeness_score(sentence: str, prev_sentence: str = "") -> float:
    """计算语义完整性评分(0-1)
    
    评分规则:
    - 对话结束点:+0.3
    - 时间标记("第二天"):+0.4
    - 人物名出现:-0.2(避免切断人物动作)
    - 情感词突变:+0.2
    """
    score = 0.5  # 基础分
    
    # 对话结束点(引号、冒号后)
    if re.search(r'["""』」]$', sentence.strip()):
        score += 0.3
    
    # 时间标记
    if re.search(r'(第[一二三四五六七八九十百千]+[天日年月]|次日|翌日|数日后|多年后)', sentence):
        score += 0.4
    
    # 人物名(常见姓氏+动词,降低分数避免切断)
    if re.search(r'[\u4e00-\u9fa5]{2,3}(说|道|想|看|走|跑|笑|哭)', sentence):
        score -= 0.2
    
    # 情感词突变检测
    emotion_words = ['突然', '忽然', '猛然', '顿时', '瞬间']
    if any(word in sentence for word in emotion_words):
        score += 0.2
    
    return max(0.0, min(1.0, score))


def split_into_semantic_paragraphs(text: str, min_len: int = 40, max_len: int = 600) -> List[str]:
    """语义段落拆分(以标点符号为界)
    - 以标点符号为主要边界(兼容中英文全角/半角)
    - 对过短片段进行句子聚合
    - 对超长片段做二次拆分,确保每段长度适中
    """
    text = _normalize_text(text)
    # 先按空行切分为块(避免跨章节/场景污染)
    blocks = [b.strip() for b in re.split(r'\n\s*\n', text) if b.strip()]

    def split_by_sentence(s: str) -> List[str]:
        # 以中文/英文标点为界,在标点后切分(保留标点)
        # 覆盖: . ! ? ; : , 、 … 以及英文 . ! ? ; : ,
        parts = re.split(r'(?<=[.!?;:,、…\.!\?;:,])', s)
        return [p.strip() for p in parts if p and p.strip()]

    paragraphs: List[str] = []
    for block in blocks:
        sentences = split_by_sentence(block)
        # 聚合过短句子为语义段
        buf = []
        acc = 0
        for sent in sentences:
            if acc + len(sent) < min_len:
                buf.append(sent)
                acc += len(sent)
            else:
                if buf:
                    buf.append(sent)
                    para = ''.join(buf)
                    paragraphs.append(para)
                    buf = []
                    acc = 0
                else:
                    paragraphs.append(sent)
        if buf:
            paragraphs.append(''.join(buf))

    # 对超长片段进行二次拆分(使用语义完整性评分优化切分点)
    final_paras: List[str] = []
    for p in paragraphs:
        if len(p) <= max_len:
            final_paras.append(p)
        else:
            sents = split_by_sentence(p)
            if len(sents) <= 1:
                # 单句超长,强制切分
                final_paras.append(p)
                continue
            
            # 使用语义完整性评分选择最佳切分点
            group = []
            acc = 0
            prev_sent = ""
            
            for i, s in enumerate(sents):
                if acc + len(s) <= max_len:
                    group.append(s)
                    acc += len(s)
                    prev_sent = s
                else:
                    # 需要切分:评估当前位置的语义完整性
                    if group:
                        # 计算切分点评分
                        score = _calculate_semantic_completeness_score(prev_sent, group[-2] if len(group) > 1 else "")
                        
                        # 如果评分过低(<0.4),尝试回退一句以提高完整性
                        if score < 0.4 and len(group) > 1:
                            # 回退最后一句到下一组
                            last_sent = group.pop()
                            final_paras.append(''.join(group))
                            group = [last_sent, s]
                            acc = len(last_sent) + len(s)
                        else:
                            final_paras.append(''.join(group))
                            group = [s]
                            acc = len(s)
                    else:
                        group = [s]
                        acc = len(s)
                    prev_sent = s
            
            if group:
                final_paras.append(''.join(group))

    # 去重与清洗
    cleaned = []
    seen = set()
    for p in final_paras:
        key = p.strip()
        if key and key not in seen:
            cleaned.append(key)
            seen.add(key)
    return cleaned


async def embed_paragraphs(paragraphs: List[str], embedding_model: str = "text-embedding-3-small") -> List[List[float]]:
    """Batch paragraph embedding with Redis cache optimization
    - Cache key: md5(paragraph_text + model_name)
    - Cache TTL: 7 days (embeddings are static)
    - Fallback to direct API call if cache miss
    """
    batch_size = 64
    vectors: List[List[float]] = []
    cache = await get_cache()
    
    async with AIService() as ai:
        for i in range(0, len(paragraphs), batch_size):
            batch = paragraphs[i: i + batch_size]
            batch_vectors = []
            uncached_texts = []
            uncached_indices = []
            
            # Check cache for each paragraph
            for j, text in enumerate(batch):
                cache_key = f"embed:{embedding_model}:{hashlib.md5(text.encode()).hexdigest()}"
                cached_vec = await cache.get(cache_key)
                
                if cached_vec:
                    batch_vectors.append(cached_vec)
                    logger.debug(f"Cache hit for paragraph {i+j}")
                else:
                    batch_vectors.append(None)  # Placeholder
                    uncached_texts.append(text)
                    uncached_indices.append(j)
            
            # Batch compute uncached embeddings
            if uncached_texts:
                logger.info(f"Computing {len(uncached_texts)}/{len(batch)} uncached embeddings")
                new_vecs = await ai.get_embeddings(uncached_texts, model_id=embedding_model)
                
                # Store to cache and fill placeholders
                for idx, vec in zip(uncached_indices, new_vecs):
                    batch_vectors[idx] = vec
                    text = batch[idx]
                    cache_key = f"embed:{embedding_model}:{hashlib.md5(text.encode()).hexdigest()}"
                    await cache.set(cache_key, vec, ttl=7 * 24 * 3600)  # 7 days
            
            vectors.extend(batch_vectors)
    
    return vectors


async def ingest_text_to_paragraph_store(
    text: str,
    book_id: Optional[str] = None,
    chapter_index: Optional[int] = None,
    section_index: Optional[int] = None,
    embedding_model: str = "text-embedding-3-small"
) -> Dict[str, Any]:
    """拆书入库:
    - 拆分 -> 分类(Star增强) -> 向量化 -> 入库
    - 增强:章节识别、场景分隔符检测
    返回统计信息与插入的段落ID列表
    """
    # 第一步:先按行切分并识别章节、场景分隔符
    text = _normalize_text(text)
    lines = text.split('\n')
    
    # 建立章节上下文
    current_chapter = None
    blocks_with_context = []
    current_block_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_block_lines:
                blocks_with_context.append({
                    "content": '\n'.join(current_block_lines),
                    "chapter": current_chapter
                })
                current_block_lines = []
        elif _is_chapter_title(stripped):
            # 记录章节标题
            if current_block_lines:
                blocks_with_context.append({
                    "content": '\n'.join(current_block_lines),
                    "chapter": current_chapter
                })
                current_block_lines = []
            current_chapter = stripped
            blocks_with_context.append({
                "content": stripped,
                "chapter": current_chapter,
                "is_chapter_title": True
            })
        elif _is_scene_marker(stripped):
            # 场景分隔符
            if current_block_lines:
                blocks_with_context.append({
                    "content": '\n'.join(current_block_lines),
                    "chapter": current_chapter
                })
                current_block_lines = []
            blocks_with_context.append({
                "content": stripped,
                "chapter": current_chapter,
                "is_scene_marker": True
            })
        else:
            current_block_lines.append(line)
    
    if current_block_lines:
        blocks_with_context.append({
            "content": '\n'.join(current_block_lines),
            "chapter": current_chapter
        })
    
    # 第二步:对普通块进行语义段落拆分
    paragraphs_with_meta = []
    for block_dict in blocks_with_context:
        content = block_dict["content"]
        chapter = block_dict.get("chapter")
        
        if block_dict.get("is_chapter_title"):
            paragraphs_with_meta.append({
                "content": content,
                "meta": {
                    "chapter_title": content,
                    "position_type": "chapter_start",
                    "scene_marker": False
                }
            })
        elif block_dict.get("is_scene_marker"):
            paragraphs_with_meta.append({
                "content": content,
                "meta": {
                    "chapter_title": chapter,
                    "position_type": "scene_break",
                    "scene_marker": True
                }
            })
        else:
            # 普通块:进行语义拆分
            paras = split_into_semantic_paragraphs(content)
            for p in paras:
                paragraphs_with_meta.append({
                    "content": p,
                    "meta": {
                        "chapter_title": chapter,
                        "position_type": "normal",
                        "scene_marker": False
                    }
                })
    
    if not paragraphs_with_meta:
        return {"count": 0, "ids": [], "message": "No paragraphs parsed"}
    
    # 提取纯文本内容用于分类
    paragraph_contents = [p["content"] for p in paragraphs_with_meta]

    # 文学辞典分类(星矢相关能力的前置增强)
    try:
        metas = await classify_paragraphs(paragraph_contents)
    except Exception:
        metas = [{} for _ in paragraph_contents]

    # 星矢标签生成器(依赖较重,按需加载且失败不影响主流程)
    tag_generator = None
    try:
        from advanced_novel_system.core.tag_generator import AdvancedTagGenerator  # type: ignore
        tag_generator = AdvancedTagGenerator()
    except Exception:
        tag_generator = None

    vectors = await embed_paragraphs(paragraph_contents, embedding_model=embedding_model)

    # 当数据库不可用时(如 settings.database.enabled=False ),跳过入库但返回成功结构,便于前端联调
    settings = get_settings()
    if not settings.database.enabled:
        return {
            "count": len(paragraph_contents),
            "ids": [],
            "message": "Database disabled: paragraphs processed and embedded in dev mode, but not stored"
        }

    # 正常入库流程
    db = await get_db_service()
    rows: List[Dict[str, Any]] = []
    for idx, p_dict in enumerate(paragraphs_with_meta):
        content = p_dict["content"]
        base_meta = p_dict["meta"]
        
        # 合并分类结果
        classify_meta = metas[idx] if idx < len(metas) and isinstance(metas[idx], dict) else {}
        meta = {**base_meta, **classify_meta}

        # 兼容 isDialogue 自动检测(若分类缺失)
        try:
            meta.setdefault("isDialogue", bool(re.search(r'[""":]|(说道|问道|答道)', content)))
        except Exception:
            pass

        # 星矢标签融合到 labels
        if tag_generator:
            try:
                tags = list(tag_generator.generate_tags(content))
                existing_labels = meta.get("labels") or []
                if not isinstance(existing_labels, list):
                    existing_labels = [str(existing_labels)]
                meta["labels"] = list({*(existing_labels), *tags})
            except Exception:
                # Ignore generator failure
                pass
        else:
            # Fallback without advanced system
            try:
                tags = generate_basic_tags(content)
                existing_labels = meta.get("labels") or []
                if not isinstance(existing_labels, list):
                    existing_labels = [str(existing_labels)]
                meta["labels"] = list({*(existing_labels), *tags})
            except Exception:
                # Ignore fallback failure
                pass

        rows.append({
            "book_id": book_id,
            "chapter_index": chapter_index,
            "section_index": section_index,
            "paragraph_index": idx,
            "content": content,
            "meta": meta,
            "embedding": vectors[idx] if idx < len(vectors) else None,
            "embedding_model": embedding_model
        })

    try:
        ids = await db.insert_paragraphs(rows)
        return {"count": len(ids), "ids": ids}
    except Exception as e:
        # 避免异常导致连接直接关闭,在上层统一转为 {code, message}
        # 这里返回部分统计,由路由层包装为领域错误
        return {
            "count": 0,
            "ids": [],
            "message": f"Failed to insert paragraphs: {str(e)}"
        }


def generate_basic_tags(text: str) -> List[str]:
    """Lightweight fallback tag generator (regex-based, no external deps).
    Coverage:
    - Dialogue / time / space / action / emotion shift / conflict
    - Person names, honorifics, role attributes (height/weight/level)
    - Equipment (weapons/armors/specs, legendary/ancient)
    - Composite hints (robot + height + equipment, causal/physical/attribute relations)
    - Monster domain (type/base attrs/skills/drops)
    - Cultivation, game, romance domains (common vocabularies)
    """
    tags: List[str] = []
    t = (text or "").strip()

    try:
        # Basic markers
        if re.search(r'["""\'::]\s*$', t) or re.search(r'(说道|问道|答道|说:|问:|答:)', t):
            tags.append("dialogue")
        if re.search(r'(第二天|翌日|一周后|一个月后|三年后|清晨|傍晚|午夜|黎明|黄昏|正午|春天|夏天|秋天|冬天|next day|week later|month later|years later)', t, re.IGNORECASE):
            tags.append("time_marker")
        if re.search(r'(山顶|密室|战场|宫殿|森林|河边|城市|村庄|mountain top|battlefield|palace|forest|riverside|city|village)', t, re.IGNORECASE):
            tags.append("space_marker")
        if re.search(r'(看|走|跑|拿|打|追|跳|挥|撞|推|冲|刺|跃)', t):
            tags.append("action")
        if re.search(r'(突然|忽然|猛然|顿时|瞬间)', t):
            tags.append("emotion_shift")
        if re.search(r'(冲突|对抗|矛盾|危机|挑战|抉择|最终|高潮|解决)', t):
            tags.append("conflict")

        # Person names & honorifics
        surnames = r'(张|李|王|赵|刘|陈|杨|黄|周|吴|徐|孙|马|朱|胡|郭|何|高|林)'
        if re.search(fr'{surnames}[\u4e00-\u9fa5]{{1,2}}', t):
            tags.append("person_name")
        if re.search(r'(先生|小姐|大师|勇士|法师|战士|公子|姑娘|道士|刺客)', t):
            tags.append("honorific")

        # Role attributes (height/weight/level)
        if re.search(r'(身高|高度)\s*\d+(\.\d+)?\s*米', t):
            tags.append("role_attr_height")
        if re.search(r'(体重)\s*\d+(\.\d+)?\s*(公斤|千克|吨)', t):
            tags.append("role_attr_weight")
        if re.search(r'(等级|Lv|Level)\s*\d+', t, re.IGNORECASE):
            tags.append("role_attr_level")

        # Equipment: weapons / armors / specs / rarity
        if re.search(r'(火箭炮|激光炮|等离子炮|激光剑|魔法剑|长矛|弓|箭|匕首|魔法杖|法杖)', t):
            tags.append("weapon")
        if re.search(r'(盔甲|重型盔甲|钛合金装甲|护盾|能量护盾|魔法袍|披风|护甲)', t):
            tags.append("armor")
        if re.search(r'\d+(\.\d+)?\s*米(长)?的', t):
            tags.append("equipment_spec_length")
        if re.search(r'(传说中的|史诗级|传奇|古代的|远古的)', t):
            tags.append("rarity_legendary")
        if re.search(r'(古代的|远古的)', t):
            tags.append("tag_ancient")

        # Composite & logical relations (robot, causal, physical, attribute)
        if re.search(r'(机器人|机械体|机甲)', t):
            tags.append("robot")
        if re.search(r'(重量超过\s*\d+(\.\d+)?\s*吨|重型盔甲)', t):
            tags.append("heavy_armor")
        if re.search(r'(移动速度减慢|缓慢移动|行动迟缓)', t):
            tags.append("slow_move")
        if re.search(r'(火系法师|炎术师|火焰法师)', t):
            tags.append("fire_mage")
        if re.search(r'(使用火系魔法|释放火焰|操控火焰)', t):
            tags.append("fire_magic_use")
        # Simple causal link hint
        if re.search(r'(因|因此|所以|导致|从而)', t):
            tags.append("causal_relation")
        if re.search(r'(重量|负重).*(速度|移动)|速度.*(受限|下降)', t):
            tags.append("physical_relation")

        # Monster domain
        if re.search(r'(史莱姆|龙|恶魔|精灵|狼人|吸血鬼|巨人|亡灵)', t):
            tags.append("monster_type")
        if re.search(r'(血量|HP)\s*\d+', t, re.IGNORECASE):
            tags.append("monster_hp")
        if re.search(r'(攻击力|ATK)\s*\d+', t, re.IGNORECASE):
            tags.append("monster_atk")
        if re.search(r'(防御力|DEF)\s*\d+', t, re.IGNORECASE):
            tags.append("monster_def")
        if re.search(r'(火球术|雷电|治疗术|寒冰术|剧毒|狂暴)', t):
            tags.append("monster_skill")
        if re.search(r'(掉落|爆出|战利品).*(魔法剑|药水|矿石|材料|装备)', t):
            tags.append("monster_drop")

        # Cultivation domain
        if re.search(r'(炼气|筑基|金丹|元婴|化神|合体|大乘|飞升)', t):
            tags.append("cultivation_realm")
        if re.search(r'(神级|天级|地级|人级)\s*(功法|心法|秘籍)', t):
            tags.append("cultivation_art_grade")
        if re.search(r'(毁天灭地|移山倒海|瞬移|御剑飞行|分身|封印)', t):
            tags.append("cultivation_skill_effect")

        # Game domain
        if re.search(r'(战士|法师|道士|刺客|牧师|弓手|骑士)', t):
            tags.append("game_class")
        if re.search(r'(白装|绿装|蓝装|紫装|橙装|传说)', t):
            tags.append("equipment_quality")
        if re.search(r'(飞行系|水系|火系|草系|冰系|岩系|风系)\s*宠物', t):
            tags.append("pet_type")

        # Romance domain
        if re.search(r'(温柔|霸道|傲娇|腹黑|开朗|内向|冷漠|热情)', t):
            tags.append("personality_trait")
        if re.search(r'(咖啡厅|办公室|海边|雪夜|校园|公园|书店|餐厅)', t):
            tags.append("scene_setting")

        # Synthesis: if multiple domains co-exist, add composite hints
        if "robot" in tags and ("role_attr_height" in tags or "equipment_spec_length" in tags) and ("weapon" in tags or "armor" in tags):
            tags.append("composite_robot_build")
        if "monster_type" in tags and ("monster_hp" in tags or "monster_atk" in tags) and "monster_skill" in tags:
            tags.append("composite_monster_profile")

    except Exception:
        # Fail-soft: never break ingestion
        pass

    return list(dict.fromkeys(tags))
