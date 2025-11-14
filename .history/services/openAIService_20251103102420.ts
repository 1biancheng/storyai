/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../types.ts';

// 定义JSON Schema接口用于应用内部数据处理
interface SchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
}

interface Schema {
    type: 'object';
    properties?: Record<string, SchemaProperty>;
    required?: string[];
}

/**
 * Generates a string to append to a prompt to constrain the LLM to output valid JSON.
 * @param schema The Schema to extract keys from.
 * @returns A string containing the JSON constraint instructions.
 */
const generateJsonPromptConstraint = (schema: Schema): string => {
    if (schema.type !== 'object' || !schema.properties) {
        return "Your response MUST be a single, valid JSON object that can be parsed directly by JSON.parse. Do not include any surrounding text or markdown code fences.";
    }

    const keys = Object.keys(schema.properties);
    
    // Using a clear, structured format for the instructions.
    const promptConstraint = `\n\n---
IMPORTANT INSTRUCTIONS:
- Your response MUST be a single, valid JSON object.
- Do not include any text, explanations, or markdown fences (e.g., \`\`\`json) before or after the JSON object.
- The JSON object must contain the following keys: ${JSON.stringify(keys)}.
- Provide reasonable content for all keys based on the prompt.
- The entire output must be directly parsable by \`JSON.parse()\`.
---`;

    return promptConstraint;
};

/**
 * Runs an agent using an OpenAI-compatible API.
 * @param prompt The user prompt.
 * @param config The model configuration.
 * @param responseSchema Optional schema for structured JSON output.
 * @returns A promise resolving to an object with the response text.
 */
export const runOpenAICompatibleAgent = async (
    prompt: string,
    config: ModelConfig,
    responseSchema?: Schema
): Promise<{ text: string }> => {
    let apiUrl = config.apiUrl;
    // If apiUrl is not provided, check for known compatible services.
    if (!apiUrl) {
        const modelNameLower = config.name.toLowerCase();
        const modelIdLower = config.modelId.toLowerCase();
        // Automatically set Kimi/Moonshot URL if detected.
        if (modelNameLower.includes('kimi') || modelIdLower.includes('moonshot')) {
            apiUrl = 'https://api.moonshot.cn/v1/chat/completions';
        } else {
             throw new Error(`API Address (apiUrl) is not configured for the custom model "${config.name}".`);
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
    };

    let finalPrompt = prompt;
    const body: Record<string, any> = {
        model: config.modelId,
    };

    if (responseSchema) {
        finalPrompt += generateJsonPromptConstraint(responseSchema);
        // Use response_format for APIs that support it (like OpenAI, Groq, modern Kimi)
        body.response_format = { type: "json_object" };
    }
    
    body.messages = [{ role: 'user', content: finalPrompt }];

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`OpenAI-compatible API error: ${response.status} ${errorBody.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // When using response_format or a strong prompt, the JSON string is expected in the content field.
    const text = data.choices?.[0]?.message?.content || '{}';

    return { text };
};


/**
 * Tests connectivity for a given OpenAI-compatible model configuration.
 * @param config The model configuration to test.
 * @returns An object indicating success or failure with an error message.
 */
export const testOpenAIModel = async (config: ModelConfig): Promise<{ success: boolean; error?: string }> => {
    if (!config.apiKey) {
        return { success: false, error: 'API Key is missing.' };
    }
    // The runOpenAICompatibleAgent function will handle the check for apiUrl if it is required.
    try {
        const response = await runOpenAICompatibleAgent('Say "Hello, World!"', config);
        if (response.text && response.text.toLowerCase().includes('hello')) {
            return { success: true };
        }
        return { success: false, error: 'Received an unexpected response.' };
    } catch (e: any) {
        return { success: false, error: e.message || 'An unknown error occurred.' };
    }
};
