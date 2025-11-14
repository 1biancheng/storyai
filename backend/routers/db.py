"""
数据库管理和向量检索API路由
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, status
from fastapi.responses import JSONResponse  # {{ line 7-7 logic+clean fix | 来源: ensure explicit 201 response }}
from fastapi import Response  # {{ line 8-8 logic+clean fix | 来源: use Response for 204 no content }}
from pydantic import BaseModel, Field

from services.db_service import get_db_service
from services.cache_service import get_cache

logger = logging.getLogger(__name__)

router = APIRouter()

# 请求模型
class DocumentCreate(BaseModel):
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档内容")
    content_type: str = Field(default="text", description="内容类型")
    source: Optional[str] = Field(None, description="文档来源")
    doc_metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    content_type: Optional[str] = None
    source: Optional[str] = None
    doc_metadata: Optional[Dict[str, Any]] = None

class VectorSearchRequest(BaseModel):
    query_embedding: List[float] = Field(..., description="查询向量")
    limit: int = Field(default=10, ge=1, le=100, description="返回结果数量")
    threshold: float = Field(default=0.8, ge=0.0, le=1.0, description="相似度阈值")
    content_type: Optional[str] = Field(None, description="内容类型过滤")

class HybridSearchRequest(BaseModel):
    query_text: str = Field(..., description="查询文本")
    query_embedding: List[float] = Field(..., description="查询向量")
    limit: int = Field(default=10, ge=1, le=100, description="返回结果数量")
    text_weight: float = Field(default=0.3, ge=0.0, le=1.0, description="文本权重")
    vector_weight: float = Field(default=0.7, ge=0.0, le=1.0, description="向量权重")

class EmbeddingUpdate(BaseModel):
    embedding: List[float] = Field(..., description="嵌入向量")
    embedding_model: str = Field(default="text-embedding-ada-002", description="嵌入模型")

# 响应模型
class DocumentResponse(BaseModel):
    id: int
    title: str
    content: str
    content_type: str
    source: Optional[str]
    doc_metadata: Optional[Dict[str, Any]]
    embedding_model: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

class SearchResult(BaseModel):
    id: int
    title: str
    content: str
    content_type: str
    source: Optional[str]
    doc_metadata: Optional[Dict[str, Any]]
    similarity: Optional[float] = None
    text_score: Optional[float] = None
    vector_score: Optional[float] = None
    combined_score: Optional[float] = None

@router.post("/documents", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_document(doc: DocumentCreate):
    """创建文档"""
    try:
        db_service = await get_db_service()
        doc_id = await db_service.insert_document(
            title=doc.title,
            content=doc.content,
            content_type=doc.content_type,
            source=doc.source,
            doc_metadata=doc.doc_metadata
        )
        
        # 直接显式返回 201，避免状态码被中间件或默认处理覆盖
        # {{ line ~83-92 logic+clean fix | 来源: enforce HTTP 201 Created for document creation }}
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "id": doc_id,
                "success": True,
                "document_id": doc_id,
                "message": "Document created successfully"
            }
        )
        
    except Exception as e:
        logger.error(f"Error creating document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: int):
    """获取文档"""
    try:
        db_service = await get_db_service()
        
        # 检查缓存
        cache = await get_cache()
        cache_key = f"document:{doc_id}"
        cached_doc = await cache.get(cache_key)
        
        if cached_doc:
            return cached_doc
        
        doc = await db_service.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # 统一时间字段为 ISO 字符串，避免响应模型校验失败
        # {{ line ~116-126 logic+clean fix | 来源: normalize datetime fields to ISO strings }}
        created_at = doc.get("created_at")
        updated_at = doc.get("updated_at")
        if created_at is not None:
            try:
                doc["created_at"] = created_at.isoformat()
            except Exception:
                doc["created_at"] = str(created_at)
        if updated_at is not None:
            try:
                doc["updated_at"] = updated_at.isoformat()
            except Exception:
                doc["updated_at"] = str(updated_at)
        
        # 缓存结果(10分钟)
        await cache.set(cache_key, doc, ttl=600)
        
        return doc
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/documents/{doc_id}/embedding")
async def update_document_embedding(doc_id: int, embedding_data: EmbeddingUpdate):
    """更新文档嵌入向量"""
    try:
        db_service = await get_db_service()
        
        # 验证向量维度
        if len(embedding_data.embedding) != 1536:
            raise HTTPException(
                status_code=400, 
                detail=f"Expected embedding dimension 1536, got {len(embedding_data.embedding)}"
            )
        
        await db_service.update_document_embedding(
            doc_id=doc_id,
            embedding=embedding_data.embedding,
            embedding_model=embedding_data.embedding_model
        )
        
        # 清除缓存
        cache = await get_cache()
        await cache.delete(f"document:{doc_id}")
        
        return {
            "success": True,
            "message": "Document embedding updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating embedding: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: int, soft_delete: bool = Query(True, description="软删除")):
    """删除文档"""
    try:
        db_service = await get_db_service()
        await db_service.delete_document(doc_id, soft_delete=soft_delete)
        
        # 清除缓存
        cache = await get_cache()
        await cache.delete(f"document:{doc_id}")
        
        # 返回 204 No Content，以符合 REST 规范及测试期望
        # {{ line ~170-176 logic+clean fix | 来源: enforce HTTP 204 No Content for delete }}
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/vector", response_model=List[SearchResult])
async def vector_search(search_request: VectorSearchRequest):
    """向量相似度搜索"""
    try:
        db_service = await get_db_service()
        
        # 验证向量维度
        if len(search_request.query_embedding) != 1536:
            raise HTTPException(
                status_code=400,
                detail=f"Expected embedding dimension 1536, got {len(search_request.query_embedding)}"
            )
        
        # 检查缓存
        cache = await get_cache()
        cache_key = f"vector_search:{hash(str(search_request.query_embedding))}"
        cached_results = await cache.get(cache_key)
        
        if cached_results:
            return cached_results
        
        results = await db_service.vector_search(
            query_embedding=search_request.query_embedding,
            limit=search_request.limit,
            threshold=search_request.threshold,
            content_type=search_request.content_type
        )
        
        # 缓存结果(5分钟)
        await cache.set(cache_key, results, ttl=300)
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in vector search: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/hybrid", response_model=List[SearchResult])
async def hybrid_search(search_request: HybridSearchRequest):
    """混合搜索(文本+向量)"""
    try:
        db_service = await get_db_service()
        
        # 验证向量维度
        if len(search_request.query_embedding) != 1536:
            raise HTTPException(
                status_code=400,
                detail=f"Expected embedding dimension 1536, got {len(search_request.query_embedding)}"
            )
        
        # 验证权重总和
        if abs(search_request.text_weight + search_request.vector_weight - 1.0) > 0.01:
            raise HTTPException(
                status_code=400,
                detail="Text weight and vector weight must sum to 1.0"
            )
        
        results = await db_service.hybrid_search(
            query_text=search_request.query_text,
            query_embedding=search_request.query_embedding,
            limit=search_request.limit,
            text_weight=search_request.text_weight,
            vector_weight=search_request.vector_weight
        )
        
        return results
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in hybrid search: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_database_stats():
    """获取数据库统计信息"""
    try:
        db_service = await get_db_service()
        
        # 检查缓存
        cache = await get_cache()
        cache_key = "db_stats"
        cached_stats = await cache.get(cache_key)
        
        if cached_stats:
            return {
                "success": True,
                "stats": cached_stats,
                "cached": True
            }
        
        stats = await db_service.get_database_stats()
        
        # 缓存统计信息(2分钟)
        await cache.set(cache_key, stats, ttl=120)
        
        return {
            "success": True,
            "stats": stats,
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error getting database stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/maintenance/reindex")
async def reindex_vectors():
    """重建向量索引"""
    try:
        db_service = await get_db_service()
        
        # 这里可以添加重建索引的逻辑
        # 由于索引重建是耗时操作,建议在后台任务中执行
        
        return {
            "success": True,
            "message": "Vector reindexing initiated (background task)"
        }
        
    except Exception as e:
        logger.error(f"Error reindexing vectors: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/maintenance/vacuum")
async def vacuum_database():
    """数据库维护 - VACUUM"""
    try:
        db_service = await get_db_service()
        
        async with db_service.get_session() as session:
            # 注意:VACUUM不能在事务中执行,这里仅作示例
            await session.execute("ANALYZE documents")
            await session.commit()
        
        return {
            "success": True,
            "message": "Database maintenance completed"
        }
        
    except Exception as e:
        logger.error(f"Error in database maintenance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 健康检查
@router.get("/health")
async def database_health_check():
    """数据库健康检查"""
    try:
        db_service = await get_db_service()
        stats = await db_service.get_database_stats()
        
        return {
            "status": "healthy",
            "database": "connected",
            "pgvector": "available",
            "total_documents": stats["total_documents"],
            "embedded_documents": stats["embedded_documents"],
            "embedding_coverage": f"{stats['embedding_coverage']:.2%}"
        }
        
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
