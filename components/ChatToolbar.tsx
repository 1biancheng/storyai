/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Globe, 
  FileText, 
  MessagesSquare, 
  GitBranch, 
  Brain, 
  Lightbulb,
  ChevronRight,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Hash
} from 'lucide-react';
import QuickPhraseTool from './QuickPhraseTool';
import WebSearchTool from './WebSearchTool';
import FileUploadTool from './FileUploadTool';
import WorkflowTool from './WorkflowTool';
import KnowledgeTool from './KnowledgeTool';
import ThoughtChainTool from './ThoughtChainTool';
import ChapterCounterTool from './ChapterCounterTool';
import ReadingTool from './ReadingTool';
import EditTool from './EditTool';

// 工具栏组件的回调函数接口
interface ChatToolbarCallbacks {
  onToolSelect?: (toolId: string) => void;
  onSearchSubmit?: (query: string) => void;
  onFileUpload?: (files: FileList) => void;
  onQuickPhraseSelect?: (phrase: string) => void;
  onWorkflowSelect?: (workflow: string) => void;
  onKnowledgeBaseSelect?: (knowledgeBase: string) => void;
  onKnowledgeSelect?: (knowledge: any) => void;
  onKnowledgeEdit?: (knowledge: any) => void;
  onThoughtChainSelect?: (thoughtChain: any[]) => void;
  onNewTopic?: () => void;
  onSaveChat?: (title: string) => void;
  onChapterCounterToggle?: (enabled: boolean) => void;
  onToolStatesChange?: (toolStates: Record<string, boolean>) => void;
  selectedProjectId?: string;
  currentChapterNumber?: number;
  onAutoSaveChapter?: (chapterNumber: number, title: string, content: string) => void;
  currentProject?: {
    projectName?: string;
    projectGenre?: string;
  } | null;
  currentChapterId?: string | null;
}

// 工具栏组件的主题配置
interface ThemeConfig {
  backgroundColor?: string;
  primaryColor?: string;
  textColor?: string;
  borderColor?: string;
}

// 工具栏组件的主接口
interface ChatToolbarProps extends ChatToolbarCallbacks {
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
    borderColor?: string;
  };
  currentProject?: {
    projectName?: string;
    projectGenre?: string;
  } | null;
  currentChapterId?: string | null;
}

