/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { AgentWorkflow, AgentRole, WorkflowNode, LLMModel } from '../types.ts';
import { getPromptCardIdForAgent } from './agentPrompts.ts';
import * as modelManager from './modelManager.ts';

const WORKFLOW_STORAGE_KEY = 'storyWeaverWorkflows';
export const DEFAULT_WORKFLOW_ID = 'default-8-agent-workflow';

// This function builds the default, non-editable workflow.
const createDefaultWorkflow = (): AgentWorkflow => {
    // We now use the robust ID lookup instead of fragile name lookup.
    // Node positions have been adjusted to be more compact to prevent overflow.
    const nodes: WorkflowNode[] = [
        // Fix: Node positions updated to prevent overflow on smaller screens.
        { id: 'node-1', name: '协调器', type: 'agent', agentType: AgentRole.COORDINATOR, promptCardId: getPromptCardIdForAgent(AgentRole.COORDINATOR) || null, position: { x: 20, y: 50 } },
        { id: 'node-data', name: '数据分析', type: 'agent', agentType: AgentRole.DATA_ANALYZER, promptCardId: getPromptCardIdForAgent(AgentRole.DATA_ANALYZER) || null, position: { x: 210, y: 50 } },
        { id: 'node-2', name: '大纲生成器', type: 'agent', agentType: AgentRole.OUTLINE_GENERATOR, promptCardId: getPromptCardIdForAgent(AgentRole.OUTLINE_GENERATOR) || null, position: { x: 400, y: 50 } },
        { id: 'node-3', name: '生成器', type: 'agent', agentType: AgentRole.GENERATOR_AGENT, promptCardId: getPromptCardIdForAgent(AgentRole.GENERATOR_AGENT) || null, position: { x: 590, y: 50 } },
        { id: 'node-4', name: '章节写作', type: 'agent', agentType: AgentRole.CHAPTER_WRITER, promptCardId: getPromptCardIdForAgent(AgentRole.CHAPTER_WRITER) || null, position: { x: 20, y: 200 } },
        { id: 'node-5', name: '审查员', type: 'agent', agentType: AgentRole.REVIEWER, promptCardId: getPromptCardIdForAgent(AgentRole.REVIEWER) || null, position: { x: 210, y: 200 } },
        { id: 'node-6', name: '质量评估', type: 'agent', agentType: AgentRole.QUALITY_EVALUATOR, promptCardId: getPromptCardIdForAgent(AgentRole.QUALITY_EVALUATOR) || null, position: { x: 400, y: 200 } },
        { id: 'node-7', name: '编辑', type: 'agent', agentType: AgentRole.EDITOR, promptCardId: getPromptCardIdForAgent(AgentRole.EDITOR) || null, position: { x: 590, y: 200 } },
    ];

    const edges: AgentWorkflow['edges'] = [
        { id: 'edge-1-data', source: 'node-1', target: 'node-data' },
        { id: 'edge-data-2', source: 'node-data', target: 'node-2' },
        { id: 'edge-2-3', source: 'node-2', target: 'node-3' },
        { id: 'edge-3-4', source: 'node-3', target: 'node-4' },
        { id: 'edge-4-5', source: 'node-4', target: 'node-5' },
        { id: 'edge-5-6', source: 'node-5', target: 'node-6' },
        { id: 'edge-6-7', source: 'node-6', target: 'node-7' },
    ];

    return {
        id: DEFAULT_WORKFLOW_ID,
        name: '小说创作工作流 (8智能体-含数据分析)',
        isDefault: true,
        nodes,
        edges,
        tools: [], // Default workflow has no custom tools initially
        llms: [],  // Default workflow uses standard LLMs
    };
};

export const getWorkflows = (): AgentWorkflow[] => {
    let userWorkflows: AgentWorkflow[] = [];
    try {
        const saved = localStorage.getItem(WORKFLOW_STORAGE_KEY);
        if (saved) {
            // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
            userWorkflows = JSON.parse(saved) as AgentWorkflow[];
        }
    } catch (e) {
        console.error("Failed to load workflows", e);
    }
    return [createDefaultWorkflow(), ...userWorkflows];
};

export const saveWorkflows = (workflows: AgentWorkflow[]): void => {
    try {
        // Filter out the default workflow before saving, as it's generated dynamically.
        const userWorkflows = workflows.filter(wf => !wf.isDefault);
        localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(userWorkflows));
        window.dispatchEvent(new Event('storage'));
    } catch (e) {
        console.error("Failed to save workflows", e);
    }
};

export const getWorkflowById = (id: string): AgentWorkflow | undefined => {
    const allWorkflows = getWorkflows();
    return allWorkflows.find(wf => wf.id === id);
};

/**
 * @deprecated Use startWorkflow and subscribe to SSE events instead.
 */
