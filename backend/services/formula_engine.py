"""公式解析与评估引擎
目标:将 DSL/JSON 公式解析为检索计划,并从段落向量库检索与拼接

公式示例(推荐JSON):
{
  "query": "主角与反派初次相遇的紧张场景",
  "top_k": 8,
  "threshold": 0.75,
  "order": "similarity_desc",
  "meta_filters": {"role": ["主角", "反派"], "emotion": ["紧张"]}
}

最小DSL示例(行内):
QUERY: 主角与反派初次相遇的紧张场景
TAKE: 8
THRESHOLD: 0.75
ORDER: similarity_desc
FILTER: role=主角,反派; emotion=紧张
"""

import json
import re
import asyncio
import time
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional

from services.ai_service import AIService
from services.db_service import get_db_service
from services.json_repairer import repair_and_load


@dataclass
class FormulaPlan:
    query: Optional[str] = None
    top_k: int = 10
    threshold: float = 0.7
    order: str = "similarity_desc"  # similarity_desc / similarity_asc
    meta_filters: Dict[str, List[str]] = field(default_factory=dict)
    book_id: Optional[str] = None
    # ComRAG 质心式记忆机制扩展字段
    comrag_mode: str = "retrieve_high"  # retrieve_high | generate_with_high | generate_excluding_low
    update_memory: bool = True  # 是否在流结束时更新记忆库
    quality_threshold: float = 0.7  # LLM评分阈值,>=阈值入高质量库,否则入低质量库
    static_kb: bool = True  # 是否融合静态知识段落库


def parse_formula(expression: str) -> FormulaPlan:
    """解析公式文本到计划
    - 优先解析JSON(使用json-repair自动补全缺失字段)
    - 失败则按简易DSL解析
    """
    from services.json_repairer import repair_and_load
    expression = expression.strip()
    # JSON优先(使用json-repair修复)
    if expression.startswith("{") or expression.startswith("["):
        try:
            obj = repair_and_load(expression)
            return FormulaPlan(
                query=obj.get("query"),
                top_k=int(obj.get("top_k", 10)),
                threshold=float(obj.get("threshold", 0.7)),
                order=str(obj.get("order", "similarity_desc")),
                meta_filters=obj.get("meta_filters", {}),
                book_id=obj.get("book_id"),
                # ComRAG扩展字段
                comrag_mode=str(obj.get("comrag_mode", "retrieve_high")),
                update_memory=bool(obj.get("update_memory", True)),
                quality_threshold=float(obj.get("quality_threshold", 0.7)),
                static_kb=bool(obj.get("static_kb", True))
            )
        except Exception:
            pass
    # 简易DSL解析
    plan = FormulaPlan()
    for line in expression.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"(?i)^QUERY:\s*(.+)$", line)
        if m:
            plan.query = m.group(1).strip()
            continue
        m = re.match(r"(?i)^TAKE:\s*(\d+)$", line)
        if m:
            plan.top_k = int(m.group(1))
            continue
        m = re.match(r"(?i)^THRESHOLD:\s*([0-9.]+)$", line)
        if m:
            plan.threshold = float(m.group(1))
            continue
        m = re.match(r"(?i)^ORDER:\s*(\w+)$", line)
        if m:
            plan.order = m.group(1)
            continue
        m = re.match(r"(?i)^FILTER:\s*(.+)$", line)
        if m:
            filters_str = m.group(1)
            # role=主角,反派; emotion=紧张
            for part in filters_str.split(";"):
                part = part.strip()
                if not part:
                    continue
                if "=" in part:
                    k, v = part.split("=", 1)
                    plan.meta_filters[k.strip()] = [x.strip() for x in v.split(",") if x.strip()]
    return plan


