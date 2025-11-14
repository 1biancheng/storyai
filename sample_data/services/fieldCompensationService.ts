/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { AgentRole, PromptCard } from '../../types';
import * as agentService from './agentService';
import * as agentFieldModels from './agentFieldModels';

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

const MAX_RETRIES = 2;

// Injects variables into a prompt template.
const injectVariables = (prompt: string, context: Record<string, any>): string => {
    return prompt.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const value = context[variableName];
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }
        return value !== undefined && value !== null ? String(value) : match;
    });
};

// Robust normalization: ensure required array fields conform to array type; tolerate strings/objects/null.
const normalizeToSchema = (data: any, schema: SchemaProperty): any => {
    if (!schema || schema.type !== 'object' || !schema.properties || typeof data !== 'object' || data === null) {
        return data;
    }

    const required = schema.required || [];
    for (const key of required) {
        const propSchema = schema.properties[key];
        if (!propSchema) continue;

        const value = (data as any)[key];
        if (propSchema.type === 'object') {
            if (value && typeof value === 'object') {
                (data as any)[key] = normalizeToSchema(value, propSchema);
            }
        } else if (propSchema.type === 'array') {
            // If missing or null, set to empty array (empty array is valid per validator)
            if (value === undefined || value === null) {
                (data as any)[key] = [];
                continue;
            }
            // Already an array
            if (Array.isArray(value)) {
                // Optionally normalize array items if they are OBJECT type
                const itemSchema = propSchema.items;
                if (itemSchema && itemSchema.type === 'object') {
                    (data as any)[key] = value.map((item: any) => {
                        if (item && typeof item === 'object') {
                            return normalizeToSchema(item, itemSchema);
                        }
                        // If item is not an object, we cannot coerce reliably; drop invalid items.
                        return null;
                    }).filter((v: any) => v !== null);
                }
                continue;
            }

            // Try to coerce into array
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        (data as any)[key] = parsed;
                    } else if (parsed && typeof parsed === 'object') {
                        (data as any)[key] = [parsed];
                    } else {
                        // Fallback: split by newlines or commas into string array if item schema expects strings
                        const itemSchema = propSchema.items;
                        if (itemSchema && itemSchema.type !== 'object') {
                            const arr = value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
                            (data as any)[key] = arr;
                        } else {
                            (data as any)[key] = [];
                        }
                    }
                } catch {
                    // Non-JSON string; fallback
                    const itemSchema = propSchema.items;
                    if (itemSchema && itemSchema.type !== 'object') {
                        const arr = value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
                        (data as any)[key] = arr;
                    } else {
                        (data as any)[key] = [];
                    }
                }
            } else if (typeof value === 'object') {
                // Wrap single object into array
                (data as any)[key] = [value];
            } else {
                // Any other type -> empty array
                (data as any)[key] = [];
            }
        }
    }

    return data;
};

// Util: strip markdown code fences and sanitize common JSON issues
const stripCodeFences = (text: string): string => {
    return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
};

const extractJsonObjectSubstring = (text: string): string => {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        return text.slice(first, last + 1);
    }
    return text;
};

const fixTrailingCommas = (text: string): string => {
    return text.replace(/,(\s*[}\]])/g, '$1');
};

