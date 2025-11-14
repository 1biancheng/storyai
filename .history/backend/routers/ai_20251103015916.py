"""AI模型管理和交互API路由

统一改造说明(不改业务逻辑):
- /run-agent: 统一返回 ApiResponse 格式,使用 success_response / restful_error 包装
- /run-agent-stream: 统一 SSE 事件命名为 append/complete/error, 数据统一为 JSON 字符串, 设置 ping=15
"""

import json  # 添加json导入
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from services.ai_service import get_ai_service
from services.cache_service import get_cache
from contracts import ApiResponse, ErrorResponse, success_response
from errors import restful_error, sse_error_event, DomainError
from services.json_repairer import safe_json_loads  # 使用安全的JSON解析

# 导入缺失的函数
from services.ai_service import clear_model_config_cache
from services.cache_service import get_cache_stats

logger = logging.getLogger(__name__)

router = APIRouter()

# 请求模型
class AgentRequest(BaseModel):
    prompt: str = Field(..., description="用户输入的提示词")
    model_id: str = Field(default="gpt-3.5-turbo", description="使用的模型ID")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="模型参数")
    stream: bool = Field(default=False, description="是否使用流式响应")

class ModelTestRequest(BaseModel):
    model_id: str = Field(..., description="要测试的模型ID")
    test_prompt: str = Field(default="Hello, how are you?", description="测试提示词")

# 响应模型
class AgentResponse(BaseModel):
    success: bool
    result: Optional[str] = None
    model_id: str
    cached: bool = False
    response_time: Optional[float] = None
    error: Optional[str] = None

class ModelInfo(BaseModel):
    model_id: str
    provider: str
    model_name: str
    available: bool
    streaming_support: bool
    max_tokens: int
    description: Optional[str] = None

class ModelConfig(BaseModel):
    model_id: str
    provider: str
    model_name: str
    max_tokens: int
    temperature: float
    streaming_support: bool
    # 敏感信息已移除

@router.post("/run-agent", response_model=ApiResponse[AgentResponse])
async def run_agent(request: AgentRequest):
    """运行AI代理"""
    try:
        ai_service = await get_ai_service()
        
        # 检查缓存
        cache = await get_cache()
        cache_key = f"agent:{request.model_id}:{hash(request.prompt + str(request.parameters))}"
        
        cached_result = await cache.get(cache_key)
        if cached_result:
            return success_response(
                data=AgentResponse(
                    success=True,
                    result=cached_result,
                    model_id=request.model_id,
                    cached=True
                ).dict(),
                message="ok"
            )
        
        # 运行代理
        import time
        start_time = time.time()
        
        if request.stream:
            # 流式响应不支持缓存
            return restful_error(
                DomainError.UNSUPPORTED_TYPE,
                "请使用 /run-agent-stream 端点以获取流式响应",
                status_code=400
            )
        
        result = await ai_service.run_agent(
            prompt=request.prompt,
            model_id=request.model_id,
            parameters=request.parameters or {}
        )
        
        response_time = time.time() - start_time
        
        # 缓存结果(5分钟)
        await cache.set(cache_key, result, ttl=300)
        
        return success_response(
            data=AgentResponse(
                success=True,
                result=result,
                model_id=request.model_id,
                cached=False,
                response_time=response_time
            ).dict(),
            message="ok"
        )
        
    except Exception as e:
        logger.error(f"Error in run_agent: {str(e)}")
        return restful_error(DomainError.INTERNAL_ERROR, f"运行代理失败: {str(e)}", status_code=500)

