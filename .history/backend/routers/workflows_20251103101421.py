"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from typing import List, Optional, Dict, Any
import asyncio
import logging
from datetime import datetime
import uuid
import json
from sse_starlette.sse import EventSourceResponse

from api_framework import ApiException, ErrorCode, get_request_id, log_request, log_response
from errors import sse_error_event, DomainError, restful_error
from contracts import (
    ApiResponse, WorkflowExecutionRequest, WorkflowExecutionResponse,
    WorkflowNodeContract, WorkflowEdgeContract, success_response, error_response,
    AgentNodeConfig
)

router = APIRouter(tags=["workflows"])
logger = logging.getLogger(__name__)

# 工作流执行状态存储(实际项目中应该使用数据库或Redis)
workflow_executions: Dict[str, Any] = {}
workflow_event_queues: Dict[str, asyncio.Queue] = {}

@router.post("/run", response_model=ApiResponse[WorkflowExecutionResponse])
async def run_workflow(
    workflow_request: WorkflowExecutionRequest,
    request: Request
):
    """启动工作流执行"""
    log_request(request, workflow_request.dict())
    
    try:
        # 执行前验证工作流结构
        validate_workflow_structure(workflow_request, request)
        
        execution_id = str(uuid.uuid4())
        
        workflow_executions[execution_id] = {
            "id": execution_id,
            "status": "starting",
            "start_time": datetime.now().isoformat(),
            "nodes_completed": [],
            "nodes_failed": [],
            "results": {}
        }
        workflow_event_queues[execution_id] = asyncio.Queue()
        
        asyncio.create_task(run_workflow_nodes(
            workflow_request.nodes,
            workflow_request.edges,
            execution_id,
            request
        ))
        
        response_data = WorkflowExecutionResponse(
            execution_id=execution_id,
            status="starting",
            execution_order=[],
            outputs={},
            start_time=datetime.now().isoformat(),
            end_time=None,
            error=None
        )
        
        response = success_response(
            response_data.dict(), 
            "工作流已启动",
            get_request_id(request)
        )
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"启动工作流失败: {str(e)}")
        import traceback
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.WORKFLOW_ERROR,
            message="启动工作流失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/stream/{execution_id}")
