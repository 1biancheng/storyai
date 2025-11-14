/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../types.ts';

// 自定义类型定义，用于应用内部数据处理
type PropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

interface SchemaProperty {
    type: PropertyType;
    description?: string;
    enum?: string[];
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
}

interface Schema {
    type: 'object';
    properties?: Record<string, SchemaProperty>;
    required?: string[];
}

// Simplified JSON constraint for Anthropic, which doesn't have a formal JSON mode like OpenAI.
// We rely on strong prompting.
const generateJsonPromptConstraint = (schema: Schema): string => {
    return `\n\nYour response MUST be a single, valid JSON object that conforms to the specified schema. Do not include any text, explanations, or markdown fences (e.g., \`\`\`json) before or after the JSON object. The entire output must be directly parsable by JSON.parse().`;
};


export const runAnthropicAgent = async (
    prompt: string,
    config: ModelConfig,
    responseSchema?: Schema
): Promise<{ text: string }> => {
    if (!config.apiUrl) {
        throw new Error(`API Address (apiUrl) is not configured for the Anthropic model "${config.name}".`);
    }
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
    };

    let finalPrompt = prompt;
    if (responseSchema) {
        finalPrompt += generateJsonPromptConstraint(responseSchema);
    }

    const body = {
        model: config.modelId,
        messages: [{ role: 'user', content: finalPrompt }],
        max_tokens: 4096, // A reasonable default for long-form content
    };

    const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`Anthropic API error: ${response.status} ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return { text };
};


export const testAnthropicModel = async (config: ModelConfig): Promise<{ success: boolean; error?: string }> => {
    if (!config.apiKey) {
        return { success: false, error: 'API Key is missing.' };
    }
    if (!config.apiUrl) {
        return { success: false, error: 'API Address is required for Anthropic models.' };
    }
    try {
        const response = await runAnthropicAgent('Say "Hello, World!"', config);
        if (response.text && response.text.toLowerCase().includes('hello')) {
            return { success: true };
        }
        return { success: false, error: 'Received an unexpected response.' };
    } catch (e: any) {
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
};
