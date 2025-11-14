"""
段落增强器 - 为轻量级神经替代网络添加参数初始化
功能:
1. 关键词提取(jieba分词)
2. 成语检测
3. 序列索引分配
4. 权重/偏置初始化
5. 前后段落关联
"""

import re
import jieba
import jieba.analyse
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

# 常见成语库(前100个高频成语)
COMMON_IDIOMS = [
    '一心一意', '一马当先', '一鸣惊人', '一无所有', '一帆风顺', 
    '一箭双雕', '三心二意', '三思而行', '不可思议', '不由自主',
    '不言而喻', '不屈不挠', '不约而同', '不胫而走', '不择手段',
    '东张西望', '丰功伟绩', '井井有条', '争先恐后', '亡羊补牢',
    '人山人海', '人心所向', '人才济济', '人杰地灵', '今非昔比',
    '仗义执言', '众志成城', '全神贯注', '出人头地', '刻舟求剑',
    '刻不容缓', '前车之鉴', '千载难逢', '南辕北辙', '卧薪尝胆',
    '危在旦夕', '厉兵秣马', '叶公好龙', '同仇敌忾', '呼风唤雨',
    '四面楚歌', '因祸得福', '图穷匕见', '坚持不懈', '声东击西',
    '天衣无缝', '守株待兔', '对牛弹琴', '左右为难', '开诚布公',
    '异曲同工', '当机立断', '心照不宣', '志同道合', '惊心动魄',
    '惨无人道', '愚公移山', '截然不同', '手忙脚乱', '扬眉吐气',
    '投桃报李', '拔苗助长', '振奋人心', '掩耳盗铃', '改过自新',
    '旁若无人', '无可奈何', '无动于衷', '日新月异', '明察秋毫',
    '星罗棋布', '春暖花开', '晴天霹雳', '暗无天日', '曲突徙薪',
    '望尘莫及', '朝三暮四', '杞人忧天', '栩栩如生', '欣欣向荣',
    '欢天喜地', '水深火热', '水落石出', '沧海一粟', '浑水摸鱼',
    '海底捞针', '漫不经心', '火上浇油', '炉火纯青', '画蛇添足',
    '疲于奔命', '盛气凌人', '目瞪口呆', '相得益彰', '破釜沉舟',
    '磨杵成针', '神机妙算', '稳操胜券', '空前绝后', '空穴来风',
]

# 编译成语正则(高效匹配)
IDIOM_PATTERN = re.compile('|'.join(COMMON_IDIOMS))


def extract_keywords(text: str, topK: int = 10) -> List[str]:
    """
    提取文本关键词
    
    Args:
        text: 输入文本
        topK: 返回前K个关键词
    
    Returns:
        关键词列表
    """
    try:
        # 使用jieba的TF-IDF关键词提取
        keywords = jieba.analyse.extract_tags(text, topK=topK, withWeight=False)
        # 过滤单字和停用词
        filtered = [kw for kw in keywords if len(kw) > 1]
        return filtered[:topK]
    except Exception as e:
        print(f"关键词提取失败: {e}")
        return []


def extract_idioms(text: str) -> List[str]:
    """
    提取文本中的成语
    
    Args:
        text: 输入文本
    
    Returns:
        成语列表(去重)
    """
    try:
        # 使用正则匹配
        found = IDIOM_PATTERN.findall(text)
        # 去重但保持顺序
        seen = set()
        unique_idioms = []
        for idiom in found:
            if idiom not in seen:
                unique_idioms.append(idiom)
                seen.add(idiom)
        return unique_idioms
    except Exception as e:
        print(f"成语提取失败: {e}")
        return []


def initialize_sequence_weight(
    paragraph: str,
    position_type: str = "normal",
    is_chapter_start: bool = False,
    is_chapter_end: bool = False
) -> float:
    """
    初始化序列权重(基于段落特征)
    
    Args:
        paragraph: 段落文本
        position_type: 位置类型
        is_chapter_start: 是否章节开头
        is_chapter_end: 是否章节结尾
    
    Returns:
        序列权重(范围: 0.5-2.0)
    """
    weight = 1.0  # 默认权重
    
    # 章节开头/结尾权重较高
    if is_chapter_start or is_chapter_end:
        weight = 1.5
    
    # 检测情节转折关键词
    turning_keywords = ['突然', '忽然', '然而', '但是', '可是', '不料', '谁知', '岂料']
    if any(keyword in paragraph for keyword in turning_keywords):
        weight = 1.3
    
    # 检测对话(权重略低,因为对话通常是辅助性内容)
    if paragraph.count('"') >= 2 or paragraph.count('"') >= 2:
        weight = 0.9
    
    # 检测描写密度(长段描写权重中等)
    if len(paragraph) > 300:
        weight = max(weight, 1.1)
    
    # 确保权重在合理范围内
    return max(0.5, min(2.0, weight))


