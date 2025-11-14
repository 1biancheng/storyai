/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Settings, RefreshCw, Sparkles, Wand2, BookOpen, MessageCircle, Code, Database, Workflow, Settings as SettingsIcon, MoveVertical, History, ChevronLeft, ChevronRight, Trash2, Plus, Copy, Edit, FilePlus, RotateCcw } from 'lucide-react';
import { runAgent, runAgentStream } from '../sample_data/services/agentService';
import { useForcedTools } from '../src/hooks/useForcedTools';
import { useChapterStore } from '../stores/chapterStore';
import type { AIModel, ProjectData } from '../types';
import ChatToolbar from './ChatToolbar';
import ConfirmDialog from './ConfirmDialog';

// 从Workflow Editor Frontend.tsx中提取的WorkflowRunner组件及其依赖
interface WorkflowState {
  workflowStatus: 'idle' | 'running' | 'complete' | 'error';
  workflowProgress: number;
  log: string;
  nodes: Record<any, { id: any; name: string; status: 'pending' | 'running' | 'complete' | 'error' }>;
}

type WorkflowAction = 
  | { type: 'SET_STATUS', payload: { status: WorkflowState['workflowStatus'], progress?: number, log?: string } }
  | { type: 'UPDATE_NODE', payload: { id: any; status: WorkflowState['nodes'][any]['status'] } }
  | { type: 'ADD_NODE_HISTORY', payload: { nodeId: any; output: string; full: string } }
  | { type: 'SET_SELECTED_NODE', payload: any };

// Loader和Play图标的实现
const Loader2 = () => <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;
const Play = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  responseTime?: number; // 响应时间,单位毫秒
}

interface AIChatPanelProps {
  models: AIModel[];
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  projectData?: ProjectData | null;
  currentChapterContent?: string;
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
    borderColor?: string;
  };
  selectedChapterId?: string | null;
}

