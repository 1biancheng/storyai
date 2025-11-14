/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Scene, PromptCard, FieldModel, AgentRole } from '../../types.ts';
import { getDefaultPrompts } from './agentPrompts.ts';
import * as agentSchemas from './agentFieldModels.ts';

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

const SCENES_KEY = 'storyWeaverScenes';
const CARDS_KEY = 'storyWeaverPromptCards';
const MODELS_KEY = 'storyWeaverFieldModels';

// Export IDs for special, non-deletable scenes
export const STYLE_SCENE_ID = 'style-scene-root';
export const FILES_SCENE_ID = 'files-scene-root';


/**
 * Converts an OpenAI schema object into the application's flat FieldModel format.
 * It only converts top-level simple types (string, number, boolean).
 * @param schema The schema to convert.
 * @param name The desired name for the new FieldModel.
 * @param id The desired ID for the new FieldModel.
 * @returns A new FieldModel object.
 */
const schemaToFieldModel = (schema: Schema, name: string, id: string): FieldModel => {
    const fields: FieldModel['fields'] = [];
    if (schema.properties) {
        for (const key in schema.properties) {
            const prop = schema.properties[key];
            let fieldType: 'string' | 'number' | 'boolean';
            switch(prop.type) {
                case 'string':
                    fieldType = 'string';
                    break;
                case 'number':
                case 'integer':
                    fieldType = 'number';
                    break;
                case 'boolean':
                    fieldType = 'boolean';
                    break;
                default:
                    // Skip unsupported types like OBJECT or ARRAY in our flat model structure.
                    continue;
            }
            fields.push({
                id: crypto.randomUUID(),
                name: key,
                type: fieldType,
                isDefault: true,
            });
        }
    }
    return { id, name, fields, isDefault: true };
};


// --- Initialization ---
// Called once when the app starts to ensure default data is present.
let initialized = false;
export const initializeCardEditorData = () => {
    if (initialized) return;
    try {
        // Initialize default prompt cards from agent templates, ensuring they exist by ID.
        const allCards = getPromptCards();
        const defaultPrompts = getDefaultPrompts();
        let cardsModified = false;

        for (const defaultPrompt of defaultPrompts) {
            // Check if a card with the static ID already exists.
            if (!allCards.find(card => card.id === defaultPrompt.id)) {
                allCards.push({
                    ...defaultPrompt,
                    sceneId: null,
                    linkedModelId: null,
                });
                cardsModified = true;
            }
        }
        if (cardsModified) {
            savePromptCards(allCards);
        } else if (!localStorage.getItem(CARDS_KEY)) {
             // Fallback for brand new users if no cards were added.
            savePromptCards([]);
        }

        // Initialize default scenes, ensuring they exist for all users
        const scenes = getScenes();
        let scenesModified = false;

        if (!scenes.find(s => s.id === STYLE_SCENE_ID)) {
            scenes.push({ id: STYLE_SCENE_ID, name: '写作风格', parentId: null });
            scenesModified = true;
        }
        if (!scenes.find(s => s.id === FILES_SCENE_ID)) {
            scenes.push({ id: FILES_SCENE_ID, name: '文件', parentId: null });
            scenesModified = true;
        }

        if (scenesModified) {
            saveScenes(scenes);
        }

        // Initialize default field models from all agent schemas
        const fieldModels = getFieldModels();
        let modelsModified = false;
        
        // Define all default models that should be created from schemas
        const defaultSchemaModels = [
            { id: 'default-project-requirements-model', name: '项目要求字段模型 (协调器)', schema: agentSchemas.projectRequirementsSchema, agent: AgentRole.COORDINATOR },
            { id: 'default-outline-model', name: '大纲字段模型 (大纲智能体)', schema: agentSchemas.outlineModelSchema, agent: AgentRole.OUTLINE_GENERATOR },
            { id: 'default-generator-model', name: '世界观字段模型 (生成器)', schema: agentSchemas.generatorModelSchema, agent: AgentRole.GENERATOR_AGENT },
            { id: 'default-chapter-writer-model', name: '章节写字段模型 (章节写作)', schema: agentSchemas.chapterWriterSchema, agent: AgentRole.CHAPTER_WRITER },
            { id: 'default-reviewer-model', name: '审查报告字段模型 (审查)', schema: agentSchemas.reviewerSchema, agent: AgentRole.REVIEWER },
            { id: 'default-quality-eval-model', name: '质量评估字段模型 (评估)', schema: agentSchemas.qualityEvaluatorSchema, agent: AgentRole.QUALITY_EVALUATOR },
            { id: 'default-editor-model', name: '编辑终稿字段模型 (编辑)', schema: agentSchemas.editorSchema, agent: AgentRole.EDITOR },
            { id: 'default-summary-model', name: '摘要字段模型 (摘要生成)', schema: agentSchemas.summaryAgentSchema, agent: AgentRole.SUMMARY_AGENT },
            { id: 'default-section-writer-model', name: '段落写作字段模型 (段落写作)', schema: agentSchemas.sectionWriterSchema, agent: AgentRole.SECTION_WRITER },
        ];

        for (const defaultModel of defaultSchemaModels) {
            if (!fieldModels.find(m => m.id === defaultModel.id)) {
                // The schemaToFieldModel function expects a simplified, flat structure.
                // For nested schemas like the outline model, we need to point to the correct sub-object.
                const schemaSource = defaultModel.agent === AgentRole.OUTLINE_GENERATOR
                    ? agentSchemas.outlineModelSchema.properties!['outline_model']
                    : defaultModel.schema;

                const newModel = schemaToFieldModel(schemaSource, defaultModel.name, defaultModel.id);
                fieldModels.push(newModel);
                modelsModified = true;
            }
        }
        
        if (modelsModified) {
            saveFieldModels(fieldModels);
        } else if (!localStorage.getItem(MODELS_KEY)) {
            // Fallback for brand new users if no schema models were added
            saveFieldModels([]);
        }

    } catch (e) {
        console.error("Failed to initialize card editor data", e);
    }
    initialized = true;
};


