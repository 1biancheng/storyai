/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../types.ts';
import { getDefaultModelConfig, getModelConfigs } from './modelManager.ts';
import * as openAIService from './openAIService.ts';
import * as anthropicService from './anthropicService.ts';

// In-memory cache for API responses to reduce redundant calls.
const requestCache = new Map<string, { text: string, groundingChunks?: any[] }>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Concurrency guard specifically for Moonshot/Kimi (org concurrency = 1)
let moonshotInFlight = false;
const waitForMoonshotSlot = async () => {
    while (moonshotInFlight) {
        await delay(250);
    }
    moonshotInFlight = true;
};
const releaseMoonshotSlot = () => {
    moonshotInFlight = false;
};

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
 * Runs the currently configured default agent (OpenAI-compatible).
 * This function acts as a dispatcher and includes caching and retry logic.
 * @param prompt The prompt to send to the agent.
 * @param modelId Optional ID of a specific model configuration to use.
 * @param enableSearchGrounding Optional flag to enable search grounding.
 * @param searchProvider Optional provider for search grounding ('openai' | 'bing' | 'baidu').
 * @returns A promise that resolves to the agent's response text and optional grounding chunks.
 */
export const runAgent = async (
  prompt: string,
  modelId?: string | null,
  enableSearchGrounding?: boolean,
  searchProvider?: 'openai' | 'bing' | 'baidu'
): Promise<{ text: string, groundingChunks?: any[] }> => {
  let modelConfig: ModelConfig;

  if (modelId) {
      const allConfigs = getModelConfigs();
      const selectedConfig = allConfigs.find(c => c.id === modelId);
      if (selectedConfig) {
          modelConfig = selectedConfig;
      } else {
          console.warn(`Model with ID "${modelId}" not found. Falling back to default.`);
          modelConfig = getDefaultModelConfig();
      }
  } else {
      modelConfig = getDefaultModelConfig();
  }
  
  const cacheKey = JSON.stringify({
      modelId: modelConfig.modelId,
      prompt,
      enableSearchGrounding, // Include in cache key
      searchProvider, // Include provider in cache key
  });

  if (requestCache.has(cacheKey)) {
      console.log("Returning cached agent response.");
      return requestCache.get(cacheKey)!;
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
        let response: { text: string, groundingChunks?: any[] };

        const isMoonshotLike = modelConfig.name.toLowerCase().includes('kimi') || modelConfig.modelId.toLowerCase().includes('moonshot');
        if (isMoonshotLike) {
            await waitForMoonshotSlot();
        }
        try {
            if (modelConfig.apiUrl?.includes('anthropic.com')) {
                response = await anthropicService.runAnthropicAgent(prompt, modelConfig);
            } else {
                response = await openAIService.runOpenAICompatibleAgent(prompt, modelConfig);
            }
        } finally {
            if (isMoonshotLike) {
                releaseMoonshotSlot();
            }
        }
        
        // Only cache successful responses
        requestCache.set(cacheKey, response);
        
        return response;

    } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Agent call failed on attempt ${attempt}:`, lastError.message);

        const cleanMessage = getCleanErrorMessage(lastError).toLowerCase();
        const rawLower = (lastError.message ? String(lastError.message) : String(lastError)).toLowerCase();
        
        const isRateLimitError =
            cleanMessage.includes('429') || rawLower.includes('429') ||
            cleanMessage.includes('quota') || rawLower.includes('quota') ||
            cleanMessage.includes('rate limit') || rawLower.includes('rate limit') ||
            cleanMessage.includes('rate_limit') || rawLower.includes('rate_limit') ||
            cleanMessage.includes('resource_exhausted') || rawLower.includes('resource_exhausted') ||
            cleanMessage.includes('concurrency') || rawLower.includes('concurrency') ||
            cleanMessage.includes('try again after') || rawLower.includes('try again after') ||
            cleanMessage.includes('retry-after') || rawLower.includes('retry-after');

        const isServerError =
            cleanMessage.includes('500') || rawLower.includes('500') ||
            cleanMessage.includes('internal error') || rawLower.includes('internal error') ||
            cleanMessage.includes('server error') || rawLower.includes('server error') ||
            cleanMessage.includes('service unavailable') || rawLower.includes('service unavailable') ||
            cleanMessage.includes('internal'); // Catches "Internal error encountered."

        if ((isRateLimitError || isServerError) && attempt < maxRetries) {
            let backoff = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            // If provider suggests a specific wait time, honor it.
            const matchRetryAfter = rawLower.match(/try again after\s+(\d+)/i) || rawLower.match(/retry-after:\s*(\d+)/i);
            if (matchRetryAfter) {
                const seconds = parseInt(matchRetryAfter[1], 10);
                if (!isNaN(seconds) && seconds > 0) {
                    backoff = Math.max(backoff, seconds * 1000);
                }
            }
            const errorType = isRateLimitError ? 'Rate limit' : 'Server error';
            console.log(`${errorType} detected. Retrying in ${backoff}ms...`);
            await delay(backoff);
        } else {
            break; // Break on client-side errors (e.g., 400 Bad Request) or after max retries
        }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Agent call failed after maximum retries');
};

/**
 * Runs the agent with streaming response.
 * @param prompt The prompt to send to the agent.
 * @param onChunk Callback function to handle each chunk of the response.
 * @param modelId Optional ID of a specific model configuration to use.
 * @param enableSearchGrounding Optional flag to enable search grounding.
 * @param searchProvider Optional provider for search grounding ('google' | 'bing' | 'baidu').
 */
export const runAgentStream = async (
  prompt: string,
  onChunk: (chunk: string) => void,
  modelId?: string | null,
  enableSearchGrounding?: boolean,
  searchProvider?: 'google' | 'bing' | 'baidu'
): Promise<void> => {
  let modelConfig: ModelConfig;

  if (modelId) {
      const allConfigs = getModelConfigs();
      const selectedConfig = allConfigs.find(c => c.id === modelId);
      if (selectedConfig) {
          modelConfig = selectedConfig;
      } else {
          console.warn(`Model with ID "${modelId}" not found. Falling back to default.`);
          modelConfig = getDefaultModelConfig();
      }
  } else {
      modelConfig = getDefaultModelConfig();
  }

  const isMoonshotLike = modelConfig.name.toLowerCase().includes('kimi') || modelConfig.modelId.toLowerCase().includes('moonshot');
  if (isMoonshotLike) {
      await waitForMoonshotSlot();
  }
  try {
      if (modelConfig.apiUrl?.includes('anthropic.com')) {
          await anthropicService.runAnthropicAgentStream(prompt, modelConfig, onChunk);
      } else {
          await openAIService.runOpenAICompatibleAgentStream(prompt, modelConfig, onChunk);
      }
  } finally {
      if (isMoonshotLike) {
          releaseMoonshotSlot();
      }
  }
};

/**
 * Clears the request cache.
 */
export const clearCache = (): void => {
  requestCache.clear();
};
