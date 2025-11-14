import React, { useState, useReducer, createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { MousePointer2, Settings, Send, LayoutList, Grip, GitCommit, Search, Trash2, Loader2, Play, RadioTower, Code, Image, Mic2 } from 'lucide-react';

// ----------------------------------------
// 1. 类型定义 (TypeScript Interfaces)
// ----------------------------------------

// 基础组件ID (用于库)
type ComponentId = string;

// 节点ID (用于画布)
type NodeId = number;

// LLM模型选择
type LLMModel = 'gpt-4o' | 'claude-3-opus' | 'ernie-4' | 'qwen-max' | 'dall-e-3' | 'tts-1';

// 智能体定义
interface Agent {
  id: ComponentId;
  name: string;
  prompt: string;
  llm: LLMModel;
  usesGrounding: boolean;
}

// 工具定义
interface Tool {
  id: ComponentId;
  name: string;
  type: 'code' | 'image_gen' | 'tts';
  functionBody?: string;
  llm?: LLMModel; // For image_gen/tts
}

// 工作流节点定义 (画布上的实例)
interface WorkflowNode {
  id: NodeId;
  name: string;
  x: number;
  y: number;
  type: 'agent' | 'tool' | 'data';
  componentId: ComponentId; // 关联的 Agent/Tool ID
  dataCard?: string; // 关联的数据卡片名称
  history: {
    timestamp: string;
    output: string;
    full: string;
  }[];
  status: 'pending' | 'running' | 'complete' | 'error';
}

// 节点连接
interface Connection {
  from: NodeId;
  to: NodeId;
}

// 全局状态 (Pinia-like Store)
interface WorkflowState {
  agents: Record<ComponentId, Agent>;
  tools: Record<ComponentId, Tool>;
  dataCards: { id: ComponentId, name: string }[];
  nodes: Record<NodeId, WorkflowNode>;
  connections: Connection[];
  selectedNodeId: NodeId | null;
  selectedComponentId: ComponentId | null; // 库中选中的ID
  isDrawingConnection: boolean;
  connectionStartNodeId: NodeId | null;
  workflowStatus: 'idle' | 'running' | 'complete' | 'error';
  workflowProgress: number;
  log: string;
}

// Context Actions
type WorkflowAction =
  | { type: 'SET_SELECTED_NODE', payload: NodeId | null }
  | { type: 'SET_SELECTED_COMPONENT', payload: ComponentId | null }
  | { type: 'START_DRAG_NODE', payload: NodeId }
  | { type: 'MOVE_NODE', payload: { id: NodeId, x: number, y: number } }
  | { type: 'ADD_NODE', payload: WorkflowNode }
  | { type: 'DELETE_NODE', payload: NodeId }
  | { type: 'UPDATE_NODE', payload: { id: NodeId, name?: string, dataCard?: string, status?: WorkflowNode['status'] } }
  | { type: 'ADD_CONNECTION', payload: Connection }
  | { type: 'START_CONNECTION', payload: NodeId }
  | { type: 'END_CONNECTION' }
  | { type: 'UPDATE_AGENT', payload: { id: ComponentId, updates: Partial<Agent> } }
  | { type: 'UPDATE_TOOL', payload: { id: ComponentId, updates: Partial<Tool> } }
  | { type: 'ADD_AGENT', payload: Agent }
  | { type: 'ADD_TOOL', payload: Tool }
  | { type: 'DELETE_AGENT', payload: ComponentId }
  | { type: 'DELETE_TOOL', payload: ComponentId }
  | { type: 'SET_STATUS', payload: { status: WorkflowState['workflowStatus'], progress?: number, log?: string } }
  | { type: 'ADD_NODE_HISTORY', payload: { nodeId: NodeId, output: string, full: string } };


// ----------------------------------------
// 2. 初始状态 (Initial State)
// ----------------------------------------

const INITIAL_STATE: WorkflowState = {
  agents: {
    'agent-1': { id: 'agent-1', name: '大纲写手', prompt: '你是一个专业的小说家,请根据以下主题,创作一个跌宕起伏的故事大纲.', llm: 'gpt-4o', usesGrounding: false },
    'agent-2': { id: 'agent-2', name: '章节生成器', prompt: '你是一个小说章节作家,请根据故事大纲和指定章节的概要,撰写详细的章节内容.', llm: 'gpt-4o', usesGrounding: false },
    'agent-3': { id: 'agent-3', name: '🌐 联网研究员', prompt: '请根据你的实时搜索结果,撰写一份关于...的详细报告.', llm: 'gpt-4o', usesGrounding: true }
  },
  tools: {
    'tool-1': { id: 'tool-1', name: '🌐 联网搜索', type: 'code', functionBody: 'function search(query) {\n  return API.bingSearch(query);\n}' },
    'tool-2': { id: 'tool-2', name: '🖼️ 图像生成', type: 'image_gen', llm: 'dall-e-3' },
    'tool-3': { id: 'tool-3', name: '🔊 TTS 语音', type: 'tts', llm: 'tts-1' }
  },
  dataCards: [
    { id: 'data-1', name: '世界观设定卡片' },
    { id: 'data-2', name: '角色小传卡片' },
  ],
  nodes: {
    1: { id: 1, name: '主线大纲生成节点', x: 50, y: 150, type: 'agent', componentId: 'agent-1', history: [], status: 'pending' },
    2: { id: 2, name: '第一章文案', x: 350, y: 50, type: 'agent', componentId: 'agent-2', history: [], status: 'pending' },
    3: { id: 3, name: '配图工具', x: 650, y: 250, type: 'tool', componentId: 'tool-2', history: [], status: 'pending' },
  },
  connections: [
    { from: 1, to: 2 }
  ],
  selectedNodeId: null,
  selectedComponentId: null,
  isDrawingConnection: false,
  connectionStartNodeId: null,
  workflowStatus: 'idle',
  workflowProgress: 0,
  log: '工作流已就绪.点击运行按钮或选择节点进行编辑.',
};

// ----------------------------------------
// 3. Reducer (状态管理逻辑)
// ----------------------------------------

const workflowReducer = (state: WorkflowState, action: WorkflowAction): WorkflowState => {
  switch (action.type) {
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNodeId: action.payload, selectedComponentId: null };
    case 'SET_SELECTED_COMPONENT':
        return { ...state, selectedComponentId: action.payload, selectedNodeId: null };
    case 'ADD_NODE':
      return { ...state, nodes: { ...state.nodes, [action.payload.id]: action.payload } };
    case 'DELETE_NODE':
      const newNodes = { ...state.nodes };
      delete newNodes[action.payload];
      return { 
        ...state, 
        nodes: newNodes,
        connections: state.connections.filter(c => c.from !== action.payload && c.to !== action.payload),
        selectedNodeId: state.selectedNodeId === action.payload ? null : state.selectedNodeId
      };
    case 'MOVE_NODE':
      return {
        ...state,
        nodes: {
          ...state.nodes,
          [action.payload.id]: {
            ...state.nodes[action.payload.id],
            x: action.payload.x,
            y: action.payload.y,
          },
        },
      };
    case 'UPDATE_NODE':
        return {
            ...state,
            nodes: {
                ...state.nodes,
                [action.payload.id]: {
                    ...state.nodes[action.payload.id],
                    ...action.payload,
                },
            },
        };
    case 'ADD_CONNECTION':
      // 避免重复连接
      if (state.connections.some(c => c.from === action.payload.from && c.to === action.payload.to)) {
          return state;
      }
      return { ...state, connections: [...state.connections, action.payload] };
    case 'START_CONNECTION':
        return { ...state, isDrawingConnection: true, connectionStartNodeId: action.payload };
    case 'END_CONNECTION':
        return { ...state, isDrawingConnection: false, connectionStartNodeId: null };
    case 'UPDATE_AGENT':
        return {
            ...state,
            agents: {
                ...state.agents,
                [action.payload.id]: {
                    ...state.agents[action.payload.id],
                    ...action.payload.updates,
                },
            },
        };
    case 'UPDATE_TOOL':
        return {
            ...state,
            tools: {
                ...state.tools,
                [action.payload.id]: {
                    ...state.tools[action.payload.id],
                    ...action.payload.updates,
                },
            },
        };
    case 'ADD_AGENT':
        return { ...state, agents: { ...state.agents, [action.payload.id]: action.payload } };
    case 'ADD_TOOL':
        return { ...state, tools: { ...state.tools, [action.payload.id]: action.payload } };
    case 'DELETE_AGENT':
        const newAgents = { ...state.agents };
        delete newAgents[action.payload];
        return { ...state, agents: newAgents, selectedComponentId: state.selectedComponentId === action.payload ? null : state.selectedComponentId };
    case 'DELETE_TOOL':
        const newTools = { ...state.tools };
        delete newTools[action.payload];
        return { ...state, tools: newTools, selectedComponentId: state.selectedComponentId === action.payload ? null : state.selectedComponentId };
    case 'SET_STATUS':
        return { 
            ...state, 
            workflowStatus: action.payload.status, 
            workflowProgress: action.payload.progress ?? state.workflowProgress,
            log: action.payload.log ?? state.log
        };
    case 'ADD_NODE_HISTORY':
        const node = state.nodes[action.payload.nodeId];
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        return {
            ...state,
            nodes: {
                ...state.nodes,
                [action.payload.nodeId]: {
                    ...node,
                    history: [...node.history, { 
                        timestamp, 
                        output: action.payload.output.substring(0, 100) + '...', 
                        full: action.payload.full 
                    }],
                }
            }
        };
    default:
      return state;
  }
};