async def evaluate_formula(plan: FormulaPlan, supplemental_query: Optional[str] = None) -> List[Dict[str, Any]]:
    """Execute retrieval plan and return paragraph results
    - Uses query or supplemental_query to generate query vector
    - Calls ComRAG mode to retrieve from independent memory_high/memory_low tables
    - Filters by meta_filters with enhanced matching logic
    - Orders by similarity (default desc)
    - Performance optimization: coarse filtering + batch query merge
    """
    query_text = supplemental_query or plan.query or ""
    if not query_text:
        return []

    async with AIService() as ai:
        vecs = await ai.get_embeddings([query_text], model_id="text-embedding-3-small")
        query_vec = vecs[0]

    # Import ComRAG service for independent memory table access
    from services.comrag_service import search_memory_by_vector
    
    # ComRAG mode branches (using independent memory tables)
    results = []
    if plan.comrag_mode == "retrieve_high":
        # Retrieve from high-quality memory table only
        results = await search_memory_by_vector(
            query_embedding=query_vec,
            memory_type="high",
            limit=plan.top_k * 2,
            threshold=plan.threshold
        )
        results = results[:plan.top_k]
    elif plan.comrag_mode == "generate_with_high":
        # Combine high-quality memory + static knowledge (paragraphs)
        high_results = await search_memory_by_vector(
            query_embedding=query_vec,
            memory_type="high",
            limit=plan.top_k * 2,
            threshold=plan.threshold
        )
        if plan.static_kb:
            # Also query from paragraphs table for static knowledge
            db = await get_db_service()
            static_results = await db.vector_search_paragraphs(
                query_vec,
                limit=plan.top_k,
                threshold=plan.threshold,
                book_id=plan.book_id
            )
            results = high_results + static_results
        else:
            results = high_results
        results = results[:plan.top_k]
    elif plan.comrag_mode == "generate_excluding_low":
        # Retrieve from high + static, exclude low-quality memory
        high_results = await search_memory_by_vector(
            query_embedding=query_vec,
            memory_type="high",
            limit=plan.top_k,
            threshold=plan.threshold
        )
        db = await get_db_service()
        static_results = await db.vector_search_paragraphs(
            query_vec,
            limit=plan.top_k,
            threshold=plan.threshold,
            book_id=plan.book_id
        )
        results = high_results + static_results
        results = results[:plan.top_k]
    else:
        # Fallback to original paragraphs table logic
        db = await get_db_service()
        results = await db.vector_search_paragraphs(
            query_vec,
            limit=plan.top_k,
            threshold=plan.threshold,
            book_id=plan.book_id
        )

    # Meta filter enhancement
    def _match(meta: Dict[str, Any], key: str, expected: List[str]) -> bool:
        try:
            val = meta.get(key)
            expected_str = [str(v) for v in expected]
            if val is None:
                # Fallback: match in labels
                labels = meta.get("labels") or []
                if isinstance(labels, list):
                    return any(v in [str(x) for x in labels] for v in expected_str)
                return False
            if isinstance(val, list):
                return any(v in [str(x) for x in val] for v in expected_str)
            if isinstance(val, bool):
                return str(val).lower() in [v.lower() for v in expected_str]
            return str(val) in expected_str
        except Exception:
            return False

    if plan.meta_filters:
        filtered = []
        for r in results:
            meta = r.get("meta", {}) or {}
            ok = True
            for k, values in plan.meta_filters.items():
                if values and not _match(meta, k, values):
                    ok = False
                    break
            if ok:
                filtered.append(r)
        results = filtered

    # Sorting
    if plan.order == "similarity_asc":
        results.sort(key=lambda x: x.get("similarity", 0.0))
    else:
        results.sort(key=lambda x: x.get("similarity", 0.0), reverse=True)

    return results


async def score_answer(answer: str, contexts: List[str], model_id: str = "gpt-3.5-turbo") -> float:
    """使用LLM对生成的答案进行评分(0-1)
    - 评估维度:正确性、可解释性、上下文一致性
    - 使用 json-repair 修复返回结果
    """
    contexts_str = "\n".join([f"{i+1}. {ctx[:200]}..." for i, ctx in enumerate(contexts[:3])])  # 限制上下文长度
    prompt = (
        "你是AI质量评估器.请对以下生成的小说片段进行0-1评分,评估维度:\n"
        "1. 正确性:是否符合上下文逻辑\n"
        "2. 可解释性:语言是否流畅、连贯\n"
        "3. 上下文一致性:与参考上下文的匹配度\n\n"
        f"参考上下文:\n{contexts_str}\n\n"
        f"生成片段:\n{answer[:500]}\n\n"
        "请仅返回JSON格式: {\"score\": 0.85, \"reason\": \"简短评价\"}\n"
        "不要包含任何其他文字."
    )
    
    try:
        async with AIService() as ai:
            resp = await ai.run_agent(prompt, model_id=model_id, parameters={"temperature": 0.2, "max_tokens": 150})
            obj = repair_and_load(resp)  # 使用json-repair自动修复
            score = float(obj.get("score", 0.5))
            # 限制0-1范围
            return max(0.0, min(1.0, score))
    except Exception:
        # 评分失败返回中间值
        return 0.5


async def update_memory_quality(paragraph: str, embedding: List[float], quality: str, meta: Dict[str, Any]) -> bool:
    """Update memory quality using independent ComRAG memory tables
    - Calls comrag_service.insert_memory to store in memory_high/memory_low
    - Uses multidimensional quality scoring
    """
    try:
        from services.comrag_service import insert_memory, calculate_multidimensional_quality, QualityScore
        
        # Calculate quality score
        llm_score = 0.8 if quality == "high" else 0.4
        quality_score = calculate_multidimensional_quality(
            llm_score=llm_score,
            likes=0,
            dislikes=0,
            usage_count=0,
            centroid_distance=0.0
        )
        
        # Store in independent memory tables
        meta["source"] = meta.get("source", "formula_generation")
        meta["updated_at"] = str(time.time())
        
        memory_id = await insert_memory(
            content=paragraph,
            embedding=embedding,
            quality_score=quality_score,
            meta=meta,
            source_paragraph_ids=[]
        )
        
        return memory_id > 0
    except Exception:
        return False

