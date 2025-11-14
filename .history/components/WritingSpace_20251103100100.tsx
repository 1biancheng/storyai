/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix: Corrected the React import statement by removing the extraneous 'a'.
import React, { useState, useEffect } from 'react';
import WritingDesk from './ChatInterface.tsx';
import * as agentService from '../services/agentService.ts';
import { AgentLog, AgentRole, WritingProcessStatus, ProjectData, WorkflowNode, VersionHistory, StoryContent, StoryContentType, AgentWorkflow, Scene, PromptCard } from '../types.ts';
import { Play, RotateCw, History } from 'lucide-react';
import * as cardEditorService from '../services/cardEditorService.ts';
import * as workflowManager from '../services/workflowManager.ts';
import * as agentFieldModels from '../services/agentFieldModels.ts';
import * as fieldCompensationService from '../services/fieldCompensationService.ts';
import VersionHistoryModal from './VersionHistory.tsx';
import * as agentPrompts from '../services/agentPrompts.ts';
import * as modelManager from '../services/modelManager.ts'; // Import modelManager to get model configs

/**
 * Injects variables from a context object into a prompt template.
 * @param prompt The template string with {{variable}} placeholders.
 * @param context A key-value store of variables.
 * @returns The prompt with variables substituted.
 */
const injectVariables = (prompt: string, context: Record<string, any>): string => {
    // Regex to find all {{variableName}} placeholders, including Chinese characters
    return prompt.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        // Look for the variable in the context.
        const value = context[variableName];
        
        // If the value is an object, stringify it to avoid "[object Object]"
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }

        return value !== undefined && value !== null ? String(value) : match;
    });
};


