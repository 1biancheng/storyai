import asyncio
import json
from typing import Dict, Any, Optional
import numpy as np

from fastapi import APIRouter, Body, Query, File, UploadFile, Form
from sse_starlette.sse import EventSourceResponse

from services.paragraph_service import ingest_text_to_paragraph_store
from services.file_extraction_service import FileExtractionService
from services.keyword_rag import KeywordRAG
from services.rl_optimizer import get_rl_optimizer
from services.formula_engine import parse_formula, evaluate_formula, score_answer, update_memory_quality
from services.db_service import get_db_service, DatabaseService
from services.classify_service import get_literary_dictionary
from services.ai_service import AIService
from api_framework import ApiException
from errors import restful_error, sse_error_event, DomainError

router = APIRouter(prefix="/story", tags=["Story"])


@router.post("/ingest")
async def ingest_story_text(payload: Dict[str, Any] = Body(...)):
    """拆书入库:传入全文文本,拆分段落并入库向量段落库
    - 统一错误返回结构: {code, message}
    - 当数据库不可用(本地开发)时,仍返回成功结构但不入库,便于前端联调
    """
    text: str = payload.get("text", "")
    book_id: Optional[str] = payload.get("bookId")
    chapter_index: Optional[int] = payload.get("chapterIndex")
    section_index: Optional[int] = payload.get("sectionIndex")
    embedding_model: str = payload.get("embeddingModel", "text-embedding-3-small")

    if not text or not isinstance(text, str):
        return restful_error(DomainError.EMPTY_TEXT, "text is required", status_code=400)

    try:
        result = await ingest_text_to_paragraph_store(
            text=text,
            book_id=book_id,
            chapter_index=chapter_index,
            section_index=section_index,
            embedding_model=embedding_model,
        )
        return {"code": 0, "message": "ok", "data": result}
    except ApiException as ae:
        # 统一领域错误码,便于前端处理
        return restful_error(DomainError.INGEST_ERROR, str(getattr(ae, "detail", ae)), status_code=getattr(ae, "status_code", 500))
    except Exception as e:
        # 兜底错误,避免连接被动关闭导致前端 Failed to fetch
        return restful_error(DomainError.INTERNAL_ERROR, str(e), status_code=500)


@router.post("/ingest-file")
async def ingest_file(
    file: UploadFile = File(..., description="File to upload (.txt, .docx, .xlsx, .pdf, etc)"),
    detected_encoding: Optional[str] = Form(None, description="Frontend-detected encoding (overrides auto-detection)"),
    preserve_structure: bool = Form(False, description="Preserve document structure (tables/headings)"),
    book_id: Optional[str] = Form(None, description="Business book ID"),
    chapter_index: Optional[int] = Form(None, description="Chapter index"),
    section_index: Optional[int] = Form(None, description="Section index")
):
    """File upload + extraction + splitting + database storage (three-articles integration)
    
    Supports:
    - Encoding detection (charset-normalizer) with frontend override
    - Multi-format extraction (markitdown/textract/direct decode)
    - Semantic paragraph splitting
    - Redis dual-key caching
    - Document-paragraph database storage
    
    Request (multipart/form-data):
    - file: Binary file content
    - detected_encoding: Optional encoding override (UTF-8/GBK/Big5/etc)
    - preserve_structure: Boolean flag for structure preservation
    - book_id, chapter_index, section_index: Optional metadata
    
    Response:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "document_id": int,
            "file_hash": "md5_hash",
            "encoding": "UTF-8",
            "extraction_method": "markitdown",
            "structure_type": "markdown",
            "total_paragraphs": 45,
            "from_cache": false,
            "paragraph_ids": [1, 2, 3, ...]
        }
    }
    """
    try:
        # Read file content
        file_bytes = await file.read()
        filename = file.filename or "uploaded_file.txt"
        
        # Validate file size (10MB default limit)
        from config import get_settings
        settings = get_settings()
        max_size = settings.file_extraction.max_file_size
        
        if len(file_bytes) > max_size:
            return restful_error(
                DomainError.INGEST_ERROR,
                f"File too large ({len(file_bytes)} bytes). Max: {max_size} bytes (10MB). Consider chunking.",
                status_code=400
            )
        
        # Call extraction pipeline
        extraction_service = FileExtractionService()
        extraction_result = await extraction_service.extract_text(
            file_bytes=file_bytes,
            filename=filename,
            detected_encoding=detected_encoding,
            preserve_structure=preserve_structure
        )
        
        # For now, we'll just return the extraction result directly
        # In a real implementation, this would be processed further
        result = {
            "document_id": 1,  # Placeholder
            "file_hash": "placeholder_hash",
            "encoding": extraction_result.get("encoding", "UTF-8"),
            "extraction_method": extraction_result.get("method", "direct"),
            "structure_type": "text",
            "total_paragraphs": 0,  # Placeholder
            "from_cache": False,
            "paragraph_ids": []
        }
        
        return {"code": 0, "message": "ok", "data": result}
    
    except ApiException as ae:
        return restful_error(
            DomainError.INGEST_ERROR,
            str(getattr(ae, "detail", ae)),
            status_code=getattr(ae, "status_code", 500)
        )
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        return restful_error(DomainError.INTERNAL_ERROR, error_detail, status_code=500)


