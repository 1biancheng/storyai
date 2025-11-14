import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MousePointer2, Settings, Send, LayoutList, Grip, GitCommit, Search, Trash2, Loader2, Play, RadioTower, Code, Image, Mic2, FileText, Upload, StopCircle, Plus, X, Save, TestTube, BarChartHorizontal, Workflow as WorkflowIcon, Download, LayoutGrid } from 'lucide-react';
import * as cardEditorService from '../sample_data/services/cardEditorService.ts';
import * as workflowManager from '../services/workflowManager.ts';
import * as agentPrompts from '../services/agentPrompts.ts';
import { Scene, PromptCard, AgentWorkflow, WorkflowNode, WorkflowEdge, LLMModel, Tool, AgentRole } from '../types.ts';
import * as agentService from '../sample_data/services/agentService.ts';
import { useWorkflowStore } from '../sample_data/services/workflowStore.ts';
import { subscribeSSE } from '../sample_data/services/sseService';

// ----------------------------------------
// 1. 类型定义 - Imported from workflowStore.ts
// ----------------------------------------
import { WorkflowLog } from '../sample_data/services/workflowStore.ts';

// ----------------------------------------
// 2. 组件 (Components)
// ----------------------------------------

const WorkflowNodeComponent: React.FC<{ node: WorkflowNode }> = ({ node }) => {
  const { selectComponent, setConnectingEdge, addEdge } = useWorkflowStore();
  const connectingEdge = useWorkflowStore(state => state.connectingEdge);
  const selectedComponentId = useWorkflowStore(state => state.selectedComponentId);
  const edges = useWorkflowStore(state => state.edges);
  const nodeRuntimeStatus = useWorkflowStore(state => state.nodeRuntimeStatus);
  const isSelected = selectedComponentId === node.id;
  const runtimeStatus = nodeRuntimeStatus[node.id] || 'idle';

  const getIcon = useCallback(() => {
    switch (node.type) {
      case 'agent': 
        if(node.agentType === AgentRole.DATA_ANALYZER) return <BarChartHorizontal size={16} className="text-sky-500" />;
        return <LayoutList size={16} className="text-purple-500" />;
      case 'llm': return <GitCommit size={16} className="text-green-500" />;
      case 'tool': return <Code size={16} className="text-yellow-500" />;
      case 'data': return <FileText size={16} className="text-orange-500" />;
      default: return <LayoutList size={16} className="text-gray-500" />;
    }
  }, [node.type, node.agentType]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    // 选中节点,但允许事件继续冒泡到画布,触发统一的拖拽逻辑
    selectComponent(node.id);
  }, [selectComponent, node.id]);

  const handleConnectorMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = document.querySelector('.workflow-canvas')?.getBoundingClientRect();
    if (canvasRect) {
      const x = rect.left + rect.width / 2 - canvasRect.left;
      const y = rect.top + rect.height / 2 - canvasRect.top;
      setConnectingEdge({ source: node.id, position: { x, y } });
    }
  }, [node.id, setConnectingEdge]);
  
  const handleConnectorMouseUp = useCallback((e: React.MouseEvent) => {
    // 仅在连线模式下阻止冒泡并处理连接,避免影响 document 级 mouseup 的拖拽释放
    if (connectingEdge) {
      e.stopPropagation();
      if (connectingEdge.source !== node.id && !edges.some(edge => edge.source === connectingEdge.source && edge.target === node.id)) {
          addEdge({ id: crypto.randomUUID(), source: connectingEdge.source, target: node.id });
      }
      setConnectingEdge(null);
    }
  }, [node.id, connectingEdge, setConnectingEdge, addEdge, edges]);

  // 根据运行时状态确定样式
  const getStatusClass = () => {
    if (runtimeStatus === 'running') return 'border-blue-500 shadow-blue-500/50 shadow-lg';
    if (runtimeStatus === 'success') return 'border-green-500 shadow-green-500/30';
    if (runtimeStatus === 'error') return 'border-red-500 shadow-red-500/50 animate-pulse';
    return '';
  };

  return (
    <div
      data-node-id={node.id}
      className={`node absolute bg-white dark:bg-[#2C2C2C] rounded-lg p-3 w-40 workflow-node ${isSelected ? 'selected' : ''} ${getStatusClass()} transition-all duration-200`}
      style={{ left: node.position.x, top: node.position.y, zIndex: 10 }}
      onMouseDown={handleNodeMouseDown}
      onMouseUp={handleConnectorMouseUp} 
    >
      <div className="flex items-center justify-between">
        <div className="font-bold text-gray-800 dark:text-white truncate text-sm flex-1">{node.name}</div>
        {runtimeStatus === 'running' && <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />}
        {runtimeStatus === 'success' && <span className="text-green-500 text-xs flex-shrink-0">✓</span>}
        {runtimeStatus === 'error' && <span className="text-red-500 text-xs flex-shrink-0">✗</span>}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg:black/20 px-2 py-1 rounded-full inline-block mt-2 flex items-center gap-1.5">
          {getIcon()}
          <span>{node.type === 'agent' ? node.agentType || 'Agent' : node.type.charAt(0).toUpperCase() + node.type.slice(1)}</span>
      </div>
      <div className="connector input" title="连接输入"></div>
      <div className="connector output" onMouseDown={handleConnectorMouseDown} title="开始连接"></div>
    </div>
  );
};