export const runWorkflow = async (workflow: AgentWorkflow): Promise<any> => {
    try {
        // Prefer configurable backend URL via Vite env, with sensible local fallback
        const BACKEND_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

        const response = await fetch(`${BACKEND_BASE_URL}/execute_workflow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(workflow),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to execute workflow');
        }

        return await response.json();
    } catch (error) {
        console.error('Error running workflow:', error);
        throw error;
    }
};

export const startWorkflow = async (workflow: AgentWorkflow): Promise<string> => {
    try {
        const BACKEND_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

        // 转换 AgentWorkflow 为 WorkflowExecutionRequest 格式
        const workflowRequest = {
            workflow_id: workflow.id,
            nodes: workflow.nodes.map(node => ({
                id: node.id,
                name: node.name || node.id, // 使用 name,如果没有则使用 id
                type: node.type,
                position: node.position,
                config: createNodeConfig(node)
            })),
            edges: workflow.edges.map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target
            })),
            context: {
                workflow_name: workflow.name,
                is_default: workflow.isDefault || false
            }
        };

        const response = await fetch(`${BACKEND_BASE_URL}/api/v1/workflows/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(workflowRequest),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to start workflow');
        }

        const responseData = await response.json();
        return responseData.data.execution_id;
    } catch (error) {
        console.error('Error starting workflow:', error);
        throw error;
    }
};

// 辅助函数:根据节点类型创建配置
function createNodeConfig(node: any) {
    console.log('Creating node config for:', node.id, 'type:', node.type, 'agentType:', node.agentType);
    
    // 基础配置,包含所有节点类型都需要的字段
    const baseConfig = {
        node_id: node.id,
        node_type: node.type,
        name: node.name || node.id,
        description: node.description || null,
        inputs: node.inputs || null,
        outputs: node.outputs || null,
        timeout: node.timeout || 30,
        retry: node.retry || 0
    };

    // 根据节点类型添加特定配置
    switch (node.type) {
        case 'agent':
            // 确保agentType存在且有效
            let agentType = node.agentType;
            if (!agentType || typeof agentType !== 'string') {
                console.warn(`Node ${node.id} missing agentType, using default GENERATOR_AGENT`);
                agentType = 'GENERATOR_AGENT';
            }
            
            // 修复:确保agentType正确映射到agent_type字段
            // 如果agentType是枚举值(如'协调器智能体'),直接使用
            // 如果是枚举键(如'COORDINATOR'),需要转换为对应的中文值
            let mappedAgentType = agentType;
            
            // 处理可能的枚举键到值的映射
            const agentTypeMapping: Record<string, string> = {
                'COORDINATOR': '协调器智能体',
                'DATA_ANALYZER': '数据分析智能体', 
                'OUTLINE_GENERATOR': '大纲智能体',
                'GENERATOR_AGENT': '生成器智能体',
                'CHAPTER_WRITER': '章节写作智能体',
                'SECTION_WRITER': '段落写作智能体',
                'REVIEWER': '审查智能体',
                'EDITOR': '编辑智能体',
                'QUALITY_EVALUATOR': '质量评估智能体',
                'SUMMARY_AGENT': '摘要生成智能体'
            };
            
            if (agentTypeMapping[agentType]) {
                mappedAgentType = agentTypeMapping[agentType];
            }
            
            const agentConfig = {
                ...baseConfig,
                agent_type: mappedAgentType,
                model_id: node.llm?.id || 'gpt-4o',
                prompt: node.prompt || `Execute ${mappedAgentType} task`,
                prompt_card_id: node.promptCardId || null
            };
            
            console.log('Agent config created:', agentConfig);
            return agentConfig;
            
        case 'tool':
            return {
                ...baseConfig,
                tool_type: node.toolType || 'code_interpreter',
                function_body: node.functionBody || 'function execute() { return "Tool executed"; }',
                model_id: node.llm?.id || null
            };
        case 'data':
            return {
                ...baseConfig,
                data_type: node.dataType || 'raw_text',
                content: node.fileContent || node.name || 'Default data content'
            };
        default:
            return {
                ...baseConfig,
                agent_type: 'GENERATOR_AGENT',
                model_id: 'gpt-4o',
                prompt: `Execute ${node.name} task`
            };
    }
}

/**
 * Retrieves a list of available LLMs from modelManager
 * @returns An array of LLMModel objects.
 */
export const getAvailableLLMs = (): LLMModel[] => {
    const allModelConfigs = modelManager.getModelConfigs();
    return allModelConfigs
        .filter(config => !config.isGemini) // Exclude Gemini models, as they are handled specially
        .map(config => ({
            id: config.id,
            name: config.name,
            modelId: config.modelId,
            type: config.apiUrl?.includes('anthropic.com') ? 'anthropic' : (config.apiUrl ? 'openai' : 'custom') // Infer type or use 'custom'
        }));
};