async def stream_workflow_events(execution_id: str, request: Request):
    """流式传输工作流执行事件"""    
    log_request(request)
    
    logger.info(f"SSE stream requested for execution_id: {execution_id}")
    logger.info(f"Available execution_ids: {list(workflow_event_queues.keys())}")
    
    if execution_id not in workflow_event_queues:
        logger.error(f"Execution ID {execution_id} not found in queues")
        return restful_error(DomainError.NOT_FOUND, f"执行ID {execution_id} 不存在", status_code=404)

    async def event_generator():
        queue = workflow_event_queues[execution_id]
        logger.info(f"Starting SSE stream for execution_id: {execution_id}")
        
        try:
            # 发送连接确认事件
            yield {
                "event": "connected",
                "data": json.dumps({
                    "executionId": execution_id,
                    "status": "connected",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
            }
            
            while True:
                try:
                    # 设置超时避免无限等待
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if event is None:  # 结束信号
                        logger.info(f"Received end signal for execution_id: {execution_id}")
                        break
                    
                    logger.debug(f"Sending event: {event}")
                    # 正确的SSE格式:返回字典而不是JSON字符串
                    yield {
                        "event": event.get("event", "message"),
                        "data": json.dumps(event.get("data", event))
                    }
                except asyncio.TimeoutError:
                    # 发送心跳事件(统一为 ping)
                    yield {
                        "event": "ping",
                        "data": json.dumps({
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "executionId": execution_id
                        })
                    }
                except Exception as e:
                    logger.error(f"Error in event generator: {str(e)}")
                    yield sse_error_event(DomainError.WORKFLOW_ERROR, str(e))
                    break
        except Exception as e:
            logger.error(f"Fatal error in SSE stream: {str(e)}")
            yield sse_error_event(DomainError.INTERNAL_ERROR, f"Stream error: {str(e)}")
        finally:
            logger.info(f"Cleaning up SSE stream for execution_id: {execution_id}")
            # 清理队列
            if execution_id in workflow_event_queues:
                del workflow_event_queues[execution_id]

    try:
        response = EventSourceResponse(event_generator(), ping=15)
        logger.info(f"EventSourceResponse created for execution_id: {execution_id}")
        return response
    except Exception as e:
        logger.error(f"Failed to create EventSourceResponse: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message=f"创建SSE响应失败: {str(e)}"
        )

@router.post("/execute", response_model=ApiResponse[WorkflowExecutionResponse], deprecated=True)
async def execute_workflow(
    workflow_request: WorkflowExecutionRequest,
    request: Request
):
    """执行工作流"""
    log_request(request, workflow_request.dict())
    
    try:
        # 生成执行ID
        execution_id = str(uuid.uuid4())
        
        # 创建工作流执行记录
        start_time = datetime.now(timezone.utc)
        execution = {
            "id": execution_id,
            "status": "running",
            "start_time": start_time.isoformat(),
            "nodes_completed": [],
            "nodes_failed": [],
            "results": {}
        }
        workflow_executions[execution_id] = execution
        
        # 执行工作流
        result = await run_workflow_nodes(
            workflow_request.nodes,
            workflow_request.edges,
            execution_id,
            request
        )
        
        # 更新执行状态
        end_time = datetime.now(timezone.utc)
        execution["status"] = "completed" if result["success"] else "failed"
        execution["end_time"] = end_time.isoformat()
        execution["results"] = result["results"]
        
        response_data = WorkflowExecutionResponse(
            execution_id=execution_id,
            status="completed" if result.get("success") else "failed",
            execution_order=result.get("execution_order", []),
            outputs=result.get("results", {}),
            start_time=start_time.isoformat(),
            end_time=end_time.isoformat(),
            error=None if result.get("success") else "Workflow execution failed"
        )
        
        response = success_response(
            response_data.dict(), 
            "工作流执行完成" if result["success"] else "工作流执行失败",
            get_request_id(request)
        )
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"执行工作流失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.WORKFLOW_ERROR,
            message="执行工作流失败",
            details=str(e),
            request_id=get_request_id(request)
        )

@router.get("/status/{execution_id}", response_model=ApiResponse[Dict[str, Any]])
async def get_workflow_status(
    execution_id: str,
    request: Request
):
    """获取工作流执行状态"""
    log_request(request)
    
    try:
        execution = workflow_executions.get(execution_id)
        if not execution:
            raise ApiException(
                status_code=status.HTTP_404_NOT_FOUND,
                code=ErrorCode.NOT_FOUND,
                message=f"工作流执行ID {execution_id} 不存在",
                request_id=get_request_id(request)
            )
        
        # 计算持续时间
        duration = None
        if execution.get("end_time"):
            duration = (execution["end_time"] - execution["start_time"]).total_seconds()
        
        status_data = {
            "execution_id": execution_id,
            "status": execution["status"],
            "start_time": execution["start_time"],
            "duration": duration,
            "nodes_completed": execution["nodes_completed"],
            "nodes_failed": execution["nodes_failed"]
        }
        
        response = success_response(status_data, "获取执行状态成功", get_request_id(request))
        log_response(request, response)
        return response
        
    except ApiException:
        raise
    except Exception as e:
        logger.error(f"获取工作流执行状态失败: {str(e)}")   
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message="获取工作流执行状态失败",
            details=str(e),
            request_id=get_request_id(request)
        )

