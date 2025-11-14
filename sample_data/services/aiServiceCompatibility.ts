/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../../types';
import * as kimiService from './kimiService';
import * as openAIService from './openAIService';
import * as anthropicService from './anthropicService';

// 缓存
const requestCache = new Map<string, { text: string, groundingChunks?: any[] }>();

/**
 * 清除请求缓存
 */
export const clearCache = (): void => {
  requestCache.clear();
};

/**
 * 检测模型类型
 * @param config 模型配置
 * @returns 模型类型
 */
export const detectModelType = (config: ModelConfig): 'kimi' | 'openai' | 'anthropic' | 'unknown' => {
  // 检查是否为Kimi/Moonshot模型
  if (kimiService.isKimiModel(config.modelId)) {
    return 'kimi';
  }
  
  // 检查是否为Anthropic模型
  if (config.apiUrl?.includes('anthropic.com')) {
    return 'anthropic';
  }
  
  // 检查是否为OpenAI兼容模型
  if (config.modelId.includes('gpt') || 
      config.modelId.includes('claude') || 
      config.modelId.includes('qwen') ||
      config.modelId.includes('gemini')) {
    return 'openai';
  }
  
  // 默认为OpenAI兼容
  return 'openai';
};

/**
 * 统一的AI服务调用接口(非流式)
 * @param prompt 提示词
 * @param modelId 模型ID(可选)
 * @param options 额外选项
 * @returns AI响应
 */
export const runAIService = async (
  prompt: string,
  modelId?: string | null,
  options: {
    enableSearchGrounding?: boolean;
    searchProvider?: 'openai' | 'bing' | 'baidu';
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    modelConfig?: ModelConfig;
  } = {}
): Promise<{ text: string, groundingChunks?: any[] }> => {
  // 获取模型配置
  let modelConfig: ModelConfig;
  
  if (options.modelConfig) {
    modelConfig = options.modelConfig;
  } else if (modelId) {
    // 从modelManager获取模型配置
    const { getModelConfigs } = await import('./modelManager');
    const allConfigs = getModelConfigs();
    const selectedConfig = allConfigs.find(c => c.id === modelId);
    
    if (selectedConfig) {
      modelConfig = selectedConfig;
    } else {
      console.warn(`模型ID "${modelId}" 未找到,使用默认模型.`);
      const { getDefaultModelConfig } = await import('./modelManager');
      modelConfig = getDefaultModelConfig();
    }
  } else {
    // 使用默认模型
    const { getDefaultModelConfig } = await import('./modelManager');
    modelConfig = getDefaultModelConfig();
  }
  
  // 检查缓存
  const cacheKey = JSON.stringify({
    modelId: modelConfig.modelId,
    prompt,
    enableSearchGrounding: options.enableSearchGrounding,
    searchProvider: options.searchProvider,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    useInternational: options.useInternational
  });

  if (requestCache.has(cacheKey)) {
    console.log("返回缓存的AI响应.");
    return requestCache.get(cacheKey)!;
  }

  // 检测模型类型
  const modelType = detectModelType(modelConfig);
  console.log(`检测到模型类型: ${modelType}, 模型ID: ${modelConfig.modelId}`);
  
  try {
    let response: { text: string, groundingChunks?: any[] };
    
    switch (modelType) {
      case 'kimi':
        console.log('使用Kimi服务');
        const kimiResponse = await kimiService.callKimiAPIWithRetry(prompt, modelConfig, {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          useInternational: options.useInternational,
          enableSearch: options.enableSearchGrounding
        });
        response = { text: kimiResponse.text };
        break;
        
      case 'anthropic':
        console.log('使用Anthropic服务');
        response = await anthropicService.runAnthropicAgent(prompt, modelConfig);
        break;
        
      case 'openai':
      default:
        console.log('使用OpenAI兼容服务');
        response = await openAIService.runOpenAICompatibleAgent(prompt, modelConfig);
        break;
    }
    
    // 缓存成功响应
    requestCache.set(cacheKey, response);
    
    return response;
  } catch (error) {
    console.error(`AI服务调用失败:`, error);
    throw error;
  }
};