def initialize_paragraph_bias(
    paragraph: str,
    global_position: float,
    emotion_intensity: float = 0.5,
    keywords: List[str] = None,
    embedding_dim: int = 1536
) -> np.ndarray:
    """
    初始化段落偏置向量(1536维)
    
    分维度初始化:
    - 前512维: 情感特征
    - 512-1024维: 结构特征
    - 1024-1536维: 语义特征
    
    Args:
        paragraph: 段落文本
        global_position: 全局位置(0-1)
        emotion_intensity: 情感强度(0-1)
        keywords: 关键词列表
        embedding_dim: 嵌入维度
    
    Returns:
        偏置向量(numpy数组)
    """
    bias = np.zeros(embedding_dim)
    
    # 维度1: 情感特征(前512维)
    # 情感强度映射到偏置值
    bias[:512] = (emotion_intensity - 0.5) * 0.3  # [-0.15, 0.15]
    
    # 维度2: 结构特征(512-1024维)
    # 位置编码:使用正弦/余弦函数
    position_encoding = []
    for i in range(512):
        if i % 2 == 0:
            position_encoding.append(np.sin(global_position * np.pi))
        else:
            position_encoding.append(np.cos(global_position * np.pi))
    bias[512:1024] = np.array(position_encoding) * 0.2  # [-0.2, 0.2]
    
    # 维度3: 语义特征(1024-1536维)
    # 关键词散列到维度空间
    if keywords:
        keyword_hash = []
        for kw in keywords[:10]:  # 最多10个关键词
            # 简单散列:字符ASCII和的正弦值
            hash_val = sum(ord(c) for c in kw)
            keyword_hash.append(np.sin(hash_val) * 0.1)
        # 填充到512维
        keyword_hash.extend([0.0] * (512 - len(keyword_hash)))
        bias[1024:] = np.array(keyword_hash[:512])
    
    # 限制偏置范围[-0.5, 0.5]
    bias = np.clip(bias, -0.5, 0.5)
    
    return bias


def enhance_paragraphs_with_neural_params(
    paragraphs: List[str],
    book_id: str,
    chapter_indices: List[int] = None
) -> List[Dict[str, Any]]:
    """
    为段落列表添加神经网络参数
    
    Args:
        paragraphs: 段落文本列表
        book_id: 书籍ID
        chapter_indices: 章节索引列表(可选)
    
    Returns:
        增强后的段落字典列表,包含:
        - keywords: 关键词数组
        - idioms: 成语数组
        - sequence_weight: 序列权重
        - paragraph_bias: 偏置向量(待向量化后计算)
        - global_position: 全局位置
        - prev_paragraph_id: 前一段落ID
        - next_paragraph_id: 后一段落ID
    """
    total_count = len(paragraphs)
    enhanced = []
    
    for idx, para in enumerate(paragraphs):
        # 1. 计算全局位置
        global_position = (idx + 1) / total_count
        
        # 2. 提取关键词和成语
        keywords = extract_keywords(para, topK=10)
        idioms = extract_idioms(para)
        
        # 3. 确定位置类型
        is_chapter_start = (idx == 0) or (chapter_indices and idx in chapter_indices)
        is_chapter_end = (idx == total_count - 1) or (
            chapter_indices and (idx + 1) in chapter_indices
        )
        
        # 4. 初始化序列权重
        sequence_weight = initialize_sequence_weight(
            para,
            position_type="chapter_start" if is_chapter_start else "normal",
            is_chapter_start=is_chapter_start,
            is_chapter_end=is_chapter_end
        )
        
        # 5. 情感强度估算(简化版,实际应调用classify_service)
        emotion_intensity = estimate_emotion_intensity(para)
        
        # 6. 初始化偏置向量
        paragraph_bias = initialize_paragraph_bias(
            para,
            global_position=global_position,
            emotion_intensity=emotion_intensity,
            keywords=keywords
        )
        
        # 7. 前后段落ID(占位符,入库时会生成实际ID)
        prev_id = f"para_{book_id}_{idx-1}" if idx > 0 else None
        next_id = f"para_{book_id}_{idx+1}" if idx < total_count - 1 else None
        
        # 8. 构建增强字典
        enhanced_para = {
            "content": para,
            "keywords": keywords,
            "idioms": idioms,
            "sequence_weight": float(sequence_weight),
            "paragraph_bias": paragraph_bias.tolist(),
            "global_position": float(global_position),
            "prev_paragraph_id": prev_id,
            "next_paragraph_id": next_id,
            "meta": {
                "is_chapter_start": is_chapter_start,
                "is_chapter_end": is_chapter_end,
                "emotion_intensity": float(emotion_intensity),
                "keywords": keywords,
                "idioms": idioms
            }
        }
        
        enhanced.append(enhanced_para)
    
    return enhanced


