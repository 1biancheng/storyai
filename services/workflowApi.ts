/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { apiClient } from '../sample_data/services/apiClient';

const API_BASE = '/api/v1/workflows';

export interface WorkflowNode {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'data';
  position: { x: number; y: number };
  config: any;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowExecutionRequest {
  workflow_id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  context?: Record<string, any>;
}

export interface WorkflowExecutionResponse {
  execution_id: string;
  status: string;
  execution_order: string[];
  outputs: Record<string, any>;
  start_time: string;
  end_time?: string;
  error?: string;
}

/**
 * 启动工作流执行
 */
export async function startWorkflow(workflow: WorkflowExecutionRequest): Promise<string> {
  try {
    const response = await apiClient.post<{ data: { execution_id: string } }>(`${API_BASE}/run`, workflow);
    return response.data.data.execution_id;
  } catch (error) {
    console.error('启动工作流失败:', error);
    throw error;
  }
}

/**
 * 获取工作流执行状态
 */
export async function getWorkflowStatus(executionId: string): Promise<any> {
  try {
    const response = await apiClient.get(`${API_BASE}/status/${executionId}`);
    return response.data;
  } catch (error) {
    console.error('获取工作流状态失败:', error);
    throw error;
  }
}

/**
 * 创建SSE连接以流式获取工作流执行事件
 */
export function createWorkflowEventStream(executionId: string, eventHandlers: {
  onConnected?: () => void;
  onProgress?: (data: any) => void;
  onComplete?: (data: any) => void;
  onError?: (error: any) => void;
}) {
  const baseUrl = window.location.origin;
  const eventSource = new EventSource(`${baseUrl}/api/v1/workflows/stream/${executionId}`);

  eventSource.onopen = () => {
    console.log('SSE连接已建立');
    eventHandlers.onConnected?.();
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'connected':
          eventHandlers.onConnected?.();
          break;
        case 'progress':
          eventHandlers.onProgress?.(data);
          break;
        case 'complete':
          eventHandlers.onComplete?.(data);
          eventSource.close();
          break;
        case 'error':
          eventHandlers.onError?.(data);
          eventSource.close();
          break;
        default:
          console.log('未知事件类型:', data.type, data);
      }
    } catch (error) {
      console.error('解析SSE事件失败:', error);
      eventHandlers.onError?.({ message: '解析事件失败', error });
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE连接错误:', error);
    eventHandlers.onError?.({ message: 'SSE连接错误', error });
    eventSource.close();
  };

  return eventSource;
}