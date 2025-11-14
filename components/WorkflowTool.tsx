import React, { useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, Clock, AlertCircle, ChevronRight, ChevronDown, FileText, Users, BookOpen, Edit3 } from 'lucide-react';

// 工作流步骤接口
interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
  duration?: number;
}

// 工作流接口
interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  steps: WorkflowStep[];
}

interface WorkflowToolProps {
  onWorkflowExecute?: (workflowId: string, params?: any) => void;
  onWorkflowStepComplete?: (workflowId: string, stepId: string, result: string) => void;
  className?: string;
}

// 预定义工作流
const predefinedWorkflows: Workflow[] = [
  {
    id: 'character-creation',
    name: '角色创建流程',
    description: '从零开始创建完整的角色档案',
    icon: <Users className="w-5 h-5" />,
    category: '角色开发',
    steps: [
      { id: 'basic-info', name: '基础信息设定', description: '设定角色姓名、年龄、性别等基本信息', status: 'pending' },
      { id: 'appearance', name: '外貌描述', description: '详细描述角色的外貌特征', status: 'pending' },
      { id: 'personality', name: '性格特质', description: '定义角色的性格特点和行为模式', status: 'pending' },
      { id: 'background', name: '背景故事', description: '创建角色的成长背景和经历', status: 'pending' },
      { id: 'relationships', name: '人际关系', description: '设定角色与其他角色的关系', status: 'pending' },
      { id: 'character-sheet', name: '生成角色档案', description: '整合所有信息生成完整角色档案', status: 'pending' }
    ]
  },
  {
    id: 'plot-development',
    name: '情节构思流程',
    description: '从创意到完整情节大纲',
    icon: <BookOpen className="w-5 h-5" />,
    category: '情节开发',
    steps: [
      { id: 'core-idea', name: '核心创意', description: '确定故事的核心创意和主题', status: 'pending' },
      { id: 'story-structure', name: '故事结构', description: '设计故事的整体结构框架', status: 'pending' },
      { id: 'main-conflict', name: '主要冲突', description: '设定故事的主要矛盾和冲突', status: 'pending' },
      { id: 'plot-points', name: '关键情节点', description: '规划故事的关键转折点', status: 'pending' },
      { id: 'subplot', name: '支线情节', description: '设计故事的支线和次要情节', status: 'pending' },
      { id: 'plot-outline', name: '生成情节大纲', description: '整合所有元素生成完整情节大纲', status: 'pending' }
    ]
  },
  {
    id: 'chapter-writing',
    name: '章节写作流程',
    description: '从大纲到成文的完整流程',
    icon: <FileText className="w-5 h-5" />,
    category: '写作流程',
    steps: [
      { id: 'chapter-outline', name: '章节大纲', description: '制定本章节的内容大纲', status: 'pending' },
      { id: 'opening', name: '开篇设计', description: '设计吸引人的章节开头', status: 'pending' },
      { id: 'content-development', name: '内容展开', description: '展开章节的主要内容', status: 'pending' },
      { id: 'dialogue', name: '对话创作', description: '创作章节中的对话部分', status: 'pending' },
      { id: 'climax', name: '高潮设计', description: '设计章节的高潮部分', status: 'pending' },
      { id: 'ending', name: '结尾设计', description: '设计章节的结尾部分', status: 'pending' },
      { id: 'review-polish', name: '审校润色', description: '审校并润色章节内容', status: 'pending' }
    ]
  },
  {
    id: 'content-review',
    name: '内容审校流程',
    description: '从初稿到终稿的审校步骤',
    icon: <Edit3 className="w-5 h-5" />,
    category: '编辑流程',
    steps: [
      { id: 'initial-review', name: '初步审阅', description: '对内容进行初步审阅', status: 'pending' },
      { id: 'structure-check', name: '结构检查', description: '检查内容的结构和逻辑', status: 'pending' },
      { id: 'fact-check', name: '事实核查', description: '核查内容中的事实信息', status: 'pending' },
      { id: 'language-polish', name: '语言润色', description: '润色语言表达和文字', status: 'pending' },
      { id: 'final-review', name: '最终审阅', description: '进行最终的全面审阅', status: 'pending' }
    ]
  }
];

