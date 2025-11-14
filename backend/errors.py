"""
统一错误码与错误响应工具

- DomainError: 领域错误码(字符串),用于 REST 和 SSE 的一致性展示
- restful_error: 返回符合规范的 REST 错误响应 {code, message}
- sse_error_event: 生成 SSE 错误事件结构 {event: 'error', data: {code, message}}

注意:
- REST 层仍然通过 HTTP 状态码表达语义(如 400/404/500),而响应体中的 code 使用领域错误码字符串,便于前端统一处理。
- SSE 错误事件统一为 event: 'error', data: {code, message}
"""

from enum import Enum
from typing import Dict
from fastapi.responses import JSONResponse
import json


class DomainError(str, Enum):
    UNSUPPORTED_TYPE = "UNSUPPORTED_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    NOT_FOUND = "NOT_FOUND"
    EMPTY_TEXT = "EMPTY_TEXT"
    NO_PARAGRAPHS = "NO_PARAGRAPHS"
    INGEST_ERROR = "INGEST_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    WORKFLOW_ERROR = "WORKFLOW_ERROR"
    SSE_STREAM_ERROR = "SSE_STREAM_ERROR"
    CONNECTION_NOT_FOUND = "CONNECTION_NOT_FOUND"


def restful_error(code: DomainError, message: str, status_code: int = 400) -> JSONResponse:
    """统一的 REST 错误响应: {code, message}

    - code: 使用 DomainError 字符串,便于前端一致处理
    - status_code: 使用具体 HTTP 状态码表达错误语义
    """
    return JSONResponse(status_code=status_code, content={"code": code.value, "message": message})


def sse_error_event(code: DomainError, message: str) -> Dict[str, str]:
    """统一的 SSE 错误事件结构, data 为 JSON 字符串"""
    return {
        "event": "error",
        "data": json.dumps({"code": code.value, "message": message})
    }