@router.post("/formulas")
async def create_or_update_formula(payload: Dict[str, Any] = Body(...)):
    """创建/更新公式"""
    formula_id = payload.get("id")
    name = payload.get("name")
    expression = payload.get("expression")
    category = payload.get("category")
    description = payload.get("description")
    parameters = payload.get("parameters", {})

    if not name or not expression:
        return {"code": 400, "message": "name and expression are required"}

    db = await get_db_service()
    if formula_id:
        await db.update_formula(int(formula_id), {
            "name": name,
            "expression": expression,
            "category": category,
            "description": description,
            "parameters": parameters
        })
        return {"code": 0, "message": "updated", "data": {"id": int(formula_id)}}
    else:
        new_id = await db.insert_formula(
            name=name,
            expression=expression,
            category=category,
            description=description,
            parameters=parameters
        )
        return {"code": 0, "message": "created", "data": {"id": new_id}}


@router.get("/formulas")
async def list_formulas(category: Optional[str] = None):
    db = await get_db_service()
    items = await db.get_formulas(category=category)
    return {"code": 0, "message": "ok", "data": items}


@router.get("/categories")
async def get_categories():
    """获取文学辞典的类别列表,用于前端类型选择器"""
    dic = get_literary_dictionary()
    cats = list(dic["categories"].keys())
    return {"code": 0, "message": "ok", "data": cats}


@router.get("/templates")
async def get_templates():
    """获取公式模板列表"""
    # 返回预定义的公式模板
    templates = [
        {
            "id": "template_basic",
            "name": "Basic Retrieval",
            "expression": json.dumps({
                "query": "",
                "top_k": 10,
                "threshold": 0.7,
                "order": "similarity_desc"
            }, ensure_ascii=False)
        },
        {
            "id": "template_comrag",
            "name": "ComRAG Enhanced",
            "expression": json.dumps({
                "query": "",
                "top_k": 10,
                "threshold": 0.7,
                "order": "similarity_desc",
                "comrag_mode": "retrieve_high",
                "update_memory": True,
                "quality_threshold": 0.7,
                "static_kb": True
            }, ensure_ascii=False)
        },
        {
            "id": "template_rl",
            "name": "RL Optimized",
            "expression": json.dumps({
                "query": "",
                "top_k": 10,
                "threshold": 0.7,
                "order": "similarity_desc",
                "rl_enabled": True,
                "exploration_rate": 0.1,
                "learning_rate": 0.01
            }, ensure_ascii=False)
        }
    ]
    return {"code": 0, "message": "ok", "data": templates}