def estimate_emotion_intensity(text: str) -> float:
    """
    估算情感强度(简化版)
    
    返回0-1之间的值
    实际应用中应调用classify_service的情感分析
    """
    # 情感词典(简化)
    positive_words = ['好', '喜欢', '高兴', '快乐', '开心', '幸福', '满意', '激动', '兴奋']
    negative_words = ['不好', '讨厌', '难过', '悲伤', '痛苦', '失望', '愤怒', '害怕', '恐惧']
    
    pos_count = sum(1 for word in positive_words if word in text)
    neg_count = sum(1 for word in negative_words if word in text)
    
    total_count = pos_count + neg_count
    if total_count == 0:
        return 0.5  # 中性
    
    # 0.5为中性,>0.5为积极,<0.5为消极
    intensity = (pos_count + 0.5 * neg_count) / (total_count + 1)
    return max(0.0, min(1.0, intensity))


def compute_enhanced_embedding(
    original_embedding: List[float],
    sequence_weight: float,
    paragraph_bias: List[float]
) -> List[float]:
    """
    计算增强向量
    
    公式: enhanced = original × weight + bias
    
    Args:
        original_embedding: 原始嵌入向量(1536维)
        sequence_weight: 序列权重(标量)
        paragraph_bias: 偏置向量(1536维)
    
    Returns:
        增强向量(1536维)
    """
    original = np.array(original_embedding)
    bias = np.array(paragraph_bias)
    
    enhanced = original * sequence_weight + bias
    
    return enhanced.tolist()
"""
段落增强器 - 为轻量级神经替代网络添加参数初始化
功能:
1. 关键词提取(jieba分词)
2. 成语检测
3. 序列索引分配
4. 权重/偏置初始化
5. 前后段落关联
"""

import re
import jieba
import jieba.analyse
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

# 常见成语库(前100个高频成语)
COMMON_IDIOMS = [
    '一心一意', '一马当先', '一鸣惊人', '一无所有', '一帆风顺', 
    '一箭双雕', '三心二意', '三思而行', '不可思议', '不由自主',
    '不言而喻', '不屈不挠', '不约而同', '不胫而走', '不择手段',
    '东张西望', '丰功伟绩', '井井有条', '争先恐后', '亡羊补牢',
    '人山人海', '人心所向', '人才济济', '人杰地灵', '今非昔比',
    '仗义执言', '众志成城', '全神贯注', '出人头地', '刻舟求剑',
    '刻不容缓', '前车之鉴', '千载难逢', '南辕北辙', '卧薪尝胆',
    '危在旦夕', '厉兵秣马', '叶公好龙', '同仇敌忾', '呼风唤雨',
    '四面楚歌', '因祸得福', '图穷匕见', '坚持不懈', '声东击西',
    '天衣无缝', '守株待兔', '对牛弹琴', '左右为难', '开诚布公',
    '异曲同工', '当机立断', '心照不宣', '志同道合', '惊心动魄',
    '惨无人道', '愚公移山', '截然不同', '手忙脚乱', '扬眉吐气',
    '投桃报李', '拔苗助长', '振奋人心', '掩耳盗铃', '改过自新',
    '旁若无人', '无可奈何', '无动于衷', '日新月异', '明察秋毫',
    '星罗棋布', '春暖花开', '晴天霹雳', '暗无天日', '曲突徙薪',
    '望尘莫及', '朝三暮四', '杞人忧天', '栩栩如生', '欣欣向荣',
    '欢天喜地', '水深火热', '水落石出', '沧海一粟', '浑水摸鱼',
    '海底捞针', '漫不经心', '火上浇油', '炉火纯青', '画蛇添足',
    '疲于奔命', '盛气凌人', '目瞪口呆', '相得益彰', '破釜沉舟',
    '磨杵成针', '神机妙算', '稳操胜券', '空前绝后', '空穴来风',
]

