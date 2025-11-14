"""
@license
SPDX-License-Identifier: Apache-2.0
"""

from typing import Any, Dict, List, Optional, TypeVar, Generic, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import IntEnum, Enum

T = TypeVar('T')

class ErrorCode(IntEnum):
    """统一的错误码定义"""
    # 成功
    SUCCESS = 200
    
    # 客户端错误
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    METHOD_NOT_ALLOWED = 405
    CONFLICT = 409
    VALIDATION_ERROR = 422
    
    # 服务端错误
    INTERNAL_ERROR = 500
    SERVICE_UNAVAILABLE = 503
    AI_MODEL_ERROR = 600
    WORKFLOW_ERROR = 601
    EXTERNAL_SERVICE_ERROR = 602
    WORKFLOW_EXECUTION_ERROR = 601
    RATE_LIMIT_ERROR = 602
    
    # 业务错误
    INVALID_WORKFLOW = 700
    MODEL_CONFIG_ERROR = 701
    EXECUTION_TIMEOUT = 702
    INVALID_API_KEY = 703
    AI_API_ERROR = 704
    AI_SERVICE_ERROR = 705
    UNSUPPORTED_MODEL = 706

class ApiResponse(BaseModel, Generic[T]):
    """统一的API响应格式"""
    code: int = Field(..., description="响应状态码")
    message: str = Field(..., description="响应消息")
    data: Optional[T] = Field(None, description="响应数据")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="时间戳")
    request_id: Optional[str] = Field(None, description="请求ID,用于追踪")

class ErrorResponse(BaseModel):
    """错误响应格式"""
    code: int = Field(..., description="错误码")
    message: str = Field(..., description="错误消息")
    details: Optional[str] = Field(None, description="详细错误信息")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="时间戳")
    request_id: Optional[str] = Field(None, description="请求ID")
    path: Optional[str] = Field(None, description="请求路径")
    method: Optional[str] = Field(None, description="请求方法")

class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应格式"""
    code: int = Field(default=200, description="响应状态码")
    message: str = Field(default="success", description="响应消息")
    data: List[T] = Field(..., description="数据列表")
    pagination: Dict[str, int] = Field(..., description="分页信息")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="时间戳")

# 工作流相关契约
class AgentType(str, Enum):
    """智能体类型枚举"""
    COORDINATOR = "协调器智能体"
    DATA_ANALYZER = "数据分析智能体"
    OUTLINE_GENERATOR = "大纲智能体"
    GENERATOR_AGENT = "生成器智能体"
    CHAPTER_WRITER = "章节写作智能体"
    SECTION_WRITER = "段落写作智能体"
    REVIEWER = "审查智能体"
    EDITOR = "编辑智能体"
    QUALITY_EVALUATOR = "质量评估智能体"
    SUMMARY_AGENT = "摘要生成智能体"
    SYSTEM = "系统"

class WorkflowNodeConfig(BaseModel):
    """工作流节点配置基类"""
    node_id: str = Field(..., description="节点唯一标识")
    node_type: str = Field(..., description="节点类型,如 agent、tool、data 等")
    name: str = Field(..., description="节点名称,用于展示")
    description: Optional[str] = Field(None, description="节点描述")
    inputs: Optional[List[str]] = Field(None, description="输入参数名列表")
    outputs: Optional[List[str]] = Field(None, description="输出参数名列表")
    timeout: Optional[int] = Field(30, description="节点执行超时时间(秒)")
    retry: Optional[int] = Field(0, description="失败重试次数")

class AgentNodeConfig(WorkflowNodeConfig):
    """智能体节点配置"""
    agent_type: str = Field(..., description="智能体类型")
    model_id: Optional[str] = Field(None, description="模型ID")
    prompt: Optional[str] = Field(None, description="提示词")
    parameters: Optional[Dict[str, Any]] = Field(None, description="额外参数")

    @validator('agent_type')
    def validate_agent_type(cls, v):
        """验证智能体类型是否有效"""
        valid_types = [agent_type.value for agent_type in AgentType]
        if v not in valid_types:
            raise ValueError(f"无效的智能体类型: {v}. 有效类型: {valid_types}")
        return v

    model_config = {
        "protected_namespaces": (),
    }

class ToolNodeConfig(WorkflowNodeConfig):
    """工具节点配置"""
    tool_type: str = Field(..., description="工具类型")
    function_body: Optional[str] = Field(None, description="函数体")
    parameters: Optional[Dict[str, Any]] = Field(None, description="额外参数")

class DataNodeConfig(WorkflowNodeConfig):
    """数据节点配置"""
    data_type: str = Field(..., description="数据类型")
    content: Optional[str] = Field(None, description="内容")
    file_name: Optional[str] = Field(None, description="文件名")
    format: Optional[str] = Field(None, description="格式")

class WorkflowNodeContract(BaseModel):
    """工作流节点契约"""
    id: str = Field(..., description="节点ID")
    name: str = Field(..., description="节点名称")
    type: str = Field(..., description="节点类型")
    config: Union[AgentNodeConfig, ToolNodeConfig, DataNodeConfig, WorkflowNodeConfig] = Field(..., description="节点配置")
    
    @validator('config', pre=True)
    def validate_config(cls, v, values):
        """根据节点类型验证配置"""
        if isinstance(v, dict):
            node_type = values.get('type', '')
            if node_type == 'agent':
                return AgentNodeConfig(**v)
            elif node_type == 'tool':
                return ToolNodeConfig(**v)
            elif node_type == 'data':
                return DataNodeConfig(**v)
            else:
                return WorkflowNodeConfig(**v)
        return v

class WorkflowEdgeContract(BaseModel):
    """工作流边契约"""
    id: str = Field(..., description="边ID")
    source: str = Field(..., description="源节点ID")
    target: str = Field(..., description="目标节点ID")
    condition: Optional[str] = Field(None, description="条件表达式")

class WorkflowExecutionRequest(BaseModel):
    """工作流执行请求"""
    workflow_id: str = Field(..., description="工作流ID")
    nodes: List[WorkflowNodeContract] = Field(..., description="节点列表")
    edges: List[WorkflowEdgeContract] = Field(..., description="边列表")
    context: Optional[Dict[str, Any]] = Field(None, description="执行上下文")

class WorkflowExecutionResponse(BaseModel):
    """工作流执行响应"""
    execution_id: str = Field(..., description="执行ID")
    status: str = Field(..., description="执行状态")
    execution_order: List[str] = Field(..., description="执行顺序")
    outputs: Dict[str, Any] = Field(..., description="节点输出")
    start_time: str = Field(..., description="开始时间")
    end_time: Optional[str] = Field(None, description="结束时间")
    error: Optional[str] = Field(None, description="错误信息")

# 模型配置相关契约
class ModelProvider(str, Enum):
    """模型提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    CUSTOM = "custom"