def validate_workflow_structure(
    workflow_request: WorkflowExecutionRequest,
    request: Request
) -> None:
    """验证工作流结构完整性"""
    nodes = workflow_request.nodes
    edges = workflow_request.edges
    
    # 1. 基础验证
    if not nodes or len(nodes) == 0:
        raise ApiException(
            status_code=400,
            code=ErrorCode.VALIDATION_ERROR,
            message="工作流不能为空",
            request_id=get_request_id(request)
        )
    
    # 2. 验证边的连接节点存在性
    node_ids = {node.id for node in nodes}
    for edge in edges:
        if edge.source not in node_ids:
            raise ApiException(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR,
                message=f"边 {edge.id} 的源节点 {edge.source} 不存在",
                request_id=get_request_id(request)
            )
        if edge.target not in node_ids:
            raise ApiException(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR,
                message=f"边 {edge.id} 的目标节点 {edge.target} 不存在",
                request_id=get_request_id(request)
            )
    
    # 3. 验证节点配置完整性
    for node in nodes:
        if node.type == 'agent':
            if not hasattr(node.config, 'agent_type') and not hasattr(node.config, 'agentType'):
                logger.warning(f"节点 {node.id} 缺少 agent_type,将使用默认值")
        elif node.type == 'tool':
            if hasattr(node.config, 'tool_type'):
                supported_tools = ['http_request', 'file_read', 'file_write', 'code_interpreter', 'image_generator', 'tts_generator']
                tool_type = getattr(node.config, 'tool_type', None)
                if tool_type and tool_type not in supported_tools:
                    raise ApiException(
                        status_code=400,
                        code=ErrorCode.VALIDATION_ERROR,
                        message=f"节点 {node.id} 的工具类型 {tool_type} 不受支持.支持的类型:{supported_tools}",
                        request_id=get_request_id(request)
                    )
        elif node.type == 'data':
            if hasattr(node.config, 'data_type'):
                supported_data_types = ['json', 'csv', 'text', 'file', 'raw_text', 'scene_cards', 'local_file']
                data_type = getattr(node.config, 'data_type', None)
                if data_type and data_type not in supported_data_types:
                    raise ApiException(
                        status_code=400,
                        code=ErrorCode.VALIDATION_ERROR,
                        message=f"节点 {node.id} 的数据类型 {data_type} 不受支持.支持的类型:{supported_data_types}",
                        request_id=get_request_id(request)
                    )
    
    # 4. 检测循环依赖(拓扑排序预检)
    dependencies = {node.id: set() for node in nodes}
    for edge in edges:
        dependencies[edge.target].add(edge.source)
    
    visited = set()
    temp_visited = set()
    
    def has_cycle(node_id: str) -> bool:
        if node_id in temp_visited:
            return True
        if node_id in visited:
            return False
        
        temp_visited.add(node_id)
        for dep in dependencies.get(node_id, []):
            if has_cycle(dep):
                return True
        temp_visited.remove(node_id)
        visited.add(node_id)
        return False
    
    for node_id in dependencies.keys():
        if has_cycle(node_id):
            raise ApiException(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR,
                message="工作流存在循环依赖,无法执行",
                request_id=get_request_id(request)
            )
    
    # 5. 检测孤立节点(警告)
    connected_nodes = set()
    for edge in edges:
        connected_nodes.add(edge.source)
        connected_nodes.add(edge.target)
    
    isolated_nodes = node_ids - connected_nodes
    if isolated_nodes and len(nodes) > 1:
        logger.warning(f"工作流中存在孤立节点: {isolated_nodes},这些节点可能不会被执行")


