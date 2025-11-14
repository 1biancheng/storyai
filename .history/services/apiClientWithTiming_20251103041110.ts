/**
 * API客户端包装器
 * 自动测量API请求执行时间
 */

import { commandTimer } from './commandTimer';

export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    duration?: number;
}

export interface ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    credentials?: 'include' | 'same-origin' | 'omit';
}

class ApiClient {
    private baseUrl: string;
    private defaultHeaders: Record<string, string>;
    private timeout: number;

    constructor(baseUrl: string = '', defaultHeaders: Record<string, string> = {}, timeout: number = 30000) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...defaultHeaders
        };
        this.timeout = timeout;
    }

    /**
     * 发送API请求并自动测量执行时间
     * @param endpoint API端点
     * @param options 请求选项
     * @returns API响应
     */
    async request<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        const method = options.method || 'GET';
        const headers = { ...this.defaultHeaders, ...options.headers };
        
        // 构建请求描述
        const command = `${method} ${url}`;
        
        // 开始测量
        const measurementId = commandTimer.startMeasurement(command);
        
        try {
            // 准备请求体
            let body: string | undefined;
            if (options.body && method !== 'GET' && method !== 'HEAD') {
                if (typeof options.body === 'object') {
                    body = JSON.stringify(options.body);
                } else {
                    body = String(options.body);
                }
            }
            
            // 创建AbortController用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);
            
            // 发送请求
            const response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
                credentials: options.credentials || 'same-origin'
            });
            
            // 清除超时
            clearTimeout(timeoutId);
            
            // 解析响应头
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            
            // 解析响应体
            let data: T | undefined;
            let error: string | undefined;
            
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text() as any;
                }
            } catch (e) {
                error = `Failed to parse response: ${e instanceof Error ? e.message : String(e)}`;
            }
            
            // 结束测量
            const duration = commandTimer.endMeasurement(measurementId, response.ok ? 'completed' : 'failed');
            
            return {
                data,
                error,
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                duration
            };
        } catch (e) {
            // 结束测量并记录错误
            const errorMessage = e instanceof Error ? e.message : String(e);
            commandTimer.endMeasurement(measurementId, 'failed', errorMessage);
            
            return {
                error: errorMessage,
                status: 0,
                statusText: 'Network Error',
                headers: {}
            };
        }
    }

    /**
     * GET请求
     * @param endpoint API端点
     * @param headers 请求头
     * @returns API响应
     */
    async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'GET', headers });
    }

    /**
     * POST请求
     * @param endpoint API端点
     * @param body 请求体
     * @param headers 请求头
     * @returns API响应
     */
    async post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'POST', body, headers });
    }

    /**
     * PUT请求
     * @param endpoint API端点
     * @param body 请求体
     * @param headers 请求头
     * @returns API响应
     */
    async put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'PUT', body, headers });
    }

    /**
     * DELETE请求
     * @param endpoint API端点
     * @param headers 请求头
     * @returns API响应
     */
    async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'DELETE', headers });
    }

    /**
     * PATCH请求
     * @param endpoint API端点
     * @param body 请求体
     * @param headers 请求头
     * @returns API响应
     */
    async patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'PATCH', body, headers });
    }

    /**
     * 获取API请求统计信息
     * @returns 统计对象
     */
    getStatistics() {
        return commandTimer.getStatistics();
    }

    /**
     * 获取API请求历史记录
     * @param limit 返回记录数量限制
     * @returns 历史记录数组
     */
    getRequestHistory(limit?: number) {
        return commandTimer.getHistory(limit);
    }
}

// 创建默认API客户端实例
export const apiClient = new ApiClient('/api');
export default apiClient;