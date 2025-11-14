"""
段落分类服务
目标: 对语义段落进行文学写作辞典分类,输出统一 meta 字段结构:
meta 示例:
{
  "category": "description",
  "subcategory": "environment",
  "labels": ["night", "rain", "oppressive"],
  "isDialogue": false,
  "characters": ["zhangsan", "lisi"],
  "emotion": "tense",
  "style": "古风/现代",
  "scene": "小巷对峙"
}

实现策略:
- 轻量内置分类词典(可扩展): LITERARY_DICTIONARY
- 调用 AIService.run_agent 进行分类提示,返回 JSON; 使用 json_repairer 修复
- 并发控制: 限制并发以避免速率限制

遵循 simple_cache 规范: 使用 lru_cache 缓存词典
"""

import asyncio
from functools import lru_cache
from typing import List, Dict, Any, Optional

from services.ai_service import AIService
from services.json_repairer import repair_and_load


@lru_cache(maxsize=1)
def get_literary_dictionary() -> Dict[str, Any]:
    # 可替换为从文件加载的实现,此处提供基础模板
    return {
        "categories": {
            "dialogue": {
                "subcategories": ["闲聊", "争执", "揭示信息", "悬念"],
                "signals": ["\"", ":", "说道", "问道", "答道"]
            },
            "description": {
                "subcategories": ["environment", "character", "action", "psychology", "details"],
                "signals": ["风", "雨", "光", "静", "远", "微笑", "目光", "心想"]
            },
            "plot": {
                "subcategories": ["foreshadowing", "conflict", "turning point", "climax", "ending"],
                "signals": ["然而", "突然", "但是", "最终", "于是", "随后", "同时"]
            }
        }
    }


def build_classify_prompt(paragraph: str) -> str:
    dic = get_literary_dictionary()
    cats = ", ".join(dic["categories"].keys())
    subs = []
    for k, v in dic["categories"].items():
        subs.append(f"{k}: {', '.join(v['subcategories'])}")
    subs_str = "; ".join(subs)
    prompt = (
        "你是'大语言模型级别'的文学写作分类器.请进行层次化、多标签分类,并仅返回一个 JSON 对象,不要包含任何额外文字.\n"
        f"主类别(category)限定: [{cats}];子类别(subcategory)限定: {subs_str}.\n"
        "要求:\n"
        "- labels 为多标签数组,包含风格/情感/主题/场景等关键特征;\n"
        "- isDialogue 布尔;characters 提取人物名;emotion 单词;style 文风;scene 简述;\n"
        "- 字段固定且必须出现: {category, subcategory, labels, isDialogue, characters, emotion, style, scene};\n"
        "- 输出必须是有效JSON,不能含中文全角引号或多余说明.\n"
        f"段落:\n{paragraph}\n"
    )
    return prompt


async def classify_paragraphs(paragraphs: List[str], model_id: str = "gpt-3.5-turbo", concurrency: int = 6) -> List[Dict[str, Any]]:
    """对段落列表进行分类,返回与输入一一对应的 meta 列表"""
    metas: List[Optional[Dict[str, Any]]] = [None] * len(paragraphs)

    async def worker(idx: int, text: str):
        try:
            async with AIService() as ai:
                prompt = build_classify_prompt(text)
                resp = await ai.run_agent(prompt, model_id=model_id, parameters={"temperature": 0.2, "max_tokens": 400})
                obj = repair_and_load(resp)
                # 兼容字段名大小写/拼写
                meta = {
                    "category": obj.get("category") or obj.get("类别") or obj.get("Category"),
                    "subcategory": obj.get("subcategory") or obj.get("子类别") or obj.get("Subcategory"),
                    "labels": obj.get("labels") or obj.get("关键词") or obj.get("Labels") or [],
                    "isDialogue": bool(obj.get("isDialogue") or obj.get("is_dialogue") or obj.get("对话")),
                    "characters": obj.get("characters") or obj.get("characters") or obj.get("Characters") or [],
            ```        "emotion": obj.get("emotion") or obj.get("情感") or obj.get("Emotion") or "",
```                    "style": obj.get("style") or obj.get("style") or obj.get("Style"),
                    "scene": obj.get("scene") or obj.get("scene") or obj.get("Scene"),
                }
                metas[idx] = meta
        except Exception:
            metas[idx] = {"category": None, "subcategory": None, "labels": [], "isDialogue": False}

    sem = asyncio.Semaphore(concurrency)

    async def run_with_sem(i: int, t: str):
        async with sem:
            await worker(i, t)

    tasks = [run_with_sem(i, p) for i, p in enumerate(paragraphs)]
    await asyncio.gather(*tasks)

    # 填充缺失
    return [m or {"category": None, "subcategory": None, "labels": [], "isDialogue": False} for m in metas]

