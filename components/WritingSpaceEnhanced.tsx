import React, { useState, useEffect, useRef } from 'react';
import AIChatPanel from './AIChatPanel';
import ChapterEditor from './ChapterEditor';
import ChapterNavigator from './ChapterNavigator';
import type { ProjectData } from '../types';
import { useChapterStore } from '../stores/chapterStore';
import { getModelConfigs, getDefaultModelConfig } from '../sample_data/services/modelManager';
import type { ModelConfig } from '../types';
import { workspaceService } from '../sample_data/services/workspaceService';
import { syncProject } from '../sample_data/services/projectApi';
import { FolderOpen } from 'lucide-react';

// 章节类型 - 与types.ts一致
interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  content: string; // 必填
  wordCount: number;
  summary?: string;
  tags?: string[];
  notes?: string;
  displayOrder?: number;
  createdAt: number;
  updatedAt: number;
}

// AI模型类型
interface AIModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  isDefault?: boolean;
}

// 聊天消息类型
interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isError?: boolean;
  groundingChunks?: any[];
}

// 项目章节数量统计
type ProjectChapterCounts = Record<string, number>;

const WritingSpaceEnhanced: React.FC<{ project?: ProjectData }> = ({ project }) => {
  // 项目数据 - 通过接口获取
  const [projects, setProjects] = useState<ProjectData[]>([]);
  // 章节数据 - 通过接口获取
  const { chapters, fetchChapters, setChapters, createChapter, addChapter } = useChapterStore();
  // AI模型列表 - 通过接口获取
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  // 当前选中的项目ID
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // 当前选中的章节ID
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  // 当前选中的AI模型
  const [selectedModel, setSelectedModel] = useState<string>('');
  // 字体大小
  const [fontSize, setFontSize] = useState<number>(14);
  // 深色主题
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);
  // 加载状态
  const [loading, setLoading] = useState<boolean>(true);
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [chapterLoading, setChapterLoading] = useState<boolean>(false);
  // 项目章节数量统计
  const [projectChapterCounts, setProjectChapterCounts] = useState<ProjectChapterCounts>({});
  // 章节标题编辑
  const [editingChapterTitle, setEditingChapterTitle] = useState<string>('');
  // 工具栏状态 - 使用ChatToolbar组件,移除本地工具栏实现

  // 获取项目的章节数量 - 从后端API获取
  const fetchProjectChapterCounts = async (projectList: ProjectData[]) => {
    const counts: Record<string, number> = {};
    
    // 并发获取所有项目的章节数量
    const promises = projectList.map(async (project) => {
      try {
        // 直接调用后端API获取章节列表
        const resp = await fetch(`http://127.0.0.1:8000/api/v1/chapters/project/${project.id}`);
        if (resp.ok) {
          const projectChapters = await resp.json();
          counts[project.id] = Array.isArray(projectChapters) ? projectChapters.length : 0;
        } else {
          counts[project.id] = 0;
        }
      } catch (error) {
        console.error(`获取项目 ${project.id} 的章节数量失败:`, error);
        counts[project.id] = 0;
      }
    });
    
    await Promise.all(promises);
    setProjectChapterCounts(counts);
  };





  // 获取当前章节标题
  const getCurrentChapterTitle = () => {
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    return currentChapter?.title || '未选择章节';
  };

  // 获取当前章节内容
  const getCurrentChapterContent = () => {
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    return currentChapter?.content || '';
  };

  // 处理章节标题更新
  const handleChapterTitleUpdate = (newTitle: string) => {
    if (!selectedChapterId || !newTitle.trim()) return;
    
    const updatedChapters = chapters.map(ch => 
      ch.id === selectedChapterId 
        ? { ...ch, title: newTitle.trim() }
        : ch
    );
    setChapters(updatedChapters);
  };

  // 获取项目的下一个章节号(自动刷新最新数据)
  const getNextChapterNumber = async (projectId: string): Promise<number> => {
    try {
      // 直接从后端API获取章节列表,而不是从workspace文件系统
      await fetchChapters(projectId);
      const currentProjectChapters = chapters.filter(ch => ch.projectId === projectId);
      return currentProjectChapters.length > 0 
        ? Math.max(...currentProjectChapters.map(ch => ch.chapterNumber)) + 1 
        : 1;
    } catch (error) {
      console.error('获取章节号失败:', error);
      throw error;
    }
  };

  // 刷新章节列表
  const reloadChapters = async (projectId: string): Promise<void> => {
    try {
      // 使用后端API刷新章节列表
      await fetchChapters(projectId);
    } catch (error) {
      console.error('刷新章节列表失败:', error);
      throw error;
    }
  };

  // 处理创建章节 - 使用后端API(封装了刷新逻辑)
  const handleCreateChapter = async () => {
    if (!selectedProjectId) return;
    
    try {
      // 获取下一个章节号(自动刷新最新数据)
      const nextChapterNumber = await getNextChapterNumber(selectedProjectId);
      
      // 调用后端API创建章节
      const newChapter = await createChapter({
        projectId: selectedProjectId,
        chapterNumber: nextChapterNumber,
        title: `第${nextChapterNumber}章: 新章节`,
        content: '' // 必填字段
      });
      
      if (newChapter) {
        // 创建成功后刷新章节列表
        await reloadChapters(selectedProjectId);
        
        setSelectedChapterId(newChapter.id);
        setEditingChapterTitle(newChapter.title);
        
        // 同步到chapterStore,让ChapterEditor能够识别
        const { setCurrentChapter } = useChapterStore.getState();
        setCurrentChapter(newChapter.id);
        
        // 立即刷新项目章节计数
        await fetchProjectChapterCounts(projects.filter(p => p.id === selectedProjectId));
        
        console.log('新章节创建成功:', newChapter.title);
        
        // 显示成功通知
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        notification.textContent = '章节创建成功!';
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.remove();
        }, 2000);
      }
    } catch (error) {
      console.error('创建章节失败:', error);
      // 显示错误通知
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '创建章节失败,请检查网络连接后重试!';
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  };

  const handleSyncToBackend = async () => {
    if (!selectedProjectId) return;
    try {
      // 调用项目级同步API
      const result = await syncProject(selectedProjectId);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = `已同步 新增${result.added} 更新${result.updated} 跳过${result.skipped}`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 3000);
      // 刷新项目和章节数据
      await fetchChapters(selectedProjectId);
      await fetchProjectChapterCounts(projects.filter(p => p.id === selectedProjectId));
    } catch (error) {
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '后端离线或同步失败';
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  };

  // 加载项目数据 - 从workspace获取
  useEffect(() => {
    setLoading(true);
    const loadProjects = async () => {
      try {
        // 从workspace获取项目数据
        const projectsMetadata = await workspaceService.getProjects(false);
        const projectsData = projectsMetadata.map(meta => 
          workspaceService.metadataToProjectData(meta)
        );
        setProjects(projectsData);
        
        // 如果有传入的项目参数,优先使用
        if (project) {
          setSelectedProjectId(project.id);
          fetchProjectChapterCounts([project]);
        } else if (projectsData.length > 0) {
          // 默认选择第一个项目
          setSelectedProjectId(projectsData[0].id);
          fetchProjectChapterCounts(projectsData);
        }
      } catch (error) {
        console.error('加载项目数据失败:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadProjects();
  }, [project]);
  
  // 从设置模块加载AI模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoading(true);
        // 从设置模块获取实际模型配置
        const modelConfigs = getModelConfigs();
        // 转换为AIModel格式
        const models: AIModel[] = modelConfigs.map(config => ({
          id: config.id,
          name: config.name,
          provider: 'openai', // 默认provider
          modelId: config.modelId,
          isDefault: config.isDefault
        }));
        setAiModels(models);
        
        // 获取默认模型或第一个模型
        const defaultConfig = getDefaultModelConfig();
        if (defaultConfig) {
          setSelectedModel(defaultConfig.id);
        } else if (models.length > 0) {
          setSelectedModel(models[0].id);
        }
      } catch (error) {
        console.error('加载AI模型配置失败:', error);
        setAiModels([]);
        setSelectedModel('');
      } finally {
        setModelLoading(false);
      }
    };
    loadModels();
    
    // 监听设置变化,自动更新模型列表
    const handleStorageChange = () => {
      loadModels();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 移除自动同步 - 改用手动同步
  // useEffect(() => {
  //   const cleanup = startAutoSync();
  //   return cleanup;
  // }, []);

  // 当选中项目变化时加载对应章节 - 从后端API加载
  useEffect(() => {
    if (selectedProjectId) {
      setChapterLoading(true);
      // 直接使用后端API加载章节
      fetchChapters(selectedProjectId)
        .then(() => {
          setChapterLoading(false);
        })
        .catch(error => {
          console.error('获取章节数据失败:', error);
          setChapterLoading(false);
        });
    }
  }, [selectedProjectId]);

  // 监听章节变化,选择第一个章节(不重新计算章节数)
  useEffect(() => {
    if (selectedProjectId && chapters.length > 0) {
      const currentProjectChapters = chapters.filter(ch => ch.projectId === selectedProjectId);
      
      // 如果有章节且当前没有选择章节,选择第一个
      if (currentProjectChapters.length > 0 && !selectedChapterId) {
        const firstChapterId = currentProjectChapters[0].id;
        setSelectedChapterId(firstChapterId);
        setEditingChapterTitle(currentProjectChapters[0].title);
        // 同步到chapterStore
        const { setCurrentChapter } = useChapterStore.getState();
        setCurrentChapter(firstChapterId);
      }
    }
  }, [chapters, selectedProjectId, selectedChapterId]);



  // 处理项目选择
  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  // 处理章节选择
  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    // 同步到chapterStore,让ChapterEditor能够识别
    const { setCurrentChapter } = useChapterStore.getState();
    setCurrentChapter(chapterId);
  };

  // 处理AI模型选择
  const handleModelSelect = (modelId: string) => {
    if (modelLoading || modelId === selectedModel) return;
    
    setModelLoading(true);
    setSelectedModel(modelId);
    
    // 保存选中的模型ID到本地存储
    localStorage.setItem('selectedModelId', modelId);
    
    // 模拟模型切换过程,为用户提供反馈
    setTimeout(() => {
      setModelLoading(false);
      // 可以在这里触发一些通知,比如"模型切换成功"
      console.log(`已切换到模型: ${aiModels.find(m => m.id === modelId)?.name}`);
    }, 500);
  };

  // 处理字体大小变化
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    // 保存字体大小到本地存储
    localStorage.setItem('editor-font-size', newSize.toString());
  };

  // 处理主题切换
  const toggleTheme = () => {
    const newTheme = !isDarkTheme ? 'dark' : 'light';
    setIsDarkTheme(!isDarkTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  
  // 初始化主题和字体大小
  useEffect(() => {
    // 初始化主题
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark');
    }
    
    // 初始化字体大小
    const savedFontSize = localStorage.getItem('editor-font-size');
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize));
    }
  }, []);

  // ====== 三栏拖拽宽度状态与逻辑 ======
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number>(128);   // 初始左侧宽度(原w-32)
  const [rightWidth, setRightWidth] = useState<number>(360); // 初始右侧宽度(约1/3屏宽)
  const lastLeftRef = useRef<number>(128);
  const lastRightRef = useRef<number>(360);

  const LEFT_KEY = 'ui:writingSpace:leftWidth';
  const RIGHT_KEY = 'ui:writingSpace:rightWidth';

  // 从 localStorage 恢复保存的宽度
  useEffect(() => {
    const ls = localStorage.getItem(LEFT_KEY);
    const rs = localStorage.getItem(RIGHT_KEY);
    if (ls) {
      const v = parseInt(ls, 10);
      if (!isNaN(v) && v >= 96) {
        setLeftWidth(v);
        lastLeftRef.current = v;
      }
    }
    if (rs) {
      const v = parseInt(rs, 10);
      if (!isNaN(v) && v >= 240) {
        setRightWidth(v);
        lastRightRef.current = v;
      }
    }
  }, []);

  const minLeft = 96;   // 左侧最小宽度
  const minRight = 240; // 右侧最小宽度
  const minMain = 400;  // 中间编辑区最小宽度

  const startResizeLeft = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    const containerW = containerRef.current?.getBoundingClientRect().width || 0;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      let newLeft = startWidth + dx;
      newLeft = Math.max(minLeft, newLeft);
      const maxLeft = containerW - rightWidth - minMain;
      newLeft = Math.min(maxLeft, newLeft);
      setLeftWidth(newLeft);
      lastLeftRef.current = newLeft;
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      localStorage.setItem(LEFT_KEY, String(lastLeftRef.current));
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startResizeRight = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    const containerW = containerRef.current?.getBoundingClientRect().width || 0;

    const onMouseMove = (ev: MouseEvent) => {
      const dx = startX - ev.clientX; // 注意:向左拖动dx为正,右侧变窄
      let newRight = startWidth + dx;
      newRight = Math.max(minRight, newRight);
      const maxRight = containerW - leftWidth - minMain;
      newRight = Math.min(maxRight, newRight);
      setRightWidth(newRight);
      lastRightRef.current = newRight;
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      localStorage.setItem(RIGHT_KEY, String(lastRightRef.current));
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  // ====== 结束拖拽逻辑 ======

  return (
    <div ref={containerRef} className="flex h-full bg-gray-50 dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      {/* 左侦项目列表区 */}
      <aside className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col" style={{ width: leftWidth }}>
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <div title="项目列表">
              <FolderOpen size={16} className="text-gray-600 dark:text-gray-400" />
            </div>
            {loading ? (
              <div className="flex-1 text-xs text-gray-500">加载中...</div>
            ) : (
              <select
                value={selectedProjectId || ''}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>请选择项目</option>
                {projects.map((projectItem) => (
                  <option key={projectItem.id} value={projectItem.id}>
                    {projectItem.projectName} ({projectChapterCounts[projectItem.id] || 0}章)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 章节导航组件 */}
        {selectedProjectId && (
          <>
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <button
                className="w-full px-2 h-7 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-xs"
                onClick={handleSyncToBackend}
                title="同步到后端"
              >
                同步到后端
              </button>
            </div>
            <ChapterNavigator
              projectId={selectedProjectId}
              selectedChapterId={selectedChapterId}
              onChapterSelect={(chapterId) => {
                handleChapterSelect(chapterId);
                setEditingChapterTitle(chapters.find(ch => ch.id === chapterId)?.title || '');
              }}
              onChapterCreate={handleCreateChapter}
            />
          </>
        )}
      </aside>

      {/* 左分隔条(拖拽调整左栏宽度) */}
      <div
        onMouseDown={startResizeLeft}
        className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors flex-shrink-0"
        title="拖拽调整左侧栏宽度"
      />

      {/* 中间编辑区 */}
      <main className="flex-grow flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
        {selectedProjectId ? (
          <ChapterEditor projectId={selectedProjectId} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>请选择一个项目开始创作</p>
          </div>
        )}
      </main>

      {/* 右分隔条(拖拽调整右栏宽度) */}
      <div
        onMouseDown={startResizeRight}
        className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors flex-shrink-0"
        title="拖拽调整右侧栏宽度"
      />

      {/* 右侧AI助手区 */}
      <aside className="bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col" style={{ width: rightWidth }}>
        {/* 工具栏 - 移除本地工具栏,使用AIChatPanel中的ChatToolbar */}
        
        {/* AIChatPanel 组件 */}
        <AIChatPanel 
          models={aiModels}
          selectedModelId={selectedModel}
          onModelChange={handleModelSelect}
          projectData={projects.find(p => p.id === selectedProjectId)}
          currentChapterContent={chapters.find(ch => ch.id === selectedChapterId)?.content || ''}
          selectedChapterId={selectedChapterId}
          theme={{
            backgroundColor: isDarkTheme ? '#1f2937' : '#ffffff',
            primaryColor: '#3b82f6',
            textColor: isDarkTheme ? '#f3f4f6' : '#111827',
            borderColor: isDarkTheme ? '#374151' : '#d1d5db'
          }}
        />
      </aside>
    </div>
  );
};

export default WritingSpaceEnhanced;