// ----------------------------------------
// 4. Context 和 Provider (Pinia-like 状态层)
// ----------------------------------------

const WorkflowContext = createContext<{ state: WorkflowState; dispatch: React.Dispatch<WorkflowAction> } | undefined>(undefined);

const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(workflowReducer, INITIAL_STATE);
  return (
    <WorkflowContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkflowContext.Provider>
  );
};

// 自定义 Hook (用于在组件中访问状态)
const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow 必须在 WorkflowProvider 内部使用');
  }
  return context;
};

// ----------------------------------------
// 5. 组件: 节点 (Node Component)
// ----------------------------------------

interface NodeProps {
  node: WorkflowNode;
  component: Agent | Tool;
  containerRef: React.RefObject<HTMLDivElement>;
}

const WorkflowNodeComponent: React.FC<NodeProps> = ({ node, component, containerRef }) => {
  const { state, dispatch } = useWorkflow();
  const nodeRef = useRef<HTMLDivElement>(null);
  
  const componentTypeLabel = node.type === 'agent' ? '智能体' : '工具';
  const icon = node.type === 'agent' 
    ? (component as Agent).usesGrounding ? <Search className="w-4 h-4 text-sky-500" /> : <MousePointer2 className="w-4 h-4 text-indigo-500" />
    : (component as Tool).type === 'image_gen' ? <Image className="w-4 h-4 text-purple-500" /> : <Code className="w-4 h-4 text-gray-500" />;

  // 拖拽逻辑修复: 考虑容器滚动和点击事件
  const handleMouseDown = (e: React.MouseEvent) => {
    // 阻止连接器上的拖拽
    if ((e.target as HTMLElement).classList.contains('connector')) return;
    
    e.stopPropagation();
    dispatch({ type: 'SET_SELECTED_NODE', payload: node.id });
    
    const nodeEl = nodeRef.current;
    if (!nodeEl || !containerRef.current) return;
    
    const container = containerRef.current;
    const offsetX = e.clientX - nodeEl.getBoundingClientRect().left;
    const offsetY = e.clientY - nodeEl.getBoundingClientRect().top;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      let newX = moveEvent.clientX - container.getBoundingClientRect().left - offsetX + container.scrollLeft;
      let newY = moveEvent.clientY - container.getBoundingClientRect().top - offsetY + container.scrollTop;
      
      // 边界限制
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      dispatch({ type: 'MOVE_NODE', payload: { id: node.id, x: newX, y: newY } });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  // 连接逻辑
  const handleConnectionStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'START_CONNECTION', payload: node.id });
  };
  
  const handleConnectionEnd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state.isDrawingConnection && state.connectionStartNodeId !== node.id) {
        dispatch({ type: 'ADD_CONNECTION', payload: { from: state.connectionStartNodeId!, to: node.id } });
    }
    dispatch({ type: 'END_CONNECTION' });
  };


  let ringColor = 'ring-transparent';
  if (state.workflowStatus === 'running' && node.status === 'running') {
      ringColor = 'ring-green-500';
  } else if (state.selectedNodeId === node.id) {
      ringColor = 'ring-blue-500';
  } else if (node.status === 'complete') {
      ringColor = 'ring-opacity-50 ring-green-300';
  }


  return (
    <div
      ref={nodeRef}
      className={`absolute bg-white rounded-xl p-4 w-64 shadow-xl border cursor-grab transition-all duration-300 ${state.selectedNodeId === node.id ? 'border-blue-600 ring-2' : 'border-gray-200'} ${ringColor}`}
      style={{ left: node.x, top: node.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center space-x-2 mb-2">
        {icon}
        <div className="font-bold text-gray-800 truncate">{node.name}</div>
      </div>
      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full inline-block">
        {componentTypeLabel}: {component.name}
      </div>

      <div 
        className="connector input absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white cursor-pointer hover:bg-green-500 transition-colors"
        onMouseUp={handleConnectionEnd}
      ></div>
      <div 
        className="connector output absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-400 rounded-full border-2 border-white cursor-pointer hover:bg-blue-500 transition-colors"
        onMouseDown={handleConnectionStart}
      ></div>
    </div>
  );
};


// ----------------------------------------
// 6. 组件: 画布 (Canvas)
// ----------------------------------------

const WorkflowCanvas: React.FC = () => {
  const { state, dispatch } = useWorkflow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tempLineEnd, setTempLineEnd] = useState({ x: 0, y: 0 });

  // 点击画布背景取消选中
  const handleClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || e.target === bgCanvasRef.current) {
      dispatch({ type: 'SET_SELECTED_NODE', payload: null });
    }
  };

  // 获取连接器在 Canvas 坐标系中的位置
  const getConnectorPosition = useCallback((nodeId: NodeId, type: 'input' | 'output'): { x: number, y: number } | null => {
    const nodeEl = document.getElementById(`node-${nodeId}`);
    const canvasEl = canvasRef.current;
    if (!nodeEl || !canvasEl) return null;

    const rect = nodeEl.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    
    const scrollLeft = canvasEl.scrollLeft;
    const scrollTop = canvasEl.scrollTop;

    // 连接器圆心相对于视口的坐标
    const centerX = type === 'output' ? rect.right + 2 : rect.left - 2;
    const centerY = rect.top + rect.height / 2;

    // 转换到 Canvas 内部坐标 (考虑滚动)
    const x = centerX - canvasRect.left + scrollLeft;
    const y = centerY - canvasRect.top + scrollTop;

    return { x, y };
  }, [state.nodes]); // 依赖节点状态,确保计算的正确性

  // 绘制连接线 (使用 Canvas API)
  const drawConnections = useCallback(() => {
    const bgCanvas = bgCanvasRef.current;
    const canvasContainer = canvasRef.current;
    if (!bgCanvas || !canvasContainer) return;
    
    bgCanvas.width = canvasContainer.scrollWidth;
    bgCanvas.height = canvasContainer.scrollHeight;
    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    // 绘制固定连接
    state.connections.forEach(conn => {
      const startPos = getConnectorPosition(conn.from, 'output');
      const endPos = getConnectorPosition(conn.to, 'input');
      
      if (startPos && endPos) {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        // 使用贝塞尔曲线使连接更平滑
        const midX = startPos.x + (endPos.x - startPos.x) * 0.5;
        ctx.bezierCurveTo(midX, startPos.y, midX, endPos.y, endPos.x, endPos.y);
        ctx.strokeStyle = '#a3a3a3';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 绘制临时连接线
    if (state.isDrawingConnection && state.connectionStartNodeId) {
        const startPos = getConnectorPosition(state.connectionStartNodeId, 'output');
        if (startPos) {
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            // 临时线终点已是 canvas 内部坐标
            ctx.lineTo(tempLineEnd.x, tempLineEnd.y); 
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

  }, [state.connections, state.nodes, state.isDrawingConnection, state.connectionStartNodeId, tempLineEnd, getConnectorPosition]);
  
  // 监听状态变化和滚动事件来重绘
  useEffect(() => {
    drawConnections();
  }, [state.nodes, state.connections, state.isDrawingConnection, tempLineEnd, drawConnections]);
  
  // 监听滚动事件,确保连接线跟随节点移动
  useEffect(() => {
      const canvasEl = canvasRef.current;
      if (canvasEl) {
          canvasEl.addEventListener('scroll', drawConnections);
          return () => {
              canvasEl.removeEventListener('scroll', drawConnections);
          };
      }
  }, [drawConnections]);

  // 临时连接线的终点跟随鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (state.isDrawingConnection && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        // 计算相对于 canvas 内部的坐标
        const newX = e.clientX - rect.left + canvasRef.current.scrollLeft;
        const newY = e.clientY - rect.top + canvasRef.current.scrollTop;
        setTempLineEnd({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    if (state.isDrawingConnection) {
        dispatch({ type: 'END_CONNECTION' });
    }
  };
  
  // 处理组件库拖放
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentData = e.dataTransfer.getData("componentData");
    if (!componentData) return;
    
    const { id, type } = JSON.parse(componentData) as { id: ComponentId, type: 'agent' | 'tool' | 'data' };
    
    if (type !== 'agent' && type !== 'tool') return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const newId = Math.max(0, ...Object.keys(state.nodes).map(Number)) + 1;

    // 计算鼠标位置相对于画布内部坐标 (考虑滚动)
    const x = e.clientX - rect.left + canvasRef.current!.scrollLeft;
    const y = e.clientY - rect.top + canvasRef.current!.scrollTop;

    const component = type === 'agent' ? state.agents[id] : state.tools[id];

    const newNode: WorkflowNode = {
        id: newId,
        name: component.name + ` 节点 #${newId}`,
        x: x - 128, // 粗略居中
        y: y - 50,
        type: type,
        componentId: id,
        history: [],
        status: 'pending'
    };
    
    dispatch({ type: 'ADD_NODE', payload: newNode });
    dispatch({ type: 'SET_SELECTED_NODE', payload: newId });
  };
  
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const nodeCount = Object.keys(state.nodes).length;

  return (
    <div
      ref={canvasRef}
      id="workflow-canvas"
      className="relative flex-grow overflow-auto bg-gray-50 border-gray-200"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ minHeight: '100%', minWidth: '100%' }}
    >
      {/* 背景 Canvas 用于绘制连接线 */}
      <canvas 
          ref={bgCanvasRef}
          className="absolute top-0 left-0 pointer-events-none z-0"
      ></canvas>

      {nodeCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center text-gray-400 p-8 bg-white/70 rounded-xl shadow-lg">
                  <h2 className="text-2xl font-semibold">欢迎使用工作流编辑器</h2>
                  <p className="mt-2">从左侧的组件库中拖动"智能体"或"工具"到此处以创建节点.</p>
              </div>
          </div>
      )}
      
      {/* 节点渲染 */}
      {Object.values(state.nodes).map(node => {
        const component = node.type === 'agent' ? state.agents[node.componentId] : state.tools[node.componentId];
        return (
          <WorkflowNodeComponent 
            key={node.id} 
            node={node} 
            component={component} 
            containerRef={canvasRef}
          />
        );
      })}
    </div>
  );
};


// ----------------------------------------
// 7. 组件: 属性检查器 (Inspector)
// ----------------------------------------

const InspectorPanel: React.FC = () => {
    const { state, dispatch } = useWorkflow();
    
    const selectedNode = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
    const selectedComponentId = state.selectedComponentId;
    
    let content: React.ReactNode;
    
    // 渲染节点属性
    if (selectedNode) {
        const component = selectedNode.type === 'agent' 
            ? state.agents[selectedNode.componentId]
            : state.tools[selectedNode.componentId];

        const historyHtml = selectedNode.history.map((item, index) => (
            <div key={index} className="flex justify-between items-center text-xs p-2 border-b last:border-b-0">
                <span className="text-gray-700 truncate">{item.timestamp} - {item.output}</span>
                <div className="flex space-x-2">
                    <button 
                        className="text-blue-500 hover:text-blue-700" 
                        onClick={() => alert(`完整输出:\n${item.full}`)}
                    >
                        查看
                    </button>
                    <button 
                        className="text-purple-600 hover:text-purple-800 font-semibold disabled:opacity-50" 
                        // Mock TTS Playback
                        onClick={() => {
                            dispatch({ type: 'SET_STATUS', payload: { status: 'idle', log: `🔊 正在模拟播放: ${item.output}` } });
                            setTimeout(() => dispatch({ type: 'SET_STATUS', payload: { status: 'idle', log: '播放完毕.' } }), 1500);
                        }}
                    >
                        <Mic2 className="w-4 h-4 inline" /> 试听
                    </button>
                </div>
            </div>
        ));

        content = (
            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center"><GitCommit className="w-5 h-5 mr-2"/> 编辑节点: {selectedNode.name}</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700">节点名称</label>
                    <input 
                        type="text" 
                        value={selectedNode.name}
                        onChange={(e) => dispatch({ type: 'UPDATE_NODE', payload: { id: selectedNode.id, name: e.target.value } })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                    />
                </div>
                <div className="p-3 border rounded-xl bg-gray-100">
                    <span className="text-xs font-medium text-gray-500">组件:</span>
                    <span className="font-semibold block">{component.name} (LLM: {(component as Agent).llm || (component as Tool).llm || 'N/A'})</span>
                </div>
                
                <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-700">章节历史输出</h3>
                    <p className="text-xs text-gray-500 mb-2">点击 🎧 试听,模拟播放内容.</p>
                    <div className="mt-2 border rounded-xl bg-white overflow-hidden max-h-48 overflow-y-auto">
                        {historyHtml.length > 0 ? historyHtml : <p className="text-center text-gray-500 text-sm p-4">暂无运行历史.</p>}
                    </div>
                </div>

                <button 
                    onClick={() => dispatch({ type: 'DELETE_NODE', payload: selectedNode.id })}
                    className="w-full text-sm text-red-600 hover:text-red-800 flex items-center justify-center p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <Trash2 className="w-4 h-4 mr-1"/> 删除节点
                </button>
            </div>
        );
    } 
    // 渲染组件库属性
    else if (selectedComponentId) {
        const component = state.agents[selectedComponentId] || state.tools[selectedComponentId];
        const isAgent = !!state.agents[selectedComponentId];

        const componentData = isAgent ? (component as Agent) : (component as Tool);
        
        const deleteHandler = isAgent 
            ? () => {
                const isUsed = Object.values(state.nodes).some(n => n.type === 'agent' && n.componentId === componentData.id);
                if (isUsed) return alert('该智能体正在被工作流节点使用,无法删除.');
                dispatch({ type: 'DELETE_AGENT', payload: componentData.id });
            }
            : () => {
                const isUsed = Object.values(state.nodes).some(n => n.type === 'tool' && n.componentId === componentData.id);
                if (isUsed) return alert('该工具正在被工作流节点使用,无法删除.');
                dispatch({ type: 'DELETE_TOOL', payload: componentData.id });
            };


        content = (
            <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center"><Settings className="w-5 h-5 mr-2"/> 编辑{isAgent ? '智能体' : '工具'}: {componentData.name}</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700">名称</label>
                    <input 
                        type="text" 
                        value={componentData.name}
                        onChange={(e) => {
                            if(isAgent) {
                                dispatch({ type: 'UPDATE_AGENT', payload: { id: componentData.id, updates: { name: e.target.value } } });
                            } else {
                                dispatch({ type: 'UPDATE_TOOL', payload: { id: componentData.id, updates: { name: e.target.value } } });
                            }
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                    />
                </div>

                {isAgent && (
                    <>
                        {/* LLM 模型选择 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">LLM 模型 (工作流配置)</label>
                            <select 
                                id="agent-llm-select"
                                value={(componentData as Agent).llm}
                                onChange={(e) => dispatch({ type: 'UPDATE_AGENT', payload: { id: componentData.id, updates: { llm: e.target.value as LLMModel } } })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                            >
                                <option value="gpt-4o">OpenAI GPT-4o</option>
                                <option value="claude-3-opus">Anthropic Claude 3 Opus</option>
                                <option value="ernie-4">百度 文心一言 (ERNIE 4.0)</option>
                                <option value="qwen-max">阿里 通义千问 (Qwen-Max)</option>
                            </select>
                            <p className="text-xs text-red-600 mt-1">注意: 下方测试功能仅调用 OpenAI API.</p>
                        </div>

                        {/* Prompt */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">提示词 (Prompt)</label>
                            <textarea 
                                rows={8} 
                                value={(componentData as Agent).prompt}
                                onChange={(e) => dispatch({ type: 'UPDATE_AGENT', payload: { id: componentData.id, updates: { prompt: e.target.value } } })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                            ></textarea>
                        </div>
                        
                        {/* Grounding Checkbox */}
                        <div className="flex items-center">
                            <input 
                                id="grounding-checkbox" 
                                type="checkbox" 
                                checked={(componentData as Agent).usesGrounding}
                                onChange={(e) => dispatch({ type: 'UPDATE_AGENT', payload: { id: componentData.id, updates: { usesGrounding: e.target.checked } } })}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="grounding-checkbox" className="ml-2 block text-sm font-medium text-gray-700">启用 Google Search 联网增强</label>
                        </div>

                        {/* 智能体测试区 - 关键修复部分 */}
                        <AgentTestSection agent={componentData as Agent} />
                    </>
                )}
                
                {!isAgent && (
                    <>
                        {/* Tool Type & Config */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">工具类型</label>
                            <select 
                                value={(componentData as Tool).type}
                                onChange={(e) => dispatch({ type: 'UPDATE_TOOL', payload: { id: componentData.id, updates: { type: e.target.value as 'code' | 'image_gen' | 'tts' } } })}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                            >
                                <option value="code">代码/函数工具</option>
                                <option value="image_gen">多模态图像生成</option>
                                <option value="tts">TTS 语音合成</option>
                            </select>
                        </div>
                        {(componentData as Tool).type === 'code' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">工具函数体 (JS Mock)</label>
                                <textarea 
                                    rows={10} 
                                    value={(componentData as Tool).functionBody}
                                    onChange={(e) => dispatch({ type: 'UPDATE_TOOL', payload: { id: componentData.id, updates: { functionBody: e.target.value } } })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 font-mono text-xs"
                                ></textarea>
                            </div>
                        )}
                        {((componentData as Tool).type === 'image_gen' || (componentData as Tool).type === 'tts') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">模型</label>
                                <select 
                                    value={(componentData as Tool).llm}
                                    onChange={(e) => dispatch({ type: 'UPDATE_TOOL', payload: { id: componentData.id, updates: { llm: e.target.value as LLMModel } } })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2"
                                >
                                    <option value="imagen-3.0-generate-002">Imagen 3.0 (图像)</option>
                                    <option value="gemini-2.5-flash-preview-tts">Gemini TTS (语音)</option>
                                </select>
                            </div>
                        )}
                    </>
                )}

                <button 
                    onClick={deleteHandler}
                    className="w-full text-sm text-red-600 hover:text-red-800 flex items-center justify-center p-2 rounded-lg hover:bg-red-50 transition-colors mt-6"
                >
                    <Trash2 className="w-4 h-4 mr-1"/> 删除组件
                </button>
            </div>
        );
    } 
    // 渲染占位符
    else {
        content = (
            <div className="text-gray-500 text-center pt-10">
                <p>在画布中选择一个节点,或在组件库中选择一个项目以查看其属性.</p>
            </div>
        );
    }

    return (
        <aside className="w-1/5 bg-white border-l border-gray-200 flex flex-col shadow-md flex-shrink-0">
            <h2 className="panel-header text-gray-700 flex items-center"><LayoutList className="w-5 h-5 mr-2"/> 属性检查器</h2>
            <div className="p-4 flex-grow overflow-y-auto">
                {content}
            </div>
        </aside>
    );
};

// ----------------------------------------
// 7.1. 智能体测试区 (Agent Test Section) - 修复拖拽后用户关心的核心功能
// ----------------------------------------

interface AgentTestSectionProps {
    agent: Agent;
}

const AgentTestSection: React.FC<AgentTestSectionProps> = ({ agent }) => {
    const [testInput, setTestInput] = useState('请写一篇关于赛博朋克城市底层生活的短篇小说开头.');
    const [testResult, setTestResult] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Mock API Call (Simulating actual Gemini API)
    const handleTest = async () => {
        setIsLoading(true);
        setStatusMessage(`正在调用 Gemini API (测试LLM: ${agent.llm}, 联网: ${agent.usesGrounding ? '是' : '否'})...`);
        setTestResult('');
        
        // Simulating API latency and result
        await new Promise(resolve => setTimeout(resolve, 2500)); 
        
        try {
            const mockOutput = `[${agent.llm} - 联网: ${agent.usesGrounding ? 'YES' : 'NO'}]\n\n**提示词:** ${agent.prompt.substring(0, 50)}...\n**输入:** ${testInput.substring(0, 50)}...\n\n**生成内容:** \n\n霓虹灯的血色光芒浸透了九龙城寨的湿漉漉的街道.空气中弥漫着廉价合成食物和电子垃圾焚烧的焦臭味.机械义肢摩擦着地面的声音是这座城市永恒的背景音乐.在代号为"蜂巢"的最低层公寓里,亚历克睁开了他的光感义眼,屏幕上跳动着的是他今晚的送货目标_一枚被加密的神经芯片.今天是他的第三百七十五个"赛博雨天",他需要活下去.`;

            setTestResult(mockOutput);
            setStatusMessage('生成成功!');
        } catch (error) {
            setTestResult(`生成失败.错误信息: ${error.message}`);
            setStatusMessage('生成失败,请检查提示词或网络状态.');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 text-base flex items-center mb-2">
                <Send className="w-5 h-5 mr-2 text-indigo-600"/> 智能体测试 (Gemini API)
            </h3>
            <p className="text-xs text-gray-500 mb-3">此功能用于验证提示词效果,实际调用 Gemini 2.5 Flash.</p>
            
            <label className="block text-sm font-medium text-gray-700 mt-2">测试输入/上下文</label>
            <textarea 
                id="test-query-input" 
                rows={4} 
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2" 
                placeholder="输入测试的主题或上下文..."
            ></textarea>
            
            <button 
                onClick={handleTest}
                disabled={isLoading}
                className={`mt-2 w-full px-4 py-2 text-white rounded-lg transition duration-200 text-sm font-semibold shadow-md flex items-center justify-center ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2"/>}
                {isLoading ? '正在生成...' : '✨ 测试并生成'}
            </button>
            
            {statusMessage && (
                <div className={`text-sm mt-2 p-2 rounded-md ${statusMessage.includes('成功') ? 'bg-green-100 text-green-800' : statusMessage.includes('失败') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'} block`}>
                    {statusMessage}
                </div>
            )}
            
            <label className="block text-sm font-medium text-gray-700 mt-4">生成结果</label>
            <textarea 
                id="test-result-output" 
                rows={6} 
                readOnly 
                value={testResult}
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 sm:text-sm p-2 font-mono text-xs" 
                placeholder="模型生成的内容将显示在此处..."
            ></textarea>
        </div>
    );
}

// ----------------------------------------
// 8. 组件: 组件库 (Library)
// ----------------------------------------

const LibraryPanel: React.FC = () => {
    const { state, dispatch } = useWorkflow();
    const nextAgentId = 'agent-' + (Object.keys(state.agents).length + 1);
    const nextToolId = 'tool-' + (Object.keys(state.tools).length + 1);
    
    // 处理拖拽开始
    const handleDragStart = (e: React.DragEvent, componentId: ComponentId, type: 'agent' | 'tool' | 'data') => {
        e.dataTransfer.setData("componentData", JSON.stringify({ id: componentId, type }));
        e.dataTransfer.effectAllowed = "move";
    };

    const addAgent = () => {
        const id = nextAgentId;
        const newAgent: Agent = { id, name: `新建智能体 (${id.split('-')[1]})`, prompt: '请在这里输入你的提示词...', llm: 'gemini-2.5-flash-preview-09-2025', usesGrounding: false };
        dispatch({ type: 'ADD_AGENT', payload: newAgent });
        dispatch({ type: 'SET_SELECTED_COMPONENT', payload: id });
    };

    const addTool = () => {
        const id = nextToolId;
        const newTool: Tool = { id, name: `新建代码工具 (${id.split('-')[1]})`, type: 'code', functionBody: 'function newTool() {\n  // 定义你的工具函数\n}' };
        dispatch({ type: 'ADD_TOOL', payload: newTool });
        dispatch({ type: 'SET_SELECTED_COMPONENT', payload: id });
    };

    const getIcon = (component: Agent | Tool) => {
        if ('usesGrounding' in component) {
            return component.usesGrounding ? <Search className="w-4 h-4 text-sky-500" /> : <MousePointer2 className="w-4 h-4 text-indigo-500" />;
        }
        if (component.type === 'image_gen') return <Image className="w-4 h-4 text-purple-500" />;
        if (component.type === 'tts') return <Mic2 className="w-4 h-4 text-pink-500" />;
        if (component.name.includes('搜索')) return <Search className="w-4 h-4 text-sky-500" />;
        return <Code className="w-4 h-4 text-gray-500" />;
    }

    return (
        <aside className="w-1/5 bg-white border-r border-gray-200 flex flex-col shadow-md flex-shrink-0">
            <h2 className="panel-header text-gray-700 flex items-center"><Grip className="w-5 h-5 mr-2"/> 组件库</h2>
            <div className="p-4 space-y-6 overflow-y-auto">
                <div className="component-section">
                    <h3 className="font-semibold text-gray-600 mb-3">智能体 (Agents)</h3>
                    <div className="space-y-2" id="agent-library">
                        {Object.values(state.agents).map(agent => (
                            <div
                                key={agent.id}
                                className={`p-3 border rounded-xl shadow-sm text-sm flex items-center space-x-2 cursor-pointer hover:bg-gray-100 cursor-grab transition-colors ${state.selectedComponentId === agent.id ? 'bg-blue-100 border-blue-400' : 'bg-white'}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, agent.id, 'agent')}
                                onClick={() => dispatch({ type: 'SET_SELECTED_COMPONENT', payload: agent.id })}
                            >
                                {getIcon(agent)}
                                <span className="truncate">{agent.name}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={addAgent} className="mt-3 w-full text-left text-sm text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors">+ 新建智能体</button>
                </div>

                <div className="component-section">
                    <h3 className="font-semibold text-gray-600 mb-3">工具 (Tools)</h3>
                    <div className="space-y-2" id="tool-library">
                        {Object.values(state.tools).map(tool => (
                            <div
                                key={tool.id}
                                className={`p-3 border rounded-xl shadow-sm text-sm flex items-center space-x-2 cursor-pointer hover:bg-gray-100 cursor-grab transition-colors ${state.selectedComponentId === tool.id ? 'bg-blue-100 border-blue-400' : 'bg-white'}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, tool.id, 'tool')}
                                onClick={() => dispatch({ type: 'SET_SELECTED_COMPONENT', payload: tool.id })}
                            >
                                {getIcon(tool)}
                                <span className="truncate">{tool.name}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={addTool} className="mt-3 w-full text-left text-sm text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors">+ 新建工具</button>
                </div>
            </div>
        </aside>
    );
};

// ----------------------------------------
// 9. SSE 客户端与流程控制 (Workflow Runner)
// ----------------------------------------

const WorkflowRunner: React.FC = () => {
    const { state, dispatch } = useWorkflow();
    const isRunning = state.workflowStatus === 'running';
    const sourceRef = useRef<EventSource | null>(null);

    const handleRun = () => {
        if (isRunning) return;

        // 1. 重置所有节点状态
        Object.values(state.nodes).forEach(node => {
            dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, status: 'pending' } });
        });
        
        // 2. 启动 SSE 连接
        dispatch({ type: 'SET_STATUS', payload: { status: 'running', progress: 0, log: '正在连接后端服务...' } });

        const sseUrl = 'http://localhost:8000/api/v1/workflows/stream/test'; // FastAPI 默认端口
        
        try {
            sourceRef.current = new EventSource(sseUrl);

            sourceRef.current.onopen = () => {
                dispatch({ type: 'SET_STATUS', payload: { status: 'running', log: '连接成功,等待后端推送数据...' } });
            };

            sourceRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'status') {
                    dispatch({ type: 'SET_STATUS', payload: { status: 'running', progress: data.progress, log: data.message } });
                } else if (data.type === 'node_start') {
                    dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'running' } });
                    dispatch({ type: 'SET_STATUS', payload: { status: 'running', log: `节点 [${data.name}] 开始执行...` } });
                } else if (data.type === 'node_complete') {
                    // 更新节点状态
                    dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'complete' } });
                    
                    // 添加历史记录
                    const nodeName = state.nodes[data.nodeId]?.name || '未知节点';
                    dispatch({ 
                        type: 'ADD_NODE_HISTORY', 
                        payload: { 
                            nodeId: data.nodeId, 
                            output: data.content, 
                            full: data.content 
                        } 
                    });
                    
                    // 更新全局状态
                    dispatch({ 
                        type: 'SET_STATUS', 
                        payload: { 
                            status: 'running', 
                            progress: data.progress, 
                            log: `节点 [${nodeName}] 执行完成,进度: ${data.progress.toFixed(0)}%` 
                        } 
                    });
                    
                    // 模拟选中完成的节点,查看输出
                    dispatch({ type: 'SET_SELECTED_NODE', payload: data.nodeId });

                } else if (data.type === 'node_error') {
                    dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'error' } });
                    dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: `❌ 节点 [${data.name}] 执行出错: ${data.error}` } });
                    sourceRef.current?.close();
                }

                if (data.progress === 100) {
                    dispatch({ type: 'SET_STATUS', payload: { status: 'complete', progress: 100, log: data.message } });
                    sourceRef.current?.close();
                }
            };

            sourceRef.current.onerror = (err) => {
                console.error('SSE Error:', err);
                dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: '⚠️ SSE 连接或运行时出错,请检查后端服务 (端口 8000) 是否启动.' } });
                sourceRef.current?.close();
            };

        } catch (error) {
            dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: `启动失败: ${error.message}` } });
        }
    };
    
    // 清理 SSE 连接
    useEffect(() => {
        return () => {
            if (sourceRef.current) {
                sourceRef.current.close();
            }
        };
    }, []);


    return (
        <div className="flex items-center space-x-3">
            <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 text-sm font-semibold shadow-sm"
                onClick={() => dispatch({ type: 'SET_STATUS', payload: { status: 'idle', log: '工作流已就绪.' } })}
            >
                保存工作流
            </button>
            <button 
                id="run-button" 
                onClick={handleRun}
                disabled={isRunning}
                className={`px-4 py-2 text-white rounded-lg transition duration-200 text-sm font-semibold shadow-sm flex items-center ${isRunning ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
                {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Play className="w-4 h-4 mr-2"/>}
                {isRunning ? `运行中... (${state.workflowProgress.toFixed(0)}%)` : '运行工作流'}
            </button>
        </div>
    );
}


// ----------------------------------------
// 10. 主应用组件 (App Component)
// ----------------------------------------

const AppContent: React.FC = () => {
    const { state } = useWorkflow();

    return (
        <div id="app" className="h-screen w-screen flex flex-col bg-gray-100">
            
            <header className="w-full bg-white border-b border-gray-200 p-3 flex items-center justify-between shadow-md flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-800 flex items-center">
                    <RadioTower className="w-6 h-6 mr-3 text-red-500"/>
                    小说创作工作流编辑器 (React/TS + SSE)
                </h1>
                <WorkflowRunner />
            </header>
            
            <div className="flex-grow flex overflow-hidden">
                <LibraryPanel />
                <div className="flex flex-col flex-grow">
                    <WorkflowCanvas />
                    {/* 状态栏/日志区 */}
                    <footer className="w-full bg-white border-t border-gray-200 p-3 text-sm flex items-center justify-between flex-shrink-0">
                        <div className={`flex items-center space-x-2 font-mono ${state.workflowStatus === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                            <div className={`w-3 h-3 rounded-full ${state.workflowStatus === 'running' ? 'bg-green-500 animate-pulse' : state.workflowStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                            <span className="font-semibold">状态:</span>
                            <span className="text-gray-700">{state.log}</span>
                        </div>
                        {state.workflowStatus === 'running' && (
                            <div className="w-48 bg-gray-200 rounded-full h-2.5">
                                <div 
                                    className="bg-green-600 h-2.5 rounded-full transition-all duration-500" 
                                    style={{ width: `${state.workflowProgress}%` }}
                                ></div>
                            </div>
                        )}
                    </footer>
                </div>
                <InspectorPanel />
            </div>
        </div>
    );
};

// 根组件包装 Provider
const App: React.FC = () => (
    <WorkflowProvider>
        <AppContent />
    </WorkflowProvider>
);

export default App;