const WritingSpace: React.FC = () => {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [logs, setLogs] = useState<AgentLog[]>([]);
    const [status, setStatus] = useState<WritingProcessStatus>(WritingProcessStatus.IDLE);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);

    const activeProject = projects.find(p => p.id === selectedProjectId) || null;
    const isWriting = status !== WritingProcessStatus.IDLE && status !== WritingProcessStatus.COMPLETE && status !== WritingProcessStatus.ERROR;


    // Load projects list from localStorage and listen for changes
    const loadProjects = () => {
        const savedProjects = localStorage.getItem('storyWeaverProjects');
        if (savedProjects) {
            // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
            setProjects(JSON.parse(savedProjects) as ProjectData[]);
        } else {
            setProjects([]);
        }
    }
    
    useEffect(() => {
        loadProjects();
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'storyWeaverProjects') {
                loadProjects();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Load logs and status when project selection changes
    useEffect(() => {
        if (!selectedProjectId) {
            setLogs([]);
            setStatus(WritingProcessStatus.IDLE);
            return;
        }

        const projectInData = projects.find(p => p.id === selectedProjectId);
        const savedLogs = localStorage.getItem(`storyWeaverLogs_${selectedProjectId}`);
        const savedStatus = localStorage.getItem(`storyWeaverStatus_${selectedProjectId}`);

        // FIX: Add explicit type assertions to JSON.parse to prevent 'unknown' type errors.
        setLogs(savedLogs ? JSON.parse(savedLogs) as AgentLog[] : []);
        setStatus(savedStatus ? JSON.parse(savedStatus) as WritingProcessStatus : WritingProcessStatus.IDLE);

    }, [selectedProjectId, projects]);

    // Save logs and status to localStorage when they change
    useEffect(() => {
        if (!selectedProjectId) return;
        localStorage.setItem(`storyWeaverLogs_${selectedProjectId}`, JSON.stringify(logs));
    }, [logs, selectedProjectId]);

    useEffect(() => {
        if (!selectedProjectId) return;
        localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(status));
    }, [status, selectedProjectId]);

    // 加载工作流列表并监听更新
    useEffect(() => {
        const loadWfs = () => {
            try {
                setWorkflows(workflowManager.getWorkflows());
            } catch (e) {
                console.error('加载工作流失败', e);
            }
        };
        loadWfs();
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'storyWeaverWorkflows') loadWfs();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);


    const addLog = (agent: AgentRole, message: string, data: any = null, isLoading = false, groundingChunks?: any[]): string => {
        const newLog = { id: crypto.randomUUID(), agent, message, data, isLoading, groundingChunks };
        setLogs(prev => [...prev, newLog]);
        return newLog.id;
    };
    
    const updateLog = (id: string, update: Partial<Omit<AgentLog, 'id' | 'agent'>>) => {
        setLogs(prev => {
            const newLogs = [...prev];
            const logIndex = newLogs.findIndex(log => log.id === id);
            if (logIndex !== -1) {
                newLogs[logIndex] = { ...newLogs[logIndex], ...update, isLoading: false };
            }
            return newLogs;
        });
    };

    // 切换当前项目的工作流
    const handleChangeWorkflowForActiveProject = (newWorkflowId: string) => {
        if (!activeProject) return;
        const updatedProjects = projects.map(p => p.id === activeProject.id ? { ...p, workflowId: newWorkflowId } : p);
        setProjects(updatedProjects);
        localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
        addLog(AgentRole.SYSTEM, `项目 "${activeProject.projectName}" 的工作流已切换为 "${workflowManager.getWorkflowById(newWorkflowId)?.name || newWorkflowId}".`);
    };

    const handleClearProgress = () => {
        if (!selectedProjectId) return;
        if (window.confirm('您确定要清除此项目的写作进度吗?生成的文本和所有版本历史记录都将丢失.')) {
            setLogs([]);
            setStatus(WritingProcessStatus.IDLE);
            
            // Remove finalText and history from project data
            const updatedProjects = projects.map(p => {
                if (p.id === selectedProjectId) {
                    const { finalText, storyContent, history, ...rest } = p as any; // Use 'as any' to bypass strict type check for deletion
                    return rest;
                }
                return p;
            });
            setProjects(updatedProjects);
            localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
        }
    };
    
     const handleRevertVersion = (version: VersionHistory) => {
        if (!activeProject) return;
        if (window.confirm('您确定要恢复到此版本吗?当前文本将被替换.')) {
            const revertedProject: ProjectData = {
                ...activeProject,
                finalText: version.content,
            };
            const updatedProjects = projects.map(p => (p.id === revertedProject.id ? revertedProject : p));
            setProjects(updatedProjects);
            localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
            setIsHistoryOpen(false);
            addLog(AgentRole.SYSTEM, `项目内容已恢复到 ${new Date(version.timestamp).toLocaleString()} 的版本.`);
        }
    };

    const mapAgentToStatus = (role: AgentRole): WritingProcessStatus => {
        switch (role) {
            case AgentRole.COORDINATOR:
                return WritingProcessStatus.ANALYZING_REQUIREMENTS;
            case AgentRole.OUTLINE_GENERATOR:
                return WritingProcessStatus.GENERATING_OUTLINE;
            case AgentRole.GENERATOR_AGENT:
                return WritingProcessStatus.PREPARING_NARRATIVE;
            case AgentRole.CHAPTER_WRITER:
                return WritingProcessStatus.GENERATING_CHAPTERS;
            case AgentRole.REVIEWER:
            case AgentRole.QUALITY_EVALUATOR:
                return WritingProcessStatus.REVIEWING;
            case AgentRole.EDITOR:
            case AgentRole.SECTION_WRITER:
                return WritingProcessStatus.EDITING;
            case AgentRole.SUMMARY_AGENT: // Fix: Added case for SUMMARY_AGENT
                return WritingProcessStatus.GENERATING_OUTLINE; // Or a more specific status if available
            default:
                // A generic fallback for any other agent types
                return WritingProcessStatus.GENERATING_CHAPTERS;
        }
    };

    const handleStartProcess = async () => {
        if (!activeProject) return;
        
        if (activeProject.finalText) {
            if (!window.confirm('这将根据当前要求生成一个新的故事,并覆盖现有文本.当前文本已保存在版本历史中.要继续吗?')) {
                return;
            }
        }
        
        setLogs([]); // Start fresh
        setStatus(WritingProcessStatus.IDLE);
        addLog(AgentRole.COORDINATOR, `开始项目: "${activeProject.projectName}"`);

        // Helper function to execute a single node.
        const executeNode = async (node: WorkflowNode, context: Record<string, any>, storyContentRef: { current: StoryContent[] }, fullTextRef: { current: string }) => {
            
            // Fix: Check node.agentType instead of node.type
            if (node.type === 'agent' && node.agentType === AgentRole.SUMMARY_AGENT) {
                // Fix: Pass node.agentType to addLog
                addLog(node.agentType, `步骤 "${node.agentType}" 已在章节生成过程中集成,此处跳过.`);
                return;
            }

            // Fix: Pass node.agentType to mapAgentToStatus for agent nodes
            if (node.type === 'agent' && node.agentType) {
                setStatus(mapAgentToStatus(node.agentType));
            } else {
                setStatus(WritingProcessStatus.ANALYZING_REQUIREMENTS); // Default status if not an agent node
            }

            // Determine model and special features based on project settings, with precedence
            let effectiveModelId = node.llm?.id || null; // Node's configured LLM is the default
            let thinkingConfig: { thinkingBudget: number } | undefined = undefined;
            let useSearchGrounding: boolean = false;
            let specialFeatureLog: string = '';
            let modelOverrideApplied = false;

            if (activeProject.enableThinkingMode) {
                // If thinking mode is enabled, force Gemini Pro and its thinking budget.
                effectiveModelId = modelManager.getModelConfigs().find(m => m.id === 'default-gemini-pro')?.id || effectiveModelId;
                if (effectiveModelId === 'default-gemini-pro') {
                    thinkingConfig = { thinkingBudget: 32768 };
                    specialFeatureLog = '已启用思考模式.强制使用 `gemini-2.5-pro` 模型并启用思考预算.';
                    modelOverrideApplied = true;
                } else {
                    specialFeatureLog = '已启用思考模式,但未找到 `gemini-2.5-pro` 配置或当前模型不是 Gemini.未应用思考模式.';
                }
            } else if (activeProject.enableSearchGrounding) {
                // If search grounding is enabled AND thinking mode is NOT overriding, force Gemini Flash for grounding.
                effectiveModelId = modelManager.getModelConfigs().find(m => m.id === 'default-gemini-flash')?.id || effectiveModelId;
                if (effectiveModelId === 'default-gemini-flash') {
                    useSearchGrounding = true;
                    specialFeatureLog = '已启用搜索增强.强制使用 `gemini-2.5-flash` 模型并启用 Google Search.';
                    modelOverrideApplied = true;
                } else {
                    specialFeatureLog = '已启用搜索增强,但未找到 `gemini-2.5-flash` 配置或当前模型不是 Gemini.未应用搜索增强.';
                }
            }
            
            if (modelOverrideApplied) {
                addLog(AgentRole.SYSTEM, specialFeatureLog);
            }

            // Fix: Pass node.agentType to addLog for agent nodes
            const mainLogId = addLog(node.type === 'agent' ? node.agentType || AgentRole.SYSTEM : AgentRole.SYSTEM, `执行步骤: ${node.name}...`, null, true);

            let promptCardId = node.promptCardId;
            // If a prompt card isn't explicitly linked in the workflow,
            // fall back to the agent's default prompt.
            if (!promptCardId && node.type === 'agent' && node.agentType) { // Fix: Add node.type check
                promptCardId = agentPrompts.getPromptCardIdForAgent(node.agentType) || null;
                if (promptCardId) {
                    addLog(AgentRole.SYSTEM, `节点 "${node.name}" 未配置提示卡,已自动使用默认提示.`);
                }
            }

            if (!promptCardId) {
                throw new Error(`节点 "${node.name}" 缺少提示卡片配置,且没有找到默认提示.`);
            }
            
            const promptCard = cardEditorService.getPromptCards().find(c => c.id === promptCardId);
            if (!promptCard) throw new Error(`未找到ID为 "${promptCardId}" 的提示卡片.`);
            
            let resultText: string;
            let data: any;
            let message: string;
            let groundingChunks: any[] | undefined = undefined;
            const contextKey = `${node.type}Result`; // This might need to be more specific for agent results
            
            const agentSchema = node.type === 'agent' && node.agentType ? agentFieldModels.getSchemaForAgent(node.agentType) : null;
            
            // Case 1: The Chapter Writer agent, which has a complex loop that calls the Summary Agent.
            // Fix: Check node.agentType instead of node.type
            if (node.type === 'agent' && node.agentType === AgentRole.CHAPTER_WRITER) {
                const outlineForLoop = context.outlineData;
                if (!outlineForLoop || !outlineForLoop.chapter_outline) {
                    throw new Error("上下文中未找到用于生成章节的大纲数据.请确保先运行大纲生成器.");
                }
                
                const summaryPromptCard = cardEditorService.getPromptCards().find(c => c.id === agentPrompts.getPromptCardIdForAgent(AgentRole.SUMMARY_AGENT));
                if (!summaryPromptCard) {
                    throw new Error('未找到"摘要生成智能体提示词"卡片,无法执行章节摘要流程.');
                }

                addLog(AgentRole.CHAPTER_WRITER, `开始为 ${outlineForLoop.chapter_outline.length} 个章节生成内容.`);
                let previousChapterSummary = "这是第一章,没有前一章的内容摘要.";

                let totalCharCount = 0;
                const targetPerChapter = activeProject?.wordsPerChapter || 0;
                const targetTotalWords = activeProject?.totalWords || 0;

                for (const chapter of outlineForLoop.chapter_outline) {
                    const chapterLogId = addLog(AgentRole.CHAPTER_WRITER, `正在生成章节: ${chapter.chapter_name}`, null, true);
                    
                    const chapterNumberMatch = chapter.chapter_name.match(/\d+/);
                    const chapterNumber = chapterNumberMatch ? parseInt(chapterNumberMatch[0], 10) : -1;

                    let chapterEmotionConstraint = "本章无特定情绪约束.";
                    if (context.emotionAnalysis && chapterNumber !== -1) {
                        const emotionPoint = context.emotionAnalysis.emotionCurve.find((p: any) => p.position === chapterNumber);
                        if (emotionPoint) {
                            chapterEmotionConstraint = `请严格遵循以下情绪约束来创作本章内容:\n- **情感得分**: ${emotionPoint.score} (范围从-1.0到1.0)\n- **核心情绪词**: ${emotionPoint.keywords.join(', ')}\n- **情感基调摘要**: ${emotionPoint.summary}`;
                        }
                    }

                    const chapterContext = { 
                        ...context, 
                        chapterNumber: chapter.chapter_name.match(/\d+/)?.[0] || 'N/A', 
                        chapterTitle: chapter.chapter_name, 
                        chapterSummary: chapter.core_plot,
                        previous_chapter_summary: previousChapterSummary,
                        chapterEmotionConstraint: chapterEmotionConstraint,
                    };
                    const chapterPromptBase = injectVariables(promptCard.prompt, chapterContext);

                    const constraintText = targetPerChapter > 0
                      ? `\n\n请将本章正文控制在约 ${targetPerChapter} 字左右(允许±20%浮动),统一使用中文,避免列表化输出,保持叙事连贯与可读性.`
                      : '';
                    const chapterPrompt = `${chapterPromptBase}${constraintText}`;

                    const chapterResponse = await agentService.runAgent(chapterPrompt, undefined, effectiveModelId, thinkingConfig, useSearchGrounding, activeProject?.searchProvider); // Pass special configs
                    const chapterText = chapterResponse.text || "";
                    groundingChunks = chapterResponse.groundingChunks;
                    
                    const actualCharCount = chapterText.replace(/\s+/g, '').length;
                    totalCharCount += actualCharCount;

                    const chapterContent: StoryContent = {
                        id: crypto.randomUUID(),
                        type: StoryContentType.CHAPTER,
                        title: chapter.chapter_name,
                        content: chapterText,
                        timestamp: new Date().toISOString(),
                    };
                    storyContentRef.current.push(chapterContent);
                    fullTextRef.current += `\n\n## ${chapter.chapter_name}\n\n${chapterText}`;
                    updateLog(chapterLogId, { message: `章节 "${chapter.chapter_name}" 完成.`, data: { 预览: `${chapterText.substring(0, 80)}...`, 实际字数: actualCharCount, 目标字数: targetPerChapter || '未设置', 偏差: targetPerChapter ? actualCharCount - targetPerChapter : 'N/A' }, groundingChunks: groundingChunks }); // Log groundingChunks

                    // Now, generate a summary
                    const summaryLogId = addLog(AgentRole.SUMMARY_AGENT, `为章节 "${chapter.chapter_name}" 生成摘要...`, null, true);
                    const summaryContext = { ...context, 本章内容: chapterText };
                    const summaryPrompt = injectVariables(summaryPromptCard.prompt, summaryContext);
                    const summaryResponse = await agentService.runAgent(summaryPrompt, undefined, effectiveModelId, thinkingConfig, useSearchGrounding, activeProject?.searchProvider); // Pass special configs
                    previousChapterSummary = summaryResponse.text || "未能生成摘要.";
                    groundingChunks = summaryResponse.groundingChunks;
                    
                    const summaryContent: StoryContent = {
                        id: crypto.randomUUID(),
                        type: StoryContentType.SUMMARY,
                        title: `摘要: ${chapter.chapter_name}`,
                        content: previousChapterSummary,
                        timestamp: new Date().toISOString(),
                    };
                    storyContentRef.current.push(summaryContent);
                    
                    updateLog(summaryLogId, { message: `章节 "${chapter.chapter_name}" 的摘要已生成.`, data: `${previousChapterSummary.substring(0, 100)}...`, groundingChunks: groundingChunks }); // Log groundingChunks
                }
                context.chapterGenerationResult = { chaptersGenerated: outlineForLoop.chapter_outline.length };
                context.全文内容 = fullTextRef.current;

                const overallTarget = targetTotalWords || '未设置';
                updateLog(mainLogId, {
                    message: `所有章节生成完毕.`,
                    data: { 已生成章节: outlineForLoop.chapter_outline.length, 当前总字数: totalCharCount, 目标总字数: overallTarget, 总偏差: typeof overallTarget === 'number' ? (totalCharCount - overallTarget) : 'N/A' }
                });
                return;

            // Case 2: Agents with a structured JSON schema
            } else if (node.type === 'agent' && agentSchema) { // Fix: Check node.type === 'agent'
                const agentContext = { ...context };
                
                // Fix: Check node.agentType instead of node.type
                if (node.agentType === AgentRole.GENERATOR_AGENT && node.linkedResourceIds) {
                    const allCards = cardEditorService.getPromptCards();
                    const allScenes = cardEditorService.getScenes();
                    
                    const linkedCardPrompts = allCards
                        .filter(c => node.linkedResourceIds?.cards.includes(c.id))
                        .map(c => `卡片: ${c.name}\n${c.prompt}`);
                        
                    const linkedSceneCardPrompts = allCards
                        .filter(c => c.sceneId && node.linkedResourceIds?.scenes.includes(c.sceneId))
                        .map(c => {
                           const sceneName = allScenes.find(s => s.id === c.sceneId)?.name || '未知场景';
                           return `场景 "${sceneName}" 中的卡片: ${c.name}\n${c.prompt}`;
                        });
                        
                    const combinedContent = [...linkedCardPrompts, ...linkedSceneCardPrompts].join('\n\n---\n\n');
                    agentContext.linkedContent = combinedContent || "无参考资料.";
                }

                const prompt = injectVariables(promptCard.prompt, agentContext);
                const response = await agentService.runAgent(prompt, agentSchema, effectiveModelId, thinkingConfig, useSearchGrounding, activeProject?.searchProvider); // Pass special configs
                resultText = response.text || "";
                groundingChunks = response.groundingChunks;

                data = await fieldCompensationService.validateAndCompensate(
                    resultText,
                    node.agentType as AgentRole, // Fix: Cast node.agentType to AgentRole
                    promptCard,
                    context,
                    (agent, msg, logData) => { addLog(agent, msg, logData); }
                );
                context[contextKey] = data;

                // Update context and prepare log message based on agent type
                // Fix: Check node.agentType instead of node.type
                if (node.agentType === AgentRole.COORDINATOR) {
                    context.projectRequirements = data;
                    message = `项目需求分析完成.`;
                }
                // Fix: Check node.agentType instead of node.type
                else if (node.agentType === AgentRole.OUTLINE_GENERATOR) {
                    context.outlineData = data.outline_model;
                    context.storyOutline = data.outline_model;
                    const outlineContent: StoryContent = {
                        id: crypto.randomUUID(),
                        type: StoryContentType.OUTLINE,
                        title: '小说大纲',
                        content: JSON.stringify(data, null, 2),
                        timestamp: new Date().toISOString(),
                    };
                    storyContentRef.current.push(outlineContent);
                    const chapterCount = data.outline_model?.chapter_outline?.length || 0;
                    message = `大纲生成完毕,共 ${chapterCount} 个章节.`;
                }
                // Fix: Check node.agentType instead of node.type
                else if (node.agentType === AgentRole.GENERATOR_AGENT) {
                    context.generatorData = data;
                    if (data.characters) context.characterData = data.characters; // For Chapter Writer compatibility
                    const counts = Object.entries(data).map(([key, value]) => Array.isArray(value) ? `${key}: ${value.length}` : null).filter(Boolean);
                    message = `世界观元素生成完成.`;
                    data = `生成摘要: ${counts.join(', ')}`;
                } else {
                    message = `步骤 "${node.name}" 完成.`; // Fallback for any future schematized agents
                }

                updateLog(mainLogId, { message, data, groundingChunks: groundingChunks }); // Log groundingChunks
            
            // Case 3: Agents without a schema (e.g., Editor, Reviewer)
            } else if (node.type === 'agent') { // Fix: Check node.type === 'agent'
                const agentContext = { ...context };
                // Fix: Check node.agentType instead of node.type
                if (node.agentType === AgentRole.EDITOR && activeProject?.styleSceneId) {
                    const allCards = cardEditorService.getPromptCards();
                    const styleCards = allCards.filter(c => c.sceneId === activeProject.styleSceneId);
                    if (styleCards.length > 0) {
                        const combinedStylePrompt = styleCards.map(c => c.prompt).join('\n\n---\n\n');
                        agentContext.styleCardPrompt = `**重要写作风格要求**: 请严格遵循以下卡片内容中描述的风格来优化所有章节的语言表达:\n---\n${combinedStylePrompt}\n---`;
                    } else {
                        agentContext.styleCardPrompt = '';
                    }
                } else {
                    agentContext.styleCardPrompt = '';
                }

                const prompt = injectVariables(promptCard.prompt, agentContext);
                const response = await agentService.runAgent(prompt, undefined, effectiveModelId, thinkingConfig, useSearchGrounding, activeProject?.searchProvider); // Pass special configs
                resultText = response.text || "";
                groundingChunks = response.groundingChunks;
                data = resultText;
                context[contextKey] = resultText;
                
                // Fix: Check node.agentType instead of node.type
                if (node.agentType === AgentRole.EDITOR) {
                    fullTextRef.current = resultText; 
                }
                
                message = `步骤 "${node.name}" 完成.`;
                updateLog(mainLogId, { message, data, groundingChunks: groundingChunks }); // Log groundingChunks
            } else {
                // Handle non-agent nodes (LLM, Tool, Data) without prompt cards or complex logic here.
                // For simplicity, for now, they just log their completion.
                message = `非智能体组件 "${node.name}" (类型: ${node.type}) 执行完成.`;
                data = `组件类型: ${node.type}, 详情: ${JSON.stringify(node)}`;
                updateLog(mainLogId, { message, data });
            }
        };


        try {
            const workflow = workflowManager.getWorkflowById(activeProject.workflowId);
            if (!workflow) {
                // Fix: Corrected typo from `active` to `activeProject`.
                throw new Error(`未找到ID为 "${activeProject.workflowId}" 的工作流.`);
            }
            addLog(AgentRole.COORDINATOR, `使用工作流: "${workflow.name}"`);

            // --- Workflow Traversal (Topological Sort) ---
            const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
            const adj = new Map<string, string[]>(workflow.nodes.map(n => [n.id, []]));
            const inDegree = new Map<string, number>(workflow.nodes.map(n => [n.id, 0]));

            for (const edge of workflow.edges) {
                adj.get(edge.source)?.push(edge.target);
                inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
            }

            const queue: string[] = [];
            for (const [nodeId, degree] of inDegree.entries()) {
                if (degree === 0) queue.push(nodeId);
            }
            
            const executionOrder: WorkflowNode[] = [];
            while (queue.length > 0) {
                const u = queue.shift()!;
                executionOrder.push(nodeMap.get(u)!);
                for (const v of (adj.get(u) || [])) {
                    inDegree.set(v, (inDegree.get(v) || 0) - 1);
                    if (inDegree.get(v) === 0) queue.push(v);
                }
            }
            
            if (executionOrder.length !== workflow.nodes.length) {
                throw new Error("工作流包含循环,无法执行.");
            }
            // --- End Traversal ---

            const context: Record<string, any> = {
                ...(activeProject.customFields || {}),
                projectName: activeProject.projectName,
                projectGenre: activeProject.projectGenre,
                projectRequirements: activeProject.projectRequirements,
                totalWords: activeProject.totalWords || 0,
                emotionAnalysis: activeProject.emotionAnalysis || null,
                // Add the existing content to the context, defaulting to empty string
                全文内容: activeProject.finalText || '',
            };
            
            const storyContentRef = { current: [] as StoryContent[] };
            const fullTextRef = { current: `# ${activeProject.projectName}\n\n一部${activeProject.projectGenre}小说\n\n` };
            

            for (const node of executionOrder) {
                // Before executing the Editor Agent, check if its dependencies are met.
                // If not, execute the missing dependencies on the fly.
                // Fix: Check node.agentType instead of node.type
                if (node.type === 'agent' && node.agentType === AgentRole.EDITOR) {
                    // Fix: Check n.agentType for finding nodes
                    const reviewerNode = workflow.nodes.find(n => n.type === 'agent' && n.agentType === AgentRole.REVIEWER);
                    if (reviewerNode && (!context[`${AgentRole.REVIEWER}Result`] || !workflow.edges.some(e => e.source === reviewerNode.id && e.target === node.id))) {
                        addLog(AgentRole.EDITOR, `检测到审查智能体的内容缺失或未连接,正在将任务返回给审查智能体...`);
                        await executeNode(reviewerNode, context, storyContentRef, fullTextRef);
                    }
                    
                    // Fix: Check n.agentType for finding nodes
                    const qualityNode = workflow.nodes.find(n => n.type === 'agent' && n.agentType === AgentRole.QUALITY_EVALUATOR);
                    if (qualityNode && (!context[`${AgentRole.QUALITY_EVALUATOR}Result`] || !workflow.edges.some(e => e.source === qualityNode.id && e.target === node.id))) {
                        addLog(AgentRole.EDITOR, `检测到质量评估智能体的内容缺失或未连接,正在将任务返回给质量评估智能体...`);
                        await executeNode(qualityNode, context, storyContentRef, fullTextRef);
                    }
                }

                // Execute the current node in the sequence
                await executeNode(node, context, storyContentRef, fullTextRef);
            }
            
            // Finalize
            setStatus(WritingProcessStatus.EDITING);
            // Fix: Log with correct AgentRole
            const finalLogId = addLog(AgentRole.EDITOR, `正在编译最终稿件...`, null, true);
            
            const newVersion: VersionHistory = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                content: fullTextRef.current.trim(),
            };
            const currentHistory = activeProject.history || [];
            
            const finalProjectData: ProjectData = { 
                ...activeProject, 
                finalText: fullTextRef.current.trim(),
                storyContent: storyContentRef.current,
                history: [...currentHistory, newVersion]
            };
            const updatedProjects = projects.map(p => p.id === finalProjectData.id ? finalProjectData : p);
            setProjects(updatedProjects);
            localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
            
            const finalCharCount = finalProjectData.finalText.replace(/\s+/g, '').length;
            updateLog(finalLogId, { message: `稿件编译成功.`, data: { chapters: context.outlineData?.chapter_outline?.length || 0, words: finalCharCount } });
            
            // --- Auto-import to Card Editor ---
            addLog(AgentRole.SYSTEM, '正在将生成的内容导入到卡片编辑器...');
            try {
                const allCards = cardEditorService.getPromptCards();
                let updatedCards = [...allCards];

                if (finalProjectData.storyContent) {
                    for (const item of finalProjectData.storyContent) {
                        if (item.type === StoryContentType.SUMMARY) continue; // Skip summaries

                        const cardName = `${finalProjectData.projectName} - ${item.title}`;
                        const existingCardIndex = updatedCards.findIndex(c => c.name === cardName);

                        if (existingCardIndex !== -1) {
                            // Update existing card
                            updatedCards[existingCardIndex] = { ...updatedCards[existingCardIndex], prompt: item.content };
                        } else {
                            // Create new card
                            const newCard: PromptCard = {
                                id: crypto.randomUUID(),
                                name: cardName,
                                prompt: item.content,
                                sceneId: null, // Add to uncategorized
                                linkedModelId: null,
                            };
                            updatedCards.push(newCard);
                        }
                    }
                }
                cardEditorService.savePromptCards(updatedCards);
                addLog(AgentRole.SYSTEM, `已成功将内容作为新卡片导入.`);
            } catch (importError: any) {
                 addLog(AgentRole.SYSTEM, `导入到卡片编辑器时出错: ${importError.message}`);
            }
            // --- End Auto-import ---

            setStatus(WritingProcessStatus.COMPLETE);

        } catch (e: any) {
            console.error("Writing process error:", e);
            const errorMessage = e.message || '写作过程中发生未知错误.';
            addLog(AgentRole.SYSTEM, `错误: ${errorMessage}`, e instanceof Error ? e.stack : e.toString(), false);
            setStatus(WritingProcessStatus.ERROR);
        }
    };
    
    const getStatusIndicator = () => {
        if (!selectedProjectId) return <p className="text-sm text-center text-gray-500 dark:text-[#A8ABB4]">请选择一个项目以开始</p>;
    
        if (status === WritingProcessStatus.IDLE) {
            return <p className="text-sm text-center text-gray-500 dark:text-[#A8ABB4]">准备为 "{activeProject?.projectName}" 开始写作.</p>;
        }
        if (status === WritingProcessStatus.COMPLETE) {
            return <p className="text-sm text-center text-green-500 dark:text-green-400">写作完成!</p>;
        }
        if (status === WritingProcessStatus.ERROR) {
            return <p className="text-sm text-center text-red-500 dark:text-red-400">发生错误.</p>;
        }
        
        // Default case for all in-progress statuses
        return (
          <div className="flex items-center justify-center gap-2 text-sm text-yellow-500 dark:text-yellow-400">
             <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
             <span>{status}...</span>
          </div>
        );
    };


    return (
        <div className="flex h-full w-full gap-4">
            <div className="w-[380px] flex-shrink-0 h-full flex flex-col p-4 bg-white dark:bg-[#1E1E1E] shadow-md rounded-xl border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E2E2E2] mb-4">创作空间</h2>
                <div className="flex-grow space-y-4">
                   <label htmlFor="project-select" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                     加载项目
                   </label>
                    <select
                        id="project-select"
                        value={selectedProjectId || ''}
                        onChange={e => setSelectedProjectId(e.target.value || null)}
                        className="w-full py-1.5 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 focus:border-gray-300 dark:focus:border-white/20 text-sm"
                    >
                        <option value="">-- 选择一个项目 --</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.projectName}</option>
                        ))}
                    </select>
                    
                    <div className="mt-2">
                      <label htmlFor="workflow-select" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                        工作流选择(来自工作流编辑器)
                      </label>
                      <select
                        id="workflow-select"
                        value={activeProject?.workflowId || workflowManager.DEFAULT_WORKFLOW_ID}
                        onChange={e => handleChangeWorkflowForActiveProject(e.target.value)}
                        disabled={!activeProject}
                        className="w-full py-1.5 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 focus:border-gray-300 dark:focus:border-white/20 text-sm"
                      >
                        {workflows.map(wf => (
                          <option key={wf.id} value={wf.id}>{wf.name}{wf.isDefault ? ' (默认)' : ''}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex gap-2">
                        {activeProject && (logs.length > 0 || activeProject.finalText) && (
                             <button
                              onClick={handleClearProgress}
                              disabled={isWriting}
                              className="w-full flex items中心 justify-center gap-2 text-xs py-1.5 px-2 text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors rounded-md bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 dark:text-red-400 dark:hover:text-red-300"
                              aria-label="Clear writing progress"
                            >
                              <RotateCw size={14} />
                              清除写作进度
                            </button>
                        )}
                        {activeProject && (
                            <button
                                onClick={() => setIsHistoryOpen(true)}
                                disabled={!activeProject.history || activeProject.history.length === 0}
                                className="w全 flex items-center justify-center gap-2 text-xs py-1.5 px-2 text-indigo-500 hover:text-indigo-600 disabled:opacity-50 transition-colors rounded-md bg-indigo-100 dark:bg-indigo-500/10 hover:bg-indigo-200 dark:hover:bg-indigo-500/20 dark:text-indigo-400 dark:hover:text-indigo-300"
                                aria-label="View version history"
                            >
                                <History size={14} />
                                版本历史
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border白/10 space-y-3">
                    <div className="p-2 bg-gray-100 dark:bg-[#2C2C2C] rounded-md min-h-[36px] flex items-center justify-center">
                      {getStatusIndicator()}
                    </div>
                    <button
                      onClick={handleStartProcess}
                      disabled={!activeProject || isWriting}
                      className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg白/[.12] dark:hover:bg白/20 dark:text白 font-semibold rounded-lg transition-colors disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-[#4A4A4A] dark:disabled:text-[#777777] disabled:cursor-not-allowed"
                    >
                      <Play size={16} />
                      <span>{isWriting ? '写作中...' : (activeProject?.finalText ? '重新生成' : '开始写作')}</span>
                    </button>
                 </div>
            </div>
            <div className="flex-grow h-full">
                <WritingDesk
                    logs={logs}
                    status={status}
                    projectData={activeProject}
                />
            </div>
             {activeProject && (
                <VersionHistoryModal
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    history={activeProject.history || []}
                    onRevert={handleRevertVersion}
                    projectName={activeProject.projectName}
                />
            )}
        </div>
    );
};

export default WritingSpace;