// --- Scenes ---
export const getScenes = (): Scene[] => {
    try {
        const data = localStorage.getItem(SCENES_KEY);
        // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
        return data ? JSON.parse(data) as Scene[] : [];
    } catch (e) {
        console.error("Failed to load scenes", e);
        return [];
    }
};

export const saveScenes = (scenes: Scene[]): void => {
    try {
        localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
         window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("Failed to save scenes", e);
    }
};

// --- Prompt Cards ---
export const getPromptCards = (): PromptCard[] => {
    try {
        const data = localStorage.getItem(CARDS_KEY);
        // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
        return data ? JSON.parse(data) as PromptCard[] : [];
    } catch (e) {
        console.error("Failed to load prompt cards", e);
        return [];
    }
};

export const getPromptCardByName = (name: string): PromptCard | undefined => {
    const cards = getPromptCards();
    return cards.find(card => card.name === name);
};

export const savePromptCards = (cards: PromptCard[]): void => {
    try {
        localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
         window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("Failed to save prompt cards", e);
    }
};

export const createPromptCard = (cardData: Omit<PromptCard, 'id' | 'lastModified'>): PromptCard => {
    const newCard: PromptCard = {
        ...cardData,
        id: crypto.randomUUID(),
        lastModified: new Date().toISOString(),
    };
    const cards = getPromptCards();
    cards.push(newCard);
    savePromptCards(cards);
    return newCard;
};

export const updatePromptCard = (id: string, updates: Partial<PromptCard>): PromptCard => {
    const cards = getPromptCards();
    const cardIndex = cards.findIndex(card => card.id === id);
    if (cardIndex === -1) {
        throw new Error(`Card with id ${id} not found`);
    }
    const updatedCard = {
        ...cards[cardIndex],
        ...updates,
        lastModified: new Date().toISOString(),
    };
    cards[cardIndex] = updatedCard;
    savePromptCards(cards);
    return updatedCard;
};

export const deletePromptCard = (id: string): void => {
    const cards = getPromptCards();
    const filteredCards = cards.filter(card => card.id !== id);
    savePromptCards(filteredCards);
};

// --- Field Models ---
export const getFieldModels = (): FieldModel[] => {
    try {
        const data = localStorage.getItem(MODELS_KEY);
        // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
        return data ? JSON.parse(data) as FieldModel[] : [];
    } catch (e) {
        console.error("Failed to load field models", e);
        return [];
    }
};

export const saveFieldModels = (models: FieldModel[]): void => {
    try {
        localStorage.setItem(MODELS_KEY, JSON.stringify(models));
         window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("Failed to save field models", e);
    }
};

// --- Import/Export All Data ---
export const exportAllData = () => {
    try {
        const dataToExport = {
            scenes: getScenes(),
            promptCards: getPromptCards(),
            fieldModels: getFieldModels(),
        };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'storyweaver-card-editor-backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export data:", error);
        alert("导出数据失败.");
    }
};

export const importAllData = (jsonString: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            // FIX: Add explicit type annotation to the parsed data to ensure type safety.
            const data: { scenes: Scene[], promptCards: PromptCard[], fieldModels: FieldModel[] } = JSON.parse(jsonString);
            if (Array.isArray(data.scenes) && Array.isArray(data.promptCards) && Array.isArray(data.fieldModels)) {
                 if (window.confirm('这将覆盖您当前的卡片编辑器数据(场景、卡片和模型).您确定要继续吗?')) {
                    saveScenes(data.scenes);
                    savePromptCards(data.promptCards);
                    saveFieldModels(data.fieldModels);
                    resolve();
                } else {
                    reject(new Error('User cancelled the import.'));
                }
            } else {
                reject(new Error('File format is invalid. It must contain "scenes", "promptCards", and "fieldModels" arrays.'));
            }
        } catch (error) {
            reject(error);
        }
    });
};