"""AI公式生成助手
功能:将自然语言转换为JSON公式
示例:
输入: "我想写一个protagonist在雪夜独自修炼的场景"
输出: {"query": "雪夜独自修炼的孤独场景", "meta_filters": {"environment": ["雪夜"], "emotion": ["孤独", "专注"]}, "top_k": 5}
"""

import json
import re
from typing import Dict, Any, Optional

from services.ai_service import AIService
from services.json_repairer import repair_and_load


FORMULA_GENERATION_PROMPT = """你是小说创作公式生成专家。用户会用自然语言描述想要的情节,你需要生成JSON公式。

公式结构:
{
  "query": "核心查询文本",
  "top_k": 段落数量(5-20),
  "threshold": 相似度阈值(0.6-0.9),
  "meta_filters": {
    "category": ["对话", "描写", "剧情", "战斗"等],
    "emotion": ["愤怒", "悲伤", "欢快", "紧张"等],
    "scene": ["夜晚", "竹林", "雪景"等],
    "role": ["protagonist", "villain", "配角"等]
  },
  "comrag_mode": "retrieve_high" 或 "generate_with_high"
}

提取规则:
1. 从用户描述中提取核心动作/场景作为query
2. 识别情感词汇填入emotion
3. 识别环境/时间填入scene
4. 识别角色填入role
5. 识别文学类型填入category

用户输入: {user_input}

只返回JSON格式的公式,不要任何其他文字。"""


async def generate_formula_from_natural_language(
    user_input: str,
    model_id: str = "gpt-3.5-turbo"
) -> Dict[str, Any]:
    """从自然语言生成JSON公式
    
    Args:
        user_input: 用户输入的自然语言描述
        model_id: 使用的LLM模型
    
    Returns:
        JSON公式字典
    """
    prompt = FORMULA_GENERATION_PROMPT.format(user_input=user_input)
    
    try:
        async with AIService() as ai:
            resp = await ai.run_agent(
                prompt,
                model_id=model_id,
                parameters={"temperature": 0.3, "max_tokens": 300}
            )
            
            # 使用json-repair修复可能的格式错误
            formula = repair_and_load(resp)
            
            # 验证和补全必要字段
            formula.setdefault("query", user_input)
            formula.setdefault("top_k", 10)
            formula.setdefault("threshold", 0.7)
            formula.setdefault("meta_filters", {})
            formula.setdefault("comrag_mode", "retrieve_high")
            
            return formula
    except Exception as e:
        # 失败时返回基础公式
        return {
            "query": user_input,
            "top_k": 10,
            "threshold": 0.7,
            "meta_filters": {},
            "comrag_mode": "retrieve_high"
        }


def extract_keywords_from_text(text: str) -> Dict[str, Any]:
    """从文本中提取关键词(作为AI生成的备选方案)
    
    Args:
        text: 输入文本
    
    Returns:
        提取的关键词字典
    """
    meta_filters = {}
    
    # 情感词典
    emotion_keywords = {
        "愤怒": ["愤怒", "生气", "暴怒", "恼火"],
        "悲伤": ["悲伤", "难过", "哀伤", "忧伤"],
        "欢快": ["欢快", "开心", "高兴", "愉快"],
        "紧张": ["紧张", "焦虑", "不安", "担心"],
        "孤独": ["孤独", "寂寞", "孤单"],
        "决心": ["决心", "坚定", "果断"],
        "恐惧": ["恐惧", "害怕", "惊恐"]
    }
    
    # 场景词典
    scene_keywords = {
        "夜晚": ["夜晚", "深夜", "夜色", "月夜"],
        "雪景": ["雪", "雪夜", "雪落", "飘雪"],
        "竹林": ["竹林", "竹海", "竹影"],
        "江湖": ["江湖", "武林", "江湖"],
        "秘境": ["秘境", "秘地", "洞府"]
    }
    
    # 检测情感
    detected_emotions = []
    for emotion, keywords in emotion_keywords.items():
        if any(kw in text for kw in keywords):
            detected_emotions.append(emotion)
    
    if detected_emotions:
        meta_filters["emotion"] = detected_emotions
    
    # 检测场景
    detected_scenes = []
    for scene, keywords in scene_keywords.items():
        if any(kw in text for kw in keywords):
            detected_scenes.append(scene)
    
    if detected_scenes:
        meta_filters["scene"] = detected_scenes
    
    # 检测角色
    if "protagonist" in text or "我" in text:
        meta_filters.setdefault("role", []).append("protagonist")
    if "反派" in text or "敌人" in text:
        meta_filters.setdefault("role", []).append("反派")
    
    # 检测文学类型
    if any(kw in text for kw in ["对话", "说", "道", "问", "答"]):
        meta_filters.setdefault("category", []).append("对话")
    if any(kw in text for kw in ["描写", "风景", "环境", "外貌"]):
        meta_filters.setdefault("category", []).append("描写")
    if any(kw in text for kw in ["战斗", "打斗", "厮杀"]):
        meta_filters.setdefault("category", []).append("战斗")
    
    return meta_filters