# 编译成语正则(高效匹配)
IDIOM_PATTERN = re.compile('|'.join(COMMON_IDIOMS))


def extract_keywords(text: str, topK: int = 10) -> List[str]:
    """
    提取文本关键词
    
    Args:
        text: 输入文本
        topK: 返回前K个关键词
    
    Returns:
        关键词列表
    """
    try:
        # 使用jieba的TF-IDF关键词提取
        keywords = jieba.analyse.extract_tags(text, topK=topK, withWeight=False)
        # 过滤单字和停用词
        filtered = [kw for kw in keywords if len(kw) > 1]
        return filtered[:topK]
    except Exception as e:
        print(f"关键词提取失败: {e}")
        return []


def extract_idioms(text: str) -> List[str]:
    """
    提取文本中的成语
    
    Args:
        text: 输入文本
    
    Returns:
        成语列表(去重)
    """
    try:
        # 使用正则匹配
        found = IDIOM_PATTERN.findall(text)
        # 去重但保持顺序
        seen = set()
        unique_idioms = []
        for idiom in found:
            if idiom not in seen:
                unique_idioms.append(idiom)
                seen.add(idiom)
        return unique_idioms
    except Exception as e:
        print(f"成语提取失败: {e}")
        return []


def initialize_sequence_weight(
    paragraph: str,
    position_type: str = "normal",
    is_chapter_start: bool = False,
    is_chapter_end: bool = False
) -> float:
    """
    初始化序列权重(基于段落特征)
    
    Args:
        paragraph: 段落文本
        position_type: 位置类型
        is_chapter_start: 是否章节开头
        is_chapter_end: 是否章节结尾
    
    Returns:
        序列权重(范围: 0.5-2.0)
    """
    weight = 1.0  # 默认权重
    
    # 章节开头/结尾权重较高
    if is_chapter_start or is_chapter_end:
        weight = 1.5
    
    # 检测情节转折关键词
    turning_keywords = ['突然', '忽然', '然而', '但是', '可是', '不料', '谁知', '岂料']
    if any(keyword in paragraph for keyword in turning_keywords):
        weight = 1.3
    
    # 检测对话(权重略低,因为对话通常是辅助性内容)
    if paragraph.count('"') >= 2 or paragraph.count('"') >= 2:
        weight = 0.9
    
    # 检测描写密度(长段描写权重中等)
    if len(paragraph) > 300:
        weight = max(weight, 1.1)
    
    # 确保权重在合理范围内
    return max(0.5, min(2.0, weight))


def initialize_paragraph_bias(
    paragraph: str,
    global_position: float,
    emotion_intensity: float = 0.5,
    keywords: List[str] = None,
    embedding_dim: int = 1536
) -> np.ndarray:
    """
    初始化段落偏置向量(1536维)
    
    分维度初始化:
    - 前512维: 情感特征
    - 512-1024维: 结构特征
    - 1024-1536维: 语义特征
    
    Args:
        paragraph: 段落文本
        global_position: 全局位置(0-1)
        emotion_intensity: 情感强度(0-1)
        keywords: 关键词列表
        embedding_dim: 嵌入维度
    
    Returns:
        偏置向量(numpy数组)
    """
    bias = np.zeros(embedding_dim)
    
    # 维度1: 情感特征(前512维)
    # 情感强度映射到偏置值
    bias[:512] = (emotion_intensity - 0.5) * 0.3  # [-0.15, 0.15]
    
    # 维度2: 结构特征(512-1024维)
    # 位置编码:使用正弦/余弦函数
    position_encoding = []
    for i in range(512):
        if i % 2 == 0:
            position_encoding.append(np.sin(global_position * np.pi))
        else:
            position_encoding.append(np.cos(global_position * np.pi))
    bias[512:1024] = np.array(position_encoding) * 0.2  # [-0.2, 0.2]
    
    # 维度3: 语义特征(1024-1536维)
    # 关键词散列到维度空间
    if keywords:
        keyword_hash = []
        for kw in keywords[:10]:  # 最多10个关键词
            # 简单散列:字符ASCII和的正弦值
            hash_val = sum(ord(c) for c in kw)
            keyword_hash.append(np.sin(hash_val) * 0.1)
        # 填充到512维
        keyword_hash.extend([0.0] * (512 - len(keyword_hash)))
        bias[1024:] = np.array(keyword_hash[:512])
    
    # 限制偏置范围[-0.5, 0.5]
    bias = np.clip(bias, -0.5, 0.5)
    
    return bias


