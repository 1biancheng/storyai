"""
SSE (Server-Sent Events) 服务模块
实现符合项目规范的流式传输功能
"""

import json
import asyncio
import logging
from typing import Dict, Any, AsyncGenerator, Optional
from datetime import datetime
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger(__name__)

class SSEEventType:
    """SSE事件类型常量"""
    CONNECTED = "connected"
    PING = "ping"
    WORKFLOW_STARTED = "workflow_started"
    WORKFLOW_COMPLETED = "workflow_completed"
    WORKFLOW_FAILED = "workflow_failed"
    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    NODE_FAILED = "node_failed"
    AGENT_THINKING = "agent_thinking"
    AGENT_RESPONSE = "agent_response"
    ERROR = "error"

class SSEService:
    """SSE服务类"""
    
    def __init__(self):
        self.active_connections: Dict[str, asyncio.Queue] = {}
    
    def create_connection(self, connection_id: str) -> asyncio.Queue:
        """创建SSE连接"""
        queue = asyncio.Queue()
        self.active_connections[connection_id] = queue
        logger.info(f"Created SSE connection: {connection_id}")
        return queue
    
    def remove_connection(self, connection_id: str) -> bool:
        """移除SSE连接"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            logger.info(f"Removed SSE connection: {connection_id}")
            return True
        return False
    
    async def send_event(
        self, 
        connection_id: str, 
        event_type: str, 
        data: Any,
        event_id: Optional[str] = None
    ) -> bool:
        """发送SSE事件"""
        if connection_id not in self.active_connections:
            logger.warning(f"SSE connection {connection_id} not found")
            return False
        
        queue = self.active_connections[connection_id]
        
        try:
            event = {
                "event": event_type,
                "data": json.dumps(data) if not isinstance(data, str) else data
            }
            
            if event_id:
                event["id"] = event_id
            
            await queue.put(event)
            logger.debug(f"Sent SSE event {event_type} to {connection_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send SSE event: {e}")
            return False
    
    async def broadcast_event(
        self, 
        event_type: str, 
        data: Any,
        exclude_connections: Optional[list] = None
    ) -> int:
        """广播SSE事件到所有连接"""
        exclude_connections = exclude_connections or []
        sent_count = 0
        
        for connection_id in list(self.active_connections.keys()):
            if connection_id not in exclude_connections:
                if await self.send_event(connection_id, event_type, data):
                    sent_count += 1
        
        logger.info(f"Broadcasted {event_type} to {sent_count} connections")
        return sent_count
    
    async def create_event_stream(
        self, 
        connection_id: str,
        ping_interval: int = 30
    ) -> AsyncGenerator[Dict[str, str], None]:
        """创建SSE事件流"""
        queue = self.create_connection(connection_id)
        
        try:
            # 发送连接确认事件
            yield {
                "event": SSEEventType.CONNECTED,
                "data": json.dumps({
                    "connection_id": connection_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "connected"
                })
            }
            
            # 设置心跳任务
            async def heartbeat():
                while connection_id in self.active_connections:
                    try:
                        await asyncio.sleep(ping_interval)
                        if connection_id in self.active_connections:
                            await self.send_event(
                                connection_id,
                                SSEEventType.PING,
                                {
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "connection_id": connection_id
                                }
                            )
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.error(f"Heartbeat error for {connection_id}: {e}")
                        break
            
            heartbeat_task = asyncio.create_task(heartbeat())
            
            try:
                while True:
                    try:
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
                        break
                        
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
                
        finally:
            self.remove_connection(connection_id)
            logger.info(f"SSE stream ended for connection {connection_id}")
    
    def create_response(
        self, 
        connection_id: str,
        ping_interval: int = 30
    ) -> EventSourceResponse:
        """创建SSE响应"""
        return EventSourceResponse(
            self.create_event_stream(connection_id, ping_interval),
            ping=ping_interval
        )
    
    def get_connection_count(self) -> int:
        """获取活跃连接数"""
        return len(self.active_connections)
    
    def get_connection_ids(self) -> list:
        """获取所有连接ID"""
        return list(self.active_connections.keys())

# 全局SSE服务实例
_sse_service = SSEService()

def get_sse_service() -> SSEService:
    """获取SSE服务实例"""
    return _sse_service

# 便捷函数
async def send_workflow_event(
    connection_id: str,
    event_type: str,
    data: Dict[str, Any]
) -> bool:
    """发送工作流事件"""
    service = get_sse_service()
    return await service.send_event(connection_id, event_type, data)

async def send_agent_thinking_event(
    connection_id: str,
    node_id: str,
    thinking_content: str
) -> bool:
    """发送智能体思考事件"""
    service = get_sse_service()
    return await service.send_event(
        connection_id,
        SSEEventType.AGENT_THINKING,
        {
            "node_id": node_id,
            "content": thinking_content,
            "timestamp": datetime.now().isoformat()
        }
    )

async def send_agent_response_event(
    connection_id: str,
    node_id: str,
    response_content: str,
    model_used: str
) -> bool:
    """发送智能体响应事件"""
    service = get_sse_service()
    return await service.send_event(
        connection_id,
        SSEEventType.AGENT_RESPONSE,
        {
            "node_id": node_id,
            "content": response_content,
            "model_used": model_used,
            "timestamp": datetime.now().isoformat()
        }
    )

async def send_error_event(
    connection_id: str,
    error_message: str,
    error_code: Optional[str] = None
) -> bool:
    """发送错误事件"""
    service = get_sse_service()
    return await service.send_event(
        connection_id,
        SSEEventType.ERROR,
        {
            "message": error_message,
            "code": error_code,
            "timestamp": datetime.now().isoformat()
        }
    )