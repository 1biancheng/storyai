/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ApiResponse, ErrorResponse, ErrorCode } from '../shared/api/contracts.ts';

/**
 * 统一的API客户端类
 * 提供类型安全的前后端通信封装
 */
export class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private requestInterceptors: Array<(config: RequestConfig) => RequestConfig> = [];
  private responseInterceptors: Array<(response: any) => any> = [];
  private errorHandlers: Array<(error: ApiError) => void> = [];

  constructor(config: ApiClientConfig = {}) {
    this.baseURL = config.baseURL || (import.meta as any).env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
  }

  /**
   * 添加请求拦截器
   */
  addRequestInterceptor(interceptor: (config: RequestConfig) => RequestConfig): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * 添加响应拦截器
   */
  addResponseInterceptor(interceptor: (response: any) => any): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * 添加错误处理器
   */
  addErrorHandler(handler: (error: ApiError) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * 通用的HTTP请求方法
   */
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    let requestConfig = { ...config };
    
    // 应用请求拦截器
    for (const interceptor of this.requestInterceptors) {
      requestConfig = interceptor(requestConfig);
    }

    const url = this.buildURL(requestConfig.url, requestConfig.params);
    const options: RequestInit = {
      method: requestConfig.method || 'GET',
      headers: this.buildHeaders(requestConfig.headers),
      signal: this.createAbortSignal(),
    };

    if (requestConfig.data) {
      options.body = JSON.stringify(requestConfig.data);
    }

    try {
      const response = await this.fetchWithRetry(url, options);
      const responseData = await this.parseResponse(response);
      
      // 应用响应拦截器
      let processedData = responseData;
      for (const interceptor of this.responseInterceptors) {
        processedData = interceptor(processedData);
      }
      // 统一标准响应结构
      return this.normalizeApiResponse(processedData);
    } catch (error) {
      const apiError = this.createApiError(error);
      
      // 触发错误处理器
      for (const handler of this.errorHandlers) {
        handler(apiError);
      }
      
      throw apiError;
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(url: string, params?: Record<string, any>, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      ...config,
    });
  }

  /**
   * POST请求
   */
  async post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config,
    });
  }

  /**
   * PUT请求
   */
  async put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...config,
    });
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  /**
   * SSE连接
   */
  connectSSE(url: string, handlers: SSEHandlers): () => void {
    const eventSource = new EventSource(`${this.baseURL}${url}`);
    
    if (handlers.onMessage) {
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handlers.onMessage!(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
    }

    if (handlers.onEvent) {
      eventSource.addEventListener('message', handlers.onEvent);
    }

    if (handlers.onError) {
      eventSource.onerror = handlers.onError;
    }

    return () => {
      eventSource.close();
    };
  }

  private buildURL(url: string, params?: Record<string, any>): string {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    
    if (!params) return fullURL;
    
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    
    return `${fullURL}?${searchParams.toString()}`;
  }

  private buildHeaders(headers?: Record<string, string>): Record<string, string> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // 禁用浏览器缓存
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    };

    return { ...defaultHeaders, ...headers };
  }

  private createAbortSignal(): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), this.timeout);
    return controller.signal;
  }

  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        // 尝试解析错误响应体并抛出标准 ApiError
        const text = await response.text();
        let payload: any = undefined;
        try { payload = JSON.parse(text); } catch {}

        const errorResponse: ErrorResponse = {
          code: (payload && typeof payload.code === 'number') ? payload.code : response.status,
          message: (payload && typeof payload.message === 'string') ? payload.message : (response.statusText || 'Request failed'),
          details: (payload && typeof payload.details === 'string') ? payload.details : undefined,
          timestamp: (payload && typeof payload.timestamp === 'string') ? payload.timestamp : new Date().toISOString(), // UTC timestamp
          requestId: payload && (payload.requestId || payload.request_id) ? (payload.requestId || payload.request_id) : undefined,
          path: (payload && payload.path) || undefined,
          method: (payload && payload.method) || undefined,
        };
        throw new ApiError(errorResponse);
      }
      
      return response;
    } catch (error) {
      if (attempt < this.retryAttempts && this.isRetryableError(error)) {
        const delay = Math.pow(2, attempt) * 1000; // 指数退避
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      throw error;
    }
  }

  private async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch (error) {
      // 如果不是JSON格式,返回原始文本
      return { data: text };
    }
  }

  private isRetryableError(error: any): boolean {
    const message = error.message || '';
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }

  private createApiError(error: any): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    const errorResponse: ErrorResponse = {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(), // UTC timestamp
    };

    return new ApiError(errorResponse);
  }

  /**
   * 统一标准化 API 响应结构
   */
  private normalizeApiResponse(obj: any): ApiResponse<any> {
    const ts = new Date().toISOString();
    if (obj && typeof obj === 'object') {
      // 映射 snake_case -> camelCase
      if (obj.request_id && !obj.requestId) {
        obj.requestId = obj.request_id;
        delete obj.request_id;
      }
      // 已是标准格式
      if (typeof obj.code === 'number' && typeof obj.message === 'string' && obj.timestamp) {
        return obj as ApiResponse<any>;
      }
    }
    // 包装为标准格式
    return {
      code: ErrorCode.SUCCESS,
      message: 'ok',
      data: obj,
      timestamp: ts,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * API错误类
 */
export class ApiError extends Error {
  public readonly code: number;
  public readonly details?: string;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(errorResponse: ErrorResponse) {
    super(errorResponse.message);
    this.name = 'ApiError';
    this.code = errorResponse.code;
    this.details = errorResponse.details;
    this.timestamp = errorResponse.timestamp;
    this.requestId = errorResponse.requestId;
  }
}

/**
 * 请求配置接口
 */
interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * API客户端配置接口
 */
interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * SSE处理器接口
 */
interface SSEHandlers {
  onMessage?: (data: any) => void;
  onEvent?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
}

/**
 * 创建API客户端单例
 */
export const apiClient = new ApiClient();

/**
 * 工作流相关的API调用
 */
export class WorkflowApi {
  constructor(private client: ApiClient) {}

  /**
   * 执行工作流
   */
  async executeWorkflow(workflow: any): Promise<ApiResponse<any>> {
    return this.client.post('/execute_workflow', workflow);
  }

  /**
   * 获取工作流执行状态
   */
  async getExecutionStatus(executionId: string): Promise<ApiResponse<any>> {
    return this.client.get(`/workflow/execution/${executionId}/status`);
  }

  /**
   * 订阅工作流执行日志
   */
  subscribeToExecutionLogs(executionId: string, handlers: SSEHandlers): () => void {
    return this.client.connectSSE(`/workflow/execution/${executionId}/logs`, handlers);
  }
}

/**
 * 模型配置相关的API调用
 */
export class ModelApi {
  constructor(private client: ApiClient) {}

  /**
   * 获取所有模型配置
   */
  async getModelConfigs(): Promise<ApiResponse<any[]>> {
    return this.client.get('/api/v1/models/configs');
  }

  /**
   * 测试模型连接
   */
  async testModel(modelId: string, testPrompt?: string): Promise<ApiResponse<any>> {
    return this.client.post('/api/v1/models/test', { modelId, testPrompt });
  }

  /**
   * 保存模型配置
   */
  async saveModelConfig(config: any): Promise<ApiResponse<any>> {
    return this.client.post('/api/v1/models/configs', config);
  }
}

/**
 * 项目数据相关的API调用
 */
export class ProjectApi {
  constructor(private client: ApiClient) {}

  /**
   * 创建项目
   */
  async createProject(projectData: any): Promise<ApiResponse<any>> {
    return this.client.post('/api/v1/projects', projectData);
  }

  /**
   * 获取项目列表
   */
  async getProjects(params?: { page?: number; size?: number }): Promise<ApiResponse<any[]>> {
    return this.client.get('/api/v1/projects', params);
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<ApiResponse<any>> {
    return this.client.get(`/api/v1/projects/${projectId}`);
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, projectData: any): Promise<ApiResponse<any>> {
    return this.client.put(`/api/v1/projects/${projectId}`, projectData);
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return this.client.delete(`/api/v1/projects/${projectId}`);
  }
}

/**
 * 创建API服务实例
 */
export const workflowApi = new WorkflowApi(apiClient);
export const modelApi = new ModelApi(apiClient);
export const projectApi = new ProjectApi(apiClient);
