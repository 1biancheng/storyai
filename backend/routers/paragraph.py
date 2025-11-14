"""段落拆分API路由"""

from fastapi import APIRouter, Body
from typing import Dict, List, Optional, Any

from services.paragraph_splitter import SemanticParagraphSplitter
from api_framework import ApiException
from errors import restful_error, DomainError

router = APIRouter(prefix="/api/v1/paragraph", tags=["Paragraph"])


@router.post("/split")
async def split_paragraphs(payload: Dict = Body(...)):
    """段落拆分
    
    请求结构:
    {
        "text": "待拆分的文本",
        "config": {
            "method": "paragraph",
            "min_length": 120,
            "max_length": 1800,
            "clean_mode": "strict"
        },
        "metadata": {
            "file_id": "upload_xxx",
            "book_id": "bk_xxx"
        }
    }
    
    响应结构:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "paragraphs": [...],
            "total_count": 45,
            "avg_length_bytes": 234,
            "total_bytes": 10530,
            "statistics": {...}
        }
    }
    """
    try:
        text = payload.get("text", "")
        config = payload.get("config", {})
        metadata = payload.get("metadata", {})
        
        if not text:
            return restful_error(
                DomainError.EMPTY_TEXT,
                "文本内容不能为空",
                status_code=400
            )
        
        # 初始化拆分器
        splitter = SemanticParagraphSplitter(
            min_bytes=config.get("min_length", 120),
            max_bytes=config.get("max_length", 1800)
        )
        
        # 执行拆分
        paragraphs = splitter.split(text)
        
        # 统计信息
        total_bytes = sum(p["length_bytes"] for p in paragraphs)
        total_chars = sum(p["length_chars"] for p in paragraphs)
        total_chinese = sum(p["length_chinese"] for p in paragraphs)
        
        statistics = {
            "total_count": len(paragraphs),
            "avg_length_bytes": round(total_bytes / max(len(paragraphs), 1)),
            "avg_length_chars": round(total_chars / max(len(paragraphs), 1)),
            "total_bytes": total_bytes,
            "total_chars": total_chars,
            "total_chinese": total_chinese,
            "min_bytes": min((p["length_bytes"] for p in paragraphs), default=0),
            "max_bytes": max((p["length_bytes"] for p in paragraphs), default=0),
        }
        
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "paragraphs": paragraphs,
                "statistics": statistics,
                "metadata": metadata
            }
        }
    
    except Exception as e:
        import traceback
        return restful_error(
            DomainError.INTERNAL_ERROR,
            f"段落拆分失败: {str(e)}\n{traceback.format_exc()}",
            status_code=500
        )
"""段落拆分API路由"""

from fastapi import APIRouter, Body
from typing import Dict, List, Optional, Any

from services.paragraph_splitter import SemanticParagraphSplitter
from api_framework import ApiException
from errors import restful_error, DomainError

router = APIRouter(prefix="/api/v1/paragraph", tags=["Paragraph"])


@router.post("/split")
async def split_paragraphs(payload: Dict = Body(...)):
    """段落拆分
    
    请求结构:
    {
        "text": "待拆分的文本",
        "config": {
            "method": "paragraph",
            "min_length": 120,
            "max_length": 1800,
            "clean_mode": "strict"
        },
        "metadata": {
            "file_id": "upload_xxx",
            "book_id": "bk_xxx"
        }
    }
    
    响应结构:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "paragraphs": [...],
            "total_count": 45,
            "avg_length_bytes": 234,
            "total_bytes": 10530,
            "statistics": {...}
        }
    }
    """
    try:
        text = payload.get("text", "")
        config = payload.get("config", {})
        metadata = payload.get("metadata", {})
        
        if not text:
            return restful_error(
                DomainError.EMPTY_TEXT,
                "文本内容不能为空",
                status_code=400
            )
        
        # 初始化拆分器
        splitter = SemanticParagraphSplitter(
            min_bytes=config.get("min_length", 120),
            max_bytes=config.get("max_length", 1800)
        )
        
        # 执行拆分
        paragraphs = splitter.split(text)
        
        # 统计信息
        total_bytes = sum(p["length_bytes"] for p in paragraphs)
        total_chars = sum(p["length_chars"] for p in paragraphs)
        total_chinese = sum(p["length_chinese"] for p in paragraphs)
        
        statistics = {
            "total_count": len(paragraphs),
            "avg_length_bytes": round(total_bytes / max(len(paragraphs), 1)),
            "avg_length_chars": round(total_chars / max(len(paragraphs), 1)),
            "total_bytes": total_bytes,
            "total_chars": total_chars,
            "total_chinese": total_chinese,
            "min_bytes": min((p["length_bytes"] for p in paragraphs), default=0),
            "max_bytes": max((p["length_bytes"] for p in paragraphs), default=0),
        }
        
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "paragraphs": paragraphs,
                "statistics": statistics,
                "metadata": metadata
            }
        }
    
    except Exception as e:
        import traceback
        return restful_error(
            DomainError.INTERNAL_ERROR,
            f"段落拆分失败: {str(e)}\n{traceback.format_exc()}",
            status_code=500
        )