async def run_workflow_nodes(
    nodes: List[WorkflowNodeContract],
    edges: List[WorkflowEdgeContract],
    execution_id: str,
    request: Request
) -> Dict[str, Any]:
    """执行工作流节点"""
    
    # 构建依赖关系
    dependencies = {}
    dependents = {}
    node_map = {node.id: node for node in nodes}
    
    for node in nodes:
        dependencies[node.id] = set()
        dependents[node.id] = set()
    
    for edge in edges:
        dependencies[edge.target].add(edge.source)
        dependents[edge.source].add(edge.target)
    
    # 拓扑排序
    execution_order = []
    ready_nodes = [node.id for node in nodes if not dependencies[node.id]]
    
    while ready_nodes:
        current_id = ready_nodes.pop(0)
        execution_order.append(current_id)
        
        # 移除当前节点的依赖
        for dependent_id in dependents[current_id]: 
            dependencies[dependent_id].remove(current_id)
            if not dependencies[dependent_id]:
                ready_nodes.append(dependent_id)
    
    # 检查是否有循环依赖
    if len(execution_order) != len(nodes):
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message="工作流存在循环依赖",
            request_id=get_request_id(request)
        )
    
    # 执行节点
    results = {}
    execution = workflow_executions[execution_id]
    queue = workflow_event_queues.get(execution_id)

    async def send_event(event_type: str, data: Any):
        if queue:
            await queue.put({"event": event_type, "data": data})

    await send_event("workflow_started", {"execution_id": execution_id})
    
    for node_id in execution_order:
        node = node_map[node_id]
        
        # 获取节点超时配置,默认30秒
        timeout = getattr(node.config, 'timeout', 30) if hasattr(node.config, 'timeout') else 30
        retry_count = getattr(node.config, 'retry', 0) if hasattr(node.config, 'retry') else 0
        
        attempt = 0
        last_error = None
        
        while attempt <= retry_count:
            try:
                await send_event("node_started", {"node_id": node_id, "attempt": attempt + 1})
                
                # 执行节点,带超时控制
                node_result = await asyncio.wait_for(
                    execute_node(node, results, request),
                    timeout=timeout
                )
                results[node_id] = node_result
            
            # 更新执行状态
                execution["nodes_completed"].append(node_id)
                await send_event("node_completed", {"node_id": node_id, "result": node_result})
                break  # 成功执行,跳出重试循环
                
            except asyncio.TimeoutError:
                last_error = f"节点执行超时({timeout}秒)"
                logger.error(f"节点 {node_id} 执行超时: {timeout}秒")
                
                if attempt < retry_count:
                    backoff = min(2 ** attempt, 8)  # 指数退避,最大8秒
                    logger.info(f"节点 {node_id} 将在 {backoff} 秒后重试(第 {attempt + 2}/{retry_count + 1} 次尝试)")
                    await asyncio.sleep(backoff)
                    attempt += 1
                else:
                    raise TimeoutError(last_error)
                    
            except Exception as e:
                last_error = str(e)
                logger.error(f"节点 {node_id} 执行失败(尝试 {attempt + 1}/{retry_count + 1}): {str(e)}")
                
                if attempt < retry_count:
                    backoff = min(2 ** attempt, 8)
                    logger.info(f"节点 {node_id} 将在 {backoff} 秒后重试")
                    await asyncio.sleep(backoff)
                    attempt += 1
                else:
                    raise
        
        # 如果所有重试都失败,处理最终错误
        if last_error and attempt > retry_count:
            e = Exception(last_error)
            logger.error(f"节点 {node_id} 执行失败: {str(e)}")
            logger.error(f"节点配置: {node.config}")
            logger.error(f"错误详情: {type(e).__name__}: {e}")
            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
            
            execution["nodes_failed"].append(node_id)
            
            # 发送详细的错误事件
            error_detail = {
                "node_id": node_id,
                "error": str(e),
                "error_type": type(e).__name__,
                "timestamp": datetime.now().isoformat(),
                "retry_attempts": attempt,
                "request_id": get_request_id(request)
            }
            await send_event("node_failed", error_detail)
            
            execution["status"] = "failed"
            await send_event("workflow_failed", {"error": f"节点 {node_id} 执行失败"})
            if queue:
                await queue.put(None)
            return {}
    
    execution["status"] = "completed"
    await send_event("workflow_completed", {"results": results})
    if queue:
        await queue.put(None)
    
    return {"success": True, "results": results, "execution_order": execution_order}

async def execute_node(
    node: WorkflowNodeContract,
    previous_results: Dict[str, Any],
    request: Request
) -> Any:
    """执行单个节点"""
    
    if node.type == "agent":
        return await execute_agent_node(node, previous_results, request)
    elif node.type == "tool":
        return await execute_tool_node(node, previous_results, request)
    elif node.type == "data":
        return await execute_data_node(node, previous_results, request)
    else:
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"不支持的节点类型: {node.type}",
            request_id=get_request_id(request)
        )