class ModelConfigContract(BaseModel):
    """模型配置契约"""
    id: str = Field(..., description="配置ID")
    name: str = Field(..., description="配置名称")
    model_id: str = Field(..., description="模型ID")
    provider: ModelProvider = Field(..., description="模型提供商")
    base_url: Optional[str] = Field(None, description="基础URL")
    api_key: Optional[str] = Field(None, description="API密钥")
    parameters: Optional[Dict[str, Any]] = Field(None, description="模型参数")
    is_default: bool = Field(default=False, description="是否默认配置")

    model_config = {
        "protected_namespaces": (),
    }

class ModelTestRequest(BaseModel):
    """模型测试请求"""
    model_id: str = Field(..., description="模型ID")
    test_prompt: Optional[str] = Field("Hello, World!", description="测试提示词")

    model_config = {
        "protected_namespaces": (),
    }

class ModelTestResponse(BaseModel):
    """模型测试响应"""
    success: bool = Field(..., description="是否成功")
    response: Optional[str] = Field(None, description="响应内容")
    error: Optional[str] = Field(None, description="错误信息")
    latency: Optional[float] = Field(None, description="延迟时间(秒)")

# 项目数据相关契约
class ProjectSettings(BaseModel):
    """项目设置"""
    chapter_count: Optional[int] = Field(None, description="章节数量")
    words_per_chapter: Optional[int] = Field(None, description="每章字数")
    enable_thinking_mode: Optional[bool] = Field(None, description="是否启用思考模式")
    enable_search_grounding: Optional[bool] = Field(None, description="是否启用搜索接地")
    search_provider: Optional[str] = Field(None, description="搜索提供商")

class ProjectDataContract(BaseModel):
    """项目数据契约"""
    id: str = Field(..., description="项目ID")
    name: str = Field(..., description="项目名称")
    genre: str = Field(..., description="项目类型")
    requirements: str = Field(..., description="项目需求")
    workflow_id: str = Field(..., description="工作流ID")
    settings: Optional[ProjectSettings] = Field(None, description="项目设置")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")

# SSE事件相关契约
class SSEEvent(BaseModel, Generic[T]):
    """SSE事件格式"""
    event: str = Field(..., description="事件类型")
    data: T = Field(..., description="事件数据")
    id: Optional[str] = Field(None, description="事件ID")
    retry: Optional[int] = Field(None, description="重试间隔")

class AgentLogEvent(BaseModel):
    """智能体日志事件"""
    execution_id: str = Field(..., description="执行ID")
    node_id: str = Field(..., description="节点ID")
    agent_type: str = Field(..., description="智能体类型")
    status: str = Field(..., description="状态")
    message: str = Field(..., description="消息")
    output: Optional[Any] = Field(None, description="输出")
    error: Optional[str] = Field(None, description="错误")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="时间戳")

# 工具函数
def success_response(data: Any = None, message: str = "success", request_id: Optional[str] = None) -> Dict[str, Any]:
    """创建成功响应"""
    return {
        "code": ErrorCode.SUCCESS,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat(),
        "request_id": request_id
    }

def error_response(code: int, message: str, details: Optional[str] = None, request_id: Optional[str] = None) -> Dict[str, Any]:
    """创建错误响应"""
    return {
        "code": code,
        "message": message,
        "details": details,
        "timestamp": datetime.now().isoformat(),
        "request_id": request_id
    }

def paginated_response(data: List[Any], page: int, size: int, total: int, request_id: Optional[str] = None) -> Dict[str, Any]:
    """创建分页响应"""
    total_pages = (total + size - 1) // size
    return {
        "code": ErrorCode.SUCCESS,
        "message": "success",
        "data": data,
        "pagination": {
            "page": page,
            "size": size,
            "total": total,
            "total_pages": total_pages
        },
        "timestamp": datetime.now().isoformat(),
        "request_id": request_id
    }