import React, { useState, useEffect } from 'react';
import type { ProjectData } from '../types';

// 章节类型
interface Chapter {
  id: number;
  name: string;
  wordCount: number;
  status: '草稿' | '已发布';
  content?: string;
}

// AI模型类型
interface AIModel {
  value: string;
  name: string;
}

const WritingSpaceEnhanced: React.FC<{ project?: ProjectData }> = ({ project }) => {
  // 项目数据 - 通过接口获取
  const [projects, setProjects] = useState<Array<{id: number; name: string; chapters: number}>>([]);
  // 章节数据 - 通过接口获取
  const [chapters, setChapters] = useState<Chapter[]>([]);
  // AI模型列表 - 通过接口获取
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  // 当前选中的项目ID
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  // 当前选中的章节ID
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
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

  // 加载项目数据 - 这里应该通过API获取
  useEffect(() => {
    setLoading(true);
    // 模拟API请求延迟
    setTimeout(() => {
      // TODO: 这里接入项目管理的项目
      // 实际应用中应该从后端API获取项目数据
      const mockProjects: Array<{id: number; name: string; chapters: number}> = [
        { id: 1, name: '小说创作', chapters: 5 },
        { id: 2, name: '技术文档', chapters: 3 },
        { id: 3, name: '博客文章', chapters: 8 }
      ];
      
      setProjects(mockProjects);
      if (mockProjects.length > 0) {
        setSelectedProjectId(mockProjects[0].id);
      }
      setLoading(false);
    }, 1500);
  }, []);

  // 加载AI模型列表 - 这里应该通过API获取
  useEffect(() => {
    setModelLoading(true);
    // 模拟API请求延迟
    setTimeout(() => {
      // TODO: 这里需要接入设置里的模型配置
      // 实际应用中应该从后端API获取可用的AI模型列表
      const mockModels: AIModel[] = [
        { value: 'gpt-4', name: 'GPT-4 - OpenAI' },
        { value: 'claude', name: 'Claude - Anthropic' },
        { value: 'ernie', name: '文心一言 - 百度' },
        { value: 'qianwen', name: '通义千问 - 阿里' }
      ];
      
      setAiModels(mockModels);
      if (mockModels.length > 0) {
        setSelectedModel(mockModels[0].value);
      }
      setModelLoading(false);
    }, 2000);
  }, []);

  // 当选中项目变化时加载对应的章节
  useEffect(() => {
    if (selectedProjectId) {
      setChapterLoading(true);
      // 模拟API请求延迟
      setTimeout(() => {
        // TODO: 这里通过API获取选中项目的章节数据
        // 根据选中的项目ID从后端获取对应的章节列表
        let mockChapters: Chapter[] = [];
        
        switch(selectedProjectId) {
          case 1:
            mockChapters = [
              { id: 1, name: '第一章:开始', wordCount: 1200, status: '草稿', content: '在一个月黑风高的夜晚...' },
              { id: 2, name: '第二章:发展', wordCount: 1800, status: '已发布', content: '随着剧情的发展...' },
              { id: 3, name: '第三章:高潮', wordCount: 2200, status: '草稿', content: '最终决战即将开始...' }
            ];
            break;
          case 2:
            mockChapters = [
              { id: 1, name: '安装指南', wordCount: 800, status: '已发布', content: '首先,下载安装包...' },
              { id: 2, name: '使用教程', wordCount: 1500, status: '已发布', content: '本教程将介绍如何使用...' },
              { id: 3, name: '常见问题', wordCount: 1000, status: '草稿', content: '以下是用户常见的问题...' }
            ];
            break;
          case 3:
            mockChapters = [
              { id: 1, name: 'React入门', wordCount: 2000, status: '已发布', content: 'React是一个用于构建用户界面的JavaScript库...' },
              { id: 2, name: '状态管理', wordCount: 2500, status: '已发布', content: '在React应用中,状态管理是一个重要的概念...' },
              { id: 3, name: '性能优化', wordCount: 1800, status: '草稿', content: 'React应用的性能优化有很多方面...' }
            ];
            break;
          default:
            mockChapters = [];
        }
        
        setChapters(mockChapters);
        if (mockChapters.length > 0) {
          setSelectedChapterId(mockChapters[0].id);
        } else {
          setSelectedChapterId(null);
        }
        setChapterLoading(false);
      }, 1000);
    }
  }, [selectedProjectId]);

  // 处理项目选择
  const handleProjectSelect = (projectId: number) => {
    setSelectedProjectId(projectId);
  };

  // 处理章节选择
  const handleChapterSelect = (chapterId: number) => {
    setSelectedChapterId(chapterId);
  };

  // 处理AI模型选择
  const handleModelSelect = (modelValue: string) => {
    setModelLoading(true);
    // 模拟模型切换延迟
    setTimeout(() => {
      setSelectedModel(modelValue);
      setModelLoading(false);
    }, 1000);
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

  // 处理AI功能点击
  const handleAiFeature = (feature: string) => {
    if (modelLoading) return;
    
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    let message = `AI功能:${feature} 已启动!`;
    
    if (currentChapter && currentChapter.content) {
      message += `\n\n基于您当前的文本,AI将为您${feature}.`;
    } else {
      message += `\n\n请先在编辑器中输入一些文本,AI将基于您的内容${feature}.`;
    }
    
    // 使用更友好的提示方式
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  // 获取当前选中章节的内容
  const getCurrentChapterContent = (): string => {
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    return currentChapter?.content || '';
  };

  // 获取当前选中章节的标题
  const getCurrentChapterTitle = (): string => {
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    return currentChapter?.name || '未选择章节';
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      {/* 左侧项目列表区 */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">项目列表</h3>
            <button className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              +
            </button>
          </div>
          {loading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <ul className="space-y-1">
              {projects.map((projectItem) => (
                <li 
                  key={projectItem.id} 
                  className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${projectItem.id === selectedProjectId ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                  onClick={() => handleProjectSelect(projectItem.id)}
                >
                  <div className="flex justify-between items-center">
                    <span>{projectItem.name}</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{projectItem.chapters}章</span>
                  </div>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="px-3 py-2 text-gray-500 dark:text-gray-400 text-sm italic">暂无项目</li>
              )}
            </ul>
          )}
        </div>

        <div className="p-4 flex-grow overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">章节管理</h3>
            <button className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              +
            </button>
          </div>
          {chapterLoading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <ul className="space-y-1">
              {chapters.map((chapter) => (
                <li 
                  key={chapter.id} 
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${chapter.id === selectedChapterId ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                  onClick={() => handleChapterSelect(chapter.id)}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{chapter.name}</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{chapter.wordCount}字</span>
                  </div>
                  <div className="flex justify-end mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${chapter.status === '草稿' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                      {chapter.status}
                    </span>
                  </div>
                </li>
              ))}
              {chapters.length === 0 && (
                <li className="p-2 text-gray-500 dark:text-gray-400 text-sm italic">暂无章节</li>
              )}
            </ul>
          )}
        </div>
      </aside>

      {/* 中间写作编辑区 */}
      <main className="flex-grow flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{getCurrentChapterTitle()}</h2>
          <div className="flex items-center space-x-3">
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400" title="字体样式">T</button>
            <div className="flex items-center">
              <input
                type="range"
                min="12"
                max="24"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="w-24 accent-primary"
              />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{fontSize}px</span>
            </div>
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400" onClick={toggleTheme} title="切换主题">⚡</button>
            <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400" title="保存">💾</button>
          </div>
        </div>
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-1 overflow-x-auto bg-gray-50 dark:bg-gray-700">
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 font-bold" title="加粗">B</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 italic" title="斜体">I</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="代码">&lt;/&gt;</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="段落">¶</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="左对齐">≡</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="右对齐">≡≡</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="插入图片">🖼️</button>
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400" title="插入链接">🔗</button>
        </div>
        <div className="flex-grow overflow-hidden p-6 bg-white dark:bg-gray-800">
          <textarea 
            className="w-full h-full resize-none outline-none bg-transparent text-gray-900 dark:text-gray-100"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
            placeholder="在这里开始写作..."
            value={getCurrentChapterContent()}
            onChange={(e) => {
              // 这里应该保存编辑器内容到状态或发送到后端
              const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
              if (currentChapter) {
                const updatedChapters = chapters.map(ch => 
                  ch.id === selectedChapterId 
                    ? { ...ch, content: e.target.value, wordCount: e.target.value.length }
                    : ch
                );
                setChapters(updatedChapters);
                
                // 自动保存功能
                if (e.target.value.length > 0 && e.target.value.length % 100 === 0) {
                  // 每输入100个字符自动保存一次
                  localStorage.setItem(`chapter-content-${selectedChapterId}`, e.target.value);
                }
              }
            }}
          />
        </div>
      </main>

      {/* 右侧AI助手区 */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">AI 写作助手</h3>
          <div className="relative">
            {modelLoading ? (
              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">加载中...</span>
                <span className="text-gray-500 dark:text-gray-400 animate-spin">⟳</span>
              </div>
            ) : (
              <select 
                className="w-full bg-gray-100 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedModel}
                onChange={(e) => handleModelSelect(e.target.value)}
              >
                {aiModels.map(model => (
                  <option key={model.value} value={model.value}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
            {!modelLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">▼</div>
            )}
          </div>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="mb-3">
            <button 
              className="w-full bg-primary hover:bg-primary-light text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => alert('AI对话功能即将上线,敬请期待!')}
            >
              开始对话
            </button>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {modelLoading ? 'AI模型加载中,请稍候...' : '与AI助手开始对话,获取写作建议和创作支持'}
            </p>
          </div>
        </div>
        <div className="flex-grow p-4 overflow-y-auto">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">快速功能</h4>
          <div className="grid grid-cols-2 gap-2">
            <button 
              className="py-2 px-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('生成段落')}
            >
              生成段落
            </button>
            <button 
              className="py-2 px-3 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('润色文本')}
            >
              润色文本
            </button>
            <button 
              className="py-2 px-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('续写故事')}
            >
              续写故事
            </button>
            <button 
              className="py-2 px-3 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('角色塑造')}
            >
              角色塑造
            </button>
            <button 
              className="py-2 px-3 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('情节大纲')}
            >
              情节大纲
            </button>
            <button 
              className="py-2 px-3 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={modelLoading}
              onClick={() => handleAiFeature('创意灵感')}
            >
              创意灵感
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default WritingSpaceEnhanced;