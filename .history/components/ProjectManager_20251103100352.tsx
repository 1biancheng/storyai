/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Fix: Corrected the React import statement to properly import hooks and remove the invalid 'from' keyword.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Folder, Plus, Trash2, Edit, Upload, ChevronDown, BookOpen, BarChart2, Sparkles, Workflow as WorkflowIcon, Palette, Search, Library, MessageSquare } from 'lucide-react';
import { ProjectData, AgentWorkflow, BookAnalysisResult, Scene, FieldModel } from '../types.ts';
import * as workflowManager from '../services/workflowManager.ts';
import * as cardEditorService from '../services/cardEditorService.ts';
import ProjectEditorModal from './ProjectEditorModal.tsx';
import EmotionCurveChart from './EmotionCurveChart.tsx';
import ElementLibrary from './ElementLibrary.tsx';
import PlanningChat from './PlanningChat.tsx';


const GENRES = ['科幻', '玄幻', '修仙', '修真', '仙侠', '洪荒', '同人', '都市', '爱情', '自传', '漫综'];
const getRequirementsTemplate = (
    projectName: string,
    projectGenre: string,
    chapterCount: string,
    wordsPerChapter: string,
    totalWords: string
): string => `请按照以下字段格式填写创作要求:
项目: ${projectName || '<在此处填写项目名称>'}
小说类型: ${projectGenre || '<在此处选择小说类型>'}
章节数: ${chapterCount || '<请填写章节数量>'}
每章字数: ${wordsPerChapter || '<请填写每章字数>'}
小说总字数: ${totalWords || '<请填写小说总字数>'}
主题思想: <>
故事背景和时代: <>
情节概要: <>
章节安排: <请说明大致的章节数量和结构>
角色介绍: <请列出主要角色及其特点>
故事简介: <请简要介绍整个故事>
世界观设定: <请描述小说的世界观和规则>
角色详细信息: <请提供主要角色的详细背景和性格>`;

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="bg-white dark:bg-black/20 p-3 rounded-lg flex items-center gap-3 border border-gray-200 dark:border-white/10">
        <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{value ?? 'N/A'}</dd>
        </div>
    </div>
);

// Stats: show provider with search grounding
const ProjectStatsView: React.FC<{ project: ProjectData; workflows: AgentWorkflow[]; styleScenes: Scene[]; onViewContent: () => void; onViewPreferences: () => void; onOpenPlanningChat: () => void; onEnterWritingSpace?: () => void; }> = ({ project, workflows, styleScenes, onViewContent, onViewPreferences, onOpenPlanningChat, onEnterWritingSpace }) => {
const actualWordCount = useMemo(() => project.finalText?.split(/\s+/).filter(Boolean).length || 0, [project.finalText]);
const workflowName = useMemo(() => workflows.find(w => w.id === project.workflowId)?.name || '未知工作流', [workflows, project.workflowId]);
const styleSceneName = useMemo(() => project.styleSceneId ? styleScenes.find(s => s.id === project.styleSceneId)?.name : null, [styleScenes, project.styleSceneId]);
const providerLabel = project.searchProvider === 'bing' ? 'Bing' : project.searchProvider === 'baidu' ? '百度' : '默认';
return (
<div className="p-4 bg-gray-100 dark:bg-black/30 rounded-b-lg border-t border-gray-200 dark:border-white/5">
<div className="space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
<StatCard label="实际总字数" value={actualWordCount.toLocaleString()} icon={BarChart2} />
<StatCard label="目标章节数" value={project.chapterCount || 'N/A'} icon={BarChart2} />
<StatCard label="工作流" value={workflowName} icon={WorkflowIcon} />
{styleSceneName && <StatCard label="写作风格" value={styleSceneName} icon={Palette} />}
{project.enableThinkingMode && <StatCard label="思考模式" value="启用" icon={Sparkles} />}
<StatCard label="联网搜索" value={project.enableSearchGrounding ? `启用 (${providerLabel})` : '禁用'} icon={Search} />
</div>
{project.emotionAnalysis && project.emotionAnalysis.emotionCurve.length > 0 && (
<div className="bg-white dark:bg-[#121212] p-3 rounded-lg border border-gray-200 dark:border-white/10">
<h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-white flex items-center gap-2"><Sparkles size={16}/> 情绪分析</h4>
<EmotionCurveChart points={project.emotionAnalysis.emotionCurve} />
</div>
)}
 <div className="flex gap-2">
{onEnterWritingSpace && (
<button 
onClick={onEnterWritingSpace}
className="flex-1 flex items-center justify-center gap-2 h-9 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600 font-semibold rounded-lg transition-colors text-sm"
>
<Edit size={14} /> Enter Writing Space
</button>
)}
<button 
onClick={onViewPreferences} 
className="flex-1 flex items-center justify-center gap-2 h-9 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg:white/[.12] dark:hover:bg:white/20 dark:text-white font-semibold rounded-lg transition-colors text-sm"
>
<Library size={14} /> 元素库
</button>
<button onClick={onOpenPlanningChat} className="flex-1 flex items-center justify-center gap-2 h-9 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg:white/[.12] dark:hover:bg:white/20 dark:text-white font-semibold rounded-lg transition-colors text-sm">
<MessageSquare size={14} /> 规划对话
</button>
<button onClick={onViewContent} className="flex-1 flex items-center justify-center gap-2 h-9 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg:white/[.12] dark:hover:bg:white/20 dark:text-white font-semibold rounded-lg transition-colors text-sm">
<BookOpen size={14} /> 查看 / 编辑内容
</button>
</div>
</div>
</div>
);
};


