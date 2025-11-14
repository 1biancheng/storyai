import os
import uuid
import shutil
import asyncio
import json
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Query
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from services.text_ingest_service import ingest_file_stream
from errors import DomainError, restful_error, sse_error_event
from config import get_settings


router = APIRouter(prefix="/api/v1/books", tags=["Books"])

settings = get_settings()
UPLOAD_DIR = settings.upload_dir
MAX_FILE_SIZE = settings.max_file_size
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _error(code: DomainError, message: str, status_code: int = 400) -> JSONResponse:
    return restful_error(code, message, status_code)


@router.post("/upload")
async def upload_book(file: UploadFile = File(...)):
    # 校验大小(FastAPI 默认无法直接拿到大小,采用分块写入并计数)
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed = {".pdf", ".epub", ".txt", ".md", ".docx"}
    if ext not in allowed:
        return _error(DomainError.UNSUPPORTED_TYPE, f"不支持的文件类型: {ext}")

    file_id = str(uuid.uuid4())
    target_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")

    size = 0
    try:
        with open(target_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    out.close()
                    try:
                        os.remove(target_path)
                    except Exception:
                        pass
                    return _error(DomainError.FILE_TOO_LARGE, f"文件超过大小限制: {MAX_FILE_SIZE} bytes")
                out.write(chunk)
        return {"fileId": file_id, "filename": file.filename, "path": target_path, "size": size}
    finally:
        await file.close()


@router.get("/ingest/stream")
async def ingest_stream(
    fileId: str,
    request: Request,
    model_id: str = Query("text-embedding-3-small"),
    format: str = Query("text"),
    encoding: Optional[str] = Query(None)
):
    # 兼容前端传入 modelId(camelCase)
    model_id = request.query_params.get("modelId") or model_id

    async def gen():
        # 心跳由 EventSourceResponse 管理
        ext_candidates = [".pdf", ".epub", ".txt", ".md", ".docx"]
        path = None
        for ext in ext_candidates:
            p = os.path.join(UPLOAD_DIR, f"{fileId}{ext}")
            if os.path.exists(p):
                path = p
                break
        if not path:
            yield sse_error_event(DomainError.NOT_FOUND, "文件不存在或尚未上传")
            return

        try:
            # 兼容 query 中传入 encoding 覆盖
            enc = request.query_params.get("encoding") or encoding
            async for evt in ingest_file_stream(path, model_id=model_id, format=format, encoding=enc):
                yield evt
        except Exception as e:
            yield sse_error_event(DomainError.INGEST_ERROR, str(e))

    return EventSourceResponse(gen(), ping=15)
