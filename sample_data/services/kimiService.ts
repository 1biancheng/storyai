/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../../types';

// Kimi API配置
export const KIMI_API_CONFIG = {
  // 国内站地址
  DOMESTIC_ENDPOINT: 'https://api.moonshot.cn/v1',
  // 国际站地址
  INTERNATIONAL_ENDPOINT: 'https://api.moonshot.ai/v1',
  // 支持的模型
  SUPPORTED_MODELS: [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k'
  ],
  // 速率限制（免费档）
  RATE_LIMITS: {
    CONCURRENT_JOBS: 1, // 并发连接数
    RPM: 10, // 每分钟请求数
    TPM: 10000, // 每分钟token数
    TPD: 500000 // 每日token数
  }
};

// 并发控制
let moonshotInFlight = false;
const waitForMoonshotSlot = async () => {
  while (moonshotInFlight) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  moonshotInFlight = true;
};

const releaseMoonshotSlot = () => {
  moonshotInFlight = false;
};

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 错误处理
const getKimiErrorMessage = (error: any): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  
  // 尝试解析JSON错误
  try {
    const errorStr = String(error);
    const jsonStartIndex = errorStr.indexOf('{');
    if (jsonStartIndex !== -1) {
      const jsonString = errorStr.substring(jsonStartIndex);
      const parsed = JSON.parse(jsonString);
      
      if (typeof parsed.error?.message === 'string') {
        return parsed.error.message;
      }
      if (typeof parsed.message === 'string') {
        return parsed.message;
      }
    }
  } catch (e) {
    // 不是JSON错误或格式错误，返回原始字符串
  }
  
  return String(error);
};

// 检查是否为速率限制错误
const isRateLimitError = (error: any): boolean => {
  const message = getKimiErrorMessage(error).toLowerCase();
  return message.includes('429') || 
         message.includes('quota') || 
         message.includes('rate limit') ||
         message.includes('rate_limit') ||
         message.includes('resource_exhausted') ||
         message.includes('concurrency') ||
         message.includes('try again after') ||
         message.includes('retry-after');
};