const WorkflowTool: React.FC<WorkflowToolProps> = ({
  onWorkflowExecute,
  onWorkflowStepComplete,
  className = ''
}) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [runningWorkflows, setRunningWorkflows] = useState<Record<string, boolean>>({});
  const [workflowSteps, setWorkflowSteps] = useState<Record<string, WorkflowStep[]>>({});

  // 按类别分组工作流
  const workflowsByCategory = predefinedWorkflows.reduce((acc, workflow) => {
    if (!acc[workflow.category]) {
      acc[workflow.category] = [];
    }
    acc[workflow.category].push(workflow);
    return acc;
  }, {} as Record<string, Workflow[]>);

  // 切换类别展开状态
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // 选择工作流
  const selectWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    // 初始化工作流步骤状态
    if (!workflowSteps[workflow.id]) {
      setWorkflowSteps(prev => ({
        ...prev,
        [workflow.id]: [...workflow.steps]
      }));
    }
  };

  // 执行工作流
  const executeWorkflow = (workflow: Workflow) => {
    setRunningWorkflows(prev => ({
      ...prev,
      [workflow.id]: true
    }));

    // 模拟执行工作流步骤
    const steps = workflowSteps[workflow.id] || workflow.steps;
    let currentStepIndex = 0;

    const executeNextStep = () => {
      if (currentStepIndex >= steps.length) {
        // 工作流完成
        setRunningWorkflows(prev => ({
          ...prev,
          [workflow.id]: false
        }));
        return;
      }

      const stepId = steps[currentStepIndex].id;
      
      // 更新当前步骤状态为运行中
      setWorkflowSteps(prev => ({
        ...prev,
        [workflow.id]: prev[workflow.id].map((step, index) => 
          index === currentStepIndex 
            ? { ...step, status: 'running' as const }
            : step
        )
      }));

      // 模拟步骤执行时间
      setTimeout(() => {
        const stepResult = `步骤 "${steps[currentStepIndex].name}" 执行完成`;
        
        // 更新步骤状态为完成
        setWorkflowSteps(prev => ({
          ...prev,
          [workflow.id]: prev[workflow.id].map((step, index) => 
            index === currentStepIndex 
              ? { 
                  ...step, 
                  status: 'completed' as const, 
                  result: stepResult,
                  duration: Math.floor(Math.random() * 3000) + 1000
                }
              : step
          )
        }));

        // 通知父组件步骤完成
        if (onWorkflowStepComplete) {
          onWorkflowStepComplete(workflow.id, stepId, stepResult);
        }

        // 执行下一步
        currentStepIndex++;
        setTimeout(executeNextStep, 500);
      }, Math.floor(Math.random() * 2000) + 1000);
    };

    executeNextStep();

    // 通知父组件工作流开始执行
    if (onWorkflowExecute) {
      onWorkflowExecute(workflow.id);
    }
  };

  // 停止工作流
  const stopWorkflow = (workflowId: string) => {
    setRunningWorkflows(prev => ({
      ...prev,
      [workflowId]: false
    }));
  };

  // 重置工作流
  const resetWorkflow = (workflowId: string) => {
    const workflow = predefinedWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      setWorkflowSteps(prev => ({
        ...prev,
        [workflowId]: [...workflow.steps]
      }));
    }
    setRunningWorkflows(prev => ({
      ...prev,
      [workflowId]: false
    }));
  };

  // 获取步骤状态图标
  const getStepStatusIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'running':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
          <Play className="w-4 h-4 mr-2" />
          工作流工具
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          选择预设工作流,提高创作效率
        </p>
      </div>
      
      <div className="p-4">
        {!selectedWorkflow ? (
          // 工作流列表
          <div className="space-y-3">
            {Object.entries(workflowsByCategory).map(([category, workflows]) => (
              <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 flex items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {category}
                  </span>
                  {expandedCategories[category] ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                
                {expandedCategories[category] && (
                  <div className="p-2 space-y-2">
                    {workflows.map(workflow => (
                      <button
                        key={workflow.id}
                        onClick={() => selectWorkflow(workflow)}
                        className="w-full text-left p-3 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start">
                          <div className="mr-3 mt-0.5">
                            {workflow.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {workflow.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {workflow.description}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {workflow.steps.length} 个步骤
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // 工作流详情
          <div className="space-y-4">
            {/* 工作流头部 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => setSelectedWorkflow(null)}
                  className="mr-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
                </button>
                <div className="mr-3">
                  {selectedWorkflow.icon}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedWorkflow.name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedWorkflow.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {!runningWorkflows[selectedWorkflow.id] ? (
                  <button
                    onClick={() => executeWorkflow(selectedWorkflow)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    执行
                  </button>
                ) : (
                  <button
                    onClick={() => stopWorkflow(selectedWorkflow.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    停止
                  </button>
                )}
                
                <button
                  onClick={() => resetWorkflow(selectedWorkflow.id)}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重置
                </button>
              </div>
            </div>
            
            {/* 工作流步骤 */}
            <div className="space-y-2">
              {(workflowSteps[selectedWorkflow.id] || selectedWorkflow.steps).map((step, index) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-md border ${
                    step.status === 'running' 
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
                      : step.status === 'completed'
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                      : step.status === 'error'
                      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="mr-3 mt-0.5">
                      {getStepStatusIcon(step.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {index + 1}. {step.name}
                        </div>
                        {step.duration && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {step.duration}ms
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {step.description}
                      </div>
                      {step.result && (
                        <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300">
                          {step.result}
                        </div>
                      )}
                      {step.error && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300">
                          {step.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowTool;