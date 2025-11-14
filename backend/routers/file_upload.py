"""文件上传与提取API路由"""

from fastapi import APIRouter, File, UploadFile, Form
from typing import Optional
import hashlib
from datetime import datetime

from services.file_extraction_service import extract_and_split_file
from api_framework import ApiException
from errors import restful_error, DomainError

router = APIRouter(prefix="/api/v1/file", tags=["File"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    encoding_hint: Optional[str] = Form(None),
    preserve_structure: bool = Form(False)
):
    """文件上传与提取
    
    请求参数:
    - file: 文件二进制数据
    - encoding_hint: 前端检测到的编码提示
    - preserve_structure: 是否保留文档结构
    
    响应结构:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "file_id": "upload_20240115_abc123",
            "text": "提取的文本...",
            "encoding": "UTF-8",
            "confidence": 0.98,
            "method": "markitdown",
            "file_hash": "md5_hash"
        }
    }
    """
    try:
        # 读取文件内容
        file_bytes = await file.read()
        filename = file.filename or "uploaded_file"
        
        # 验证文件大小(10MB)
        max_size = 10 * 1024 * 1024
        if len(file_bytes) > max_size:
            return restful_error(
                DomainError.VALIDATION_ERROR,
                f"文件过大 ({len(file_bytes)} bytes). 最大: {max_size} bytes",
                status_code=400
            )
        
        # 计算文件哈希
        file_hash = hashlib.md5(file_bytes).hexdigest()
        
        # 调用提取服务 - 仅提取文本,不入库
        from services.file_extraction_service import FileExtractionService
        extraction_service = FileExtractionService()
        
        # 简单文本提取
        result = await extraction_service.extract_text(
            file_bytes=file_bytes,
            filename=filename,
            detected_encoding=encoding_hint,
            preserve_structure=preserve_structure
        )
        
        # 生成文件ID
        file_id = f"upload_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file_hash[:8]}"
        
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "file_id": file_id,
                "text": result.get("text", ""),
                "encoding": result.get("encoding", "UTF-8"),
                "confidence": result.get("confidence", 0.0),
                "method": result.get("method", "direct"),
                "file_hash": file_hash
            }
        }
    
    except Exception as e:
        import traceback
        return restful_error(
            DomainError.INTERNAL_ERROR,
            f"文件处理失败: {str(e)}\n{traceback.format_exc()}",
            status_code=500
        )
"""文件上传与提取API路由"""

from fastapi import APIRouter, File, UploadFile, Form
from typing import Optional
import hashlib
from datetime import datetime

from services.file_extraction_service import extract_and_split_file
from api_framework import ApiException
from errors import restful_error, DomainError

router = APIRouter(prefix="/api/v1/file", tags=["File"])


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    encoding_hint: Optional[str] = Form(None),
    preserve_structure: bool = Form(False)
):
    """文件上传与提取
    
    请求参数:
    - file: 文件二进制数据
    - encoding_hint: 前端检测到的编码提示
    - preserve_structure: 是否保留文档结构
    
    响应结构:
    {
        "code": 0,
        "message": "ok",
        "data": {
            "file_id": "upload_20240115_abc123",
            "text": "提取的文本...",
            "encoding": "UTF-8",
            "confidence": 0.98,
            "method": "markitdown",
            "file_hash": "md5_hash"
        }
    }
    """
    try:
        # 读取文件内容
        file_bytes = await file.read()
        filename = file.filename or "uploaded_file"
        
        # 验证文件大小(10MB)
        max_size = 10 * 1024 * 1024
        if len(file_bytes) > max_size:
            return restful_error(
                DomainError.VALIDATION_ERROR,
                f"文件过大 ({len(file_bytes)} bytes). 最大: {max_size} bytes",
                status_code=400
            )
        
        # 计算文件哈希
        file_hash = hashlib.md5(file_bytes).hexdigest()
        
        # 调用提取服务 - 仅提取文本,不入库
        from services.file_extraction_service import FileExtractionService
        extraction_service = FileExtractionService()
        
        # 简单文本提取
        result = await extraction_service.extract_text(
            file_bytes=file_bytes,
            filename=filename,
            detected_encoding=encoding_hint,
            preserve_structure=preserve_structure
        )
        
        # 生成文件ID
        file_id = f"upload_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file_hash[:8]}"
        
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "file_id": file_id,
                "text": result.get("text", ""),
                "encoding": result.get("encoding", "UTF-8"),
                "confidence": result.get("confidence", 0.0),
                "method": result.get("method", "direct"),
                "file_hash": file_hash
            }
        }
    
    except Exception as e:
        import traceback
        return restful_error(
            DomainError.INTERNAL_ERROR,
            f"文件处理失败: {str(e)}\n{traceback.format_exc()}",
            status_code=500
        )