def enhance_paragraphs_with_neural_params(
    paragraphs: List[str],
    book_id: str,
    chapter_indices: List[int] = None
) -> List[Dict[str, Any]]:
    """
    为段落列表添加神经网络参数
    
    Args:
        paragraphs: 段落文本列表
        book_id: 书籍ID
        chapter_indices: 章节索引列表(可选)
    
    Returns:
        增强后的段落字典列表,包含:
        - keywords: 关键词数组
        - idioms: 成语数组
        - sequence_weight: 序列权重
        - paragraph_bias: 偏置向量(待向量化后计算)
        - global_position: 全局位置
        - prev_paragraph_id: 前一段落ID
        - next_paragraph_id: 后一段落ID
    """
    total_count = len(paragraphs)
    enhanced = []
    
    for idx, para in enumerate(paragraphs):
        # 1. 计算全局位置
        global_position = (idx + 1) / total_count
        
        # 2. 提取关键词和成语
        keywords = extract_keywords(para, topK=10)
        idioms = extract_idioms(para)
        
        # 3. 确定位置类型
        is_chapter_start = (idx == 0) or (chapter_indices and idx in chapter_indices)
        is_chapter_end = (idx == total_count - 1) or (
            chapter_indices and (idx + 1) in chapter_indices
        )
        
        # 4. 初始化序列权重
        sequence_weight = initialize_sequence_weight(
            para,
            position_type="chapter_start" if is_chapter_start else "normal",
            is_chapter_start=is_chapter_start,
            is_chapter_end=is_chapter_end
        )
        
        # 5. 情感强度估算(简化版,实际应调用classify_service)
        emotion_intensity = estimate_emotion_intensity(para)
        
        # 6. 初始化偏置向量
        paragraph_bias = initialize_paragraph_bias(
            para,
            global_position=global_position,
            emotion_intensity=emotion_intensity,
            keywords=keywords
        )
        
        # 7. 前后段落ID(占位符,入库时会生成实际ID)
        prev_id = f"para_{book_id}_{idx-1}" if idx > 0 else None
        next_id = f"para_{book_id}_{idx+1}" if idx < total_count - 1 else None
        
        # 8. 构建增强字典
        enhanced_para = {
            "content": para,
            "keywords": keywords,
            "idioms": idioms,
            "sequence_weight": float(sequence_weight),
            "paragraph_bias": paragraph_bias.tolist(),
            "global_position": float(global_position),
            "prev_paragraph_id": prev_id,
            "next_paragraph_id": next_id,
            "meta": {
                "is_chapter_start": is_chapter_start,
                "is_chapter_end": is_chapter_end,
                "emotion_intensity": float(emotion_intensity),
                "keywords": keywords,
                "idioms": idioms
            }
        }
        
        enhanced.append(enhanced_para)
    
    return enhanced


def estimate_emotion_intensity(text: str) -> float:
    """
    估算情感强度(简化版)
    
    返回0-1之间的值
    实际应用中应调用classify_service的情感分析
    """
    # 情感词典(简化)
    positive_words = ['好', '喜欢', '高兴', '快乐', '开心', '幸福', '满意', '激动', '兴奋']
    negative_words = ['不好', '讨厌', '难过', '悲伤', '痛苦', '失望', '愤怒', '害怕', '恐惧']
    
    pos_count = sum(1 for word in positive_words if word in text)
    neg_count = sum(1 for word in negative_words if word in text)
    
    total_count = pos_count + neg_count
    if total_count == 0:
        return 0.5  # 中性
    
    # 0.5为中性,>0.5为积极,<0.5为消极
    intensity = (pos_count + 0.5 * neg_count) / (total_count + 1)
    return max(0.0, min(1.0, intensity))


def compute_enhanced_embedding(
    original_embedding: List[float],
    sequence_weight: float,
    paragraph_bias: List[float]
) -> List[float]:
    """
    计算增强向量
    
    公式: enhanced = original × weight + bias
    
    Args:
        original_embedding: 原始嵌入向量(1536维)
        sequence_weight: 序列权重(标量)
        paragraph_bias: 偏置向量(1536维)
    
    Returns:
        增强向量(1536维)
    """
    original = np.array(original_embedding)
    bias = np.array(paragraph_bias)
    
    enhanced = original * sequence_weight + bias
    
    return enhanced.tolist()