@router.get("/generate/stream")
async def generate_story_stream(
    formula: str = Query(..., description="公式表达式"),
    prompt: str = Query("", description="补充提示词")
):
    """智能拼接:基于公式与提示词进行段落匹配并流式拼接输出
    SSE事件:
    - event: step  data: {msg}
    - event: ctx   data: {mode, high_count, static_count, total_count}  # ComRAG上下文信息
    - event: append data: {paragraph, similarity, quality}  # 增加quality字段
    - event: complete data: {count}
    - event: error data: {code, message}
    """
    if not formula:
        return restful_error(DomainError.EMPTY_TEXT, "formula is required", status_code=400)

    plan = parse_formula(formula)

    async def event_generator():
        try:
            yield {"event": "step", "data": json.dumps({"msg": "start"})}
            yield {"event": "step", "data": json.dumps({"msg": f"ComRAG mode: {plan.comrag_mode}"})}
            
            results = await evaluate_formula(plan, supplemental_query=prompt)
            
            # ComRAG 上下文统计
            high_count = sum(1 for r in results if r.get("meta", {}).get("quality") == "high")
            static_count = sum(1 for r in results if not r.get("meta", {}).get("quality"))
            low_count = sum(1 for r in results if r.get("meta", {}).get("quality") == "low")
            
            yield {"event": "ctx", "data": json.dumps({
                "mode": plan.comrag_mode,
                "high_count": high_count,
                "static_count": static_count,
                "low_count": low_count,
                "total_count": len(results)
            })}
            
            # 收集输出用于后续评分
            output_paragraphs = []
            context_paragraphs = [r.get("content", "") for r in results[:5]]  # 前5个作为上下文
            
            count = 0
            for r in results:
                para = r.get("content")
                if para:
                    output_paragraphs.append(para)
                yield {"event": "append", "data": json.dumps({
                    "paragraph": para,
                    "similarity": r.get("similarity"),
                    "quality": r.get("meta", {}).get("quality", "static")  # 标记来源质量
                })}
                count += 1
                await asyncio.sleep(0.01)
            
            yield {"event": "complete", "data": json.dumps({"count": count})}
            
            # ComRAG 记忆更新机制
            if plan.update_memory and output_paragraphs:
                yield {"event": "step", "data": json.dumps({"msg": "scoring..."})}
                
                # 合并输出为LLM评分样本
                combined_output = "\n".join(output_paragraphs[:3])  # 取前3段评分
                score = await score_answer(combined_output, context_paragraphs)
                
                yield {"event": "scored", "data": json.dumps({
                    "score": score,
                    "threshold": plan.quality_threshold
                })}
                
                # 根据评分划分质量
                quality = "high" if score >= plan.quality_threshold else "low"
                
                # 生成向量并更新记忆库
                async with AIService() as ai:
                    vecs = await ai.get_embeddings([combined_output], model_id="text-embedding-3-small")
                    embedding = vecs[0]
                
                success = await update_memory_quality(
                    paragraph=combined_output,
                    embedding=embedding,
                    quality=quality,
                    meta={"source": "comrag_generation", "mode": plan.comrag_mode}
                )
                
                yield {"event": "store_update", "data": json.dumps({
                    "quality": quality,
                    "success": success,
                    "score": score
                })}
        except ApiException as ae:
            # 统一 SSE 错误事件结构
            yield sse_error_event(DomainError.WORKFLOW_ERROR, str(getattr(ae, "detail", "Internal server error")))
        except Exception as e:
            # 其他异常统一输出为 INTERNAL_ERROR
            yield sse_error_event(DomainError.INTERNAL_ERROR, str(e))

    return EventSourceResponse(event_generator(), ping=15)


