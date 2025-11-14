/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ModelConfig } from '../../types';

const STORAGE_KEY = 'storyWeaverModelConfigs';

// The default configurations.
const DEFAULT_CONFIGS: ModelConfig[] = [
    {
        id: 'default-anthropic',
        name: 'Anthropic (Claude Sonnet 3.5)',
        modelId: 'claude-3-5-sonnet-20240620',
        apiKey: '', // User-provided
        apiUrl: 'https://api.anthropic.com/v1/messages',
        isDefault: true, // This will be the initially selected default
    },
    {
        id: 'default-openai',
        name: 'OpenAI API / Compatible (Kimi, Qwen, etc.)',
        modelId: 'e.g., gpt-4, moonshot-v1-8k, qwen-long',
        apiKey: '', // User-provided
        apiUrl: 'e.g., https://api.moonshot.cn/v1/chat/completions',
        isDefault: false,
    },
];


export const getModelConfigs = (): ModelConfig[] => {
    try {
        const savedConfigs = localStorage.getItem(STORAGE_KEY);
        if (savedConfigs) {
            // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
            let configs = JSON.parse(savedConfigs) as ModelConfig[];

            // Guard against invalid or empty data in localStorage
            if (!Array.isArray(configs) || configs.length === 0) {
                return DEFAULT_CONFIGS;
            }

            // Ensure there is exactly one default model.
            let defaultIndex = configs.findIndex(c => c.isDefault);

            if (defaultIndex === -1) {
                // If no default is set, make the first model the default.
                if (configs.length > 0) {
                    configs[0].isDefault = true;
                }
            } else {
                // If a default exists, ensure it's the only one.
                return configs.map((config, index) => ({
                    ...config,
                    isDefault: index === defaultIndex,
                }));
            }
            return configs;
        }
    } catch (e) {
        console.error("Failed to load model configs from localStorage", e);
    }
    // Return the default if nothing is saved or if there was an error.
    return DEFAULT_CONFIGS;
};


export const saveModelConfigs = (configs: ModelConfig[]): void => {
    try {
        let finalConfigs = [...configs];
        // Ensure at least one model is set as default if the list is not empty.
        if (finalConfigs.length > 0 && !finalConfigs.some(c => c.isDefault)) {
            finalConfigs[0].isDefault = true;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalConfigs));
        // Dispatch a storage event so other parts of the app can react if needed
        window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("Failed to save model configs to localStorage", e);
    }
};

export const getDefaultModelConfig = (): ModelConfig => {
    const configs = getModelConfigs();
    const defaultConfig = configs.find(c => c.isDefault);
    return defaultConfig || configs[0] || DEFAULT_CONFIGS[0];
};

export const resetModelConfigs = (): void => {
    try {
        // Save the default configs back to storage instead of just removing the key
        saveModelConfigs(DEFAULT_CONFIGS);
    } catch (e) {
        console.error("Failed to reset model configs in localStorage", e);
    }
};