async def execute_agent_node(
    node: WorkflowNodeContract,
    previous_results: Dict[str, Any],
    request: Request
) -> Any:
    """执行代理节点"""
    logger.info(f"执行智能体节点 {node.id}")
    
    # 检查配置是否存在
    if not node.config or node.type != "agent":
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"代理节点 {node.id} 缺少配置或类型不匹配",
            request_id=get_request_id(request)
        )
    
    # 将基类配置转换为AgentNodeConfig
    try:
        from contracts import AgentNodeConfig
        
        logger.info(f"节点 {node.id} 配置类型: {type(node.config)}")
        logger.info(f"节点 {node.id} 配置内容: {node.config}")
        
        # 直接使用已经验证的配置对象
        if isinstance(node.config, AgentNodeConfig):    
            agent_config = node.config
            logger.info(f"节点 {node.id} 使用已验证的AgentNodeConfig")
        else:
            # 如果不是AgentNodeConfig类型,尝试转换
            if hasattr(node.config, 'dict'):
                config_dict = node.config.dict()
            elif isinstance(node.config, dict):
                config_dict = node.config
            else:
                # 尝试将对象转换为字典
                config_dict = vars(node.config) if hasattr(node.config, '__dict__') else {}
            
            logger.info(f"节点 {node.id} 原始配置内容: {config_dict}")
            
            # 检查是否有agent_type字段,如果没有则从节点的其他属性中获取
            if 'agent_type' not in config_dict:
                logger.warning(f"节点 {node.id} 配置中缺少agent_type字段,尝试从其他属性推断")
                
                # 如果配置中有agentType字段(前端可能使用驼峰命名)
                if 'agentType' in config_dict:
                    config_dict['agent_type'] = config_dict['agentType']
                    logger.info(f"从agentType字段获取agent_type: {config_dict['agent_type']}")
                else:
                    # 默认设置为生成器智能体
                    config_dict['agent_type'] = "生成器智能体"
                    logger.warning(f"未找到agent_type,使用默认值: {config_dict['agent_type']}")
            
            # 确保必要的字段存在,如果不存在则设置默认值
            if 'model_id' not in config_dict:   
                config_dict['model_id'] = "gpt-3.5-turbo"
                logger.info(f"设置默认model_id: {config_dict['model_id']}")
            
            if 'prompt' not in config_dict:
                config_dict['prompt'] = f"你是一个{config_dict.get('agent_type', '智能')}助手"
                logger.info(f"设置默认prompt: {config_dict['prompt']}")
            
            logger.info(f"节点 {node.id} 最终配置内容: {config_dict}")
            agent_config = AgentNodeConfig(**config_dict)
        
    except Exception as e:
        logger.error(f"节点 {node.id} 配置解析失败: {str(e)}")
        logger.error(f"配置内容: {node.config.dict() if hasattr(node.config, 'dict') else node.config}")
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"代理节点 {node.id} 配置格式错误: {str(e)}",
            request_id=get_request_id(request)
        )
    
    # 构建输入提示词
    input_data = ""
    for result_key, result_value in previous_results.items():
        if isinstance(result_value, dict) and "output" in result_value:
            input_data += f"{result_value['output']}\n"
        else:
            input_data += f"{result_value}\n"
    
    # 组合最终提示词
    final_prompt = agent_config.prompt or f"你是一个{agent_config.agent_type}助手"
    if input_data.strip():
        final_prompt += f"\n\n输入数据:\n{input_data.strip()}"
    
    logger.info(f"Executing node '{node.name}' (type: {node.type}) with input: {final_prompt[:100]}...")
    
    # 调用AI服务
    try:
        from services.ai_service import get_ai_service
        ai_service = await get_ai_service()
        result = await ai_service.run_agent(
            prompt=final_prompt,
            model_id=agent_config.model_id or "gemini-pro",
            parameters=agent_config.parameters
        )
        
        logger.info(f"  -> Output of '{node.name}': {result[:100]}...")
        
        return {
            "type": "agent",
            "agent_type": agent_config.agent_type,
            "output": result,
            "model_used": agent_config.model_id or "gemini-pro",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"节点 {node.id} AI服务调用失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.AI_MODEL_ERROR,
            message=f"代理节点 {node.id} AI服务调用失败: {str(e)}",
            request_id=get_request_id(request)
        )