@router.get("/run-agent-stream")
async def run_agent_stream(
    # 对外参数采用 camelCase, 为兼容保留 model_id
    prompt: str,
    modelId: Optional[str] = None,
    model_id: Optional[str] = None,
    parameters: Optional[str] = None,
    requestId: Optional[str] = None,
):
    """以 GET + Query 参数方式流式运行AI代理, 便于原生 EventSource 订阅。

    Query 参数:
    - prompt: 必填,提示词
    - modelId: 可选(优先),模型ID,默认 gpt-3.5-turbo
    - model_id: 可选(兼容),与 modelId 等价
    - parameters: 可选,JSON 字符串,将解析为字典传入后端
    - requestId: 可选,用于前后端日志与事件追踪
    """
    try:
        ai_service = await get_ai_service()

        # 入参解析与映射(camelCase -> snake_case)
        resolved_model_id = modelId or model_id or "gpt-3.5-turbo"
        try:
            # 使用安全的JSON解析
            resolved_parameters = safe_json_loads(parameters, {}) if parameters else {}
        except Exception:
            # parameters 解析失败,以 SSE 错误事件返回
            async def error_stream():
                yield sse_error_event(
                    DomainError.UNSUPPORTED_TYPE,
                    "parameters 必须为合法的 JSON 字符串"
                )
            return EventSourceResponse(error_stream(), ping=15)

        # 生成 request_id(若未提供)
        request_id = requestId or f"req-{__import__('uuid').uuid4()}"

        async def generate_stream():
            try:
                # 连接确认事件
                yield {
                    "event": "connected",
                    "data": json.dumps({
                        "modelId": resolved_model_id,
                        "requestId": request_id
                    })
                }

                async for chunk in ai_service.run_agent_stream(
                    prompt=prompt,
                    model_id=resolved_model_id,
                    parameters=resolved_parameters
                ):
                    yield {
                        "event": "append",
                        "data": json.dumps({
                            "content": chunk,
                            "modelId": resolved_model_id,
                            "requestId": request_id
                        })
                    }

                # 发送完成事件
                yield {
                    "event": "complete",
                    "data": json.dumps({
                        "modelId": resolved_model_id,
                        "requestId": request_id
                    })
                }

            except Exception as e:
                logger.error(f"Stream error: {str(e)}")
                # 统一错误事件结构(JSON字符串),事件名: error
                yield sse_error_event(
                    DomainError.SSE_STREAM_ERROR,
                    f"流式响应错误: {str(e)}"
                )

        return EventSourceResponse(generate_stream(), ping=15)

    except Exception as e:
        logger.error(f"Error in run_agent_stream: {str(e)}")
        return restful_error(DomainError.INTERNAL_ERROR, f"创建流式响应失败: {str(e)}", status_code=500)

@router.get("/models", response_model=List[ModelInfo])
async def get_available_models():
    """获取可用模型列表"""
    try:
        ai_service = await get_ai_service()
        models = await ai_service.get_available_models()
        
        return [
            ModelInfo(
                model_id=model["id"],
                provider=model["provider"],
                model_name=model["name"],
                available=model["available"],
                streaming_support=model.get("supports_streaming", False),
                max_tokens=model.get("max_tokens", 2048),
                description=model.get("description")
            )
            for model in models
        ]
        
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/{model_id}/config", response_model=ModelConfig)
async def get_model_config(model_id: str):
    """获取模型配置(敏感信息已移除)"""
    try:
        from services.ai_service import ModelConfig as AIModelConfig
        config = AIModelConfig.get_model_config(model_id)
        
        if not config:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
        
        return ModelConfig(
            model_id=model_id,
            provider=config["provider"],
            model_name=config["model_name"],
            max_tokens=config.get("max_tokens", 2048),
            temperature=config.get("temperature", 0.7),
            streaming_support=config.get("streaming_support", False)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/models/clear-cache")
async def clear_cache():
    """清空模型配置缓存"""
    try:
        # 清空lru_cache
        clear_model_config_cache()
        
        # 清空应用缓存
        cache = await get_cache()
        cleared_count = await cache.clear("model:*")
        
        return {
            "success": True,
            "message": f"Cache cleared, {cleared_count} items removed"
        }
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-model")
async def test_model(request: ModelTestRequest):
    """测试模型连接"""
    try:
        ai_service = await get_ai_service()
        result = await ai_service.test_model_connection(
            model_id=request.model_id,
            test_prompt=request.test_prompt
        )
        
        return {
            "success": True,
            "model_id": request.model_id,
            "test_result": result
        }
        
    except Exception as e:
        logger.error(f"Error testing model: {str(e)}")
        return {
            "success": False,
            "model_id": request.model_id,
            "error": str(e)
        }

@router.get("/cache/stats")
async def get_cache_statistics():
    """获取缓存统计信息"""
    try:
        stats = await get_cache_stats()
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cache/clear")
async def clear_all_cache():
    """清空所有缓存"""
    try:
        cache = await get_cache()
        cleared_count = await cache.clear()
        
        # 同时清空lru_cache
        clear_model_config_cache()
        
        return {
            "success": True,
            "message": f"All cache cleared, {cleared_count} items removed"
        }
        
    except Exception as e:
        logger.error(f"Error clearing all cache: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 健康检查端点
@router.get("/health")
async def health_check():
    """AI服务健康检查"""
    try:
        ai_service = await get_ai_service()
        
        # 检查缓存状态
        cache_stats = await get_cache_stats()
        
        return {
            "status": "healthy",
            "ai_service": "running",
            "cache": {
                "l1_size": cache_stats["l1_cache"]["size"],
                "redis_available": cache_stats["redis_available"],
                "redis_connected": cache_stats["redis_connected"]
            }
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }