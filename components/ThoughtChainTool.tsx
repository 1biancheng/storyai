import React, { useState } from 'react';
import { Brain, Plus, Trash2, ArrowRight, Check, X, Edit2, Lightbulb } from 'lucide-react';

// 思维链步骤类型
interface ThoughtStep {
  id: string;
  content: string;
  type: 'premise' | 'reasoning' | 'conclusion' | 'question';
  order: number;
}

// 思维链工具组件属性
interface ThoughtChainToolProps {
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
    borderColor?: string;
  };
  onThoughtChainSelect?: (thoughtChain: ThoughtStep[]) => void;
}

// 步骤类型配置
const stepTypeConfig = {
  premise: { name: '前提', color: '#3B82F6', icon: '📍' },
  reasoning: { name: '推理', color: '#8B5CF6', icon: '🔗' },
  conclusion: { name: '结论', color: '#10B981', icon: '✅' },
  question: { name: '问题', color: '#F59E0B', icon: '❓' }
};

// 默认思维链步骤
const defaultThoughtChain: ThoughtStep[] = [
  { id: '1', content: '故事的核心主题是什么?', type: 'question', order: 0 },
  { id: '2', content: '主角的性格特点决定了故事的冲突', type: 'premise', order: 1 },
  { id: '3', content: '通过主角的内心独白展示其性格特点', type: 'reasoning', order: 2 },
  { id: '4', content: '读者能够理解主角的行为动机', type: 'conclusion', order: 3 }
];