const WorkflowEdgeComponent: React.FC<{ edge: WorkflowEdge; sourceNode: WorkflowNode; targetNode: WorkflowNode; }> = ({ edge, sourceNode, targetNode }) => {
    const selectComponent = useWorkflowStore(state => state.selectComponent);
    const selectedComponentId = useWorkflowStore(state => state.selectedComponentId);
    const isSelected = selectedComponentId === edge.id;

    const NODE_WIDTH = 160; // w-40
    const NODE_HEIGHT = 92; // Approximate height

    const startX = sourceNode.position.x + NODE_WIDTH;
    const startY = sourceNode.position.y + NODE_HEIGHT / 2;
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + NODE_HEIGHT / 2;

    const midX = startX + (endX - startX) * 0.5;
    const path = `M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`;

    return (
        <g onClick={(e) => { e.stopPropagation(); selectComponent(edge.id); }}>
            <path d={path} fill="none" stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={isSelected ? 4 : 2} />
            {isSelected && <path d={path} fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray="5 5" style={{ animation: 'dash 1s linear infinite' }} />}
        </g>
    );
};

const LibraryPanel: React.FC = () => {
    const availableLLMs = workflowManager.getAvailableLLMs();
    
    const handleDragStart = useCallback((e: React.DragEvent, component: any) => {
        const data = {
            type: component.type,
            agentType: component.agentType,
            toolType: component.toolType,
            dataType: component.dataType,
            name: component.name,
        };
        e.dataTransfer.setData('componentData', JSON.stringify(data));
        document.body.classList.add('dragging');
    }, []);

    const handleDragEnd = useCallback(() => {
        document.body.classList.remove('dragging');
    }, []);

    const DraggableItem: React.FC<{ type: 'agent' | 'llm' | 'tool' | 'data', payload?: any, children: React.ReactNode }> = ({ type, payload, children }) => (
        <div draggable onDragStart={(e) => handleDragStart(e, { type, ...payload })} onDragEnd={handleDragEnd} className="p-2 border rounded-md bg-gray-50 dark:bg-black/20 text-sm cursor-grab hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            {children}
        </div>
    );
    
    return (
        <aside className="w-1/5 bg-white dark:bg-[#1E1E1E] border-r border-gray-200 dark:border-white/10 flex flex-col shadow-md">
            <h2 className="panel-header text-gray-700 dark:text-gray-300">组件库</h2>
            <div className="p-4 space-y-4 overflow-y-auto">
                <div className="component-section">
                    <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">智能体 (Agents)</h3>
                    <div className="space-y-2">
                        {Object.values(AgentRole).filter(role => role !== AgentRole.SYSTEM).map(agentType => (
                            <DraggableItem key={agentType} type="agent" payload={{ agentType }}>{agentType}</DraggableItem>
                        ))}
                    </div>
                </div>
                <div className="component-section">
                    <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">工具 (Tools)</h3>
                    <div className="space-y-2">
                        <DraggableItem type="tool" payload={{ toolType: 'code_interpreter', name: '代码解释器' }}>⚙️ 代码解释器</DraggableItem>
                        <DraggableItem type="tool" payload={{ toolType: 'image_generator', name: '图像生成器' }}>🖼️ 图像生成器</DraggableItem>
                        <DraggableItem type="tool" payload={{ toolType: 'tts_generator', name: 'TTS生成器' }}>🎙️ TTS生成器</DraggableItem>
                    </div>
                </div>
                <div className="component-section">
                    <h3 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">资料源 (Data)</h3>
                    <div className="space-y-2">
                        <DraggableItem type="data" payload={{ dataType: 'raw_text', name: '手动输入' }}>📝 手动输入文本</DraggableItem>
                        <DraggableItem type="data" payload={{ dataType: 'scene_cards', name: '场景/卡片' }}>📚 场景/卡片</DraggableItem>
                        <DraggableItem type="data" payload={{ dataType: 'local_file', name: '本地文件' }}>📄 本地文件</DraggableItem>
                    </div>
                </div>
            </div>
        </aside>
    );
};

