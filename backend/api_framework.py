"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import uuid
from typing import Any, Dict, Optional
from datetime import datetime
import traceback

from contracts import (
    ApiResponse, ErrorResponse, ErrorCode, 
    WorkflowExecutionRequest, WorkflowExecutionResponse,
    ModelConfigContract, ModelTestRequest, ModelTestResponse,
    ProjectDataContract,
    success_response, error_response, paginated_response
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class ApiException(HTTPException):
    """自定义API异常"""
    def __init__(
        self, 
        status_code: int = 500, 
        code: int = ErrorCode.INTERNAL_ERROR,
        message: str = "Internal server error",
        details: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        self.code = code
        self.details = details
        self.request_id = request_id
        super().__init__(status_code=status_code, detail=message)

def create_app() -> FastAPI:
    """创建FastAPI应用实例"""
    app = FastAPI(
        title="Story AI API",
        description="多智能体写作工作流API服务",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json"
    )

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 在生产环境中应该配置具体的域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 请求ID中间件
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # 记录请求日志
        logger.info(f"[{request_id}] {request.method} {request.url.path}")
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # 全局异常处理器
    @app.exception_handler(ApiException)
    async def api_exception_handler(request: Request, exc: ApiException):
        request_id = getattr(request.state, 'request_id', None)
        
        logger.error(
            f"[{request_id}] API Exception: {exc.code} - {exc.detail}",
            extra={
                "request_id": request_id,
                "error_code": exc.code,
                "error_message": exc.detail,
                "details": exc.details
            }
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(
                code=exc.code,
                message=str(exc.detail),
                details=exc.details,
                request_id=request_id
            )
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, 'request_id', None)
        
        logger.warning(
            f"[{request_id}] Validation Error: {exc.errors()}",
            extra={"request_id": request_id, "errors": exc.errors()}
        )
        
        return JSONResponse(
            status_code=422,
            content=error_response(
                code=ErrorCode.VALIDATION_ERROR,
                message="请求参数验证失败",
                details=str(exc.errors()),
                request_id=request_id
            )
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        request_id = getattr(request.state, 'request_id', None)
        
        logger.warning(
            f"[{request_id}] HTTP Exception: {exc.status_code} - {exc.detail}",
            extra={"request_id": request_id, "status_code": exc.status_code}
        )
        
        # 映射HTTP状态码到错误码
        error_code_map = {
            400: ErrorCode.BAD_REQUEST,
            401: ErrorCode.UNAUTHORIZED,
            403: ErrorCode.FORBIDDEN,
            404: ErrorCode.NOT_FOUND,
            405: ErrorCode.METHOD_NOT_ALLOWED,
            409: ErrorCode.CONFLICT,
        }
        
        error_code = error_code_map.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
        
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(
                code=error_code,
                message=str(exc.detail),
                request_id=request_id
            )
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, 'request_id', None)
        
        logger.error(
            f"[{request_id}] Unhandled Exception: {str(exc)}",
            exc_info=True,
            extra={"request_id": request_id, "traceback": traceback.format_exc()}
        )
        
        return JSONResponse(
            status_code=500,
            content=error_response(
                code=ErrorCode.INTERNAL_ERROR,
                message="服务器内部错误",
                details=str(exc) if __debug__ else None,  # 只在调试模式下显示详细错误
                request_id=request_id
            )
        )

    return app

def get_request_id(request: Request) -> Optional[str]:
    """获取请求ID"""
    return getattr(request.state, 'request_id', None)

def log_request(request: Request, data: Optional[Dict[str, Any]] = None):
    """记录请求日志"""
    request_id = get_request_id(request)
    logger.info(
        f"[{request_id}] Request: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "data": data
        }
    )

def log_response(request: Request, response: Any, status_code: int = 200):
    """记录响应日志"""
    request_id = get_request_id(request)
    logger.info(
        f"[{request_id}] Response: {status_code}",
        extra={
            "request_id": request_id,
            "status_code": status_code,
            "response": response
        }
    )