async def enhance_formula_with_ai(
    base_formula: Dict[str, Any],
    user_input: str,
    model_id: str = "gpt-3.5-turbo"
) -> Dict[str, Any]:
    """使用AI增强现有公式
    
    Args:
        base_formula: 基础公式
        user_input: 用户原始输入
        model_id: LLM模型
    
    Returns:
        增强后的公式
    """
    # 提取关键词
    keywords = extract_keywords_from_text(user_input)
    
    # 尝试AI生成
    try:
        ai_formula = await generate_formula_from_natural_language(user_input, model_id)
        
        # 合并AI生成和关键词提取的结果
        enhanced_meta_filters = {**keywords, **ai_formula.get("meta_filters", {})}
        ai_formula["meta_filters"] = enhanced_meta_filters
        
        return ai_formula
    except Exception:
        # AI失败时使用关键词提取
        base_formula["meta_filters"] = keywords
        return base_formula
"""AI公式生成助手
功能:将自然语言转换为JSON公式
示例:
输入: "我想写一个protagonist在雪夜独自修炼的场景"
输出: {"query": "雪夜独自修炼的孤独场景", "meta_filters": {"environment": ["雪夜"], "emotion": ["孤独", "专注"]}, "top_k": 5}
"""

import json
import re
from typing import Dict, Any, Optional

from services.ai_service import AIService
from services.json_repairer import repair_and_load


FORMULA_GENERATION_PROMPT = """你是小说创作公式生成专家。用户会用自然语言描述想要的情节,你需要生成JSON公式。

公式结构:
{
  "query": "核心查询文本",
  "top_k": 段落数量(5-20),
  "threshold": 相似度阈值(0.6-0.9),
  "meta_filters": {
    "category": ["对话", "描写", "剧情", "战斗"等],
    "emotion": ["愤怒", "悲伤", "欢快", "紧张"等],
    "scene": ["夜晚", "竹林", "雪景"等],
    "role": ["protagonist", "反派", "配角"等]
  },
  "comrag_mode": "retrieve_high" 或 "generate_with_high"
}

提取规则:
1. 从用户描述中提取核心动作/场景作为query
2. 识别情感词汇填入emotion
3. 识别环境/时间填入scene
4. 识别角色填入role
5. 识别文学类型填入category

用户输入: {user_input}

只返回JSON格式的公式,不要任何其他文字。"""


