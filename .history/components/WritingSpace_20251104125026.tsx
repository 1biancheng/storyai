/**
 * Merged Writing Space - Combines functionality from WritingSpace and WritingSpaceV2
 * Left: Project/Chapter Navigator
 * Center: Chapter Editor
 * Right: Workflow & AI Integration
 */

import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, ChevronDown, Trash2, PlayCircle, Square, RotateCcw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import ChapterNavigator from './ChapterNavigator';
import ChapterEditor from './ChapterEditor';
import InlineAIChatPanel from './InlineAIChatPanel';
import { ProjectData, WritingProcessStatus, AgentWorkflow, StoryContentType, AgentRole, WorkflowNode } from '../types';
import * as workflowManager from '../services/workflowManager';
import { apiClient } from '../services/apiClient';
import { runAgent } from '../services/agentService';

const WritingSpace: React.FC = () => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectGenre, setNewProjectGenre] = useState('科幻');
  const [newProjectRequirements, setNewProjectRequirements] = useState('');
  
  // Workflow execution state
  const [isWriting, setIsWriting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<WritingProcessStatus | null>(null);
  const [logs, setLogs] = useState<Array<{ timestamp: number; message: string; type: 'info' | 'error' | 'success' }>>([]);

  // Load projects and workflows on mount
  useEffect(() => {
    const loadProjects = () => {
      const savedProjects = localStorage.getItem('storyWeaverProjects');
      setProjects(savedProjects ? JSON.parse(savedProjects) : []);
    };

    const loadWorkflows = () => {
      try {
        setWorkflows(workflowManager.getWorkflows());
      } catch (e) {
        console.error('Failed to load workflows:', e);
      }
    };

    loadProjects();
    loadWorkflows();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'storyWeaverProjects') loadProjects();
      if (e.key === 'storyWeaverWorkflows') loadWorkflows();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load status and logs when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setCurrentStatus(null);
      setLogs([]);
      return;
    }

    const loadStatus = () => {
      const savedStatus = localStorage.getItem(`storyWeaverStatus_${selectedProjectId}`);
      setCurrentStatus(savedStatus ? JSON.parse(savedStatus) : null);
    };

    const loadLogs = () => {
      const savedLogs = localStorage.getItem(`storyWeaverLogs_${selectedProjectId}`);
      setLogs(savedLogs ? JSON.parse(savedLogs) : []);
    };

    loadStatus();
    loadLogs();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `storyWeaverStatus_${selectedProjectId}`) loadStatus();
      if (e.key === `storyWeaverLogs_${selectedProjectId}`) loadLogs();
    };
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [selectedProjectId]);

  const saveProjects = (updatedProjects: ProjectData[]) => {
    setProjects(updatedProjects);
    localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }

    const newProject: ProjectData = {
      id: crypto.randomUUID(),
      projectName: newProjectName.trim(),
      projectGenre: newProjectGenre,
      projectRequirements: newProjectRequirements,
      workflowId: 'default-workflow',
    };
    const updatedProjects = [...projects, newProject];
    saveProjects(updatedProjects);
    setSelectedProjectId(newProject.id);
    setShowCreateProject(false);
    setNewProjectName('');
    setNewProjectGenre('科幻');
    setNewProjectRequirements('');
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('确定要删除此项目吗?此操作无法撤销.')) {
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      saveProjects(updatedProjects);

      if (selectedProjectId === projectId) {
        setSelectedProjectId(updatedProjects.length > 0 ? updatedProjects[0].id : null);
      }

      localStorage.removeItem(`storyWeaverLogs_${projectId}`);
      localStorage.removeItem(`storyWeaverStatus_${projectId}`);
    }
  };

  const handleChangeWorkflowForActiveProject = (projectId: string, newWorkflowId: string) => {
    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, workflowId: newWorkflowId } : p
    );
    saveProjects(updatedProjects);
  };

  // Workflow execution functions
  const startWritingProcess = async () => {
    if (!selectedProjectId) return;
    
    const activeProject = projects.find(p => p.id === selectedProjectId);
    if (!activeProject) return;

    try {
      setIsWriting(true);
      addLog('info', '开始写作流程...');
      
      const workflow = workflows.find(w => w.id === activeProject.workflowId);
      if (!workflow) {
        throw new Error(`找不到工作流: ${activeProject.workflowId}`);
      }

      // Initialize status
      setCurrentStatus(WritingProcessStatus.ANALYZING_REQUIREMENTS);
      localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(WritingProcessStatus.ANALYZING_REQUIREMENTS));
      
      // Execute workflow
      await executeWorkflow(workflow, activeProject);
      
    } catch (error) {
      console.error('写作流程执行失败:', error);
      addLog('error', `写作流程执行失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // Update status to failed
      setCurrentStatus(WritingProcessStatus.ERROR);
      localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(WritingProcessStatus.ERROR));
    } finally {
      setIsWriting(false);
    }
  };

  const executeWorkflow = async (workflow: AgentWorkflow, project: ProjectData) => {
    if (!selectedProjectId) return;
    
    addLog('info', `开始执行工作流: ${workflow.name}`);
    
    // Sort nodes by dependencies (topological sort)
    const sortedNodes = topologicalSort(workflow.nodes);
    
    for (const node of sortedNodes) {
      if (!currentStatus || !currentStatus.isRunning) break;
      
      try {
        addLog('info', `执行节点: ${node.name}`);
        
        // Update status
        setCurrentStatus(WritingProcessStatus.GENERATING_OUTLINE);
        localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(WritingProcessStatus.GENERATING_OUTLINE));
        
        // Execute node based on type
        await executeNode(node, project);
        
        // Mark as completed
        updatedStatus.completedSteps.push(node.id);
        setCurrentStatus(updatedStatus);
        localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(updatedStatus));
        
        addLog('success', `完成节点: ${node.name}`);
        
      } catch (error) {
        addLog('error', `节点执行失败: ${node.name} - ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
    
    // Complete workflow
    if (currentStatus && currentStatus.isRunning) {
      setCurrentStatus(WritingProcessStatus.COMPLETE);
      localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(WritingProcessStatus.COMPLETE));
      
      addLog('success', '写作流程已完成!');
    }
  };

  const executeNode = async (node: WorkflowNode, project: ProjectData) => {
    if (!selectedProjectId) return;
    
    switch (node.type) {
      case 'AGENT':
        await executeAgentNode(node, project);
        break;
      case 'SUMMARY':
        await executeSummaryNode(node, project);
        break;
      case 'CONDITION':
        await executeConditionNode(node, project);
        break;
      default:
        throw new Error(`未知节点类型: ${node.type}`);
    }
  };

  const executeAgentNode = async (node: WorkflowNode, project: ProjectData) => {
    if (!selectedProjectId) return;
    
    const agentConfig = node.data?.agent;
    if (!agentConfig) {
      throw new Error('代理节点缺少配置');
    }
    
    // Build prompt based on agent role
    let prompt = '';
    
    switch (agentConfig.role) {
      case AgentRole.PLANNER:
        prompt = `作为小说策划师,请为以下项目创建大纲:\n项目名称: ${project.projectName}\n类型: ${project.projectGenre}\n需求: ${project.projectRequirements}`;
        break;
      case AgentRole.WRITER:
        prompt = `作为小说作家,请根据以下信息创作内容:\n项目名称: ${project.projectName}\n类型: ${project.projectGenre}`;
        break;
      case AgentRole.CRITIC:
        prompt = `作为文学评论家,请评估以下内容并提供改进建议:\n项目名称: ${project.projectName}`;
        break;
      default:
        prompt = `请处理以下项目:\n项目名称: ${project.projectName}\n类型: ${project.projectGenre}`;
    }
    
    // Add context from previous steps
    if (currentStatus && currentStatus.completedSteps.length > 0) {
      prompt += '\n\n已完成步骤:';
      for (const stepId of currentStatus.completedSteps) {
        const step = workflows.find(w => w.id === currentStatus.workflowId)?.nodes.find(n => n.id === stepId);
        if (step) {
          prompt += `\n- ${step.name}`;
        }
      }
    }
    
    // Call AI service
    const response = await runAgent(prompt);
    
    // Store result
    const result = {
      nodeId: node.id,
      result: response.text,
      timestamp: Date.now()
    };
    
    // Save to project data
    const projectDataKey = `storyWeaverProjectData_${selectedProjectId}`;
    const existingData = localStorage.getItem(projectDataKey);
    const projectData = existingData ? JSON.parse(existingData) : {};
    
    if (!projectData.nodeResults) projectData.nodeResults = {};
    projectData.nodeResults[node.id] = result;
    
    localStorage.setItem(projectDataKey, JSON.stringify(projectData));
    
    addLog('info', `代理节点 ${node.name} 已完成,结果已保存`);
  };

  const executeSummaryNode = async (node: WorkflowNode, project: ProjectData) => {
    if (!selectedProjectId) return;
    
    // Get previous results
    const projectDataKey = `storyWeaverProjectData_${selectedProjectId}`;
    const existingData = localStorage.getItem(projectDataKey);
    const projectData = existingData ? JSON.parse(existingData) : {};
    
    if (!projectData.nodeResults || Object.keys(projectData.nodeResults).length === 0) {
      throw new Error('没有可总结的内容');
    }
    
    // Build summary prompt
    let prompt = `请总结以下内容:\n`;
    
    for (const [nodeId, result] of Object.entries(projectData.nodeResults)) {
      const step = workflows.find(w => w.id === currentStatus?.workflowId)?.nodes.find(n => n.id === nodeId);
      if (step) {
        prompt += `\n## ${step.name}\n${(result as any).result}\n`;
      }
    }
    
    // Call AI service
    const response = await runAgent(prompt);
    
    // Store result
    const result = {
      nodeId: node.id,
      result: response.text,
      timestamp: Date.now()
    };
    
    projectData.nodeResults[node.id] = result;
    localStorage.setItem(projectDataKey, JSON.stringify(projectData));
    
    addLog('info', `摘要节点 ${node.name} 已完成,结果已保存`);
  };

  const executeConditionNode = async (node: WorkflowNode, project: ProjectData) => {
    if (!selectedProjectId) return;
    
    const conditionConfig = node.data?.condition;
    if (!conditionConfig) {
      throw new Error('条件节点缺少配置');
    }
    
    // Get previous results
    const projectDataKey = `storyWeaverProjectData_${selectedProjectId}`;
    const existingData = localStorage.getItem(projectDataKey);
    const projectData = existingData ? JSON.parse(existingData) : {};
    
    // Evaluate condition (simplified)
    let conditionMet = false;
    
    if (conditionConfig.type === 'wordCount') {
      // Count total words in all previous results
      let totalWords = 0;
      if (projectData.nodeResults) {
        for (const result of Object.values(projectData.nodeResults)) {
          totalWords += (result as any).result.split(/\s+/).length;
        }
      }
      conditionMet = totalWords >= (conditionConfig.threshold || 1000);
    } else if (conditionConfig.type === 'custom') {
      // For custom conditions, we'll use a simple keyword check
      let allText = '';
      if (projectData.nodeResults) {
        for (const result of Object.values(projectData.nodeResults)) {
          allText += (result as any).result + ' ';
        }
      }
      conditionMet = allText.includes(conditionConfig.keyword || '');
    }
    
    // Store result
    const result = {
      nodeId: node.id,
      result: conditionMet ? '条件满足' : '条件不满足',
      conditionMet,
      timestamp: Date.now()
    };
    
    projectData.nodeResults[node.id] = result;
    localStorage.setItem(projectDataKey, JSON.stringify(projectData));
    
    addLog('info', `条件节点 ${node.name} 已完成,结果: ${result.result}`);
  };

  const topologicalSort = (nodes: WorkflowNode[]): WorkflowNode[] => {
    const sorted: WorkflowNode[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error('检测到循环依赖');
      }
      
      if (visited.has(nodeId)) return;
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      visiting.add(nodeId);
      
      // Visit dependencies first
      if (node.dependencies) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }
      
      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(node);
    };
    
    // Visit all nodes
    for (const node of nodes) {
      visit(node.id);
    }
    
    return sorted;
  };

  const stopWritingProcess = () => {
    if (!selectedProjectId || !currentStatus) return;
    
    setCurrentStatus(WritingProcessStatus.IDLE);
    localStorage.setItem(`storyWeaverStatus_${selectedProjectId}`, JSON.stringify(WritingProcessStatus.IDLE));
    
    setIsWriting(false);
    addLog('info', '写作流程已停止');
  };

  const resetWritingProcess = () => {
    if (!selectedProjectId) return;
    
    setCurrentStatus(null);
    setLogs([]);
    localStorage.removeItem(`storyWeaverStatus_${selectedProjectId}`);
    localStorage.removeItem(`storyWeaverLogs_${selectedProjectId}`);
    
    addLog('info', '写作流程已重置');
  };

  const addLog = (type: 'info' | 'error' | 'success', message: string) => {
    const newLog = {
      timestamp: Date.now(),
      type,
      message
    };
    
    const updatedLogs = [...logs, newLog];
    setLogs(updatedLogs);
    localStorage.setItem(`storyWeaverLogs_${selectedProjectId}`, JSON.stringify(updatedLogs));
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusIcon = () => {
    if (!currentStatus) return null;
    
    if (!currentStatus.isRunning) {
      if (currentStatus.error) return <AlertCircle className="w-5 h-5 text-red-500" />;
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  const getStatusText = () => {
    if (!currentStatus) return '未开始';
    
    if (!currentStatus.isRunning) {
      if (currentStatus.error) return '执行失败';
      return '已完成';
    }
    
    const currentStep = workflows.find(w => w.id === currentStatus.workflowId)?.nodes.find(n => n.id === currentStatus.currentStep);
    return currentStep ? `执行中: ${currentStep.name}` : '准备中...';
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="grid grid-cols-[280px_1fr_360px] h-full">
      {/* Left Sidebar - Project/Chapter Navigator */}
      <aside className="border-r bg-white flex flex-col">
        <header className="border-b p-3">
          <button
            onClick={() => setShowProjectManager(!showProjectManager)}
            className="w-full flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-100 rounded-lg"
          >
            <span>{activeProject?.projectName || '选择项目'}</span>
            <ChevronDown className={`transform ${showProjectManager ? 'rotate-180' : ''}`} />
          </button>
        </header>

        {showProjectManager && (
          <div className="p-3 border-b">
            <button
              onClick={() => setShowCreateProject(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              创建新项目
            </button>
            
            <div className="mt-3">
              <h3 className="text-sm font-medium text-gray-700 mb-2">项目列表</h3>
              <ul className="space-y-1">
                {projects.map((proj) => (
                  <li
                    key={proj.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                      selectedProjectId === proj.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      onClick={() => setSelectedProjectId(proj.id)}
                      className="flex-1 truncate"
                    >
                      {proj.projectName}
                    </span>
                    <button
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {showCreateProject && (
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-lg font-medium mb-3">创建新项目</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="输入项目名称"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目类型</label>
                <select
                  value={newProjectGenre}
                  onChange={(e) => setNewProjectGenre(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="科幻">科幻</option>
                  <option value="玄幻">玄幻</option>
                  <option value="都市">都市</option>
                  <option value="言情">言情</option>
                  <option value="悬疑">悬疑</option>
                  <option value="历史">历史</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">项目需求</label>
                <textarea
                  value={newProjectRequirements}
                  onChange={(e) => setNewProjectRequirements(e.target.value)}
                  placeholder="描述项目需求、目标读者、风格等"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowCreateProject(false);
                    setNewProjectName('');
                    setNewProjectGenre('科幻');
                    setNewProjectRequirements('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {activeProject && <ChapterNavigator projectId={activeProject.id} />}
      </aside>

      {/* Center - Chapter Editor */}
      <main>
        {activeProject && <ChapterEditor projectId={activeProject.id} />}
      </main>

      {/* Right Sidebar - Workflow selection and AI panel */}
      <aside className="border-l bg-white flex flex-col">
        {activeProject && (
          <>
            {/* Workflow selection and controls */}
            <div className="p-4 border-b">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">选择工作流</label>
                <select
                  value={activeProject.workflowId}
                  onChange={(e) => handleChangeWorkflowForActiveProject(activeProject.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status display */}
              {currentStatus && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded">
                  {getStatusIcon()}
                  <span className="text-sm">{getStatusText()}</span>
                  {currentStatus.progress > 0 && (
                    <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${currentStatus.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Control buttons */}
              <div className="flex gap-2">
                {!isWriting ? (
                  <button
                    onClick={startWritingProcess}
                    disabled={!selectedProjectId}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    <PlayCircle className="w-4 h-4" />
                    开始写作
                  </button>
                ) : (
                  <button
                    onClick={stopWritingProcess}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Square className="w-4 h-4" />
                    停止
                  </button>
                )}
                
                <button
                  onClick={resetWritingProcess}
                  disabled={!selectedProjectId || isWriting}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
              </div>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b">
                <h3 className="text-sm font-medium text-gray-700">执行日志</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-sm text-gray-500">暂无日志</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-gray-500">{formatTimestamp(log.timestamp)}</span>
                      <span
                        className={`ml-2 ${
                          log.type === 'error' ? 'text-red-600' : log.type === 'success' ? 'text-green-600' : 'text-gray-700'
                        }`}
                      >
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Chat Panel */}
            <InlineAIChatPanel project={activeProject} />
          </>
        )}
      </aside>
    </div>
  );
};

export default WritingSpace;