// 实现WorkflowRunner组件
const WorkflowRunner: React.FC<{ theme: AIChatPanelProps['theme']; workflowId?: string }> = ({ theme, workflowId }) => {
  // 初始化节点状态 - 如果有workflowId,可以从外部数据源获取节点信息
  const initializeNodes = () => {
    // TODO: 当workflowManager可用时,从这里获取实际的工作流节点数据
    // const workflow = workflowManager?.getWorkflowById(workflowId);
    // if (workflow && workflow.nodes) {
    //   return workflow.nodes.reduce((acc, node) => {
    //     acc[node.id] = {
    //       id: node.id,
    //       name: node.data.label,
    //       status: 'pending'
    //     };
    //     return acc;
    //   }, {} as Record<string, { id: string; name: string; status: string }>);
    // }
    
    // 临时使用示例数据
    return {
      'node1': { id: 'node1', name: '数据输入', status: 'pending' },
      'node2': { id: 'node2', name: '数据处理', status: 'pending' },
      'node3': { id: 'node3', name: '结果输出', status: 'pending' }
    };
  };
  
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    workflowStatus: 'idle',
    workflowProgress: 0,
    log: workflowId ? `工作流 ${workflowId} 已就绪.` : '工作流已就绪.',
    nodes: initializeNodes()
  });
  const sourceRef = useRef<EventSource | null>(null);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);

  const dispatch = (action: WorkflowAction) => {
    setWorkflowState(prev => {
      switch (action.type) {
        case 'SET_STATUS':
          return {
            ...prev,
            workflowStatus: action.payload.status,
            workflowProgress: action.payload.progress ?? prev.workflowProgress,
            log: action.payload.log ?? prev.log
          };
        case 'UPDATE_NODE':
          return {
            ...prev,
            nodes: {
              ...prev.nodes,
              [action.payload.id]: {
                ...prev.nodes[action.payload.id],
                status: action.payload.status
              }
            }
          };
        default:
          return prev;
      }
    });
  };

  const handleRun = () => {
    if (workflowState.workflowStatus === 'running') return;

    // 1. 重置所有节点状态
    Object.values(workflowState.nodes).forEach(node => {
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
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status') {
            dispatch({ type: 'SET_STATUS', payload: { status: 'running', progress: data.progress, log: data.message } });
          } else if (data.type === 'node_start') {
            dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'running' } });
            dispatch({ type: 'SET_STATUS', payload: { status: 'running', log: `节点 [${data.name}] 开始执行...` } });
          } else if (data.type === 'node_complete') {
            // 更新节点状态
            dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'complete' } });
            
            // 更新全局状态
            const nodeName = workflowState.nodes[data.nodeId]?.name || '未知节点';
            dispatch({ 
                type: 'SET_STATUS', 
                payload: { 
                    status: 'running', 
                    progress: data.progress, 
                    log: `节点 [${nodeName}] 执行完成,进度: ${data.progress.toFixed(0)}%` 
                } 
            });
          } else if (data.type === 'node_error') {
            dispatch({ type: 'UPDATE_NODE', payload: { id: data.nodeId, status: 'error' } });
            dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: `❌ 节点 [${data.name}] 执行出错: ${data.error}` } });
            sourceRef.current?.close();
          }

          if (data.progress === 100) {
            dispatch({ type: 'SET_STATUS', payload: { status: 'complete', progress: 100, log: data.message } });
            sourceRef.current?.close();
          }
        } catch (e) {
          console.error('解析SSE消息失败:', e);
        }
      };

      sourceRef.current.onerror = (err) => {
        console.error('SSE Error:', err);
        dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: '⚠️ SSE 连接或运行时出错,请检查后端服务 (端口 8000) 是否启动.' } });
        sourceRef.current?.close();
      };

    } catch (error: any) {
      console.error('Error starting workflow:', error);
      dispatch({ type: 'SET_STATUS', payload: { status: 'error', log: `启动工作流失败: ${error.message || '未知错误'}` } });
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

  const getStatusColor = (status: WorkflowState['workflowStatus']) => {
    switch (status) {
      case 'running': return '#4CAF50';
      case 'complete': return '#2196F3';
      case 'error': return '#F44336';
      default: return theme.textColor;
    }
  };

  const getNodeStatusColor = (status: WorkflowState['nodes'][any]['status']) => {
    switch (status) {
      case 'running': return '#4CAF50';
      case 'complete': return '#2196F3';
      case 'error': return '#F44336';
      default: return theme.textColor;
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium" style={{ color: theme.textColor }}>工作流助手</h4>
        <button 
          onClick={() => setShowWorkflowDetails(!showWorkflowDetails)}
          className="p-1 rounded-full hover:bg-opacity-20 transition-colors"
          style={{ backgroundColor: `${theme.primaryColor}20` }}
        >
          <SettingsIcon size={16} style={{ color: theme.primaryColor }} />
        </button>
      </div>
      
      <div className="space-y-2">
        <button 
          onClick={() => dispatch({ type: 'SET_STATUS', payload: { status: 'idle', log: '工作流已就绪.' } })}
          className="w-full px-3 py-2 text-sm rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
          style={{ backgroundColor: `${theme.primaryColor}80`, color: '#FFFFFF' }}
        >
          <Database size={16} />
          保存工作流
        </button>
        <button 
          onClick={handleRun}
          disabled={workflowState.workflowStatus === 'running'}
          className={`w-full px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${workflowState.workflowStatus === 'running' ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
          style={{ 
            backgroundColor: workflowState.workflowStatus === 'running' 
              ? 'rgba(76, 175, 80, 0.6)' 
              : 'rgba(76, 175, 80, 1)',
            color: '#FFFFFF',
            cursor: workflowState.workflowStatus === 'running' ? 'not-allowed' : 'pointer'
          }}
        >
          {workflowState.workflowStatus === 'running' 
            ? <Loader2 /> 
            : <Play />}
          {workflowState.workflowStatus === 'running' 
            ? `运行中... (${workflowState.workflowProgress.toFixed(0)}%)` 
            : '运行工作流'}
        </button>
      </div>
      
      {showWorkflowDetails && (
        <div className="space-y-2 p-2 bg-opacity-10 rounded-lg" style={{ backgroundColor: `${theme.primaryColor}10` }}>
          <div className="text-xs" style={{ color: theme.textColor }}>状态: {workflowState.workflowStatus}</div>
          <div className="text-xs" style={{ color: theme.textColor }}>进度: {workflowState.workflowProgress.toFixed(0)}%</div>
          <div className="text-xs text-gray-400">日志: {workflowState.log}</div>
          
          <div className="space-y-1">
            {Object.values(workflowState.nodes).map(node => (
              <div key={node.id} className="flex items-center justify-between text-xs">
                <span style={{ color: theme.textColor }}>{node.name}</span>
                <span style={{ color: getNodeStatusColor(node.status) }}>
                  {node.status === 'complete' ? '✓' : node.status === 'running' ? '⟳' : node.status === 'error' ? '✗' : '○'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AIChatPanel({
  models,
  selectedModelId,
  onModelChange,
  projectData,
  currentChapterContent,
  theme = {
    backgroundColor: '#1E1E1E',
    primaryColor: '#007ACC',
    textColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.05)'
  },
  selectedChapterId: propSelectedChapterId = null
}: AIChatPanelProps) {

  const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentChapterNumber, setCurrentChapterNumber] = useState<number>(1);
  const [isChapterCounterEnabled, setIsChapterCounterEnabled] = useState<boolean>(false);
  // 使用传入的propSelectedChapterId作为初始状态
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(propSelectedChapterId);
  const forcedTools = useForcedTools(); // 当前强制启用的工具
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // 聊天历史记录侧边栏状态
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistoryList, setChatHistoryList] = useState<Array<{
    id: string;
    title: string;
    timestamp: string;
    messages: Message[];
    projectId?: string;
  }>>([]);
  
  // 删除历史记录确认对话框状态
  const [deleteHistoryConfirmVisible, setDeleteHistoryConfirmVisible] = useState(false);
  const [historyToDelete, setHistoryToDelete] = useState<{id: string, title: string, index: number} | null>(null);
  
  // 追踪当前对话是否是从历史记录加载的
  const [isLoadedFromHistory, setIsLoadedFromHistory] = useState(false);
  // 追踪当前激活的历史记录ID
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  
  // ChatToolbar工具状态管理
  const [toolbarToolStates, setToolbarToolStates] = useState<Record<string, boolean>>({
    search: true,      // 网络搜索
    upload: true,      // 文件上传
    quickphrase: true, // 快捷短语
    workflow: false,   // 工作流
    knowledge: false,  // 知识库
    thoughtChain: false, // 思维链
    chapterCounter: false // 章节计数器
  });

  // 加载聊天历史列表
  const loadChatHistoryList = () => {
    try {
      const existingHistory = localStorage.getItem('aiChatHistory');
      if (existingHistory) {
        const historyArray = JSON.parse(existingHistory);
        
        // 过滤掉空的历史记录(messages为空或不存在的记录)
        const validHistory = historyArray.filter((item: any) => 
          item.messages && item.messages.length > 0
        );
        
        // 如果过滤后的记录数量少于原记录,说明有空记录被清理,更新localStorage
        if (validHistory.length < historyArray.length) {
          localStorage.setItem('aiChatHistory', JSON.stringify(validHistory));
          console.log(`已清理 ${historyArray.length - validHistory.length} 条空历史记录`);
        }
        
        const formattedHistory = validHistory.map((item: any, index: number) => ({
          id: `history-${index}`,
          title: item.messages[0].content.substring(0, 30) + (item.messages[0].content.length > 30 ? '...' : ''),
          timestamp: item.timestamp,
          messages: item.messages,
          projectId: item.projectId
        }));
        setChatHistoryList(formattedHistory.reverse()); // 最新的在前
      }
    } catch (error) {
      console.error('加载聊天历史列表失败:', error);
    }
  };

  // 初始化加载历史列表
  useEffect(() => {
    loadChatHistoryList();
  }, []);

  // 加载指定的聊天历史
  const loadSpecificHistory = (historyId: string) => {
    const history = chatHistoryList.find(h => h.id === historyId);
    if (history) {
      // 将字符串类型的timestamp转换为Date对象
      const messagesWithDateTimestamp = history.messages.map(msg => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp
      }));
      setMessages(messagesWithDateTimestamp);
      // 标记当前对话是从历史记录加载的
      setIsLoadedFromHistory(true);
      // 设置当前激活的历史记录ID
      setActiveHistoryId(historyId);
    }
  };

  // 处理删除历史记录点击
  const handleDeleteHistoryClick = (e: React.MouseEvent, historyId: string, title: string, index: number) => {
    e.stopPropagation(); // 阻止事件冒泡,避免触发加载历史
    setHistoryToDelete({ id: historyId, title, index });
    setDeleteHistoryConfirmVisible(true);
  };

  // 确认删除历史记录
  const handleConfirmDeleteHistory = () => {
    if (!historyToDelete) return;

    try {
      // 从 localStorage 加载历史记录
      const existingHistory = localStorage.getItem('aiChatHistory');
      if (existingHistory) {
        const historyArray = JSON.parse(existingHistory);
        
        // 计算实际索引(因为显示时是反转的)
        const actualIndex = historyArray.length - 1 - historyToDelete.index;
        
        // 删除指定索引的记录
        historyArray.splice(actualIndex, 1);
        
        // 更新 localStorage
        localStorage.setItem('aiChatHistory', JSON.stringify(historyArray));
        
        // 重新加载列表
        loadChatHistoryList();
        
        console.log(`已删除历史记录: ${historyToDelete.title}`);
      }
    } catch (error) {
      console.error('删除历史记录失败:', error);
    } finally {
      setDeleteHistoryConfirmVisible(false);
      setHistoryToDelete(null);
    }
  };

  // 取消删除
  const handleCancelDeleteHistory = () => {
    setDeleteHistoryConfirmVisible(false);
    setHistoryToDelete(null);
  };

  // 保存对话历史到本地存储(只在有实际对话时保存)
  const saveChatHistory = (currentMessages?: Message[]) => {
    // 使用传入的messages或当前状态的messages
    const messagesToSave = currentMessages || messages;
    
    // 只有当消息数量大于0时才保存(用户和AI至少有一次对话)
    if (messagesToSave.length === 0) {
      return;
    }

    try {
      const chatHistory = {
        messages: messagesToSave,
        timestamp: new Date().toISOString(),
        modelId: selectedModelId,
        projectId: projectData?.id
      };
      
      // 获取现有的对话历史
      const existingHistory = localStorage.getItem('aiChatHistory');
      let historyArray = existingHistory ? JSON.parse(existingHistory) : [];
      
      // 如果有激活的历史记录ID,说明是在更新现有记录
      if (activeHistoryId) {
        // 提取索引号
        const historyIndex = parseInt(activeHistoryId.replace('history-', ''));
        // 计算实际索引(因为显示时是反转的)
        const actualIndex = historyArray.length - 1 - historyIndex;
        
        if (actualIndex >= 0 && actualIndex < historyArray.length) {
          // 更新现有记录
          historyArray[actualIndex] = chatHistory;
          console.log(`已更新历史记录: ${activeHistoryId}`);
        } else {
          // 索引不存在,作为新记录添加
          historyArray.push(chatHistory);
          // 设置新的activeHistoryId
          const newIndex = historyArray.length - 1;
          setActiveHistoryId(`history-${newIndex}`);
        }
      } else {
        // 没有激活的历史记录,添加新的对话历史
        historyArray.push(chatHistory);
        // 设置新创建的记录为激活状态
        const newIndex = historyArray.length - 1;
        setActiveHistoryId(`history-${newIndex}`);
        setIsLoadedFromHistory(true); // 标记为已加载状态,避免新话题时重复保存
      }
      
      // 限制历史记录数量,最多保存20条
      if (historyArray.length > 20) {
        historyArray = historyArray.slice(-20);
      }
      
      localStorage.setItem('aiChatHistory', JSON.stringify(historyArray));
      loadChatHistoryList(); // 重新加载列表
    } catch (error) {
      console.error('保存对话历史失败:', error);
    }
  };

  // 加载对话历史(移除自动加载,用户需要手动选择)
  const loadChatHistory = () => {
    // 不再自动加载历史记录,用户需要从历史记录列表中手动选择
  };

  // 初始化时不再自动加载对话历史,让用户每次都从空白开始
  useEffect(() => {
    // loadChatHistory(); // 已禁用自动加载
  }, [selectedModelId, projectData?.id]);

  // 同步项目数据到状态
  useEffect(() => {
    if (projectData) {
      setSelectedProjectId(projectData.id);
    }
  }, [projectData]);

  // 同步selectedChapterId prop到状态
  useEffect(() => {
    setSelectedChapterId(propSelectedChapterId);
  }, [propSelectedChapterId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedModel = models.find(m => m.id === selectedModelId);

  const enhancePromptWithContext = (prompt: string): string => {
    let enhancedPrompt = prompt;
    
    if (projectData) {
      enhancedPrompt = `项目:${projectData.projectName}\n类型:${projectData.projectGenre}\n${enhancedPrompt}`;
    }
    
    if (currentChapterContent) {
      enhancedPrompt = `当前章节内容:\n${currentChapterContent}\n\n${enhancedPrompt}`;
    }
    
    return enhancedPrompt;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // 检查模型是否已选择
    if (!selectedModelId) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '请先选择一个AI模型',
        timestamp: new Date(),
        model: selectedModel?.name,
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // 注意:不再重置isLoadedFromHistory,保持activeHistoryId以便更新现有记录

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      model: selectedModel?.name
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const enhancedPrompt = enhancePromptWithContext(userMessage.content);
      
      // 尝试流式响应
      let assistantContent = '';
      const assistantMessageId = (Date.now() + 1).toString();
      const startTime = Date.now(); // 记录开始时间
      
      const streamMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        model: selectedModel?.name
      };
      
      setMessages(prev => [...prev, streamMessage]);
      setIsStreaming(true);

      // 使用实际的API调用
      try {
        // 获取当前所有启用的工具(包括ChatToolbar中启用的和手动设置的forcedTools)
        const activeTools = getActiveTools();
        
        await runAgentStream(
          enhancedPrompt,
          (chunk) => {
            assistantContent += chunk;
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: assistantContent }
                  : msg
              )
            );
          },
          selectedModelId,
          true,               // 👈 启用搜索增强
          undefined,
          activeTools         // 👈 使用所有启用的工具
        );
        
        // 计算响应时间
        const responseTime = Date.now() - startTime;
        
        // 更新消息,添加响应时间
        setMessages(prev => {
          const updatedMessages = prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, responseTime }
              : msg
          );
          
          // 在状态更新后保存历史记录
          setTimeout(() => {
            saveChatHistory(updatedMessages);
          }, 100);
          
          return updatedMessages;
        });
        if (isChapterCounterEnabled && assistantContent && selectedProjectId) {
          await handleCreateChapterFromMessage(assistantContent)
        }
      } catch (apiError) {
        console.error('API调用失败:', apiError);
        // 如果API调用失败,显示错误消息
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: '抱歉,API调用失败.请检查后端服务是否正常运行.' }
              : msg
          )
        );
      }

    } catch (error) {
      console.error('AI对话错误:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '抱歉,发生了错误.请稍后重试.',
        timestamp: new Date(),
        model: selectedModel?.name
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== (Date.now() + 1).toString()), errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      
      // 注意:不再在这里调用saveChatHistory()
      // 现在通过useEffect监听messages变化来自动保存
    }
  };

  // 处理快捷短语选择
  const handleQuickPhraseSelect = (phrase: string) => {
    setInputMessage(phrase);
    // 聚焦到输入框
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // 处理文件上传
  const handleFileUpload = (files: any[]) => {
    if (!files || files.length === 0) return;
    
    // 将文件信息添加到输入消息
    const fileNames = files.map(file => 
      file instanceof File ? file.name : (file.name || '未知文件')
    ).join(', ');
    
    const fileMessage = `[文件: ${fileNames}]`;
    setInputMessage(prev => prev ? `${prev}\n${fileMessage}` : fileMessage);
    inputRef.current?.focus();
  };
  
  // 处理知识库选择
  const handleKnowledgeSelect = (item: any) => {
    if (!item) return;
    
    // 将知识库内容添加到输入消息
    const knowledgeMessage = `[知识库: ${item.title}]\n${item.description}`;
    setInputMessage(prev => prev ? `${prev}\n${knowledgeMessage}` : knowledgeMessage);
    inputRef.current?.focus();
  };
  
  // 处理知识库编辑
  const handleKnowledgeEdit = (item: any) => {
    if (!item) return;
    
    // 这里可以添加编辑知识库项的逻辑
    console.log('编辑知识库项:', item);
  };

  // 处理网络搜索
  const handleWebSearch = (query: string) => {
    if (!query.trim()) return;
    
    // 将搜索查询添加到输入消息
    const searchMessage = `[网络搜索: ${query}]`;
    setInputMessage(prev => prev ? `${prev}\n${searchMessage}` : searchMessage);
    inputRef.current?.focus();
  };
  
  // 处理工作流执行
  const handleWorkflowExecute = (workflowId: string) => {
    if (!workflowId) return;
    
    // 切换到工作流助手模式
    setActiveTool('workflow');
    
    // 这里可以添加执行工作流的逻辑
    console.log('执行工作流:', workflowId);
  };
  
  // 处理工作流步骤完成
  const handleWorkflowStepComplete = (workflowId: string, stepId: string, result: any) => {
    if (!workflowId || !stepId) return;
    
    // 这里可以添加处理工作流步骤完成的逻辑
    console.log('工作流步骤完成:', workflowId, stepId, result);
  };

  // 章节计数器工具相关函数
  const handleChapterCounterToggle = (enabled: boolean) => {
    setIsChapterCounterEnabled(enabled);
    console.log('章节计数器工具:', enabled ? '已启用' : '已禁用');
  };

  const handleAutoSaveChapter = async (chapterNumber: number, title: string, content: string) => {
    if (!selectedProjectId) {
      console.error('没有选中的项目');
      return;
    }

    try {
      console.log('自动保存章节:', { chapterNumber, title, content: content.substring(0, 100) + '...' });
      
      // 使用chapterStore创建新章节
      const { createChapter } = useChapterStore.getState();
      
      const newChapter = await createChapter({
        projectId: selectedProjectId,
        chapterNumber,
        title,
        content,
        tags: ['AI生成'],
        notes: '由AI聊天面板自动创建'
      });
      
      if (newChapter) {
        console.log('章节自动保存成功:', newChapter.id);
        // 显示成功提示(可以添加toast通知)
      } else {
        console.error('章节创建失败');
      }
    } catch (error) {
      console.error('自动保存章节失败:', error);
      // 这里可以添加用户友好的错误提示
    }
  };

  // 处理工具选择
  const handleToolSelect = (toolId: string | null) => {
    console.log('工具选择:', toolId);
    // 这里可以添加工具选择的逻辑
  };

  // 处理思维链选择
  const handleThoughtChainSelect = (thoughtChain: any[]) => {
    if (!thoughtChain || thoughtChain.length === 0) return;
    
    // 将思维链内容添加到输入消息
    const thoughtChainMessage = `[思维链: ${thoughtChain.length}个步骤]\n${thoughtChain.map(step => step.title || step.content).join(' → ')}`;
    setInputMessage(prev => prev ? `${prev}\n${thoughtChainMessage}` : thoughtChainMessage);
    inputRef.current?.focus();
  };

  // 处理新话题
  const handleNewTopic = () => {
    // 只有当没有激活的历史记录且有消息时才保存
    // (如果有激活的历史记录,内容已经在每次对话后自动更新了)
    if (messages.length > 0 && !activeHistoryId) {
      saveChatHistory();
    }
    
    // 清空当前对话
    setMessages([]);
    setInputMessage('');
    // 重置加载标记
    setIsLoadedFromHistory(false);
    // 清除激活的历史记录ID
    setActiveHistoryId(null);
    console.log('开始新话题');
  };

  // 处理消息操作:复制
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    // 可以添加toast提示
    console.log('已复制到剪贴板');
  };

  // 处理消息操作:编辑
  const handleEditMessage = (messageId: string, content: string) => {
    // 将消息内容填入输入框
    setInputMessage(content);
    inputRef.current?.focus();
  };

  // 处理消息操作:删除
  const handleDeleteMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // 处理消息操作:创建新章节
  const handleCreateChapterFromMessage = async (content: string) => {
    if (!selectedProjectId) {
      console.error('没有选中的项目');
      // 显示错误提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = '请先选择一个项目';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
      return;
    }

    try {
      const { createChapter, fetchChapters } = useChapterStore.getState();
      
      const lines = content.split('\n').filter(line => line.trim());
      const firstLine = lines[0] || '';
      const titleMatch = content.match(/第[一二三四五六七八九十\d]+章[^\n]*/);
      const title = titleMatch ? titleMatch[0].trim() : (firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : ''));
      const numberMatch = content.match(/第([一二三四五六七八九十\d]+)章/);
      const chineseMap: Record<string, number> = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
      let desiredNumber: number | null = null;
      if (numberMatch && numberMatch[1]) {
        const raw = numberMatch[1];
        if (/^\d+$/.test(raw)) desiredNumber = parseInt(raw, 10);
        else if (raw.length === 1 && chineseMap[raw] != null) desiredNumber = chineseMap[raw];
        else if (raw.length === 2 && raw[0] === '十' && chineseMap[raw[1]] != null) desiredNumber = 10 + chineseMap[raw[1]];
        else if (raw.length === 2 && chineseMap[raw[0]] != null && raw[1] === '十') desiredNumber = chineseMap[raw[0]] * 10;
      }
      
      // 获取现有章节列表
      const chapters = useChapterStore.getState().chapters.filter(ch => ch.projectId === selectedProjectId);
      const taken = new Set(chapters.map(ch => ch.chapterNumber));
      let chapterNumber = desiredNumber && !taken.has(desiredNumber) ? desiredNumber : (chapters.length > 0 ? Math.max(...chapters.map(ch => ch.chapterNumber)) + 1 : 1);
      
      // 创建章节
      const newChapter = await createChapter({
        projectId: selectedProjectId,
        chapterNumber,
        title: title || `第${chapterNumber}章: 新章节`,
        content: content,
        tags: ['AI生成'],
        notes: '由AI聊天创建'
      });
      
      if (newChapter) {
        // 刷新章节列表
        await fetchChapters(selectedProjectId);
        
        console.log('章节创建成功:', newChapter.id);
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.textContent = `章节「${newChapter.title}」创建成功!`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
      }
    } catch (error) {
      console.error('创建章节失败:', error);
      
      // 显示错误提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      notification.textContent = '创建章节失败,请重试';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }
  };

  // 处理用户消息重发
  const handleResendMessage = async (content: string) => {
    // 将内容设置到输入框并自动发送
    setInputMessage(content);
    // 等待状态更新后发送
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // 处理保存对话
  const handleSaveChat = (title: string) => {
    if (!title.trim()) return;
    
    // 这里可以添加保存对话的逻辑
    console.log('保存对话:', title);
  };

  // 处理知识库基础选择
  const handleKnowledgeBaseSelect = (knowledgeBase: string) => {
    if (!knowledgeBase) return;
    
    // 将知识库信息添加到输入消息
    const knowledgeBaseMessage = `[知识库: ${knowledgeBase}]`;
    setInputMessage(prev => prev ? `${prev}\n${knowledgeBaseMessage}` : knowledgeBaseMessage);
    inputRef.current?.focus();
  };

  // 处理工具栏快捷操作
  const handleToolbarAction = (action: string) => {
    setActiveQuickAction(action);
    setIsQuickActionMode(true);
    // 立即执行对应动作
    handleQuickAction(action);
  };

  const handleQuickAction = (action: string) => {
    let prompt = '';
    
    switch (action) {
      case 'generate':
      case 'generate-paragraph':
        prompt = '请为当前章节生成一段情节发展';
        break;
      case 'polish':
      case 'polish-text':
        prompt = '请润色当前章节的文字,使其更加生动优美';
        break;
      case 'continue':
      case 'continue-story':
        prompt = '请基于当前章节内容续写接下来的情节';
        break;
      case 'analyze':
      case 'character-shaping':
        prompt = '请分析当前章节的情节结构和人物发展';
        break;
      case 'plot-outline':
        prompt = '请为当前章节生成情节大纲';
        break;
      case 'creative-inspiration':
        prompt = '请提供一些创意灵感';
        break;
      default:
        return;
    }
    
    setInputMessage(prompt);
    setIsQuickActionMode(false);
    setActiveQuickAction(null);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    
    // 清除当前项目的对话历史
    try {
      const existingHistory = localStorage.getItem('aiChatHistory');
      if (existingHistory) {
        let historyArray = JSON.parse(existingHistory);
        // 过滤掉当前项目的历史记录
        historyArray = historyArray.filter((item: any) => 
          !projectData || !item.projectId || item.projectId !== projectData.id
        );
        localStorage.setItem('aiChatHistory', JSON.stringify(historyArray));
      }
    } catch (error) {
      console.error('清除对话历史失败:', error);
    }
  };

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 只保留底部工具栏,删除所有其他工具栏状态
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [isQuickActionMode, setIsQuickActionMode] = useState(false);
  
  // ChatToolbar工具ID到forcedTools的映射
  const toolbarToForcedToolsMap: Record<string, string> = {
    search: 'web_search',
    upload: 'file_upload',
    quickphrase: 'quick_phrase',
    workflow: 'workflow',
    knowledge: 'knowledge_base',
    thoughtChain: 'thought_chain',
    chapterCounter: 'chapter_counter'
  };
  
  // 处理ChatToolbar工具状态更新
  const handleToolbarToolStateChange = (newToolStates: Record<string, boolean>) => {
    setToolbarToolStates(newToolStates);
    
    // 将启用的工具转换为forcedTools格式
    const enabledTools = Object.entries(newToolStates)
      .filter(([_, isEnabled]) => isEnabled)
      .map(([toolId]) => toolbarToForcedToolsMap[toolId])
      .filter(Boolean);
    
    // 更新forcedTools - 使用toggle方法逐个设置
    enabledTools.forEach(tool => {
      if (!forcedTools.tools.includes(tool)) {
        forcedTools.toggle(tool);
      }
    });
    
    // 禁用未在enabledTools中的工具
    forcedTools.tools.forEach(tool => {
      if (!enabledTools.includes(tool)) {
        forcedTools.toggle(tool);
      }
    });
  };
  
  // 获取当前启用的工具列表(包含手动设置的forcedTools和ChatToolbar中启用的工具)
  const getActiveTools = () => {
    const toolbarEnabledTools = Object.entries(toolbarToolStates)
      .filter(([_, isEnabled]) => isEnabled)
      .map(([toolId]) => toolbarToForcedToolsMap[toolId])
      .filter(Boolean);
    
    // 合并手动设置的forcedTools和toolbar中启用的工具
    const allTools = [...new Set([...forcedTools.tools, ...toolbarEnabledTools])];
    return allTools;
  };
  
  return (
    <>
    <div className="flex h-full rounded-lg border overflow-hidden" style={{ backgroundColor: theme.backgroundColor, borderColor: theme.borderColor }}>
      {/* 左侧聊天历史记录栏 */}
      {showHistory && (
        <div className="w-24 border-r flex-shrink-0 flex flex-col" style={{ borderColor: theme.borderColor }}>
          <div className="px-2 py-1 border-b flex justify-between items-center" style={{ borderColor: theme.borderColor }}>
            <h4 className="text-xs font-medium" style={{ color: theme.textColor }}>聊天历史</h4>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewTopic}
                className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                title="新话题"
              >
                <Plus size={14} className="text-green-600 dark:text-green-400" />
              </button>
              <button
                onClick={() => setShowHistory(false)}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="隐藏历史"
              >
                <ChevronLeft size={14} style={{ color: theme.textColor }} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {chatHistoryList.length === 0 ? (
              <div className="p-2 text-xs text-center" style={{ color: theme.textColor, opacity: 0.6 }}>
                暂无历史记录
              </div>
            ) : (
              <div className="space-y-1">
                {chatHistoryList.map((history, index) => {
                  const isActive = history.id === activeHistoryId;
                  return (
                  <div
                    key={history.id}
                    className={`group relative p-2 rounded cursor-pointer transition-colors ${
                      isActive 
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div onClick={() => loadSpecificHistory(history.id)}>
                      <div className="text-xs font-medium truncate pr-5" style={{ 
                        color: isActive ? theme.primaryColor : theme.textColor,
                        fontWeight: isActive ? 'bold' : 'normal'
                      }}>
                        {history.title}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: theme.textColor, opacity: 0.6 }}>
                        {new Date(history.timestamp).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteHistoryClick(e, history.id, history.title, index)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                      title="删除历史记录"
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 右侧主要内容区域 */}
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="px-2 py-1 border-b flex justify-between items-center" style={{ borderColor: theme.borderColor }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title={showHistory ? "隐藏历史" : "显示历史"}
            >
              <History size={14} style={{ color: theme.textColor }} />
            </button>
            <h3 className="text-xs font-medium" style={{ color: theme.textColor }}>AI 助手</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedModelId}
              onChange={(e) => onModelChange(e.target.value)}
              className="text-xs px-2 py-1 rounded"
              style={{ 
                borderColor: theme.borderColor, 
                backgroundColor: theme.backgroundColor, 
                color: theme.textColor 
              }}
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 聊天模式 */}
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center mt-8" style={{ color: theme.textColor, opacity: 0.6 }}>
                <Bot size={48} className="mx-auto mb-4 opacity-50" style={{ color: theme.textColor }} />
                <p className="text-sm">开始与AI助手对话</p>
                <p className="text-xs mt-1">我可以帮您生成段落、润色文本、续写故事等</p>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`group flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col gap-1 max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                          <Bot size={16} style={{ color: theme.primaryColor }} />
                        </div>
                      )}
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.textColor}15` }}>
                          <User size={16} style={{ color: theme.textColor, opacity: 0.8 }} />
                        </div>
                      )}
                      <div className={`px-4 py-2 rounded-lg ${message.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : ''
                      }`} style={{ 
                        backgroundColor: message.role === 'user' ? theme.primaryColor : `${theme.textColor}08`,
                        color: message.role === 'user' ? '#FFFFFF' : theme.textColor
                      }}>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <div className="text-xs mt-1 opacity-70" style={{ color: message.role === 'user' ? '#FFFFFF' : theme.textColor }}>
                          {formatTime(message.timestamp)}
                          {message.model && ` · ${message.model}`}
                          {message.responseTime && ` · 响应时间: ${message.responseTime < 1000 ? message.responseTime + 'ms' : (message.responseTime / 1000).toFixed(1) + 's'}`}
                        </div>
                      </div>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {message.role === 'assistant' && (
                        <>
                          <button
                            onClick={() => handleCreateChapterFromMessage(message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="创建新章节"
                          >
                            <FilePlus size={14} />
                          </button>
                          <button
                            onClick={() => handleEditMessage(message.id, message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="编辑"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleCopyMessage(message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="复制"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            style={{ color: theme.textColor }}
                            title="删除"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </>
                      )}
                      {message.role === 'user' && (
                        <>
                          <button
                            onClick={() => handleCreateChapterFromMessage(message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="创建新章节"
                          >
                            <FilePlus size={14} />
                          </button>
                          <button
                            onClick={() => handleEditMessage(message.id, message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="编辑"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleCopyMessage(message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="复制"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => handleResendMessage(message.content)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            style={{ color: theme.textColor }}
                            title="重发"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            style={{ color: theme.textColor }}
                            title="删除"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isStreaming && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.primaryColor}20` }}>
                    <Bot size={16} style={{ color: theme.primaryColor }} className="animate-pulse" />
                  </div>
                  <div className="px-4 py-2 rounded-lg" style={{ backgroundColor: `${theme.textColor}08` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.textColor, opacity: 0.5 }}></div>
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.textColor, opacity: 0.5, animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: theme.textColor, opacity: 0.5, animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
            
            {/* 输入区域 */}
            <div className="px-0.5 py-0.5 border-t" style={{ borderColor: theme.borderColor }}>
              <div className="flex flex-col gap-0.5">
                {/* 工具栏 */}
                <div className="mb-0.5">
                  <button
                    onClick={() => setShowToolbar(!showToolbar)}
                    className="w-full flex items-center justify-between px-1 py-0.5 rounded transition-colors"
                    style={{ backgroundColor: `${theme.textColor}08`, color: theme.textColor }}
                  >
                    <span className="text-xs font-medium">
                      {showToolbar ? '隐藏工具栏' : '显示工具栏'}
                    </span>
                    <svg
                      className={`w-3 h-3 transition-transform ${showToolbar ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ color: theme.textColor, opacity: 0.7 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showToolbar && (
                    <div className="mt-1">
                      <ChatToolbar 
              onToolSelect={handleToolSelect}
              onQuickPhraseSelect={handleQuickPhraseSelect}
              onSearchSubmit={handleWebSearch}
              onFileUpload={handleFileUpload}
              onWorkflowSelect={handleWorkflowExecute}
              onWorkflowStepComplete={handleWorkflowStepComplete}
              onKnowledgeBaseSelect={handleKnowledgeBaseSelect}
              onKnowledgeSelect={handleKnowledgeSelect}
              onKnowledgeEdit={handleKnowledgeEdit}
              onToolStatesChange={handleToolbarToolStateChange}
              onThoughtChainSelect={handleThoughtChainSelect}
              onNewTopic={handleNewTopic}
              onSaveChat={handleSaveChat}
              onChapterCounterToggle={handleChapterCounterToggle}
              selectedProjectId={selectedProjectId}
              currentChapterNumber={currentChapterNumber}
              onAutoSaveChapter={handleAutoSaveChapter}
              theme={{
                primaryColor: theme.primaryColor,
                backgroundColor: theme.backgroundColor,
                textColor: theme.textColor,
                borderColor: theme.borderColor
              }}
              currentProject={projectData}
              currentChapterId={selectedChapterId}
            />
                    </div>
                  )}
                </div>
                
                {/* 输入框区域 */}
                <div className="relative flex items-end gap-1">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="输入消息... (Shift+Enter 换行,Enter 发送)"
                      className="w-full px-2 py-1.5 pr-10 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-all"
                      style={{ 
                        borderColor: theme.borderColor, 
                        backgroundColor: `${theme.textColor}08`,
                        color: theme.textColor,
                        minHeight: '60px',
                        maxHeight: '160px'
                      }}
                      rows={2}
                      disabled={isLoading}
                    />
                    {/* 字符计数器 */}
                    <div className="absolute bottom-2 right-2 text-xs opacity-60" style={{ color: theme.textColor }}>
                      {inputMessage.length} 字
                    </div>
                  </div>
                  
                  {/* 发送按钮 */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="px-2 py-1.5 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-1 min-w-[60px]"
                    style={{ 
                      backgroundColor: (!inputMessage.trim() || isLoading) ? `${theme.primaryColor}50` : theme.primaryColor, 
                      color: '#FFFFFF',
                      cursor: (!inputMessage.trim() || isLoading) ? 'not-allowed' : 'pointer',
                      opacity: (!inputMessage.trim() || isLoading) ? 0.6 : 1
                    }}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        发送
                      </>
                    )}
                  </button>
                </div>
                
                {/* 输入提示和快捷操作 */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <button
                      className="text-xs px-2 py-1 rounded opacity-70 hover:opacity-100 transition-opacity"
                      style={{ color: theme.textColor, backgroundColor: `${theme.textColor}10` }}
                      onClick={() => setInputMessage(prev => prev + '\n')}
                      disabled={isLoading}
                    >
                      换行
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded opacity-70 hover:opacity-100 transition-opacity"
                      style={{ color: theme.textColor, backgroundColor: `${theme.textColor}10` }}
                      onClick={() => setInputMessage('')}
                      disabled={isLoading}
                    >
                      清空
                    </button>
                  </div>
                  <div className="text-xs opacity-60" style={{ color: theme.textColor }}>
                    {isLoading ? 'AI 正在思考中...' : '按 Enter 发送,Shift+Enter 换行'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* 删除历史记录确认对话框 */}
    <ConfirmDialog
      visible={deleteHistoryConfirmVisible}
      title="删除历史记录"
      message={`确定要删除聊天记录「${historyToDelete?.title}」吗?此操作无法撤销.`}
      onConfirm={handleConfirmDeleteHistory}
      onCancel={handleCancelDeleteHistory}
    />
    </>
  );
}