async def generate_formula_from_natural_language(
    user_input: str,
    model_id: str = "gpt-3.5-turbo"
) -> Dict[str, Any]:
    """从自然语言生成JSON公式
    
    Args:
        user_input: 用户输入的自然语言描述
        model_id: 使用的LLM模型
    
    Returns:
        JSON公式字典
    """
    prompt = FORMULA_GENERATION_PROMPT.format(user_input=user_input)
    
    try:
        async with AIService() as ai:
            resp = await ai.run_agent(
                prompt,
                model_id=model_id,
                parameters={"temperature": 0.3, "max_tokens": 300}
            )
            
            # 使用json-repair修复可能的格式错误
            formula = repair_and_load(resp)
            
            # 验证和补全必要字段
            formula.setdefault("query", user_input)
            formula.setdefault("top_k", 10)
            formula.setdefault("threshold", 0.7)
            formula.setdefault("meta_filters", {})
            formula.setdefault("comrag_mode", "retrieve_high")
            
            return formula
    except Exception as e:
        # 失败时返回基础公式
        return {
            "query": user_input,
            "top_k": 10,
            "threshold": 0.7,
            "meta_filters": {},
            "comrag_mode": "retrieve_high"
        }


def extract_keywords_from_text(text: str) -> Dict[str, Any]:
    """从文本中提取关键词(作为AI生成的备选方案)
    
    Args:
        text: 输入文本
    
    Returns:
        提取的关键词字典
    """
    meta_filters = {}
    
    # 情感词典
    emotion_keywords = {
        "愤怒": ["愤怒", "生气", "暴怒", "恼火"],
        "悲伤": ["悲伤", "难过", "哀伤", "忧伤"],
        "欢快": ["欢快", "开心", "高兴", "愉快"],
        "紧张": ["紧张", "焦虑", "不安", "担心"],
        "孤独": ["孤独", "寂寞", "孤单"],
        "决心": ["决心", "坚定", "果断"],
        "恐惧": ["恐惧", "害怕", "惊恐"]
    }
    
    # 场景词典
    scene_keywords = {
        "夜晚": ["夜晚", "深夜", "夜色", "月夜"],
        "雪景": ["雪", "雪夜", "雪落", "飘雪"],
        "竹林": ["竹林", "竹海", "竹影"],
        "江湖": ["江湖", "武林", "江湖"],
        "秘境": ["秘境", "秘地", "洞府"]
    }
    
    # 检测情感
    detected_emotions = []
    for emotion, keywords in emotion_keywords.items():
        if any(kw in text for kw in keywords):
            detected_emotions.append(emotion)
    
    if detected_emotions:
        meta_filters["emotion"] = detected_emotions
    
    # 检测场景
    detected_scenes = []
    for scene, keywords in scene_keywords.items():
        if any(kw in text for kw in keywords):
            detected_scenes.append(scene)
    
    if detected_scenes:
        meta_filters["scene"] = detected_scenes
    
    # 检测角色
    if "protagonist" in text or "我" in text:
        meta_filters.setdefault("role", []).append("protagonist")
    if "反派" in text or "敌人" in text:
        meta_filters.setdefault("role", []).append("反派")
    
    # 检测文学类型
    if any(kw in text for kw in ["对话", "说", "道", "问", "答"]):
        meta_filters.setdefault("category", []).append("对话")
    if any(kw in text for kw in ["描写", "风景", "环境", "外貌"]):
        meta_filters.setdefault("category", []).append("描写")
    if any(kw in text for kw in ["战斗", "打斗", "厮杀"]):
        meta_filters.setdefault("category", []).append("战斗")
    
    return meta_filters


async def enhance_formula_with_ai(
    base_formula: Dict[str, Any],
    user_input: str,
    model_id: str = "gpt-3.5-turbo"
) -> Dict[str, Any]:
    """使用AI增强现有公式
    
    Args:
        base_formula: 基础公式
        user_input: 用户原始输入
        model_id: LLM模型
    
    Returns:
        增强后的公式
    """
    # 提取关键词
    keywords = extract_keywords_from_text(user_input)
    
    # 尝试AI生成
    try:
        ai_formula = await generate_formula_from_natural_language(user_input, model_id)
        
        # 合并AI生成和关键词提取的结果
        enhanced_meta_filters = {**keywords, **ai_formula.get("meta_filters", {})}
        ai_formula["meta_filters"] = enhanced_meta_filters
        
        return ai_formula
    except Exception:
        # AI失败时使用关键词提取
        base_formula["meta_filters"] = keywords
        return base_formula