/**
 * 统一的AI服务调用接口(流式)
 * @param prompt 提示词
 * @param onChunk 处理每个数据块的回调
 * @param modelId 模型ID(可选)
 * @param options 额外选项
 */
export const runAIServiceStream = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  modelId?: string | null,
  options: {
    enableSearchGrounding?: boolean;
    searchProvider?: 'openai' | 'bing' | 'baidu';
    temperature?: number;
    maxTokens?: number;
    useInternational?: boolean;
    modelConfig?: ModelConfig;
    forceTools?: string[];
  } = {}
): Promise<void> => {
  // 获取模型配置
  let modelConfig: ModelConfig;
  
  if (options.modelConfig) {
    modelConfig = options.modelConfig;
  } else if (modelId) {
    // 从modelManager获取模型配置
    const { getModelConfigs } = await import('./modelManager');
    const allConfigs = getModelConfigs();
    const selectedConfig = allConfigs.find(c => c.id === modelId);
    
    if (selectedConfig) {
      modelConfig = selectedConfig;
    } else {
      console.warn(`模型ID "${modelId}" 未找到,使用默认模型.`);
      const { getDefaultModelConfig } = await import('./modelManager');
      modelConfig = getDefaultModelConfig();
    }
  } else {
    // 使用默认模型
    const { getDefaultModelConfig } = await import('./modelManager');
    modelConfig = getDefaultModelConfig();
  }
  
  // 检测模型类型
  const modelType = detectModelType(modelConfig);
  console.log(`检测到模型类型: ${modelType}, 模型ID: ${modelConfig.modelId}`);
  
  try {
    const hasTools = Array.isArray(options.forceTools) && options.forceTools.length > 0
    if (hasTools && modelType === 'openai') {
      const { getToolDefinitions, invokeToolByName } = await import('./toolRegistry')
      const defs = getToolDefinitions(options.forceTools!)
      const raw = await openAIService.chatCompletionsRaw(prompt, modelConfig, { tools: defs })
      const calls = raw?.choices?.[0]?.message?.tool_calls || []
      if (calls.length > 0) {
        const results: any[] = []
        for (const c of calls) {
          const name = c?.function?.name
          let args: any = {}
          try { args = JSON.parse(c?.function?.arguments || '{}') } catch {}
          const out = await invokeToolByName(name, args)
          results.push({ name, args, result: out })
        }
        const followup = `根据下列工具调用结果生成结构化最终回答。请严格输出JSON，包含字段: answer:string, tools:array。\nTOOLS_JSON=${JSON.stringify(results)}`
        const final = await openAIService.runOpenAICompatibleAgent(
          followup,
          modelConfig,
          { type: 'object', properties: { answer: { type: 'string' }, tools: { type: 'array' } }, required: ['answer','tools'] }
        )
        onChunk(final.text)
        return
      }
    }
    switch (modelType) {
      case 'kimi':
        await kimiService.callKimiAPIStreamWithRetry(prompt, onChunk, modelConfig, {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          useInternational: options.useInternational,
          enableSearch: options.enableSearchGrounding,
          forceTools: options.forceTools
        })
        break
      case 'anthropic':
        const response = await anthropicService.runAnthropicAgent(prompt, modelConfig)
        onChunk(response.text)
        break
      case 'openai':
      default:
        const openaiResponse = await openAIService.runOpenAICompatibleAgent(prompt, modelConfig)
        onChunk(openaiResponse.text)
        break
    }
  } catch (error) {
    console.error(`AI服务流式调用失败:`, error);
    throw error;
  }
};

/**
 * 测试AI服务连接
 * @param config 模型配置
 * @param options 额外选项
 * @returns 测试结果
 */