// 工具栏组件
export default function ChatToolbar({
  theme = {
    backgroundColor: '#1E1E1E',
    primaryColor: '#007ACC',
    textColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.05)'
  },
  onToolSelect,
  onSearchSubmit,
  onFileUpload,
  onQuickPhraseSelect,
  onWorkflowSelect,
  onKnowledgeBaseSelect,
  onKnowledgeSelect,
  onKnowledgeEdit,
  onNewTopic,
  onSaveChat,
  onChapterCounterToggle,
  onToolStatesChange,
  selectedProjectId,
  currentChapterNumber,
  onAutoSaveChapter,
  currentProject = null,
  currentChapterId = null
}: ChatToolbarProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 工具开关状态
  const [toolStates, setToolStates] = useState<Record<string, boolean>>({
    search: true,
    upload: true,
    quickphrase: true,
    workflow: false,
    knowledge: false,
    thoughtChain: false,
    chapterCounter: false,
    reading: true,
    edit: true
  });

  // 工具按钮配置
  const tools = [
    { id: 'search', name: '网络搜索', icon: Globe, description: '搜索网络信息' },
    { id: 'upload', name: '文件上传', icon: FileText, description: '上传文件或图片' },
    { id: 'quickphrase', name: '快捷短语', icon: MessagesSquare, description: '使用预设短语' },
    { id: 'workflow', name: '工作流', icon: GitBranch, description: '执行工作流' },
    { id: 'knowledge', name: '知识库', icon: Brain, description: '查询知识库' },
    { id: 'thoughtChain', name: '思维链', icon: Lightbulb, description: '使用思维链工具' },
    { id: 'chapterCounter', name: '章节计数器', icon: Hash, description: '自动创建章节并保存AI内容' },
    { id: 'reading', name: '阅读', icon: ChevronRight, description: '解析项目与章节内容' },
    { id: 'edit', name: '编辑', icon: ChevronDown, description: '生成优化建议并审批应用' }
  ];

  // 处理工具选择(search 只做开关,不弹面板)
  const handleToolSelect = (toolId: string) => {
    if (toolId === 'search') {
      toggleToolState('search') // 纯开关,无面板
      return
    }
    // 其余工具保持原逻辑 - 移除工具关闭时的阻断逻辑
    if (activeTool === toolId) {
      setActiveTool(null)
      onToolSelect?.(null)
    } else {
      setActiveTool(toolId)
      onToolSelect?.(toolId)
      // 点击工具时自动展开工具面板
      setIsExpanded(true)
    }
  }

  // 切换工具开关状态
  const toggleToolState = (toolId: string) => {
    const newToolStates = {
      ...toolStates,
      [toolId]: !toolStates[toolId]
    };
    setToolStates(newToolStates);
    
    // 通知父组件工具状态已更改
    onToolStatesChange?.(newToolStates);
    if (toolId === 'chapterCounter') {
      onChapterCounterToggle?.(newToolStates.chapterCounter);
    }
    
    // 如果关闭的是当前激活的工具,则关闭工具面板
    if (activeTool === toolId && toolStates[toolId]) {
      setActiveTool(null);
      setIsExpanded(false);
    }
  };

  // 切换工具栏折叠状态
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 处理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSubmit?.(searchQuery);
      setSearchQuery('');
    }
  };

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload?.(e.target.files);
    }
  };

  return (
    <div className="w-full border-b" style={{ borderColor: theme.borderColor, backgroundColor: theme.backgroundColor }}>
      {/* 工具栏主体 */}
      <div className="flex items-center justify-between p-1">
        {/* 工具按钮组 */}
        <div className="flex items-center gap-2 px-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isToolEnabled = toolStates[tool.id];
            const shouldShow = !isCollapsed || isToolEnabled; // 折叠状态下只显示开启的工具
            
            if (!shouldShow) return null;
            
            return (
              <div 
                key={tool.id} 
                className="relative group"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleToolState(tool.id);
                }}
              >
                <button
                  onClick={() => handleToolSelect(tool.id)}
                  className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ${
                    activeTool === tool.id ? 'bg-opacity-20 shadow-md' : 'hover:bg-opacity-10'
                  } cursor-pointer`}
                  style={{
                    backgroundColor: activeTool === tool.id ? `${theme.primaryColor}20` : 'transparent',
                    color: isToolEnabled 
                      ? (activeTool === tool.id ? theme.primaryColor : theme.textColor) 
                      : '#666666'
                  }}
                >
                  <Icon size={14} />
                </button>
                
                {/* 浮动提示 */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                  {tool.name}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
                
                {/* 工具状态指示器 */}
                <div 
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 cursor-pointer shadow-sm"
                  style={{
                    backgroundColor: isToolEnabled ? '#4CAF50' : '#F44336',
                    borderColor: theme.backgroundColor
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleToolState(tool.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleToolState(tool.id);
                  }}
                  title={`切换 ${tool.name} 状态`}
                />
              </div>
            );
          })}
        </div>

        {/* 展开/收起按钮 */}
            <div className="flex items-center gap-1">
              {/* 折叠/展开按钮 */}
              <div className="relative group">
                <button
                  onClick={toggleCollapse}
                  className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
                  style={{ color: theme.textColor }}
                >
                  {isCollapsed ? <ChevronRightIcon size={12} /> : <ChevronLeft size={12} />}
                </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
              {isCollapsed ? '展开工具栏' : '折叠工具栏'}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
          
          {/* 工具面板展开/收起按钮 */}
          <div className="relative group">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded opacity-70 hover:opacity-100 transition-opacity"
              style={{ color: theme.textColor }}
            >
              {isExpanded ? <X size={14} /> : <ChevronDown size={14} />}
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
              {isExpanded ? '收起工具面板' : '展开工具面板'}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 工具内容区域 */}
      {isExpanded && (
        <div className="p-3 border-t" style={{ borderColor: theme.borderColor }}>


          {/* 文件上传工具 */}
          {activeTool === 'upload' && (
            <FileUploadTool 
              onFileUpload={onFileUpload}
              theme={theme}
            />
          )}

          {/* 快捷短语工具 */}
          {activeTool === 'quickphrase' && (
            <QuickPhraseTool 
              onPhraseSelect={(phrase, type) => {
                onQuickPhraseSelect?.(phrase);
              }}
              theme={theme}
            />
          )}

          {/* 工作流工具 */}
          {activeTool === 'workflow' && (
            <WorkflowTool 
              onWorkflowExecute={onWorkflowSelect ? (workflowId) => {
                console.log('Workflow executed:', workflowId);
                onWorkflowSelect(workflowId);
              } : undefined}
              onWorkflowStepComplete={onWorkflowSelect ? (workflowId, stepId, result) => {
                console.log('Workflow step completed:', workflowId, stepId, result);
                // 这里可以添加处理工作流步骤完成的逻辑
              } : undefined}
              theme={theme}
            />
          )}

          {/* 知识库工具 */}
          {activeTool === 'knowledge' && (
            <KnowledgeTool
              onKnowledgeSelect={onKnowledgeSelect}
              onKnowledgeEdit={onKnowledgeEdit}
              theme={theme}
            />
          )}

          {/* 思维链工具 */}
          {activeTool === 'thoughtChain' && (
            <ThoughtChainTool
              onThoughtChainSelect={onThoughtChainSelect}
              theme={theme}
            />
          )}

          {/* 网络搜索工具 */}
          {activeTool === 'search' && toolStates.search && (
            <WebSearchTool 
              onQuerySubmit={onSearchSubmit}
              className="w-full"
              currentProject={currentProject}
              currentChapterId={currentChapterId}
            />
          )}

          {/* 章节计数器工具 */}
          {activeTool === 'chapterCounter' && (
            <ChapterCounterTool
              isEnabled={toolStates.chapterCounter}
              selectedProjectId={selectedProjectId}
              currentChapterNumber={currentChapterNumber}
              onAutoSave={onAutoSaveChapter}
            />
          )}

          {/* 阅读工具 */}
          {activeTool === 'reading' && (
            <ReadingTool
              selectedProjectId={selectedProjectId || null}
              theme={theme}
              autoRun={true}
            />
          )}

          {/* 编辑工具 */}
          {activeTool === 'edit' && (
            <EditTool
              selectedProjectId={selectedProjectId || null}
              currentChapterId={currentChapterId || null}
              theme={theme}
              isChapterCounterEnabled={toolStates.chapterCounter}
              autoRun={true}
            />
          )}
        </div>
      )}
      {toolStates.reading && (
        <div className="hidden">
          <ReadingTool selectedProjectId={selectedProjectId || null} theme={theme} autoRun={true} />
        </div>
      )}
      {toolStates.edit && (
        <div className="hidden">
          <EditTool selectedProjectId={selectedProjectId || null} currentChapterId={currentChapterId || null} theme={theme} isChapterCounterEnabled={toolStates.chapterCounter} autoRun={true} />
        </div>
      )}
    </div>
  );
}
