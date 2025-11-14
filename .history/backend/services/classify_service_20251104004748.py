"""
Paragraph Classification Service
Objective: Classify semantic paragraphs using literary writing dictionary, output unified meta field structure:
meta example:
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

Implementation Strategy:
- Lightweight built-in classification dictionary (extensible): LITERARY_DICTIONARY
- Call AIService.run_agent for classification prompts, return JSON; use json_repairer for fixes
- Concurrency control: Limit concurrency to avoid rate limiting

Follow simple_cache specification: Use lru_cache to cache dictionary
"""

import asyncio
from functools import lru_cache
from typing import List, Dict, Any, Optional

from services.ai_service import AIService
from services.json_repairer import repair_and_load


@lru_cache(maxsize=1)
def get_literary_dictionary() -> Dict[str, Any]:
    # Can be replaced with file loading implementation, basic template provided here
    return {
        "categories": {
            "dialogue": {
                "subcategories": ["chat", "dispute", "reveal information", "suspense"],
                "signals": ["\"", ":", "said", "asked", "answered"]
            },
            "description": {
                "subcategories": ["environment", "character", "action", "psychology", "details"],
                "signals": ["wind", "rain", "light", "quiet", "distant", "smile", "gaze", "thought"]
            },
            "plot": {
                "subcategories": ["foreshadowing", "conflict", "turning point", "climax", "ending"],
                "signals": ["however", "suddenly", "but", "finally", "so", "then", "meanwhile"]
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
        "You are a 'large language model level' literary writing classifier. Please perform hierarchical, multi-label classification and return only a JSON object without any additional text.\n"
        f"Main category(category) limited to: [{cats}]; Subcategory(subcategory) limited to: {subs_str}.\n"
        "Requirements:\n"
        "- labels is a multi-label array containing key features such as style/emotion/theme/scene;\n"
        "- isDialogue boolean;characters extract character names;emotion single word;style style;scene brief description;\n"
        "- Fields are fixed and must appear: {category, subcategory, labels, isDialogue, characters, emotion, style, scene};\n"
        "- Output must be valid JSON, cannot contain Chinese full-width quotes or extra explanations.\n"
        f"Paragraph:\n{paragraph}\n"
    )
    return prompt


async def classify_paragraphs(paragraphs: List[str], model_id: str = "gpt-3.5-turbo", concurrency: int = 6) -> List[Dict[str, Any]]:
    """Classify a list of paragraphs, return a meta list corresponding one-to-one with the input"""
    metas: List[Optional[Dict[str, Any]]] = [None] * len(paragraphs)

    async def worker(idx: int, text: str):
        try:
            async with AIService() as ai:
                prompt = build_classify_prompt(text)
                resp = await ai.run_agent(prompt, model_id=model_id, parameters={"temperature": 0.2, "max_tokens": 400})
                obj = repair_and_load(resp)
                # Compatible with field name case/spelling
                meta = {
                    "category": obj.get("category") or obj.get("category") or obj.get("Category"),
                    "subcategory": obj.get("subcategory") or obj.get("subcategory") or obj.get("Subcategory"),
                    "labels": obj.get("labels") or obj.get("keywords") or obj.get("Labels") or [],
                    "isDialogue": bool(obj.get("isDialogue") or obj.get("is_dialogue") or obj.get("dialogue")),
                    "characters": obj.get("characters") or obj.get("characters") or obj.get("Characters") or [],
                    "emotion": obj.get("emotion") or obj.get("emotion") or obj.get("Emotion") or "",
                    "style": obj.get("style") or obj.get("style") or obj.get("Style"),
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
  
      # Fill missing values
      return [m or {"category": None, "subcategory": None, "labels": [], "isDialogue": False} for m in metas]