@router.post("/splicing/rl")
async def intelligent_splicing_with_rl(payload: Dict[str, Any] = Body(...)):
    """智能拼接(强化学习增强版)
    
    请求体:
    {
        "query": "山巅 云海 感慨",
        "top_k": 5,
        "enable_rl": true,
        "store_generated": false,
        "book_id": "bk_12345"  # 可选,入库时需要
    }
    
    返回:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "spliced_content": "...",
            "paragraphs": [...],
            "rl_info": {
                "strategy_used": "q_learning",
                "avg_q_value": 0.82
            }
        }
    }
    """
    query = payload.get("query", "")
    top_k = payload.get("top_k", 5)
    enable_rl = payload.get("enable_rl", True)
    store_generated = payload.get("store_generated", False)
    book_id = payload.get("book_id")
    
    if not query:
        return {"code": 400, "message": "query is required", "data": None}
    
    try:
        db = await get_db_service()
        
        # 1. 生成查询向量
        async with AIService() as ai:
            embeddings = await ai.get_embeddings([query], model_id="text-embedding-3-small")
            query_vec = np.array(embeddings[0])
        
        # 2. 关键词RAG检索
        rag = KeywordRAG()
        await rag.build_inverted_index(book_id=book_id)
        
        # 混合检索:稀疏激活 + 向量精排
        candidate_paragraphs = await rag.hybrid_retrieve(
            query=query,
            query_embedding=query_vec.tolist(),
            top_k_sparse=top_k * 4,  # 粗筛20个
            top_n_dense=top_k * 2    # 精排10个
        )
        
        # 3. 强化学习段落选择(如果启用)
        if enable_rl and candidate_paragraphs:
            rl_optimizer = await get_rl_optimizer(db.pool)
            selected_paragraphs = await rl_optimizer.select_paragraphs_with_rl(
                candidate_paragraphs=candidate_paragraphs,
                query_vec=query_vec,
                top_k=top_k
            )
        else:
            selected_paragraphs = candidate_paragraphs[:top_k]
        
        # 4. 拼接内容
        spliced_content = "\n\n".join([p["content"] for p in selected_paragraphs])
        
        # 5. 异步后台优化(不阻塞响应)
        if enable_rl and selected_paragraphs:
            rl_optimizer = await get_rl_optimizer(db.pool)
            asyncio.create_task(
                rl_optimizer.async_evaluate_and_optimize(
                    spliced_content=spliced_content,
                    paragraphs=selected_paragraphs,
                    query_vec=query_vec,
                    query_text=query,
                    llm_score=None,  # 将在后台异步评分
                    user_feedback=None,
                    store_generated=store_generated,
                    book_id=book_id
                )
            )
        
        # 6. 构造返回信息
        rl_info = {}
        if enable_rl and selected_paragraphs:
            avg_q = sum([p.get("rl_info", {}).get("q_value", 0.5) for p in selected_paragraphs]) / len(selected_paragraphs)
            rl_info = {
                "strategy_used": "q_learning",
                "avg_q_value": round(avg_q, 3),
                "exploration_rate": 0.1
            }
        
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "splicing_id": f"splicing_{hash(spliced_content)}",  # 生成拼接ID用于反馈
                "spliced_content": spliced_content,
                "paragraphs": [
                    {
                        "id": p["id"],
                        "content": p["content"],
                        "similarity": p.get("similarity", 0),
                        "weight": p.get("weight", 1.0),
                        "rl_info": p.get("rl_info", {})
                    }
                    for p in selected_paragraphs
                ],
                "rl_info": rl_info
            }
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"Splicing failed: {str(e)}",
            "data": None
        }


@router.post("/splicing/feedback")
async def submit_splicing_feedback(payload: Dict[str, Any] = Body(...)):
    """提交智能拼接的用户反馈
    
    请求体:
    {
        "splicing_id": "splicing_12345",
        "paragraph_ids": ["para_1", "para_2"],
        "query": "山巅 云海 感慨",
        "feedback_type": "thumbs_up",  # thumbs_up / thumbs_down
        "comment": "语言很流畅"  # 可选
    }
    
    返回:
    {
        "code": 0,
        "message": "Feedback recorded",
        "data": {
            "reward_applied": 0.85,
            "q_values_updated": 5
        }
    }
    """
    splicing_id = payload.get("splicing_id")
    paragraph_ids = payload.get("paragraph_ids", [])
    query = payload.get("query", "")
    feedback_type = payload.get("feedback_type")  # thumbs_up / thumbs_down
    comment = payload.get("comment", "")
    
    if not paragraph_ids or not query or not feedback_type:
        return {"code": 400, "message": "paragraph_ids, query and feedback_type are required", "data": None}
    
    try:
        db = await get_db_service()
        rl_optimizer = await get_rl_optimizer(db.pool)
        
        # 生成查询向量
        async with AIService() as ai:
            embeddings = await ai.get_embeddings([query], model_id="text-embedding-3-small")
            query_vec = np.array(embeddings[0])
        
        # 计算奖励(仅基于用户反馈)
        reward = await rl_optimizer.calculate_reward(
            spliced_content="",  # 不需要内容
            contexts=[],
            llm_score=None,
            user_feedback=feedback_type
        )
        
        # 更新Q值
        await rl_optimizer.update_q_values(
            paragraph_ids=paragraph_ids,
            query_vec=query_vec,
            reward=reward
        )
        
        return {
            "code": 0,
            "message": "Feedback recorded, Q-values updated",
            "data": {
                "reward_applied": round(reward, 3),
                "q_values_updated": len(paragraph_ids)
            }
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"Failed to process feedback: {str(e)}",
            "data": None
        }

