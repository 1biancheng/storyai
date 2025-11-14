"""
SSE (Server-Sent Events) 路由模块
提供标准化的SSE端点,严格按照项目规范实现
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse

from services.sse_service import get_sse_service, SSEEventType
from api_framework import get_request_id
from contracts import success_response
from errors import restful_error, sse_error_event, DomainError

router = APIRouter(tags=["sse"])
logger = logging.getLogger(__name__)

@router.get("/connect/{connection_id}")
async def sse_connect(
    connection_id: str,
    request: Request,
    ping_interval: int = 15
) -> EventSourceResponse:
    """
    建立SSE连接
    
    Args:
        connection_id: 连接标识符
        request: FastAPI请求对象
        ping_interval: 心跳间隔(秒),默认15秒
    
    Returns:
        EventSourceResponse: SSE响应流
    """
    logger.info(f"New SSE connection request: {connection_id}")
    
    sse_service = get_sse_service()
    
    async def event_generator():
        """SSE事件生成器,严格按照规范实现"""
        queue = sse_service.create_connection(connection_id)
        
        try:
            # 发送连接确认事件
            yield {
                "event": SSEEventType.CONNECTED,
                "data": json.dumps({
                    "connectionId": connection_id,
                    "timestamp": datetime.now().isoformat(),
                    "status": "connected",
                    "pingInterval": ping_interval
                })
            }
            
            # 设置心跳任务
            async def heartbeat():
                while connection_id in sse_service.active_connections:
                    try:
                        # 检查客户端是否断开连接
                        if await request.is_disconnected():
                            logger.info(f"Client disconnected: {connection_id}")
                            break
                            
                        await asyncio.sleep(ping_interval)
                        
                        if connection_id in sse_service.active_connections:
                            await sse_service.send_event(
                                connection_id,
                                SSEEventType.PING,
                                {
                                    "timestamp": datetime.now().isoformat(),
                                    "connectionId": connection_id
                                }
                            )
                    except asyncio.CancelledError:
                        logger.info(f"Heartbeat cancelled for {connection_id}")
                        break
                    except Exception as e:
                        logger.error(f"Heartbeat error for {connection_id}: {e}")
                        break
            
            heartbeat_task = asyncio.create_task(heartbeat())
            
            try:
                while True:
                    try:
                        # 检查客户端连接状态
                        if await request.is_disconnected():
                            logger.info(f"Client disconnected: {connection_id}")
                            break
                        
                        # 等待事件,设置超时以便定期检查连接状态
                        event = await asyncio.wait_for(queue.get(), timeout=5.0)
                        
                        if event is None:  # 结束信号
                            logger.info(f"Received end signal for connection {connection_id}")
                            break
                        
                        yield event
                        
                    except asyncio.TimeoutError:
                        # 超时是正常的,继续循环
                        continue
                    except Exception as e:
                        logger.error(f"Error in event stream for {connection_id}: {e}")
                        # 发送统一的错误事件
                        yield sse_error_event(DomainError.SSE_STREAM_ERROR, str(e))
                        break
                        
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
                
        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled for {connection_id}")
        except Exception as e:
            logger.error(f"SSE stream error for {connection_id}: {e}")
            # 流程级错误也输出统一的错误事件
            yield sse_error_event(DomainError.SSE_STREAM_ERROR, f"SSE stream error: {str(e)}")
        finally:
            sse_service.remove_connection(connection_id)
            logger.info(f"SSE stream ended for connection {connection_id}")
    
    return EventSourceResponse(
        event_generator(),
        ping=ping_interval,
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用nginx缓冲
        }
    )

@router.get("/connect")
async def sse_connect_auto(
    request: Request,
    ping_interval: int = 15
) -> EventSourceResponse:
    """
    自动生成连接ID的SSE连接端点
    
    Args:
        request: FastAPI请求对象
        ping_interval: 心跳间隔(秒)
    
    Returns:
        EventSourceResponse: SSE响应流
    """
    connection_id = str(uuid.uuid4())
    logger.info(f"Auto-generated SSE connection: {connection_id}")
    
    return await sse_connect(connection_id, request, ping_interval)

@router.post("/send/{connection_id}")
async def send_event(
    connection_id: str,
    event_data: Dict[str, Any],
    event_type: str = "message",
    event_id: Optional[str] = None
):
    """
    向指定连接发送事件
    
    Args:
        connection_id: 连接标识符
        event_data: 事件数据
        event_type: 事件类型
        event_id: 事件ID(可选)
    
    Returns:
        Dict: 发送结果
    """
    sse_service = get_sse_service()
    
    success = await sse_service.send_event(
        connection_id, 
        event_type, 
        event_data, 
        event_id
    )
    
    if not success:
        return restful_error(DomainError.CONNECTION_NOT_FOUND, f"Connection {connection_id} not found", status_code=404)

    return success_response(
        data={
            "connection_id": connection_id,
            "event_type": event_type,
            "timestamp": datetime.now().isoformat()
        },
        message="event sent"
    )

@router.post("/broadcast")
async def broadcast_event(
    event_data: Dict[str, Any],
    event_type: str = "message",
    exclude_connections: Optional[list] = None
):
    """
    广播事件到所有连接
    
    Args:
        event_data: 事件数据
        event_type: 事件类型
        exclude_connections: 排除的连接列表
    
    Returns:
        Dict: 广播结果
    """
    sse_service = get_sse_service()
    
    sent_count = await sse_service.broadcast_event(
        event_type,
        event_data,
        exclude_connections
    )
    
    return success_response(
        data={
            "event_type": event_type,
            "sent_count": sent_count,
            "total_connections": sse_service.get_connection_count(),
            "timestamp": datetime.now().isoformat()
        },
        message="broadcasted"
    )

@router.get("/status")
async def get_sse_status():
    """
    获取SSE服务状态
    
    Returns:
        Dict: SSE服务状态信息
    """
    sse_service = get_sse_service()
    
    return success_response(
        data={
            "active_connections": sse_service.get_connection_count(),
            "connection_ids": sse_service.get_connection_ids(),
            "timestamp": datetime.now().isoformat()
        },
        message="sse status"
    )

@router.delete("/disconnect/{connection_id}")
async def disconnect_sse(connection_id: str):
    """
    断开指定的SSE连接
    
    Args:
        connection_id: 连接标识符
    
    Returns:
        Dict: 断开结果
    """
    sse_service = get_sse_service()
    
    success = sse_service.remove_connection(connection_id)
    
    if not success:
        return restful_error(DomainError.CONNECTION_NOT_FOUND, f"Connection {connection_id} not found", status_code=404)

    return success_response(
        data={
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat()
        },
        message="disconnected"
    )