// 指数退避重试
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Kimi API调用失败，尝试 ${attempt}/${maxRetries}:`, lastError.message);
      
      if (isRateLimitError(lastError) && attempt < maxRetries) {
        // 指数退避：2s, 4s, 8s
        let backoff = Math.pow(2, attempt) * 1000;
        
        // 如果API建议了特定的等待时间，优先使用
        const errorMessage = String(lastError.message || lastError);
        const matchRetryAfter = errorMessage.match(/try again after\s+(\d+)/i) || 
                               errorMessage.match(/retry-after:\s*(\d+)/i);
        
        if (matchRetryAfter) {
          const seconds = parseInt(matchRetryAfter[1], 10);
          if (!isNaN(seconds) && seconds > 0) {
            backoff = Math.max(backoff, seconds * 1000);
          }
        }
        
        console.log(`检测到速率限制，${backoff}ms后重试...`);
        await delay(backoff);
      } else {
        // 非速率限制错误或已达到最大重试次数
        break;
      }
    }
  }
  
  throw lastError || new Error('Kimi API调用失败');
};

/**
 * 检测模型是否为Kimi/Moonshot模型
 * @param modelId 模型ID
 * @returns 是否为Kimi模型
 */
export const isKimiModel = (modelId: string): boolean => {
  return modelId.toLowerCase().includes('moonshot') || 
         modelId.toLowerCase().includes('kimi') ||
         KIMI_API_CONFIG.SUPPORTED_MODELS.some(model => modelId.toLowerCase().includes(model));
};

/**
 * 获取Kimi API端点
 * @param useInternational 是否使用国际站
 * @returns API端点URL
 */
export const getKimiEndpoint = (useInternational: boolean = false): string => {
  return useInternational ? KIMI_API_CONFIG.INTERNATIONAL_ENDPOINT : KIMI_API_CONFIG.DOMESTIC_ENDPOINT;
};

/**
 * 调用Kimi API（非流式）
 * @param prompt 提示词
 * @param config 模型配置
 * @param options 额外选项
 * @returns API响应
 */
export const callKimiAPI = async (
  prompt: string,
  config: ModelConfig,
  options: {
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    enableSearch?: boolean;
    forceTools?: string[];
  } = {}
): Promise<{ text: string; usage?: any }> => {
  const {
    temperature = 0.3,
    maxTokens,
    useInternational = false,
    enableSearch = false
  } = options;
  
  // 确保使用Kimi API端点
  const apiUrl = config.apiUrl || `${getKimiEndpoint(useInternational)}/chat/completions`;
  
  // 构建请求头
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };
  
  // 构建请求体
  const body: any = {
    model: config.modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature,
  };
  
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }
  
  // 如果启用搜索增强，添加相关参数
  if (enableSearch || (options.forceTools && options.forceTools.length > 0)) {
    const { getToolDefinitions } = await import('./toolRegistry')
    const ids = options.forceTools && options.forceTools.length > 0 ? options.forceTools : ['web_search']
    body.tools = getToolDefinitions(ids)
    body.tool_choice = 'auto'
  }

  // 强制工具系统提示注入
  
  
  // 使用并发控制
  await waitForMoonshotSlot();
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Kimi API错误: ${response.status} ${errorBody.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return {
      text,
      usage: data.usage
    };
  } finally {
    releaseMoonshotSlot();
  }
};

/**
 * 调用Kimi API（流式）
 * @param prompt 提示词
 * @param onChunk 处理每个数据块的回调
 * @param config 模型配置
 * @param options 额外选项
 */
export const callKimiAPIStream = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  config: ModelConfig,
  options: {
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    enableSearch?: boolean;
    forceTools?: string[];  // 强制启用的工具列表
  } = {}
): Promise<void> => {
  const {
    temperature = 0.3,
    maxTokens,
    useInternational = false,
    enableSearch = false
  } = options;
  
  // 确保使用Kimi API端点
  const apiUrl = config.apiUrl || `${getKimiEndpoint(useInternational)}/chat/completions`;
  
  // 构建请求头
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };
  
  // 构建请求体
  const body: any = {
    model: config.modelId,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    stream: true,
  };
  
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }
  
  if (enableSearch || (options.forceTools && options.forceTools.length > 0)) {
    const { getToolDefinitions } = await import('./toolRegistry')
    const ids = options.forceTools && options.forceTools.length > 0 ? options.forceTools : ['web_search']
    body.tools = getToolDefinitions(ids)
    body.tool_choice = 'auto'
  }
  
  // 使用并发控制
  await waitForMoonshotSlot();
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Kimi API错误: ${response.status} ${errorBody.error?.message || response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('无法获取响应流');
    }
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    releaseMoonshotSlot();
  }
};

/**
 * 带重试机制的Kimi API调用（非流式）
 * @param prompt 提示词
 * @param config 模型配置
 * @param options 额外选项
 * @returns API响应
 */
export const callKimiAPIWithRetry = async (
  prompt: string,
  config: ModelConfig,
  options: {
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    enableSearch?: boolean;
    maxRetries?: number;
  } = {}
): Promise<{ text: string; usage?: any }> => {
  const { maxRetries = 3, ...restOptions } = options;
  
  return retryWithBackoff(() => callKimiAPI(prompt, config, restOptions), maxRetries);
};

/**
 * 带重试机制的Kimi API调用（流式）
 * @param prompt 提示词
 * @param onChunk 处理每个数据块的回调
 * @param config 模型配置
 * @param options 额外选项
 */
export const callKimiAPIStreamWithRetry = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  config: ModelConfig,
  options: {
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    enableSearch?: boolean;
    maxRetries?: number;
  } = {}
): Promise<void> => {
  const { maxRetries = 3, ...restOptions } = options;
  
  return retryWithBackoff(() => callKimiAPIStream(prompt, onChunk, config, restOptions), maxRetries);
};

/**
 * 测试Kimi API连接
 * @param config 模型配置
 * @param options 额外选项
 * @returns 测试结果
 */
export const testKimiAPI = async (
  config: ModelConfig,
  options: { useInternational?: boolean } = {}
): Promise<{ success: boolean; error?: string; model?: string }> => {
  if (!config.apiKey) {
    return { success: false, error: 'API密钥缺失' };
  }
  
  try {
    const response = await callKimiAPIWithRetry('请回复"连接成功"', config, {
      ...options,
      maxTokens: 50,
      maxRetries: 1 // 测试时只尝试一次
    });
    
    if (response.text.includes('成功')) {
      return { 
        success: true, 
        model: config.modelId 
      };
    }
    
    return { 
      success: false, 
      error: '收到意外响应' 
    };
  } catch (e: any) {
    return { 
      success: false, 
      error: e.message || '发生未知错误' 
    };
  }
};