interface ProjectManagerProps {
  onProjectSelect?: (project: ProjectData) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onProjectSelect }) => {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [projectName, setProjectName] = useState('');
    const [projectGenre, setProjectGenre] = useState(GENRES[0]);
    const [chapterCount, setChapterCount] = useState('');
    const [wordsPerChapter, setWordsPerChapter] = useState('');
    const [totalWords, setTotalWords] = useState('');
    const [projectRequirements, setProjectRequirements] = useState(getRequirementsTemplate('', GENRES[0], '', '', ''));
    const [requirementsManuallyEdited, setRequirementsManuallyEdited] = useState(false);
    const [error, setError] = useState('');
    const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflowManager.DEFAULT_WORKFLOW_ID);
    const [styleScenes, setStyleScenes] = useState<Scene[]>([]);
    const [selectedStyleSceneId, setSelectedStyleSceneId] = useState<string | null>(null);
    const [allFields, setAllFields] = useState<FieldModel[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
    
    // State for new features
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [viewingProject, setViewingProject] = useState<ProjectData | null>(null);
    const [viewingPreferencesForProject, setViewingPreferencesForProject] = useState<ProjectData | null>(null);
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; projectId: string | null }>({
      visible: false, x: 0, y: 0, projectId: null
    });
    // Fix: The type 'EmotionAnalysisResult' does not exist. It should be 'BookAnalysisResult'.
    const [emotionAnalysis, setEmotionAnalysis] = useState<BookAnalysisResult | null>(null);
    const [emotionFileName, setEmotionFileName] = useState<string | null>(null);
    const emotionFileRef = useRef<HTMLInputElement>(null);
    const [importedFile, setImportedFile] = useState<{name: string, content: string} | null>(null);
    const importTxtRef = useRef<HTMLInputElement>(null);

    // New states for thinking mode and search grounding
    const [enableThinkingMode, setEnableThinkingMode] = useState<boolean>(false);
    const [enableSearchGrounding, setEnableSearchGrounding] = useState<boolean>(false);
    const [searchProvider, setSearchProvider] = useState<'bing' | 'baidu'>('bing');
    const [viewingPlanningChatForProject, setViewingPlanningChatForProject] = useState<ProjectData | null>(null);


    useEffect(() => {
        const loadInitialData = () => {
            try {
                const savedProjects = localStorage.getItem('storyWeaverProjects');
                // FIX: Add explicit type assertion to JSON.parse to prevent 'unknown' type errors downstream.
                if (savedProjects) setProjects(JSON.parse(savedProjects) as ProjectData[]);

                setWorkflows(workflowManager.getWorkflows());
                
                const allScenes = cardEditorService.getScenes();
                const styleRoot = allScenes.find(s => s.name === '写作风格' && s.parentId === null);
                if (styleRoot) {
                    const children = allScenes.filter(s => s.parentId === styleRoot.id);
                    setStyleScenes(children);
                } else {
                    setStyleScenes([]);
                }
                
                setAllFields(cardEditorService.getFieldModels());

            } catch (e) {
                console.error("Failed to load initial data from localStorage", e);
            }
        };

        loadInitialData();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'storyWeaverWorkflows' || e.key === 'storyWeaverProjects' || e.key === 'storyWeaverScenes' || e.key === 'storyWeaverFieldModels') {
                loadInitialData();
            }
        };

        const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('click', handleClick);
        }
    }, []);
    
    useEffect(() => {
        if (!editingProjectId && !requirementsManuallyEdited) {
           setProjectRequirements(getRequirementsTemplate(projectName, projectGenre, chapterCount, wordsPerChapter, totalWords));
        }
    }, [projectName, projectGenre, chapterCount, wordsPerChapter, totalWords, editingProjectId, requirementsManuallyEdited]);

    const customFieldsToRender = useMemo(() => {
        const allCustomFields: { id: string; name: string; type: 'string' | 'number' | 'boolean' }[] = [];
        const seenNames = new Set<string>();

        allFields.forEach(model => {
            model.fields.forEach(field => {
                if (!field.isDefault && !seenNames.has(field.name)) {
                    allCustomFields.push({ id: field.id, name: field.name, type: field.type });
                    seenNames.add(field.name);
                }
            });
        });
        return allCustomFields;
    }, [allFields]);

    const resetForm = () => {
        setProjectName('');
        setProjectGenre(GENRES[0]);
        setChapterCount('');
        setWordsPerChapter('');
        setTotalWords('');
        setProjectRequirements(getRequirementsTemplate('', GENRES[0], '', '', ''));
        setSelectedWorkflowId(workflowManager.DEFAULT_WORKFLOW_ID);
        setSelectedStyleSceneId(null);
        setEditingProjectId(null);
        setError('');
        setEmotionAnalysis(null);
        setEmotionFileName(null);
        setImportedFile(null);
        setCustomFieldValues({});
        setRequirementsManuallyEdited(false);
        setEnableThinkingMode(false); // Reset new fields
        setEnableSearchGrounding(false); // Reset new fields
        if (importTxtRef.current) {
            importTxtRef.current.value = "";
        }
    };

    const handleEmotionFileLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                // Fix: The type 'EmotionAnalysisResult' does not exist. It should be 'BookAnalysisResult'.
                const importedResult: BookAnalysisResult = JSON.parse(text);
                // Fix: Added a more robust check for all expected properties in a BookAnalysisResult.
                if (importedResult.emotionCurve && importedResult.overallSentiment && importedResult.characters && importedResult.plotPoints && importedResult.worldBuilding) {
                    setEmotionAnalysis(importedResult);
                    setEmotionFileName(file.name);
                    setError('');
                } else {
                    throw new Error('情绪分析文件格式无效.');
                }
            } catch (error: any) {
                setError('加载情绪文件失败: ' + error.message);
                setEmotionAnalysis(null);
                setEmotionFileName(null);
            } finally {
                if (emotionFileRef.current) {
                    emotionFileRef.current.value = "";
                }
            }
        };
        reader.onerror = () => setError('读取情绪文件时出错.');
        reader.readAsText(file);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !file.name.toLowerCase().endsWith('.txt')) {
            setError('请选择一个 .txt 文件.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            resetForm(); // Reset form before populating
            setImportedFile({ name: file.name, content });
            setProjectName(file.name.replace(/\.[^/.]+$/, ''));
            setError('');
        };
        reader.onerror = () => {
            setError('读取文件时出错.');
            setImportedFile(null);
        };
        reader.readAsText(file);
    };

    const handleCustomFieldChange = (fieldName: string, value: any, type: 'string' | 'number' | 'boolean') => {
        let finalValue = value;
        if (type === 'number') {
            finalValue = value === '' ? '' : Number(value);
        }
        if (type === 'boolean') {
            finalValue = value as boolean;
        }
        setCustomFieldValues(prev => ({ ...prev, [fieldName]: finalValue }));
    };

    const handleSubmitProject = () => {
        if (!projectName.trim()) {
            setError('小说名称不能为空.');
            return;
        }
        setError('');
        
        const chapterNum = parseInt(chapterCount, 10);
        const wordsPerChapterNum = parseInt(wordsPerChapter, 10);
        const totalWordsNum = parseInt(totalWords, 10);

        if (editingProjectId) {
            const originalProject = projects.find(p => p.id === editingProjectId);
            if (window.confirm(`您确定要保存对项目 "${originalProject?.projectName}" 的更改吗?`)) {
                const updatedProjects = projects.map(p => {
                    if (p.id === editingProjectId) {
                        return {
                            ...p,
                            projectName: projectName.trim(),
                            projectGenre,
                            projectRequirements,
                            workflowId: selectedWorkflowId,
                            styleSceneId: selectedStyleSceneId,
                            chapterCount: isNaN(chapterNum) ? undefined : chapterNum,
                            wordsPerChapter: isNaN(wordsPerChapterNum) ? undefined : wordsPerChapterNum,
                            totalWords: isNaN(totalWordsNum) ? undefined : totalWordsNum,
                            emotionAnalysis: emotionAnalysis || undefined,
                            customFields: customFieldValues,
                            enableThinkingMode: enableThinkingMode, // Save new field
                            enableSearchGrounding: enableSearchGrounding, // Save new field
                        };
                    }
                    return p;
                });
                setProjects(updatedProjects);
                localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
                resetForm();
            }
        } else {
            // Create new project
            const newProject: ProjectData = {
                id: crypto.randomUUID(),
                projectName: projectName.trim(),
                projectGenre: projectGenre,
                projectRequirements: projectRequirements,
                workflowId: selectedWorkflowId,
                styleSceneId: selectedStyleSceneId,
                chapterCount: isNaN(chapterNum) ? undefined : chapterNum,
                wordsPerChapter: isNaN(wordsPerChapterNum) ? undefined : wordsPerChapterNum,
                totalWords: isNaN(totalWordsNum) ? undefined : totalWordsNum,
                emotionAnalysis: emotionAnalysis || undefined,
                customFields: customFieldValues,
                enableThinkingMode: enableThinkingMode, // Save new field
                enableSearchGrounding: enableSearchGrounding, // Save new field
                ...(importedFile && {
                    finalText: importedFile.content,
                    history: [{
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        content: importedFile.content
                    }]
                })
            };
            const updatedProjects = [...projects, newProject];
            setProjects(updatedProjects);
            localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
            resetForm();
        }
    };
    
    const handleDeleteProject = (projectId: string) => {
        if (window.confirm('您确定要删除此项目及其所有数据吗?此操作无法撤消.')) {
            const updatedProjects = projects.filter(p => p.id !== projectId);
            setProjects(updatedProjects);
            localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
            localStorage.removeItem(`storyWeaverLogs_${projectId}`);
            localStorage.removeItem(`storyWeaverStatus_${projectId}`);
        }
    };

    const handleContextMenu = (event: React.MouseEvent, projectId: string) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ visible: true, x: event.pageX, y: event.pageY, projectId });
    };

    const handleEditProject = () => {
        if (!contextMenu.projectId) return;
        const projectToEdit = projects.find(p => p.id === contextMenu.projectId);
        if (projectToEdit) {
            setEditingProjectId(projectToEdit.id);
            setProjectName(projectToEdit.projectName);
            setProjectGenre(projectToEdit.projectGenre);
            setChapterCount(projectToEdit.chapterCount?.toString() || '');
            setWordsPerChapter(projectToEdit.wordsPerChapter?.toString() || '');
            setTotalWords(projectToEdit.totalWords?.toString() || '');
            setProjectRequirements(projectToEdit.projectRequirements);
            setSelectedWorkflowId(projectToEdit.workflowId);
            setSelectedStyleSceneId(projectToEdit.styleSceneId || null);
            setEmotionAnalysis(projectToEdit.emotionAnalysis || null);
            setEmotionFileName(projectToEdit.emotionAnalysis ? '已加载情绪文件' : null);
            setCustomFieldValues(projectToEdit.customFields || {});
            setEnableThinkingMode(projectToEdit.enableThinkingMode || false); // Load new field
            setEnableSearchGrounding(projectToEdit.enableSearchGrounding || false); // Load new field
            setRequirementsManuallyEdited(true);
            setError('');
        }
    };
    
    const handleSaveEditedContent = (updatedText: string) => {
        if (!viewingProject) return;
        const updatedProjects = projects.map(p => 
            p.id === viewingProject.id ? { ...p, finalText: updatedText, history: [...(p.history || []), {id: crypto.randomUUID(), timestamp: new Date().toISOString(), content: updatedText }] } : p
        );
        setProjects(updatedProjects);
        localStorage.setItem('storyWeaverProjects', JSON.stringify(updatedProjects));
        setViewingProject(null);
    };


    return (
        <div className="p-6 bg-white dark:bg-[#1E1E1E] h-full overflow-y-auto text-gray-900 dark:text-[#E2E2E2] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
            <div className="flex items-center gap-3 mb-6">
                <Folder size={28} className="text-orange-400" />
                <div>
                    <h2 className="text-2xl font-bold">项目管理</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">创建和管理您的小说项目</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create/Edit Project Section */}
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 h-fit">
                   <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{editingProjectId ? '编辑项目' : importedFile ? `导入 "${importedFile.name}"` : '创建新项目'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="novel-name" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                        小说名称
                      </label>
                      <input
                        id="novel-name"
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="例如,星尘余烬"
                        className="w-full h-8 py-1 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] placeholder-gray-400 dark:placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-orange-400/50 focus:border-orange-400/50 transition-shadow text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="project-genre" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                        类型
                      </label>
                      <select
                        id="project-genre"
                        value={projectGenre}
                        onChange={(e) => setProjectGenre(e.target.value)}
                        className="w-full py-1.5 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-orange-400/50 focus:border-orange-400/50 text-sm"
                      >
                        {GENRES.map(genre => (
                          <option key={genre} value={genre}>{genre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="chapter-count" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">章节数</label>
                          <input id="chapter-count" type="number" value={chapterCount} onChange={e => setChapterCount(e.target.value)} placeholder="例如, 50"
                            className="w-full h-8 py-1 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor="words-per-chapter" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">每章字数</label>
                          <input id="words-per-chapter" type="number" value={wordsPerChapter} onChange={e => setWordsPerChapter(e.target.value)} placeholder="例如, 2000"
                           className="w-full h-8 py-1 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-lg text-sm"
                          />
                        </div>
                         <div>
                          <label htmlFor="total-words" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">总字数</label>
                          <input id="total-words" type="number" value={totalWords} onChange={e => setTotalWords(e.target.value)} placeholder="例如, 100000"
                           className="w-full h-8 py-1 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-lg text-sm"
                           />
                        </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                        情绪分析文件 (可选)
                      </label>
                      <div className="flex items-center gap-2">
                        <label htmlFor="emotion-file-input" className="flex-grow flex items-center gap-2 h-8 px-2.5 bg-gray-100 dark:bg-[#2C2C2C] border border-gray-300 dark:border-[rgba(255,255,255,0.1)] rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5">
                            <Upload size={14} className="text-gray-500"/>
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{emotionFileName || '加载 .json 文件'}</span>
                        </label>
                        <input id="emotion-file-input" type="file" accept=".json" className="hidden" onChange={handleEmotionFileLoad} ref={emotionFileRef}/>
                        {emotionAnalysis && (
                            <button onClick={() => { setEmotionAnalysis(null); setEmotionFileName(null); }} className="p-1.5 text-red-500 rounded-md hover:bg-red-100 dark:hover:bg-red-500/10" aria-label="清除情绪文件">
                                <Trash2 size={16} />
                            </button>
                        )}
                      </div>
                    </div>

                    {/* 工作流选择已迁移到创作空间(WritingSpace).此处移除以避免重复选择. */}
                    
                    <div>
                        <label htmlFor="style-scene" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                          写作风格场景 (可选)
                        </label>
                        <select
                          id="style-scene"
                          value={selectedStyleSceneId || ''}
                          onChange={(e) => setSelectedStyleSceneId(e.target.value || null)}
                          className="w-full py-1.5 pl-3 pr-8 appearance-none border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-md focus:ring-1 focus:ring-orange-400/50 focus:border-orange-400/50 text-sm"
                        >
                          <option value="">-- 无特定风格 --</option>
                          {styleScenes.map(scene => (
                            <option key={scene.id} value={scene.id}>{scene.name}</option>
                          ))}
                        </select>
                    </div>

                    {/* New: Thinking Mode and Search Grounding */}
                    <div className="space-y-2 p-3 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-lg">
                        <h4 className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">高级 AI 功能</h4>
                        <div className="flex items-center">
                            <input
                                id="enable-thinking-mode"
                                type="checkbox"
                                checked={enableThinkingMode}
                                onChange={(e) => setEnableThinkingMode(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-[#2C2C2C]"
                            />
                            <label htmlFor="enable-thinking-mode" className="ml-2 block text-sm">
                                启用思考模式 <span className="text-xs text-gray-500 dark:text-gray-400">(仅限 Gemini Pro)</span>
                            </label>
                        </div>
                        <div className="flex items-center">
                            <input
                                id="enable-search-grounding"
                                type="checkbox"
                                checked={enableSearchGrounding}
                                onChange={(e) => setEnableSearchGrounding(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-[#2C2C2C]"
                            />
                            <label htmlFor="enable-search-grounding" className="ml-2 block text-sm">
                                启用搜索增强 <span className="text-xs text-gray-500 dark:text-gray-400">(仅限 Gemini Flash)</span>
                            </label>
                        </div>
                    </div>


                    <div>
                      <label htmlFor="project-requirements" className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                        创作要求
                      </label>
                      <textarea
                        id="project-requirements"
                        value={projectRequirements}
                        onChange={(e) => {
                           setProjectRequirements(e.target.value);
                           setRequirementsManuallyEdited(true);
                        }}
                        className="w-full h-40 p-2 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] placeholder-gray-400 dark:placeholder-[#777777] rounded-lg focus:ring-1 focus:ring-orange-400/50 focus:border-orange-400/50 transition text-sm"
                      />
                    </div>
                    
                    {customFieldsToRender.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 dark:text-[#A8ABB4] mb-1">
                                自定义字段
                            </label>
                            <div className="p-3 space-y-3 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/5 rounded-lg">
                                {customFieldsToRender.map(field => (
                                    <div key={field.id}>
                                        <label htmlFor={`custom-field-${field.id}`} className="block text-xs font-medium text-gray-500 dark:text-[#A8ABB4] mb-1">{field.name}</label>
                                        {field.type === 'boolean' ? (
                                            <input
                                                id={`custom-field-${field.id}`}
                                                type="checkbox"
                                                checked={!!customFieldValues[field.name]}
                                                onChange={(e) => handleCustomFieldChange(field.name, e.target.checked, field.type)}
                                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-gray-100 dark:bg-[#2C2C2C]"
                                            />
                                        ) : (
                                            <input
                                                id={`custom-field-${field.id}`}
                                                type={field.type === 'number' ? 'number' : 'text'}
                                                value={customFieldValues[field.name] || ''}
                                                onChange={(e) => handleCustomFieldChange(field.name, e.target.value, field.type)}
                                                placeholder={`输入 ${field.name}`}
                                                className="w-full h-8 py-1 px-2.5 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#333333] text-gray-900 dark:text-[#E2E2E2] rounded-lg text-sm"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                     <button
                      onClick={handleSubmitProject}
                      className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 dark:text-orange-300 font-semibold rounded-lg transition-colors"
                    >
                      <Plus size={16} />
                      <span>{editingProjectId ? '更新项目' : importedFile ? '确认导入' : '创建项目'}</span>
                    </button>
                    {(editingProjectId || importedFile) && <button onClick={resetForm} className="w-full text-center text-xs mt-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white">取消</button>}
                    {error && <p className="text-xs text-red-400 px-1">{error}</p>}
                  </div>
                </div>

                {/* Project List Section */}
                 <div className="p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-900 dark:text-white">所有项目 ({projects.length})</h3>
                        <div>
                           <button 
                                onClick={() => importTxtRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                aria-label="从 .txt 文件导入项目"
                            >
                                <Upload size={14} />
                                导入 .txt
                            </button>
                            <input type="file" ref={importTxtRef} onChange={handleFileImport} className="hidden" accept=".txt" />
                        </div>
                    </div>
                    <div className="space-y-2 max-h-[40rem] overflow-y-auto">
                        {projects.length > 0 ? (
                            projects.map(project => {
                                const isExpanded = expandedProjectId === project.id;
                                return (
                                <div 
                                    key={project.id} 
                                    className="bg-white dark:bg-[#2C2C2C] rounded-lg border border-gray-200 dark:border-white/5 shadow-sm transition-all duration-300"
                                    onContextMenu={(e) => handleContextMenu(e, project.id)}
                                >
                                    <div 
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5"
                                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{project.projectName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{project.projectGenre}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => {e.stopPropagation(); handleDeleteProject(project.id)}} className="p-1.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors opacity-50 hover:opacity-100 focus:opacity-100">
                                                <Trash2 size={16} />
                                            </button>
                                            <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
                                        {isExpanded && (
                                            <ProjectStatsView 
                                                project={project}
                                                workflows={workflows}
                                                styleScenes={styleScenes}
                                                onViewContent={() => setViewingProject(project)}
                                                onViewPreferences={() => setViewingPreferencesForProject(project)}
                                                onOpenPlanningChat={() => setViewingPlanningChatForProject(project)}
                                                onEnterWritingSpace={() => onProjectSelect?.(project)}
                                            />
                                        )}
                                    </div>
                                </div>
                            )})
                        ) : (
                            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-4">还没有项目.请创建一个新项目.</p>
                        )}
                    </div>
                 </div>
            </div>
            {contextMenu.visible && (
                <div 
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  className="absolute z-10 w-32 bg-white dark:bg-[#333333] rounded-md shadow-lg border border-gray-200 dark:border-white/10 text-sm"
                >
                    <button onClick={handleEditProject} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-white/10">
                        <Edit size={14} />
                        编辑
                    </button>
                </div>
            )}
            <ProjectEditorModal
                isOpen={!!viewingProject}
                onClose={() => setViewingProject(null)}
                project={viewingProject}
                onSave={handleSaveEditedContent}
            />
            {viewingPreferencesForProject && (
                <ElementLibrary
                    isOpen={!!viewingPreferencesForProject}
                    onClose={() => setViewingPreferencesForProject(null)}
                    project={viewingPreferencesForProject}
                />
            )}
            {viewingPlanningChatForProject && (
                <PlanningChat
                    isOpen={!!viewingPlanningChatForProject}
                    onClose={() => setViewingPlanningChatForProject(null)}
                    project={viewingPlanningChatForProject}
                />
            )}
        </div>
    );
};

export default ProjectManager;