const normalizeQuotesAndBackticks = (text: string): string => {
    return text.replace(/[""]/g, '"').replace(/['']/g, "'").replace(/`+/g, '');
};

const sanitizeJsonString = (text: string): string => {
    const stripped = stripCodeFences(text);
    const extracted = extractJsonObjectSubstring(stripped);
    const normalized = normalizeQuotesAndBackticks(extracted);
    return fixTrailingCommas(normalized);
};

const safeParseJsonOrNull = (text: string): any | null => {
    try {
        return JSON.parse(stripCodeFences(text));
    } catch {
        try {
            return JSON.parse(sanitizeJsonString(text));
        } catch {
            return null;
        }
    }
};

// Build default values based on schema types
const buildDefaultObject = (schemaNode: SchemaProperty): any => {
    const obj: any = {};
    if (!schemaNode || schemaNode.type !== 'object' || !schemaNode.properties) return obj;
    const req = schemaNode.required || [];
    for (const key of req) {
        const child = schemaNode.properties[key];
        if (!child) continue;
        obj[key] = defaultValueForSchema(child);
    }
    return obj;
};

const defaultValueForSchema = (schemaNode: SchemaProperty): any => {
    switch (schemaNode.type) {
        case 'string': return '';
        case 'integer': return 0;
        case 'number': return 0;
        case 'boolean': return false;
        case 'array': return [];
        case 'object': return buildDefaultObject(schemaNode);
        default: return null;
    }
};

// Ensure all required fields exist, recursively, and coerce simple scalars
const ensureRequiredFields = (data: any, schemaNode: SchemaProperty): any => {
    if (!schemaNode || schemaNode.type !== 'object' || !schemaNode.properties || typeof data !== 'object' || data === null) return data;
    const required = schemaNode.required || [];
    for (const key of required) {
        const childSchema = schemaNode.properties[key];
        if (!childSchema) continue;
        let value = data[key];
        if (value === undefined || value === null) {
            data[key] = defaultValueForSchema(childSchema);
            value = data[key];
        }
        if (childSchema.type === 'object') {
            data[key] = ensureRequiredFields(value, childSchema);
        } else if (childSchema.type === 'array') {
            if (!Array.isArray(value)) {
                data[key] = [];
            } else {
                const itemSchema = childSchema.items;
                if (itemSchema && itemSchema.type === 'object') {
                    data[key] = value.map((item: any) => ensureRequiredFields(item, itemSchema));
                }
            }
        } else if (childSchema.type === 'string') {
            if (typeof data[key] !== 'string') data[key] = String(data[key]);
        } else if (childSchema.type === 'integer') {
            const num = typeof data[key] === 'number' ? Math.trunc(data[key]) : parseInt(String(data[key]).replace(/[^\d-]/g, ''), 10);
            data[key] = isNaN(num) ? 0 : num;
        } else if (childSchema.type === 'number') {
            const num = typeof data[key] === 'number' ? data[key] : parseFloat(String(data[key]).replace(/[^\d.-]/g, ''));
            data[key] = isNaN(num) ? 0 : num;
        } else if (childSchema.type === 'boolean') {
            const v = data[key];
            if (typeof v !== 'boolean') {
                const s = String(v).toLowerCase().trim();
                data[key] = ['true','yes','y','1','t'].includes(s) ? true : ['false','no','n','0','f'].includes(s) ? false : Boolean(v);
            }
        }
    }
    return data;
};

/**
 * Validates AI-generated data against a schema and attempts to fix it if invalid.
 * This is the core "Field Compensation Mechanism" tool.
 * @param initialResponseText The initial raw text response from the AI.
 * @param agentType The role of the agent that generated the response.
 * @param promptCard The original prompt card used, for retry context.
 * @param context The context object used to generate the original prompt.
 * @param addLog A callback to log retry attempts to the UI.
 * @returns A promise that resolves to the validated, parsed data object.
 */
export const validateAndCompensate = async (
    initialResponseText: string,
    agentType: AgentRole,
    promptCard: PromptCard,
    context: Record<string, any>,
    addLog: (agent: AgentRole, message: string, data?: any) => void
): Promise<any> => {
    const schema = agentFieldModels.getSchemaForAgent(agentType);
    if (!schema) {
        // If there's no schema, we can't validate. Try parsing, or return as is.
        try {
            // Sanitize even for non-schema responses that might be JSON.
            const cleanedText = initialResponseText
                .trim()
                .replace(/^```(?:json)?\s*/, '')
                .replace(/```$/, '')
                .trim();
            return JSON.parse(cleanedText);
        } catch {
            return initialResponseText;
        }
    }

    let attempts = 0;
    let isValid = false;
    let parsedData: any;
    let compensationMessage = '';
    let currentText = initialResponseText;

    while (attempts < MAX_RETRIES && !isValid) {
        attempts++;
        if (attempts > 1) {
            addLog(
                AgentRole.COORDINATOR,
                `${agentType} output validation failed, retrying... (Attempt ${attempts}/${MAX_RETRIES})`,
                { reason: "Output does not conform to the required field model.", details: compensationMessage }
            );
            const strictConstraints = `
STRICT FORMAT CONSTRAINTS:
- Output MUST be a single JSON object and NOTHING ELSE (no prose, no markdown).
- Use double quotes for all keys and strings (no single/smart quotes).
- Do NOT include trailing commas in arrays/objects.
- Required array fields MUST be arrays (empty array is acceptable if unsure).
- Integer fields MUST be numbers, not strings.
- Fill ALL required fields in the schema.`;
            const promptWithCompensation = `${compensationMessage}${strictConstraints}

---
Please regenerate the complete JSON output based on the correction request above. The original prompt is provided for reference:
${injectVariables(promptCard.prompt, context)}`;
            const response = await agentService.runAgent(promptWithCompensation);
            currentText = response.text || "";
        }

        try {
            // Attempt parsing with sanitization and extraction.
            const maybeObj = safeParseJsonOrNull(currentText);
            if (maybeObj === null) throw new Error('JSON parse failed after sanitization.');

            parsedData = maybeObj;
            // Normalize to schema to tolerate type mismatches (e.g., required arrays returned as strings/objects)
            parsedData = normalizeToSchema(parsedData, schema);
            const validation = agentFieldModels.validateData(parsedData, schema);
            isValid = validation.isValid;

            if (!isValid) {
                if (attempts >= MAX_RETRIES) {
                    // Final attempt: gracefully auto-fill missing required fields and coerce types
                    const beforeMissing = validation.missingFields.slice();
                    parsedData = ensureRequiredFields(parsedData, schema);
                    const finalValidation = agentFieldModels.validateData(parsedData, schema);
                    if (finalValidation.isValid) {
                        addLog(AgentRole.COORDINATOR, 'Auto-filled missing required fields with safe defaults to satisfy schema.', { previouslyMissing: beforeMissing });
                        isValid = true;
                    } else {
                        throw new Error(`Agent ${agentType} failed to generate valid structured data after ${MAX_RETRIES} attempts. Missing fields: ${finalValidation.missingFields.join(', ')}`);
                    }
                } else {
                    compensationMessage = `Coordinator Agent: Your last output was incomplete. Please rewrite it, ensuring you fill in the following missing or incomplete required fields:\n- ${validation.missingFields.join('\n- ')}`;
                }
            }
        } catch (e: any) {
            const parseErrorDetails = `The raw response started with: "${currentText.substring(0, 80)}...".`;
            if (attempts >= MAX_RETRIES) {
                const salvaged = safeParseJsonOrNull(currentText);
                if (salvaged) {
                    parsedData = normalizeToSchema(salvaged, schema);
                    parsedData = ensureRequiredFields(parsedData, schema);
                    const finalValidation = agentFieldModels.validateData(parsedData, schema);
                    if (finalValidation.isValid) {
                        addLog(AgentRole.COORDINATOR, 'Salvaged and sanitized JSON after persistent parse errors; filled defaults to ensure validity.', { error: e?.message });
                        return parsedData;
                    }
                }
                // As a last resort, return a skeleton object so downstream steps can proceed.
                const skeleton = buildDefaultObject(schema);
                addLog(AgentRole.COORDINATOR, 'Generated minimal schema skeleton due to persistent JSON parse errors.', { error: e?.message, hint: parseErrorDetails });
                return skeleton;
            } else {
                compensationMessage = `Coordinator Agent: Your last output was not valid JSON and failed to parse. Error: ${e.message}. ${parseErrorDetails} Please strictly follow the specified field model and ensure the output is a single, complete, parseable JSON object without any surrounding text or markdown code fences (like \`\`\`json).`;
            }
        }
    }
    return parsedData;
};