async def execute_tool_node(
    node: WorkflowNodeContract,
    previous_results: Dict[str, Any],
    request: Request
) -> Any:
    """执行工具节点"""
    
    if not node.config or node.type != "tool":
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"工具节点 {node.id} 缺少配置或类型不匹配",
            request_id=get_request_id(request)
        )
    
    # 将基类配置转换为ToolNodeConfig
    try:
        from contracts import ToolNodeConfig
        tool_config = ToolNodeConfig(**node.config.dict())
    except Exception as e:
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"工具节点 {node.id} 配置格式错误: {str(e)}",
            request_id=get_request_id(request)
        )
    
    # 获取工具参数
    tool_params = tool_config.parameters or {}
    
    # 根据工具类型执行实际逻辑
    try:
        if tool_config.tool_type == "http_request":
            import aiohttp
            async with aiohttp.ClientSession() as session:
                method = tool_params.get("method", "GET").upper()
                url = tool_params.get("url", "")
                headers = tool_params.get("headers", {})
                body = tool_params.get("body", None)
                
                if method == "GET":
                    async with session.get(url, headers=headers) as resp:
                        resp.raise_for_status()
                        result = await resp.json() if resp.headers.get("content-type", "").startswith("application/json") else await resp.text()
                elif method == "POST":
                    async with session.post(url, json=body, headers=headers) as resp:
                        resp.raise_for_status()
                        result = await resp.json() if resp.headers.get("content-type", "").startswith("application/json") else await resp.text()
                elif method == "PUT":
                    async with session.put(url, json=body, headers=headers) as resp:
                        resp.raise_for_status()
                        result = await resp.json() if resp.headers.get("content-type", "").startswith("application/json") else await resp.text()
                elif method == "DELETE":
                    async with session.delete(url, headers=headers) as resp:
                        resp.raise_for_status()
                        result = await resp.json() if resp.headers.get("content-type", "").startswith("application/json") else await resp.text()
                else:
                    raise ValueError(f"不支持的HTTP方法: {method}")
                
                result = result
                
        elif tool_config.tool_type == "file_read":
            import aiofiles
            file_path = tool_params.get("file_path", "")
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                result = await f.read()
                
        elif tool_config.tool_type == "file_write":
            import aiofiles
            file_path = tool_params.get("file_path", "")
            content = tool_params.get("content", "")
            async with aiofiles.open(file_path, "w", encoding="utf-8") as f:
                await f.write(content)
            result = {"status": "written", "file_path": file_path}
            
        else:
            raise ValueError(f"不支持的工具类型: {tool_config.tool_type}")
            
        return {
            "type": "tool",
            "tool_type": tool_config.tool_type,
            "output": result,
            "parameters": tool_params,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"工具节点 {node.id} 执行失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message=f"工具节点 {node.id} 执行失败: {str(e)}",
            request_id=get_request_id(request)
        )

async def execute_data_node(
    node: WorkflowNodeContract,
    previous_results: Dict[str, Any],
    request: Request
) -> Any:
    """执行数据节点"""
    
    if not node.config or node.type != "data":
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"数据节点 {node.id} 缺少配置或类型不匹配",
            request_id=get_request_id(request)
        )
    
    # 将基类配置转换为DataNodeConfig
    try:
        from contracts import DataNodeConfig
        import json
        import csv
        import io
        import aiofiles
        data_config = DataNodeConfig(**node.config.dict())
    except Exception as e:
        raise ApiException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code=ErrorCode.VALIDATION_ERROR,
            message=f"数据节点 {node.id} 配置格式错误: {str(e)}",
            request_id=get_request_id(request)
        )
    
    # 根据 data_type 执行真实的数据处理逻辑
    try:
        if data_config.data_type == "json":
            # 如果 content 是字符串,尝试解析为 JSON;否则直接返回
            if isinstance(data_config.content, str):
                # 使用安全的JSON解析
                from services.json_repairer import safe_json_loads
                output = safe_json_loads(data_config.content, {})
            else:
                output = data_config.content

        elif data_config.data_type == "csv":
            if isinstance(data_config.content, str):
                reader = csv.DictReader(io.StringIO(data_config.content))
                output = list(reader)
            else:
                raise ValueError("CSV 类型要求 content 为字符串")

        elif data_config.data_type == "text":
            # 文本类型直接返回 content
            output = data_config.content

        elif data_config.data_type == "file":
            # 读取指定路径的文件内容
            file_path = data_config.content
            if not file_path:
                raise ValueError("文件类型需要指定文件路径")
            async with aiofiles.open(file_path, "r", encoding="utf-8") as f:
                output = await f.read()

        else:
            raise ValueError(f"不支持的数据类型: {data_config.data_type}")

        return {
            "type": "data",
            "data_type": data_config.data_type,
            "output": output,
            "content": data_config.content,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"数据节点 {node.id} 执行失败: {str(e)}")
        raise ApiException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=ErrorCode.INTERNAL_ERROR,
            message=f"数据节点 {node.id} 执行失败: {str(e)}",
            request_id=get_request_id(request)
        )
