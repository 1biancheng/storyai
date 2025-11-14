/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * 统一的API响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 错误响应格式
 */
export interface ErrorResponse {
  code: number;
  message: string;
  details?: string;
  timestamp: string;
  requestId?: string;
  path?: string;
  method?: string;
}

/**
 * 工作流相关API契约
 */
export interface WorkflowExecutionRequest {
  workflowId: string;
  nodes: WorkflowNodeContract[];
  edges: WorkflowEdgeContract[];
  context?: Record<string, any>;
}

export interface WorkflowExecutionResponse {
  executionId: string;
  status: 'running' | 'completed' | 'failed';
  executionOrder: string[];
  outputs: Record<string, any>;
  startTime: string;
  endTime?: string;
  error?: string;
}

export interface WorkflowNodeContract {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'data';
  config: AgentNodeConfig | ToolNodeConfig | DataNodeConfig;
}

export interface WorkflowEdgeContract {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface AgentNodeConfig {
  agentType: string;
  modelId?: string;
  prompt?: string;
  parameters?: Record<string, any>;
}

export interface ToolNodeConfig {
  toolType: string;
  functionBody?: string;
  parameters?: Record<string, any>;
}

export interface DataNodeConfig {
  dataType: 'raw_text' | 'file' | 'structured';
  content?: string;
  fileName?: string;
  format?: string;
}

/**
 * 模型配置相关API契约
 */
export interface ModelConfigContract {
  id: string;
  name: string;
  modelId: string;
  provider: 'openai' | 'anthropic' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  parameters?: Record<string, any>;
  isDefault?: boolean;
}

export interface ModelTestRequest {
  modelId: string;
  testPrompt?: string;
}

export interface ModelTestResponse {
  success: boolean;
  response?: string;
  error?: string;
  latency?: number;
}

/**
 * 项目数据相关API契约
 */
export interface ProjectDataContract {
  id: string;
  name: string;
  genre: string;
  requirements: string;
  workflowId: string;
  settings?: ProjectSettings;
  metadata?: Record<string, any>;
}

export interface ProjectSettings {
  chapterCount?: number;
  wordsPerChapter?: number;
  enableThinkingMode?: boolean;
  enableSearchGrounding?: boolean;
  searchProvider?: 'google' | 'bing' | 'baidu';
}

/**
 * SSE事件相关契约
 */
export interface SSEEvent<T = any> {
  event: string;
  data: T;
  id?: string;
  retry?: number;
}

export interface AgentLogEvent {
  executionId: string;
  nodeId: string;
  agentType: string;
  status: 'started' | 'processing' | 'completed' | 'failed';
  message: string;
  output?: any;
  error?: string;
  timestamp: string;
}

/**
 * 统一的错误码定义
 */
export enum ErrorCode {
  // 成功
  SUCCESS = 200,
  
  // 客户端错误
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  VALIDATION_ERROR = 422,
  
  // 服务端错误
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
  AI_MODEL_ERROR = 600,
  WORKFLOW_EXECUTION_ERROR = 601,
  RATE_LIMIT_ERROR = 602,
  
  // 业务错误
  INVALID_WORKFLOW = 700,
  MODEL_CONFIG_ERROR = 701,
  EXECUTION_TIMEOUT = 702,
}