export default function ThoughtChainTool({
  theme = {
    backgroundColor: '#1E1E1E',
    primaryColor: '#007ACC',
    textColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.05)'
  },
  onThoughtChainSelect
}: ThoughtChainToolProps) {
  const [thoughtChain, setThoughtChain] = useState<ThoughtStep[]>(defaultThoughtChain);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  // 思维链模板
  const thoughtChainTemplates = {
    storyStructure: [
      { id: 't1', content: '确定故事的核心冲突', type: 'question' as const, order: 0 },
      { id: 't2', content: '主角需要克服的内在障碍', type: 'premise' as const, order: 1 },
      { id: 't3', content: '通过情节发展展示主角的成长', type: 'reasoning' as const, order: 2 },
      { id: 't4', content: '主角最终克服障碍并解决冲突', type: 'conclusion' as const, order: 3 }
    ],
    characterDevelopment: [
      { id: 't5', content: '角色的初始状态是什么?', type: 'question' as const, order: 0 },
      { id: 't6', content: '角色有明显的性格缺陷', type: 'premise' as const, order: 1 },
      { id: 't7', content: '通过事件迫使角色面对自己的缺陷', type: 'reasoning' as const, order: 2 },
      { id: 't8', content: '角色获得成长并改变', type: 'conclusion' as const, order: 3 }
    ],
    plotTwist: [
      { id: 't9', content: '如何创造一个出人意料的情节转折?', type: 'question' as const, order: 0 },
      { id: 't10', content: '在故事前期埋下伏笔', type: 'premise' as const, order: 1 },
      { id: 't11', content: '让伏笔在关键时刻产生新的意义', type: 'reasoning' as const, order: 2 },
      { id: 't12', content: '读者回顾时会发现转折的必然性', type: 'conclusion' as const, order: 3 }
    ]
  };

  // 添加新步骤
  const addStep = (index: number) => {
    const newStep: ThoughtStep = {
      id: `step-${Date.now()}`,
      content: '新的思考步骤',
      type: 'reasoning',
      order: index
    };
    
    const newChain = [...thoughtChain];
    newChain.splice(index, 0, newStep);
    
    // 重新排序
    const reorderedChain = newChain.map((step, i) => ({
      ...step,
      order: i
    }));
    
    setThoughtChain(reorderedChain);
    setEditingStepId(newStep.id);
    setEditingContent('新的思考步骤');
  };

  // 删除步骤
  const deleteStep = (stepId: string) => {
    const newChain = thoughtChain.filter(step => step.id !== stepId);
    
    // 重新排序
    const reorderedChain = newChain.map((step, i) => ({
      ...step,
      order: i
    }));
    
    setThoughtChain(reorderedChain);
  };

  // 更新步骤内容
  const updateStepContent = (stepId: string, content: string) => {
    setThoughtChain(thoughtChain.map(step => 
      step.id === stepId ? { ...step, content } : step
    ));
  };

  // 更新步骤类型
  const updateStepType = (stepId: string, type: ThoughtStep['type']) => {
    setThoughtChain(thoughtChain.map(step => 
      step.id === stepId ? { ...step, type } : step
    ));
  };

  // 开始编辑步骤
  const startEditingStep = (stepId: string, content: string) => {
    setEditingStepId(stepId);
    setEditingContent(content);
  };

  // 保存步骤编辑
  const saveStepEdit = () => {
    if (!editingStepId.trim()) return;
    
    updateStepContent(editingStepId, editingContent);
    setEditingStepId(null);
    setEditingContent('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingStepId(null);
    setEditingContent('');
  };

  // 应用模板
  const applyTemplate = (templateName: keyof typeof thoughtChainTemplates) => {
    const template = thoughtChainTemplates[templateName];
    const newChain = template.map((step, index) => ({
      ...step,
      id: `template-${Date.now()}-${index}`,
      order: index
    }));
    setThoughtChain(newChain);
    setShowTemplates(false);
  };

  // 导出思维链
  const exportThoughtChain = () => {
    const exportChain = thoughtChain.map(step => {
      const config = stepTypeConfig[step.type];
      return `${config.icon} [${config.name}] ${step.content}`;
    }).join('\n');
    
    onThoughtChainSelect?.(thoughtChain);
    
    // 创建一个临时文本区域来复制到剪贴板
    const textarea = document.createElement('textarea');
    textarea.value = exportChain;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    // 显示成功通知
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    notification.textContent = '思维链已复制到剪贴板!';
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  return (
    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.backgroundColor }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain size={18} style={{ color: theme.primaryColor }} />
          <h3 className="text-sm font-medium" style={{ color: theme.textColor }}>
            思维链工具
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-2 py-1 text-xs rounded bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1"
          >
            <Lightbulb size={12} />
            模板
          </button>
          <button
            onClick={exportThoughtChain}
            className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            导出
          </button>
        </div>
      </div>
      
      <div className="mb-3 text-xs" style={{ color: theme.textColor, opacity: 0.7 }}>
        构建思考过程,展示逻辑推理步骤
      </div>
      
      {/* 模板选择 */}
      {showTemplates && (
        <div className="mb-3 p-2 rounded border" style={{ borderColor: theme.borderColor }}>
          <div className="text-xs font-medium mb-2" style={{ color: theme.textColor }}>
            选择思维链模板:
          </div>
          <div className="space-y-1">
            <button
              onClick={() => applyTemplate('storyStructure')}
              className="w-full text-left px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              故事结构思维链
            </button>
            <button
              onClick={() => applyTemplate('characterDevelopment')}
              className="w-full text-left px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              角色发展思维链
            </button>
            <button
              onClick={() => applyTemplate('plotTwist')}
              className="w-full text-left px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              情节转折思维链
            </button>
          </div>
        </div>
      )}
      
      {/* 思维链步骤 */}
      <div className="max-h-64 overflow-y-auto p-2 rounded border" style={{ borderColor: theme.borderColor }}>
        {thoughtChain.length === 0 ? (
          <div className="text-center py-4 text-xs" style={{ color: theme.textColor, opacity: 0.5 }}>
            暂无思维链步骤,点击下方按钮添加
          </div>
        ) : (
          <div className="space-y-2">
            {thoughtChain.map((step, index) => {
              const isEditing = step.id === editingStepId;
              const config = stepTypeConfig[step.type];
              
              return (
                <div key={step.id} className="relative">
                  {/* 连接线 */}
                  {index < thoughtChain.length - 1 && (
                    <div className="absolute left-4 top-8 w-0.5 h-6" style={{ backgroundColor: theme.borderColor }}></div>
                  )}
                  
                  <div className="flex items-start gap-2">
                    {/* 步骤类型指示器 */}
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </div>
                    
                    {/* 步骤内容 */}
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveStepEdit();
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                            className="w-full px-2 py-1 rounded bg-gray-700 text-white text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={step.type}
                              onChange={(e) => updateStepType(step.id, e.target.value as ThoughtStep['type'])}
                              className="px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:outline-none focus:border-blue-500"
                            >
                              {Object.entries(stepTypeConfig).map(([key, config]) => (
                                <option key={key} value={key}>
                                  {config.icon} {config.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={saveStepEdit}
                              className="p-1 rounded hover:bg-green-600 transition-colors"
                              style={{ color: theme.textColor }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded hover:bg-red-600 transition-colors"
                              style={{ color: theme.textColor }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="px-2 py-1 rounded bg-gray-700 text-white text-sm cursor-pointer hover:bg-gray-600 transition-colors"
                          onClick={() => startEditingStep(step.id, step.content)}
                        >
                          {step.content}
                        </div>
                      )}
                      
                      {/* 步骤类型标签 */}
                      {!isEditing && (
                        <div 
                          className="inline-block px-2 py-0.5 rounded-full text-xs mt-1"
                          style={{ backgroundColor: config.color + '40', color: config.color }}
                        >
                          {config.name}
                        </div>
                      )}
                    </div>
                    
                    {/* 操作按钮 */}
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditingStep(step.id, step.content)}
                          className="p-1 rounded hover:bg-gray-600 transition-colors"
                          style={{ color: theme.textColor }}
                          title="编辑"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => addStep(index + 1)}
                          className="p-1 rounded hover:bg-gray-600 transition-colors"
                          style={{ color: theme.textColor }}
                          title="在此处添加步骤"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => deleteStep(step.id)}
                          className="p-1 rounded hover:bg-red-600 transition-colors"
                          style={{ color: theme.textColor }}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* 添加步骤按钮 */}
        <button
          onClick={() => addStep(thoughtChain.length)}
          className="mt-3 w-full py-1 px-2 rounded border border-dashed flex items-center justify-center gap-2 text-xs transition-colors hover:bg-gray-700"
          style={{ 
            borderColor: theme.borderColor, 
            color: theme.textColor 
          }}
        >
          <Plus size={14} />
          添加思考步骤
        </button>
      </div>
    </div>
  );
}