const InspectorPanel: React.FC<{ promptCards: PromptCard[], scenes: Scene[], workflowLogs: WorkflowLog[] }> = ({ promptCards, scenes, workflowLogs }) => {
    const { selectedComponentId, nodes, edges, workflowName, isDefaultWorkflow } = useWorkflowStore(state => ({
        selectedComponentId: state.selectedComponentId,
        nodes: state.nodes,
        edges: state.edges,
        workflowName: state.workflowName,
        isDefaultWorkflow: state.isDefaultWorkflow,
    }));
    const { updateNodeProps, deleteNode, deleteEdge, setWorkflowName } = useWorkflowStore();

    const [testQuery, setTestQuery] = useState('');
    const [testResult, setTestResult] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const selectedNode = useMemo(() => nodes.find(node => node.id === selectedComponentId), [nodes, selectedComponentId]);
    const nodeHistory = useMemo(() => workflowLogs.filter(log => log.componentId === selectedNode?.id), [workflowLogs, selectedNode]);

    const handleTestAgent = async () => {
        if (!selectedNode || selectedNode.type !== 'agent' || !selectedNode.promptCardId) return;
        setTestStatus('loading');
        setTestResult('');
        try {
            const promptCard = promptCards.find(c => c.id === selectedNode.promptCardId);
            if (!promptCard) throw new Error("Prompt card not found.");
            const fullPrompt = `${promptCard.prompt}

---

${testQuery}`;
            const response = await agentService.runAgent(fullPrompt);
            setTestResult(response.text);
            setTestStatus('success');
        } catch (error) {
            setTestResult(`Error: ${(error as Error).message}`);
            setTestStatus('error');
        }
    };
    
    const handleDataFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && selectedNode) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                updateNodeProps(selectedNode.id, {
                    fileContent: content,
                    fileName: file.name,
                    fileMimeType: file.type
                });
            };
            reader.readAsText(file);
        }
    };
    
     const handleMultiSelectChange = (key: 'selectedSceneIds' | 'selectedCardIds', e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!selectedNode) return;
        const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        updateNodeProps(selectedNode.id, { [key]: selectedOptions });
    };

    const renderContent = () => {
        if (selectedNode) {
            return (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold">编辑节点: {selectedNode.name}</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">节点名称</label>
                        <input type="text" value={selectedNode.name} onChange={e => updateNodeProps(selectedNode.id, { name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm" />
                    </div>
                    {selectedNode.type === 'agent' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">智能体类型</label>
                                <select value={selectedNode.agentType || ''} onChange={e => updateNodeProps(selectedNode.id, { agentType: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                    <option value="">选择智能体类型</option>
                                    {Object.values(AgentRole).filter(role => role !== AgentRole.SYSTEM).map(agentType => (
                                        <option key={agentType} value={agentType}>{agentType}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">提示词卡片</label>
                                <select value={selectedNode.promptCardId || ''} onChange={e => updateNodeProps(selectedNode.id, { promptCardId: e.target.value || null })} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                    <option value="">选择提示词卡片</option>
                                    {promptCards.map(card => (<option key={card.id} value={card.id}>{card.name}</option>))}
                                </select>
                            </div>
                        </>
                    )}

                    {selectedNode.type === 'data' && (
                        <div className="space-y-3 border-t border-gray-200 dark:border-white/10 pt-4">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">资料源配置</h3>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">资料类型</label>
                                <select value={selectedNode.dataType || 'raw_text'} onChange={e => updateNodeProps(selectedNode.id, { dataType: e.target.value as any, selectedSceneIds: [], selectedCardIds: [], fileContent: '', fileName: '' })} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                    <option value="raw_text">手动输入文本</option>
                                    <option value="scene_cards">场景/卡片</option>
                                    <option value="local_file">本地文件</option>
                                </select>
                            </div>
                            {selectedNode.dataType === 'raw_text' && (
                                <textarea value={selectedNode.fileContent || ''} onChange={e => updateNodeProps(selectedNode.id, { fileContent: e.target.value })} rows={5} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm" placeholder="在此处输入文本..."></textarea>
                            )}
                            {selectedNode.dataType === 'local_file' && (
                                <div>
                                    <input type="file" onChange={handleDataFileChange} className="mt-1 text-sm" />
                                    {selectedNode.fileName && <p className="text-xs text-gray-500 mt-1">已加载: {selectedNode.fileName}</p>}
                                </div>
                            )}
                             {selectedNode.dataType === 'scene_cards' && (
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">选择场景</label>
                                        <select multiple value={selectedNode.selectedSceneIds || []} onChange={e => handleMultiSelectChange('selectedSceneIds', e)} className="mt-1 block w-full h-24 rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                            {scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">选择卡片</label>
                                         <select multiple value={selectedNode.selectedCardIds || []} onChange={e => handleMultiSelectChange('selectedCardIds', e)} className="mt-1 block w-full h-24 rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                            {promptCards.map(card => <option key={card.id} value={card.id}>{card.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                     {selectedNode.type === 'tool' && (
                        <div className="space-y-3 border-t border-gray-200 dark:border-white/10 pt-4">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">工具配置</h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">工具类型</label>
                                <select value={selectedNode.toolType || 'code_interpreter'} onChange={e => updateNodeProps(selectedNode.id, { toolType: e.target.value as any })} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm">
                                    <option value="code_interpreter">代码解释器</option>
                                    <option value="image_generator">图像生成器</option>
                                    <option value="tts_generator">TTS生成器</option>
                                </select>
                            </div>
                            {selectedNode.toolType === 'code_interpreter' && (
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">函数体</label>
                                    <textarea value={selectedNode.functionBody || ''} onChange={e => updateNodeProps(selectedNode.id, { functionBody: e.target.value })} rows={5} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm" placeholder="在此处输入代码..."></textarea>
                                 </div>
                            )}
                            {(selectedNode.toolType === 'image_generator' || selectedNode.toolType === 'tts_generator') && (
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">提示词</label>
                                    <textarea value={selectedNode.prompt || ''} onChange={e => updateNodeProps(selectedNode.id, { prompt: e.target.value })} rows={5} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm" placeholder="输入生成提示词..."></textarea>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {selectedNode.type === 'agent' && selectedNode.promptCardId && (
                        <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">✨ 智能体测试</h3>
                            <textarea value={testQuery} onChange={e => setTestQuery(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm" placeholder="输入测试的主题或上下文..."></textarea>
                            <button onClick={handleTestAgent} disabled={testStatus === 'loading'} className="mt-2 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200 text-sm font-semibold shadow-md disabled:bg-indigo-400">
                                {testStatus === 'loading' ? '测试中...' : '✨ 测试并生成'}
                            </button>
                            {testResult && <textarea value={testResult} readOnly rows={6} className={`mt-2 block w-full rounded-md border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 sm:text-sm ${testStatus === 'error' ? 'text-red-700' : ''}`} />}
                        </div>
                    )}

                    {nodeHistory.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                            <h3 className="font-semibold text-gray-700 dark:text-gray-300">运行历史</h3>
                            <div className="mt-2 border rounded-md bg-white dark:bg-black/20 overflow-hidden max-h-48 overflow-y-auto">
                                {nodeHistory.map(log => (
                                    <div key={log.id} className="p-2 border-b border-gray-200 dark:border-white/10 last:border-b-0 text-xs">
                                        <p><strong>{log.status.toUpperCase()}</strong> @ {new Date(log.timestamp).toLocaleTimeString()}</p>
                                        <p className="truncate text-gray-500 dark:text-gray-400">{log.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button onClick={() => deleteNode(selectedNode.id)} className="w-full text-sm text-red-600 hover:text-red-800 pt-4">删除节点</button>
                </div>
            );
        }
        
        if (edges.find(e => e.id === selectedComponentId)) {
             return <button onClick={() => deleteEdge(selectedComponentId!)} className="w-full text-sm text-red-600 hover:text-red-800">删除连接</button>;
        }
        
        return (
             <div className="space-y-4">
                 <h3 className="text-lg font-bold">工作流属性</h3>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400">工作流名称</label>
                    <input type="text" value={workflowName} onChange={e => setWorkflowName(e.target.value)} disabled={isDefaultWorkflow} className="mt-1 block w-full rounded-md border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] shadow-sm sm:text-sm disabled:bg-gray-100 dark:disabled:bg-black/20" />
                 </div>
                 <div className="text-gray-500 dark:text-gray-400 text-center pt-10"><p>在画布中选择一个节点以查看其属性.</p></div>
             </div>
        );
    };

    return (
        <aside className="w-1/5 bg-white dark:bg-[#1E1E1E] border-l border-gray-200 dark:border-white/10 flex flex-col shadow-md">
            <h2 className="panel-header text-gray-700 dark:text-gray-300">属性检查器</h2>
            <div className="p-4 flex-grow overflow-y-auto">{renderContent()}</div>
        </aside>
    );
};

// ----------------------------------------
// 5. 主工作流编辑器组件
// ----------------------------------------
const AgentWorkflowEditor: React.FC = () => {
    const { workflowId, isDefaultWorkflow, setWorkflow, nodes, edges, setNodes, connectingEdge, setConnectingEdge, selectComponent, updateNodePosition, addNodeAndSelect } = useWorkflowStore();
    const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [savedWorkflows, setSavedWorkflows] = useState<AgentWorkflow[]>([]);
    const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
    const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
    // 布局设置与提示
    const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
    const [enableGridSnap, setEnableGridSnap] = useState<boolean>(false);
    const [layoutInfo, setLayoutInfo] = useState<string | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const dragStartOffset = useRef({ x: 0, y: 0 });
    const draggedNodeId = useRef<string | null>(null);
    const draggingElRef = useRef<HTMLElement | null>(null);
    const lastPointerRef = useRef<{ x: number, y: number } | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const startNodePosRef = useRef<{ x: number, y: number } | null>(null);

     const handleLoadWorkflow = useCallback((workflow?: AgentWorkflow) => {
        if (!workflow) return;
        setWorkflow({
            nodes: workflow.nodes, edges: workflow.edges, tools: workflow.tools || [], llms: workflowManager.getAvailableLLMs(),
            selectedComponentId: null, workflowId: workflow.id, workflowName: workflow.name, isDefaultWorkflow: !!workflow.isDefault,
            nodeRuntimeStatus: {},
        });
        setWorkflowLogs([]);
    }, [setWorkflow]);
    
    useEffect(() => {
        const allWorkflows = workflowManager.getWorkflows();
        setSavedWorkflows(allWorkflows);
        // Load default on first mount if no other workflow is active
        if(!useWorkflowStore.getState().workflowId || useWorkflowStore.getState().nodes.length === 0) {
            const defaultWorkflow = allWorkflows.find(wf => wf.isDefault) || allWorkflows[0];
            if (defaultWorkflow) handleLoadWorkflow(defaultWorkflow);
        }
        setPromptCards(cardEditorService.getPromptCards());
        setScenes(cardEditorService.getScenes());
        
        const handleStorageChange = () => {
            setSavedWorkflows(workflowManager.getWorkflows());
            setPromptCards(cardEditorService.getPromptCards());
            setScenes(cardEditorService.getScenes());
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [handleLoadWorkflow]);

    const handleSaveWorkflow = useCallback(() => {
        const { nodes, edges, tools, llms, workflowId, workflowName, isDefaultWorkflow } = useWorkflowStore.getState();

        let workflowToSave: AgentWorkflow = {
            id: workflowId, name: workflowName, isDefault: isDefaultWorkflow,
            nodes, edges, tools, llms,
        };

        let isNewSave = isDefaultWorkflow;
        if (isDefaultWorkflow) {
            const newName = prompt("您正在保存一个默认工作流的副本.请输入新名称:", `${workflowName} (副本)`);
            if (!newName || !newName.trim()) return; // User cancelled
            workflowToSave = { ...workflowToSave, id: crypto.randomUUID(), name: newName, isDefault: false };
        }

        const otherUserWorkflows = savedWorkflows.filter(wf => wf.id !== workflowToSave.id && !wf.isDefault);
        const newWorkflowsToSave = [...otherUserWorkflows, workflowToSave];
        
        workflowManager.saveWorkflows(newWorkflowsToSave);
        const allWorkflows = workflowManager.getWorkflows();
        setSavedWorkflows(allWorkflows);

        if (isNewSave) {
            const newlySavedWorkflow = allWorkflows.find(wf => wf.id === workflowToSave.id);
            if (newlySavedWorkflow) handleLoadWorkflow(newlySavedWorkflow);
        }
        alert(`工作流 "${workflowToSave.name}" 已保存!`);
    }, [savedWorkflows, handleLoadWorkflow]);
    
    const handleNewWorkflow = useCallback(() => {
         if (window.confirm("这将清除当前画布.您确定要创建一个新的工作流吗?")) {
            const newWorkflow = {
                id: crypto.randomUUID(), name: "未命名工作流", isDefault: false,
                nodes: [], edges: [], tools: [], llms: workflowManager.getAvailableLLMs(),
            };
            handleLoadWorkflow(newWorkflow);
        }
    }, [handleLoadWorkflow]);
    
    const handleDeleteWorkflow = useCallback(() => {
        if (isDefaultWorkflow) return;
        const currentName = useWorkflowStore.getState().workflowName;
        if (window.confirm(`您确定要删除工作流 "${currentName}" 吗?此操作无法撤消.`)) {
            const updatedWorkflows = savedWorkflows.filter(wf => wf.id !== workflowId);
            workflowManager.saveWorkflows(updatedWorkflows);
            setSavedWorkflows(workflowManager.getWorkflows());
            // Load default workflow after deletion
            handleLoadWorkflow(workflowManager.getWorkflows().find(wf => wf.isDefault)!);
        }
    }, [workflowId, isDefaultWorkflow, savedWorkflows, handleLoadWorkflow]);

    const handleExportWorkflow = useCallback(() => {
        const { nodes, edges, tools, llms, workflowId, workflowName, isDefaultWorkflow } = useWorkflowStore.getState();
        const workflowToExport: AgentWorkflow = {
            id: workflowId, name: workflowName, isDefault: isDefaultWorkflow,
            nodes, edges, tools: tools || [], llms: llms || [],
        };
        const jsonString = JSON.stringify(workflowToExport, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = `${workflowName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const handleImportWorkflow = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const importedWorkflow = JSON.parse(text) as AgentWorkflow;
                if (importedWorkflow && Array.isArray(importedWorkflow.nodes) && Array.isArray(importedWorkflow.edges)) {
                    if (window.confirm(`您确定要导入工作流 "${importedWorkflow.name}" 吗?这将覆盖当前画布上的内容.`)) {
                        const newWorkflow: AgentWorkflow = {
                            ...importedWorkflow, id: crypto.randomUUID(), isDefault: false,
                        };
                        handleLoadWorkflow(newWorkflow);
                        const otherUserWorkflows = savedWorkflows.filter(wf => !wf.isDefault);
                        workflowManager.saveWorkflows([...otherUserWorkflows, newWorkflow]);
                    }
                } else {
                    throw new Error("无效的工作流文件格式.");
                }
            } catch (error) {
                alert(`导入工作流失败: ${(error as Error).message}`);
            } finally {
                if (event.target) event.target.value = "";
            }
        };
        reader.readAsText(file);
    }, [handleLoadWorkflow, savedWorkflows]);

    const handleRunWorkflowNew = useCallback(async () => {
        const { nodes, edges, tools, llms, workflowId, workflowName, resetAllNodeStatus } = useWorkflowStore.getState();
        const currentWorkflow: AgentWorkflow = {
            id: workflowId,
            name: workflowName,
            isDefault: false,
            nodes,
            edges,
            tools,
            llms
        };

        if (!currentWorkflow || nodes.length === 0) return;

        console.log('Starting workflow:', currentWorkflow.name);
        resetAllNodeStatus(); // 重置所有节点状态
        setIsWorkflowRunning(true);

        try {
            const executionId = await workflowManager.startWorkflow(currentWorkflow);
            console.log('Workflow started with execution ID:', executionId);

            const url = `${(import.meta as any).env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/api/v1/workflows/stream/${executionId}`;

            const cleanup = subscribeSSE(url, {
                onMessage: (data) => {
                    console.log('SSE Message:', data);
                    const { setNodeStatus } = useWorkflowStore.getState();
                    
                    // 处理工作流事件
                    if (data.type === 'workflow_started' || data.__event__ === 'workflow_started') {
                        console.log('Workflow started');
                    }
                    
                    // 处理节点事件
                    if (data.type === 'node_started' || data.__event__ === 'node_started') {
                        const nodeId = data.node_id || data.nodeId;
                        if (nodeId) setNodeStatus(nodeId, 'running');
                    }
                    
                    if (data.type === 'node_completed' || data.__event__ === 'node_completed') {
                        const nodeId = data.node_id || data.nodeId;
                        if (nodeId) setNodeStatus(nodeId, 'success');
                    }
                    
                    if (data.type === 'node_failed' || data.__event__ === 'node_failed') {
                        const nodeId = data.node_id || data.nodeId;
                        if (nodeId) setNodeStatus(nodeId, 'error');
                    }
                    
                    // 工作流完成/失败
                    if (data.type === 'workflow_completed' || data.__event__ === 'workflow_completed') {
                        console.log('Workflow completed successfully');
                        setIsWorkflowRunning(false);
                        cleanup();
                    }
                    
                    if (data.type === 'workflow_failed' || data.__event__ === 'workflow_failed') {
                        console.error('Workflow failed:', data.error);
                        setIsWorkflowRunning(false);
                        cleanup();
                    }
                },
                onError: (error) => {
                    // 根据W3C规范,onerror事件在连接关闭时也会触发,这是正常行为
                    // 我们需要区分真正的错误和正常的连接关闭
                    const eventSource = error.target as EventSource;
                    
                    if (eventSource && eventSource.readyState === EventSource.CLOSED) {
                        // 连接已关闭,这可能是服务器主动关闭或正常结束
                        console.log('SSE connection closed');
                        setIsWorkflowRunning(false);
                        cleanup();
                        return;
                    }
                    
                    if (eventSource && eventSource.readyState === EventSource.CONNECTING) {
                        // 连接失败或正在重连
                        console.log('SSE reconnecting...');
                        // 不调用错误处理器,因为这是自动重连机制
                        return;
                    }
                    
                    if (eventSource && eventSource.readyState === EventSource.OPEN) {
                        // 连接打开时发生错误,这是真正的错误
                        console.error('SSE Error during active connection:', error);
                    }
                    
                    setIsWorkflowRunning(false);
                    cleanup();
                },
            });

        } catch (error) {
            console.error('Failed to start workflow:', error);
            setIsWorkflowRunning(false);
        }
    }, []);

    // 删除旧的handleRunWorkflow函数,使用新的SSE实现

    const handleAutoLayout = useCallback(() => {
        if (!canvasRef.current || nodes.length === 0) return;

        // 常量设置
        const PADDING = 50;
        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 92;

        // 1) 构建图结构(邻接表 + 入度表)
        const adj = new Map<string, string[]>(nodes.map(n => [n.id, []]));
        const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
        for (const edge of edges) {
            if (adj.has(edge.source)) adj.get(edge.source)!.push(edge.target);
            if (inDegree.has(edge.target)) inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }

        // 2) Kahn 拓扑分层
        const queue: string[] = [];
        for (const [id, deg] of inDegree.entries()) if (deg === 0) queue.push(id);
        const layers: string[][] = [];
        while (queue.length) {
            const size = queue.length;
            const layer: string[] = [];
            for (let i = 0; i < size; i++) {
                const u = queue.shift()!;
                layer.push(u);
                for (const v of (adj.get(u) || [])) {
                    inDegree.set(v, (inDegree.get(v) || 0) - 1);
                    if (inDegree.get(v) === 0) queue.push(v);
                }
            }
            layers.push(layer);
        }

        const placedIds = new Set(layers.flat());
        const cycleNodes = nodes.filter(n => !placedIds.has(n.id));
        const effectiveLayers = cycleNodes.length > 0 ? [...layers, cycleNodes.map(n => n.id)] : layers;
        if (cycleNodes.length > 0) {
            setLayoutInfo(`检测到 ${cycleNodes.length} 个循环相关节点,已分组至最末列.`);
            setTimeout(() => setLayoutInfo(null), 3000);
        }

        // 3) 计算位置,支持换行/换列,保证不溢出
        const newNodes = JSON.parse(JSON.stringify(nodes)) as WorkflowNode[];
        const canvasWidth = canvasRef.current.clientWidth;
        const canvasHeight = canvasRef.current.clientHeight;

        const snap = (v: number, grid = 20) => (enableGridSnap ? Math.round(v / grid) * grid : v);

        if (layoutOrientation === 'horizontal') {
            // 列(层)在水平方向排布;当列过多时自动换行
            const totalCols = Math.max(effectiveLayers.length, 1);
            const availableW = Math.max(canvasWidth - 2 * PADDING, NODE_WIDTH);
            // 每行最多可容纳的列数(按最小宽度估算)
            const maxColsPerRow = Math.max(1, Math.floor(availableW / NODE_WIDTH));
            const colsPerRow = Math.max(1, Math.min(maxColsPerRow, totalCols));
            const rows = Math.ceil(totalCols / colsPerRow);

            // 行带高度与间距,均分可用高度,避免上下溢出
            const rowGap = 40;
            const availableH = Math.max(canvasHeight - 2 * PADDING - (rows - 1) * rowGap, NODE_HEIGHT);
            const rowBandH = Math.floor(availableH / rows);

            for (let layerIndex = 0; layerIndex < totalCols; layerIndex++) {
                const rowIdx = Math.floor(layerIndex / colsPerRow);
                const colIdxInRow = layerIndex % colsPerRow;
                const colsInThisRow = Math.min(colsPerRow, totalCols - rowIdx * colsPerRow);
                // 该行内列间距,确保刚好铺满而不溢出
                const xSpace = colsInThisRow > 1
                    ? (canvasWidth - 2 * PADDING - colsInThisRow * NODE_WIDTH) / (colsInThisRow - 1)
                    : 0;
                const xBase = PADDING + colIdxInRow * (NODE_WIDTH + xSpace);

                const layer = effectiveLayers[layerIndex];
                const count = Math.max(layer.length, 1);
                const ySpace = count > 1 ? (rowBandH - NODE_HEIGHT) / (count - 1) : 0;
                const layerHeight = NODE_HEIGHT + (count - 1) * ySpace;
                const rowTop = PADDING + rowIdx * (rowBandH + rowGap);
                const startY = rowTop + Math.max(0, (rowBandH - layerHeight) / 2);

                for (let i = 0; i < layer.length; i++) {
                    const id = layer[i];
                    const node = newNodes.find(n => n.id === id);
                    if (node) {
                        node.position = {
                            x: snap(xBase),
                            y: snap(startY + i * ySpace),
                        };
                    }
                }
            }
        } else {
            // 行(层)在垂直方向排布;当行过多时自动分多列
            const totalRows = Math.max(effectiveLayers.length, 1);
            const availableH = Math.max(canvasHeight - 2 * PADDING, NODE_HEIGHT);
            const maxRowsPerCol = Math.max(1, Math.floor(availableH / NODE_HEIGHT));
            const rowsPerCol = Math.max(1, Math.min(maxRowsPerCol, totalRows));
            const cols = Math.ceil(totalRows / rowsPerCol);

            const colGap = 40;
            const availableW = Math.max(canvasWidth - 2 * PADDING - (cols - 1) * colGap, NODE_WIDTH);
            const colBandW = Math.floor(availableW / cols);
            const ySpaceRow = rowsPerCol > 1
                ? (canvasHeight - 2 * PADDING - rowsPerCol * NODE_HEIGHT) / (rowsPerCol - 1)
                : 0;

            for (let layerIndex = 0; layerIndex < totalRows; layerIndex++) {
                const colIdx = Math.floor(layerIndex / rowsPerCol);
                const rowIdxInCol = layerIndex % rowsPerCol;
                const layer = effectiveLayers[layerIndex];
                const count = Math.max(layer.length, 1);

                const rowY = PADDING + rowIdxInCol * (NODE_HEIGHT + ySpaceRow);
                // 行内节点水平间距,确保刚好铺满列带宽度而不溢出
                const xSpace = count > 1 ? (colBandW - NODE_WIDTH) / (count - 1) : 0;
                const rowWidth = NODE_WIDTH + (count - 1) * xSpace;
                const colLeft = PADDING + colIdx * (colBandW + colGap);
                const startX = colLeft + Math.max(0, (colBandW - rowWidth) / 2);

                for (let i = 0; i < layer.length; i++) {
                    const id = layer[i];
                    const node = newNodes.find(n => n.id === id);
                    if (node) {
                        node.position = {
                            x: snap(startX + i * xSpace),
                            y: snap(rowY),
                        };
                    }
                }
            }
        }

        // 4) 更新状态
        setNodes(newNodes);
    }, [nodes, edges, setNodes, layoutOrientation, enableGridSnap]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!canvasRef.current) return;

        const raw = e.dataTransfer.getData('componentData');
        if (!raw) return;

        const comp = JSON.parse(raw);
        const rect = canvasRef.current.getBoundingClientRect();

        const NODE_WIDTH = 160;
        const NODE_HEIGHT = 92;

        let x = e.clientX - rect.left - NODE_WIDTH / 2;
        let y = e.clientY - rect.top - NODE_HEIGHT / 2;

        x = Math.max(0, x);
        y = Math.max(0, y);

        const newNodeId = crypto.randomUUID();
        const name = comp.name || `${comp.type} 节点`;

        let newNode: WorkflowNode;

        switch (comp.type) {
            case 'agent':
                newNode = { id: newNodeId, name, type: 'agent', agentType: comp.agentType, position: { x, y } };
                break;
            case 'tool':
                newNode = { id: newNodeId, name, type: 'tool', toolType: comp.toolType, position: { x, y } };
                break;
            case 'data':
                newNode = { id: newNodeId, name, type: 'data', dataType: comp.dataType, position: { x, y } };
                break;
            default:
                return;
        }

        addNodeAndSelect(newNode);
    }, [addNodeAndSelect]);

    const handleWindowMouseMove = useCallback((e: MouseEvent) => {
        if (connectingEdge && canvasRef.current) {
            const rect = canvasRef.current.getBoundingClientRect();
            const position = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            
            // 使用 RAF 优化连线跟随性能
            if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    setConnectingEdge({ ...connectingEdge, position });
                    rafIdRef.current = null;
                });
            }
        }
    }, [connectingEdge, setConnectingEdge]);

    const handleWindowMouseUp = useCallback(() => {
        // 提交最终位置到store
        if (draggedNodeId.current) {
            const finalPos = lastPointerRef.current || startNodePosRef.current || { x: 0, y: 0 };
            updateNodePosition(draggedNodeId.current, finalPos);
        }

        // 清理拖拽状态与样式
        if (rafIdRef.current != null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        if (draggingElRef.current) {
            draggingElRef.current.classList.remove('dragging');
            draggingElRef.current.style.willChange = '';
        }
        draggingElRef.current = null;
        lastPointerRef.current = null;
        startNodePosRef.current = null;
        draggedNodeId.current = null;

        if (connectingEdge) {
            setConnectingEdge(null);
        }
        document.removeEventListener('mousemove', handleWindowMouseMove);
        document.removeEventListener('mouseup', handleWindowMouseUp);
    }, [connectingEdge, setConnectingEdge, handleWindowMouseMove, updateNodePosition]);

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const nodeEl = target.closest('.workflow-node') as HTMLElement | null;
        const container = canvasRef.current;

        if (nodeEl && !target.classList.contains('connector') && container) {
            const nodeId = nodeEl.getAttribute('data-node-id');
            if (!nodeId) return;

            // 选中节点
            selectComponent(nodeId);
            draggedNodeId.current = nodeId;
            draggingElRef.current = nodeEl;

            const startNode = useWorkflowStore.getState().nodes.find(n => n.id === nodeId);
            startNodePosRef.current = startNode ? { x: startNode.position.x, y: startNode.position.y } : { x: 0, y: 0 };

            const nodeRect = nodeEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            dragStartOffset.current = {
                x: e.clientX - nodeRect.left,
                y: e.clientY - nodeRect.top,
            };

            // 提升拖拽流畅度
            nodeEl.classList.add('dragging');
            nodeEl.style.willChange = 'left, top';

            let rafId: number | null = null;
            let pendingPos: { x: number, y: number } | null = null;

            const onMouseMove = (moveEvent: MouseEvent) => {
                const newX = moveEvent.clientX - containerRect.left - dragStartOffset.current.x + container.scrollLeft;
                const newY = moveEvent.clientY - containerRect.top - dragStartOffset.current.y + container.scrollTop;
                pendingPos = { x: newX, y: newY };
                lastPointerRef.current = pendingPos;

                if (rafId == null) {
                    rafId = requestAnimationFrame(() => {
                        if (pendingPos && draggedNodeId.current) {
                            updateNodePosition(draggedNodeId.current, pendingPos);
                        }
                        rafId = null;
                    });
                }

                // 如果处于连线模式,更新连线末端坐标
                const ce = useWorkflowStore.getState().connectingEdge;
                if (ce) {
                    const pos = { x: moveEvent.clientX - containerRect.left, y: moveEvent.clientY - containerRect.top };
                    setConnectingEdge({ ...ce, position: pos });
                }
            };

            const onMouseUp = () => {
                // 提交最终位置并清理
                if (draggedNodeId.current) {
                    const finalPos = lastPointerRef.current || startNodePosRef.current || { x: 0, y: 0 };
                    updateNodePosition(draggedNodeId.current, finalPos);
                }
                if (rafId) cancelAnimationFrame(rafId);
                rafId = null;
                pendingPos = null;

                if (draggingElRef.current) {
                    draggingElRef.current.classList.remove('dragging');
                    draggingElRef.current.style.willChange = '';
                }
                draggingElRef.current = null;
                lastPointerRef.current = null;
                startNodePosRef.current = null;
                draggedNodeId.current = null;

                const ce = useWorkflowStore.getState().connectingEdge;
                if (ce) setConnectingEdge(null);

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        } else {
            draggedNodeId.current = null;
            draggingElRef.current = null;
            startNodePosRef.current = null;
            selectComponent(null);
        }
    }, [selectComponent, updateNodePosition, setConnectingEdge]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [handleWindowMouseMove, handleWindowMouseUp]);

    return (
        <>
            <style>{`
                .node {
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    border: 1px solid #e5e7eb;
                    transition: all 0.2s ease-in-out;
                    cursor: move;
                }
                .node.dragging { transition: none; cursor: grabbing; }
                .workflow-node { will-change: left, top; touch-action: none; user-select: none; }
                .workflow-node.dragging .connector { pointer-events: none; }
                .workflow-node.connecting { pointer-events: none; }
                body.dragging .workflow-node:not(.dragging) { pointer-events: auto; }
                .dark .node { border-color: rgba(255,255,255,0.1); }
                .node.selected {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4);
                }
                .connector {
                    width: 16px; height: 16px; background-color: #cbd5e1;
                    border-radius: 50%; position: absolute; border: 2px solid white; cursor: pointer;
                }
                .dark .connector { background-color: #4b5563; border-color: #2C2C2C; }
                .connector:hover { background-color: #3b82f6; }
                .connector.output { right: -8px; top: 50%; transform: translateY(-50%); }
                .connector.input { left: -8px; top: 50%; transform: translateY(-50%); }
                .panel-header {
                    font-size: 1.1rem; font-weight: 600; padding: 0.75rem;
                    border-bottom: 1px solid #e5e7eb; background-color: #ffffff;
                }
                .dark .panel-header { background-color: #1E1E1E; border-color: rgba(255,255,255,0.1); }
            `}</style>
            <div className="p-0 bg-gray-50 dark:bg-[#121212] h-full overflow-hidden text-gray-900 dark:text-gray-200 rounded-xl flex flex-col">
                <header className="w-full bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-white/10 p-3 flex items-center justify-between shadow-sm flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                           <WorkflowIcon size={24} />
                           <h1 className="text-lg font-bold">工作流编辑器</h1>
                        </div>
                        <div className="flex items-center gap-2">
                           <select 
                             value={workflowId} 
                             onChange={e => handleLoadWorkflow(savedWorkflows.find(w => w.id === e.target.value))}
                             className="py-1 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-md text-sm"
                           >
                            {savedWorkflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}{wf.isDefault ? ' (默认)' : ''}</option>)}
                           </select>
                           <button onClick={handleDeleteWorkflow} disabled={isDefaultWorkflow} title="删除当前工作流" className="p-1.5 text-gray-500 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={16}/></button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <select
                            value={layoutOrientation}
                            onChange={e => setLayoutOrientation(e.target.value as ('horizontal' | 'vertical'))}
                            className="py-1 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] rounded-md text-sm"
                            title="布局方向"
                        >
                            <option value="horizontal">从左到右</option>
                            <option value="vertical">从上到下</option>
                        </select>
                        <label className="flex items-center gap-1 px-2 py-1 rounded-md text-sm border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C]">
                            <input type="checkbox" checked={enableGridSnap} onChange={e => setEnableGridSnap(e.target.checked)} />
                            网格吸附
                        </label>
                        <button onClick={handleAutoLayout} className="px-3 py-1.5 bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition duration-200 text-sm font-semibold flex items-center gap-1.5"><LayoutGrid size={16}/> 自动排布</button>
                        {layoutInfo && (<span className="text-xs text-gray-600 dark:text-gray-400">{layoutInfo}</span>)}
                        <button onClick={handleNewWorkflow} className="px-3 py-1.5 bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition duration-200 text-sm font-semibold flex items-center gap-1.5"><Plus size={16}/> 新建</button>
                        <button onClick={() => importFileRef.current?.click()} className="px-3 py-1.5 bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition duration-200 text-sm font-semibold flex items-center gap-1.5"><Upload size={16}/> 导入</button>
                        <input type="file" ref={importFileRef} onChange={handleImportWorkflow} className="hidden" accept=".json" />
                        <button onClick={handleExportWorkflow} className="px-3 py-1.5 bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition duration-200 text-sm font-semibold flex items-center gap-1.5"><Download size={16}/> 导出</button>
                        <button onClick={handleSaveWorkflow} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 text-sm font-semibold flex items-center gap-1.5"><Save size={16}/> 保存</button>
                        <button id="run-button" onClick={handleRunWorkflowNew} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 text-sm font-semibold shadow-sm flex items-center gap-1.5">{isWorkflowRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} 运行</button>
                    </div>
                </header>

                <div className="flex-grow flex overflow-hidden">
                    <LibraryPanel />
                    <main
                        ref={canvasRef}
                        className="w-3/5 flex-grow relative bg-slate-100 dark:bg-black workflow-canvas"
                        onDragEnter={(e) => { e.preventDefault(); }}
                        onDragOver={(e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch {} }}
                        onDrop={handleDrop}
                        onMouseDown={handleCanvasMouseDown}
                    >
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 0)', backgroundSize: '20px 20px', color: 'rgba(128, 128, 128, 0.2)', pointerEvents: 'none' }}></div>
                        <div className="relative w-full h-full">
                            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                                <style>{`@keyframes dash { to { stroke-dashoffset: -10; } }`}</style>
                                {edges.map(edge => {
                                    const sourceNode = nodes.find(node => node.id === edge.source);
                                    const targetNode = nodes.find(node => node.id === edge.target);
                                    if (sourceNode && targetNode) return <WorkflowEdgeComponent key={edge.id} edge={edge} sourceNode={sourceNode} targetNode={targetNode} />;
                                    return null;
                                })}
                                {connectingEdge && (() => {
                                    const sourceNode = nodes.find(node => node.id === connectingEdge.source);
                                    if (!sourceNode) return null;
                                    const startX = sourceNode.position.x + 160; const startY = sourceNode.position.y + 46;
                                    const endX = connectingEdge.position.x; const endY = connectingEdge.position.y;
                                    const midX = startX + (endX - startX) * 0.5;
                                    const path = `M ${startX},${startY} C ${midX},${startY} ${midX},${endY} ${endX},${endY}`;
                                    return <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5,5" />;
                                })()}
                            </svg>
                            {nodes.map(node => <WorkflowNodeComponent key={node.id} node={node} />)}
                        </div>
                        {nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center text-gray-400"><p>从左侧拖动组件到此处开始.</p></div>}
                    </main>
                    <InspectorPanel promptCards={promptCards} scenes={scenes} workflowLogs={workflowLogs}/>
                </div>
            </div>
        </>
    );
};

export default AgentWorkflowEditor;