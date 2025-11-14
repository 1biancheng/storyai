/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../../types';
import { runAIService, runAIServiceStream, testAIServiceConnectivity, clearCache as clearCompatibilityCache } from './aiServiceCompatibility';

/**
 * Parses a raw error from an AI service to extract the cleanest possible technical message.
 * It handles plain strings, stringified JSON from OpenAI, and other formats.
 * @param error The raw error object to parse.
 * @returns A clean error message string.
 */
const getCleanErrorMessage = (error: any): string => {
    let message = 'An unknown error occurred.';

    if (error instanceof Error && error.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    // Attempt to parse a structured JSON error from within the message string.
    try {
        const jsonStartIndex = message.indexOf('{');
        if (jsonStartIndex !== -1) {
            const jsonString = message.substring(jsonStartIndex);
            const parsed = JSON.parse(jsonString);

            // OpenAI-like: { "error": { "message": "..." } }
            if (typeof parsed.error?.message === 'string') {
                return parsed.error.message;
            }
            // Other direct message formats: { "message": "..." }
            if (typeof parsed.message === 'string') {
                return parsed.message;
            }
        }
    } catch (e) {
        // Not a JSON error or malformed JSON. Fall through to clean up the original string.
    }
    
    // If no JSON was found or parsed, clean up common prefixes from SDKs.
    return message
        .replace(/\[[a-zA-Z0-9\s_]+Error\]:\s*/, '') // Removes prefixes like [Error]:
        .replace(/OpenAI-compatible API error:\s*/i, '') // Preserve status code (e.g., 429)
        .trim();
};


/**
 * 运行当前配置的默认代理(OpenAI兼容).
 * 此函数作为调度器,包含缓存和重试逻辑.
 * @param prompt 发送给代理的提示词.
 * @param modelId 要使用的特定模型配置的ID(可选).
 * @param enableSearchGrounding 启用搜索增强的标志(可选).
 * @param searchProvider 搜索增强的提供者('openai' | 'bing' | 'baidu').
 * @returns 解析为代理响应文本和可选增强块的promise.
 */
export const runAgent = async (
  prompt: string,
  modelId?: string | null,
  enableSearchGrounding?: boolean,
  searchProvider?: 'openai' | 'bing' | 'baidu'
): Promise<{ text: string, groundingChunks?: any[] }> => {
  return runAIService(prompt, modelId, {
    enableSearchGrounding,
    searchProvider
  });
};

/**
 * 运行当前配置的默认代理(流式响应).
 * 此函数作为调度器,包含缓存和重试逻辑.
 * @param prompt 发送给代理的提示词.
 * @param onChunk 接收每个内容块的回调函数.
 * @param modelId 要使用的特定模型配置的ID(可选).
 * @param enableSearchGrounding 启用搜索增强的标志(可选).
 * @param searchProvider 搜索增强的提供者('openai' | 'bing' | 'baidu').
 * @returns 解析为完整响应文本和可选增强块的promise.
 */
export const runAgentStream = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  modelId?: string | null,
  enableSearchGrounding?: boolean,
  searchProvider?: 'openai' | 'bing' | 'baidu',
  forceTools?: string[]
): Promise<void> => {
  await runAIServiceStream(prompt, onChunk, modelId, {
    enableSearchGrounding,
    searchProvider,
    forceTools
  });
};

/**
 * 测试指定模型的连接性.
 * @param modelId 要测试的模型配置的ID.
 * @returns 解析为测试结果的promise.
 */
export const testModelConnectivity = async (modelId: string): Promise<{ success: boolean, message: string }> => {
  return testAIServiceConnectivity(modelId);
};

/**
 * 清除请求缓存.
 * 向后兼容函数,实际调用兼容层的缓存清除功能.
 */
export const clearCache = (): void => {
  clearCompatibilityCache();
};