export const testAIService = async (
  config: ModelConfig,
  options: { useInternational?: boolean } = {}
): Promise<{ success: boolean; error?: string; model?: string }> => {
  const modelType = detectModelType(config);
  
  switch (modelType) {
    case 'kimi':
      return kimiService.testKimiAPI(config, options);
      
    case 'anthropic':
      // 注意:anthropicService可能没有测试方法,这里需要调整
      try {
        const response = await anthropicService.runAnthropicAgent('请回复"连接成功"', config);
        if (response.text.includes('成功')) {
          return { success: true, model: config.modelId };
        }
        return { success: false, error: '收到意外响应' };
      } catch (e: any) {
        return { success: false, error: e.message || '发生未知错误' };
      }
      
    case 'openai':
    default:
      return openAIService.testOpenAIModel(config);
  }
};

/**
 * 测试AI服务连接(通过模型ID)
 * @param modelId 模型ID
 * @returns 测试结果
 */
export const testAIServiceConnectivity = async (modelId: string): Promise<{ success: boolean, message: string }> => {
  try {
    // 从modelManager获取模型配置
    const { getModelConfigs } = await import('./modelManager');
    const allConfigs = getModelConfigs();
    const config = allConfigs.find(c => c.id === modelId);
    
    if (!config) {
      return { success: false, message: `模型ID "${modelId}" 未找到` };
    }
    
    // 调用测试服务
    const result = await testAIService(config);
    
    if (result.success) {
      return { success: true, message: `成功连接到模型: ${result.model || config.modelId}` };
    } else {
      return { success: false, message: result.error || '连接失败' };
    }
  } catch (error: any) {
    return { success: false, message: error.message || '测试连接时发生未知错误' };
  }
};

/**
 * 获取模型信息
 * @param modelId 模型ID
 * @returns 模型信息
 */
export const getModelInfo = async (modelId: string): Promise<{
  name: string;
  provider: string;
  description?: string;
  maxTokens?: number;
  contextLength?: number;
}> => {
  // 从modelManager获取模型配置
  const { getModelConfigs } = await import('./modelManager');
  const allConfigs = getModelConfigs();
  const config = allConfigs.find(c => c.id === modelId || c.modelId === modelId);
  
  if (!config) {
    throw new Error(`模型ID "${modelId}" 未找到`);
  }
  
  const modelType = detectModelType(config);
  
  // 基础信息
  const info: any = {
    name: config.name,
    provider: modelType,
    description: config.modelId
  };
  
  // 根据模型类型添加特定信息
  if (modelType === 'kimi') {
    // Kimi模型信息
    if (config.modelId.includes('8k')) {
      info.maxTokens = 8000;
      info.contextLength = 8000;
    } else if (config.modelId.includes('32k')) {
      info.maxTokens = 32000;
      info.contextLength = 32000;
    } else if (config.modelId.includes('128k')) {
      info.maxTokens = 128000;
      info.contextLength = 128000;
    }
    
    info.description = `Moonshot AI模型,${info.contextLength}上下文长度`;
  } else if (modelType === 'anthropic') {
    // Anthropic模型信息
    if (config.modelId.includes('claude-3-5-sonnet')) {
      info.maxTokens = 4096;
      info.contextLength = 200000;
    } else if (config.modelId.includes('claude-3-opus')) {
      info.maxTokens = 4096;
      info.contextLength = 200000;
    }
    
    info.description = `Anthropic Claude模型,${info.contextLength}上下文长度`;
  } else {
    // OpenAI兼容模型信息
    if (config.modelId.includes('gpt-4')) {
      info.maxTokens = 4096;
      info.contextLength = config.modelId.includes('32k') ? 32768 : 8192;
    } else if (config.modelId.includes('gpt-3.5')) {
      info.maxTokens = 4096;
      info.contextLength = config.modelId.includes('16k') ? 16384 : 4096;
    }
    
    info.description = `OpenAI兼容模型,${info.contextLength || '未知'}上下文长度`;
  }
  
  return info;
};
