import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Moon, Sun, Plus, Search, Settings, X, Save, Edit3, Book, Clock, Activity, Users, Brain, Zap, Palette, Trash2, PlusCircle } from 'lucide-react';
import type { ProjectData, AIModel } from '../types';
import { getChaptersByProjectId } from '../services/chapterApi';
import { getModelConfigs, getDefaultModelConfig } from '../sample_data/services/modelManager';
import AIChatPanel from './AIChatPanel';
import AgentWorkflowEditor from './AgentWorkflowEditor';
import { useTheme } from '../contexts/ThemeContext';

// 章节类型
interface Chapter {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string;
  content?: string;
  wordCount: number;
  status: '草稿' | '已发布';
  displayOrder?: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  notes?: string;
  summary?: string;
}

// 元素类型
type TreeElement = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeElement[];
};

// 主题颜色类型
interface ThemeColors {
  background: string;
  editorBg: string;
  primary: string;
  text: string;
  border: string;
}

const WritingSpace: React.FC<{ project?: ProjectData }> = ({ project }) => {
  // 状态管理
  const { theme, setTheme } = useTheme();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<number>(16);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showAIPanel, setShowAIPanel] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'workflow'>('chat');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editorBgColor, setEditorBgColor] = useState<string>('#1E1E1E');
  const [wordCount, setWordCount] = useState<number>(0);
  const [lineCount, setLineCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [chapterLoading, setChapterLoading] = useState<boolean>(false);
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<'default' | 'light' | 'pink'>('default');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [themeType, setThemeType] = useState<'normal' | 'girlish'>('normal');
  const [currentTheme, setCurrentTheme] = useState(normalThemes[0]);
  // AI模型相关状态
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(getDefaultModelConfig().id);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  // 项目章节数量统计
  const [projectChapterCounts, setProjectChapterCounts] = useState<Record<string, number>>({});
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  
  // 颜色主题配置
  const normalThemes = [
    { id: 'theme1', name: '默认深色', bgColor: '#1E1E1E', primaryColor: '#007ACC', textColor: '#FFFFFF' },
    { id: 'theme2', name: '紫色梦境', bgColor: '#5222b0', primaryColor: '#b392f0', textColor: '#FFFFFF' },
    { id: 'theme3', name: '灰色经典', bgColor: '#858483', primaryColor: '#1e1e1e', textColor: '#FFFFFF' },
    { id: 'theme4', name: '青翠绿意', bgColor: '#136e6a', primaryColor: '#70c1b3', textColor: '#FFFFFF' },
    { id: 'theme5', name: '古铜金色', bgColor: '#a17c43', primaryColor: '#ffd700', textColor: '#FFFFFF' },
    { id: 'theme6', name: '深紫优雅', bgColor: '#7b6672', primaryColor: '#d7ccc8', textColor: '#FFFFFF' },
    { id: 'theme7', name: '淡紫薄雾', bgColor: '#c0c2e0', primaryColor: '#6e6ec8', textColor: '#000000' },
    { id: 'theme8', name: '橄榄绿', bgColor: '#738f41', primaryColor: '#f0e68c', textColor: '#000000' },
  ];

  const girlishThemes = [
    { id: 'gtheme1', name: '梦幻粉红', bgColor: '#fe4365', primaryColor: '#fcbdc6', textColor: '#FFFFFF' },
    { id: 'gtheme2', name: '珊瑚橘', bgColor: '#fc9d9a', primaryColor: '#fe4365', textColor: '#FFFFFF' },
    { id: 'gtheme3', name: '暖金色', bgColor: '#f9cdad', primaryColor: '#fe4365', textColor: '#000000' },
    { id: 'gtheme4', name: '抹茶绿', bgColor: '#c8c8a9', primaryColor: '#83af9b', textColor: '#000000' },
    { id: 'gtheme5', name: '薄荷绿', bgColor: '#83af9b', primaryColor: '#c8c8a9', textColor: '#FFFFFF' },
  ];
  
  // 主题颜色配置
  const themeColors = {
    default: {
      background: '#121212',
      editorBg: '#1E1E1E',
      primary: '#007ACC',
      text: '#E2E2E2',
      border: 'rgba(255,255,255,0.1)'
    },
    light: {
      background: '#F3F4F6',
      editorBg: '#FFFFFF',
      primary: '#007ACC',
      text: '#1F2937',
      border: 'rgba(0,0,0,0.1)'
    },
    pink: {
      background: '#FFF0F5',
      editorBg: '#FFFFFF',
      primary: '#FE4365',
      text: '#333333',
      border: 'rgba(254, 67, 101, 0.2)'
    }
  };

  // 加载项目数据
  useEffect(() => {
    setLoading(true);
    try {
      // 从localStorage获取真实的项目数据
      const savedProjects = localStorage.getItem('storyWeaverProjects');
      if (savedProjects) {
        const parsedProjects: ProjectData[] = JSON.parse(savedProjects);
        setProjects(parsedProjects);
        
        // 获取所有项目的章节数量
        fetchProjectChapterCounts(parsedProjects);
        
        // 如果有传入的项目参数,优先使用
        if (project) {
          setSelectedProjectId(project.id);
        } else if (parsedProjects.length > 0) {
          // 默认选择第一个项目
          setSelectedProjectId(parsedProjects[0].id);
        }
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error('加载项目数据失败:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [project]);

  // 加载AI模型配置
  useEffect(() => {
    setModelLoading(true);
    try {
      const modelConfigs = getModelConfigs();
      // 转换为AIModel格式
      const convertedModels: AIModel[] = modelConfigs.map(config => ({
        id: config.id,
        name: config.name,
        description: config.modelId
      }));
      
      setAiModels(convertedModels);
      
      // 获取之前保存的选中模型ID,如果没有则使用默认模型
      const savedModelId = localStorage.getItem('selectedModelId');
      const defaultConfig = getDefaultModelConfig();
      
      // 如果保存的模型ID存在于当前模型列表中,则使用它;否则使用默认模型
      const modelExists = savedModelId && convertedModels.some(model => model.id === savedModelId);
      setSelectedModelId(modelExists ? savedModelId : defaultConfig.id);
    } catch (error) {
      console.error('加载AI模型配置失败:', error);
      setAiModels([]);
      setSelectedModelId('');
    } finally {
      setModelLoading(false);
    }
  }, []);

  // 当选中项目变化时加载对应的章节
  useEffect(() => {
    if (selectedProjectId) {
      setChapterLoading(true);
      // 通过API获取选中项目的章节数据
      getChaptersByProjectId(selectedProjectId)
        .then(fetchedChapters => {
          // 转换章节数据格式以匹配前端接口
          const convertedChapters: Chapter[] = fetchedChapters.map(chapter => ({
            id: chapter.id,
            projectId: chapter.projectId,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: chapter.content,
            wordCount: chapter.wordCount,
            status: '草稿',
            displayOrder: chapter.displayOrder,
            createdAt: chapter.createdAt,
            updatedAt: chapter.updatedAt,
            tags: chapter.tags,
            notes: chapter.notes,
            summary: chapter.summary
          }));
          
          setChapters(convertedChapters);
          if (convertedChapters.length > 0) {
            setSelectedChapterId(convertedChapters[0].id);
            setCurrentContent(convertedChapters[0].content || '');
          } else {
            setSelectedChapterId(null);
            setCurrentContent('');
          }
          setChapterLoading(false);
        })
        .catch(error => {
          console.error('获取章节数据失败:', error);
          // 出错时使用空数组
          setChapters([]);
          setSelectedChapterId(null);
          setCurrentContent('');
          setChapterLoading(false);
        });
    }
  }, [selectedProjectId]);

  // 处理章节选择
  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (chapter) {
      setCurrentContent(chapter.content || '');
    }
  };

  // 处理内容变化
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setCurrentContent(content);
    
    // 计算统计信息
    const charCount = content.length;
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lineCount = content.split('\n').length;
    
    setCharCount(charCount);
    setWordCount(wordCount);
    setLineCount(lineCount);
    
    // 自动保存功能
    if (charCount > 0 && charCount % 100 === 0) {
      saveContent(content);
    }
  };

  // 保存内容
  const saveContent = (content: string) => {
    if (selectedChapterId) {
      // 更新本地状态
      const updatedChapters = chapters.map(ch => 
        ch.id === selectedChapterId 
          ? { ...ch, content, wordCount: content.length, updatedAt: Date.now() }
          : ch
      );
      setChapters(updatedChapters);
      
      // 保存到localStorage
      localStorage.setItem(`chapter-content-${selectedChapterId}`, content);
    }
  };

  // 处理字体大小变化
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(e.target.value);
    setFontSize(newSize);
    localStorage.setItem('editor-font-size', newSize.toString());
  };

  // 切换主题
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
  // 改变编辑器背景色
  const changeEditorBgColor = (color: string) => {
    // 更新ThemeContext中的编辑器背景色
    setTheme({
      ...theme,
      editorBgColor: color
    });
  };  setShowThemePicker(false);
  };

  // 切换主题预设
  const changeThemePreset = (preset: 'default' | 'light' | 'pink') => {
    setActiveTheme(preset);
    let newTheme;
    if (preset === 'light') {
      newTheme = { name: '浅色主题', bgColor: '#FFFFFF', textColor: '#000000', primaryColor: '#3B82F6' };
      setIsDarkTheme(false);
      document.documentElement.classList.remove('dark');
    } else if (preset === 'pink') {
      newTheme = { name: '粉色主题', bgColor: '#FFF0F5', textColor: '#8B4513', primaryColor: '#EC4899' };
      setIsDarkTheme(false);
      document.documentElement.classList.remove('dark');
    } else {
      newTheme = { name: '经典黑', bgColor: '#1E1E1E', textColor: '#FFFFFF', primaryColor: '#333230' };
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark');
    }
    setCurrentTheme(newTheme);
    // 更新ThemeContext中的编辑器背景色
    setTheme({
      ...theme,
      editorBgColor: newTheme.bgColor,
      editorTextColor: newTheme.textColor
    });
    localStorage.setItem('editorTheme', JSON.stringify({
      activeTheme: preset,
      themeType,
      currentTheme: newTheme
    }));
    localStorage.setItem('theme-preset', preset);
  };

  // 切换文件夹展开状态
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // 初始化主题和字体大小
  useEffect(() => {
    // 初始化主题
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkTheme(true);
      document.documentElement.classList.add('dark');
    }
    
    // 初始化主题预设
    const preset = localStorage.getItem('theme-preset') as 'default' | 'light' | 'pink';
    if (preset && ['default', 'light', 'pink'].includes(preset)) {
      setActiveTheme(preset);
    }
    
    // 初始化字体大小
    const savedFontSize = localStorage.getItem('editor-font-size');
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize));
    }
    
    // 初始化主题选择器
    const savedTheme = localStorage.getItem('editorTheme');
    if (savedTheme) {
      const parsedTheme = JSON.parse(savedTheme);
      setCurrentTheme(parsedTheme);
    }
  }, []);
  
  const handleThemeSelect = (selectedTheme: typeof normalThemes[0] | typeof girlishThemes[0]) => {
    setCurrentTheme(selectedTheme);
    // 更新ThemeContext中的编辑器背景色
    setTheme({
      ...theme,
      editorBgColor: selectedTheme.bgColor,
      editorTextColor: selectedTheme.textColor || '#FFFFFF'
    });
    setShowThemeSelector(false);
    localStorage.setItem('editorTheme', JSON.stringify(selectedTheme));
  };
  
  const handleModelChange = (modelId: string) => {
    if (modelLoading) return;
    setSelectedModelId(modelId);
    // 保存选中的模型ID到localStorage
    localStorage.setItem('selectedModelId', modelId);
  };

  // 点击外部关闭主题选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(event.target as Node)) {
        setShowThemePicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 获取项目章节数量
  const fetchProjectChapterCounts = async (projectList: ProjectData[]) => {
    const counts: Record<string, number> = {};
    
    for (const project of projectList) {
      try {
        // 直接从API获取章节数据,不依赖组件状态
        const response = await fetch(`/api/v1/chapters/project/${project.id}`);
        if (response.ok) {
          const projectChapters = await response.json();
          counts[project.id] = Array.isArray(projectChapters) ? projectChapters.length : 0;
        } else {
          counts[project.id] = 0;
        }
      } catch (error) {
        console.error(`获取项目 ${project.id} 的章节数量失败:`, error);
        counts[project.id] = 0;
      }
    }
    
    setProjectChapterCounts(counts);
  };

  // 获取当前章节标题
  const getCurrentChapterTitle = () => {
    const currentChapter = chapters.find(ch => ch.id === selectedChapterId);
    return currentChapter?.title || '未选择章节';
  };

  // 渲染文件树元素
  const renderTreeElement = (element: TreeElement, level = 0) => {
    const isExpanded = expandedFolders.has(element.id);
    
    return (
      <div key={element.id} className="relative">
        <div 
          className={`flex items-center py-1.5 px-2 rounded-md cursor-pointer hover:bg-gray-700/50 transition-colors ${selectedChapterId === element.id ? 'bg-blue-900/30 text-blue-400' : ''}`}
          style={{ paddingLeft: `${level * 20 + 24}px` }}
          onClick={() => {
            if (element.type === 'folder') {
              toggleFolder(element.id);
            } else {
              handleChapterSelect(element.id);
            }
          }}
        >
          {element.type === 'folder' ? (
            <span 
              className="absolute left-2 w-4 h-4 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(element.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-400" />
              )}
            </span>
          ) : (
            <span className="absolute left-2">
              <FileText size={14} className="text-gray-400" />
            </span>
          )}
          <span className="text-sm truncate">{element.name}</span>
        </div>
        
        {element.type === 'folder' && isExpanded && element.children && element.children.length > 0 && (
          <div className="mt-1">
            {element.children.map(child => renderTreeElement(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 构建文件树结构
  const buildFileTree = (): TreeElement[] => {
    if (!selectedProjectId) return [];
    
    // 按章节号分组
    const chaptersByNumber = chapters.reduce<Record<string, Chapter[]>>((acc, chapter) => {
      const section = Math.floor((chapter.chapterNumber - 1) / 10) + 1;
      const key = `第${section}卷`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(chapter);
      return acc;
    }, {});
    
    // 转换为树结构
    return Object.entries(chaptersByNumber).map(([sectionName, sectionChapters], index) => ({
      id: `section-${index}`,
      name: sectionName,
      type: 'folder',
      children: sectionChapters.map(chapter => ({
        id: chapter.id,
        name: chapter.title,
        type: 'file'
      }))
    }));
  };

  const currentThemeColors = themeColors[activeTheme];
  const availableBgColors = editorBgColors[activeTheme === 'pink' ? 'pink' : 'default'];

  return (
    <div 
      className="flex h-full overflow-hidden"
      style={{ backgroundColor: currentThemeColors.background }}
    >
      {/* 左侧导航区 */}
      {showSidebar && (
        <aside 
          className="w-1/6 border-r flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out"
          style={{ borderColor: currentThemeColors.border }}
        >
          {/* 项目管理部分 */}
          <div className="p-3 border-b" style={{ borderColor: currentThemeColors.border }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium" style={{ color: currentThemeColors.text }}>项目管理</h3>
              <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-700/50 transition-colors">
                <Plus size={14} style={{ color: currentThemeColors.text }} />
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索项目..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-gray-800/50 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{ color: currentThemeColors.text, borderColor: currentThemeColors.border }}
              />
            </div>
            {loading ? (
              <div className="mt-3 text-sm text-gray-400">加载中...</div>
            ) : (
              <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto pr-1">
                {projects.map((projectItem) => (
                  <li 
                    key={projectItem.id} 
                    className={`px-3 py-2 rounded-md cursor-pointer transition-colors ${projectItem.id === selectedProjectId ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-gray-700/50'}`}
                    onClick={() => setSelectedProjectId(projectItem.id)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm truncate">{projectItem.projectName}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50">{projectChapterCounts[projectItem.id] || 0}章</span>
                    </div>
                  </li>
                ))}
                {projects.length === 0 && (
                  <li className="px-3 py-2 text-gray-400 text-sm italic">暂无项目</li>
                )}
              </ul>
            )}
          </div>

          {/* 章节列表部分 */}
          <div className="flex-grow overflow-y-auto p-3">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium" style={{ color: currentThemeColors.text }}>章节列表</h3>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50">
                  {chapters.length}章
                </span>
              </div>
              <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-700/50 transition-colors">
                <Plus size={14} style={{ color: currentThemeColors.text }} />
              </button>
            </div>
            {chapterLoading ? (
              <div className="text-sm text-gray-400">加载中...</div>
            ) : (
              <div className="max-h-full overflow-y-auto pr-1">
                {buildFileTree().map(element => renderTreeElement(element))}
                {chapters.length === 0 && (
                  <div className="p-2 text-gray-400 text-sm italic">暂无章节</div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* 中间编辑区 */}
      <main className="flex-grow flex flex-col overflow-hidden">
        {/* 编辑器头部 */}
        <div 
          className="p-3 border-b flex justify-between items-center"
          style={{ borderColor: currentThemeColors.border, backgroundColor: currentThemeColors.background }}
        >
          <div className="flex items-center space-x-2">
            <button 
              className="p-1.5 rounded hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Book size={16} style={{ color: currentThemeColors.text }} />
            </button>
            <h2 className="text-base font-medium truncate max-w-md" style={{ color: currentThemeColors.text }}>
              {getCurrentChapterTitle()}
            </h2>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 字体大小控制 */}
            <div className="flex items-center space-x-1">
              <span className="text-xs" style={{ color: currentThemeColors.text }}>A</span>
              <input
                type="range"
                min="12"
                max="24"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="w-16 accent-blue-500"
              />
              <span className="text-xs" style={{ color: currentThemeColors.text }}>A+</span>
            </div>
            
            {/* 主题切换 */}
              <button 
                className="p-1.5 rounded hover:bg-gray-700/50 transition-colors relative"
                onClick={() => setShowThemePicker(!showThemePicker)}
                ref={themePickerRef}
              >
                <Palette size={16} style={{ color: currentThemeColors.text }} />
                
                {/* 主题颜色选择器 */}
                {showThemePicker && (
                  <div 
                    className="absolute right-0 mt-2 w-48 rounded-md shadow-lg z-10 py-2"
                    style={{ backgroundColor: currentThemeColors.background, borderColor: currentThemeColors.border, border: '1px solid' }}
                  >
                    <div className="px-3 py-2 border-b" style={{ borderColor: currentThemeColors.border }}>
                      <span className="text-xs font-medium" style={{ color: currentThemeColors.text }}>主题预设</span>
                      <div className="flex space-x-2 mt-2">
                        <button 
                          className={`w-6 h-6 rounded-full ${activeTheme === 'default' ? 'ring-2 ring-blue-500' : ''}`}
                          style={{ backgroundColor: '#1E1E1E' }}
                          onClick={() => changeThemePreset('default')}
                        />
                        <button 
                          className={`w-6 h-6 rounded-full ${activeTheme === 'light' ? 'ring-2 ring-blue-500' : ''}`}
                          style={{ backgroundColor: '#FFFFFF' }}
                          onClick={() => changeThemePreset('light')}
                        />
                        <button 
                          className={`w-6 h-6 rounded-full ${activeTheme === 'pink' ? 'ring-2 ring-pink-500' : ''}`}
                          style={{ backgroundColor: '#FFF0F5' }}
                          onClick={() => changeThemePreset('pink')}
                        />
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <span className="text-xs font-medium" style={{ color: currentThemeColors.text }}>编辑器背景</span>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {(themeType === 'normal' ? normalThemes : girlishThemes).map((t) => (
                          <div 
                            key={t.id}
                            onClick={() => handleThemeSelect(t)}
                            className={`w-6 h-6 rounded cursor-pointer transition-transform hover:scale-110 ${currentTheme.id === t.id ? 'ring-2 ring-blue-500' : ''}`}
                            style={{ backgroundColor: t.bgColor }}
                            title={t.name}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => setThemeType('normal')}
                          className={`px-2 py-1 text-xs rounded transition-colors`}
                          style={{ 
                            backgroundColor: themeType === 'normal' ? currentThemeColors.primary : `${currentThemeColors.text}15`, 
                            color: themeType === 'normal' ? '#FFFFFF' : currentThemeColors.text 
                          }}
                        >
                          标准色系
                        </button>
                        <button 
                          onClick={() => setThemeType('girlish')}
                          className={`px-2 py-1 text-xs rounded transition-colors`}
                          style={{ 
                            backgroundColor: themeType === 'girlish' ? currentThemeColors.primary : `${currentThemeColors.text}15`, 
                            color: themeType === 'girlish' ? '#FFFFFF' : currentThemeColors.text 
                          }}
                        >
                          女生色系
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </button>
            
            {/* 保存按钮 */}
            <button 
              className="p-1.5 rounded hover:bg-gray-700/50 transition-colors"
              onClick={() => saveContent(currentContent)}
            >
              <Save size={16} style={{ color: currentThemeColors.text }} />
            </button>
            
            {/* 设置按钮 */}
            <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors">
              <Settings size={16} style={{ color: currentThemeColors.text }} />
            </button>
          </div>
        </div>
        
        {/* 编辑器工具栏 */}
        <div 
          className="p-2 border-b flex items-center space-x-1 overflow-x-auto"
          style={{ borderColor: currentThemeColors.border, backgroundColor: currentThemeColors.background }}
        >
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="加粗">
            <strong style={{ color: currentThemeColors.text }}>B</strong>
          </button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="斜体">
            <em style={{ color: currentThemeColors.text }}>I</em>
          </button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="代码">
            <code style={{ color: currentThemeColors.text }}>&lt;/&gt;</code>
          </button>
          <div className="h-4 border-r mx-1" style={{ borderColor: currentThemeColors.border }}></div>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="段落">¶</button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="左对齐">≡</button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="居中对齐">≡≡</button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="右对齐">≡≡≡</button>
          <div className="h-4 border-r mx-1" style={{ borderColor: currentThemeColors.border }}></div>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="插入图片">🖼️</button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="插入链接">🔗</button>
          <button className="p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="插入列表">📋</button>
        </div>
        
        {/* 编辑器主体 */}
        <div className="flex-grow overflow-hidden relative">
          {/* 行号 */}
          <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col items-center justify-start py-4 overflow-hidden text-gray-500 text-xs select-none">
            {Array.from({ length: Math.max(lineCount, 20) }).map((_, index) => (
              <div key={index} className="h-[22px] leading-[22px] font-mono">{index + 1}</div>
            ))}
          </div>
          
          {/* 编辑区域 */}
          <div className="pl-12 h-full w-full overflow-auto">
            <textarea 
              ref={editorRef}
              className="w-full h-full resize-none outline-none p-4 font-mono"
              style={{ 
                fontSize: `${fontSize}px`, 
                lineHeight: 1.4,
                backgroundColor: theme.editorBgColor,
                color: theme.editorTextColor
              }}
              placeholder="在这里开始写作..."
              value={currentContent}
              onChange={handleContentChange}
              spellCheck={false}
            />
          </div>
          
          {/* 统计信息 */}
          <div 
            className="absolute bottom-2 right-3 text-xs px-2 py-1 rounded-md"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: currentThemeColors.text }}
          >
            字数: {wordCount} | 行数: {lineCount} | 字符: {charCount}
          </div>
        </div>
      </main>

      {/* 右侧AI面板 */}
      {showAIPanel && (
        <aside 
          className="w-1/3 border-l flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out"
          style={{ borderColor: currentThemeColors.border, backgroundColor: currentThemeColors.background }}
        >
          {/* AI面板头部 */}
          <div 
            className="p-3 border-b flex justify-between items-center"
            style={{ borderColor: currentThemeColors.border }}
          >
            <div className="flex items-center space-x-2">
              <button 
                className="p-1.5 rounded hover:bg-gray-700/50 transition-colors"
                onClick={() => setShowAIPanel(!showAIPanel)}
              >
                <Brain size={16} style={{ color: currentThemeColors.text }} />
              </button>
              <div className="flex bg-gray-800/50 rounded-md overflow-hidden">
                <button 
                  className={`px-3 py-1 text-sm transition-colors ${activeTab === 'chat' ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-gray-700/50'}`}
                  onClick={() => setActiveTab('chat')}
                >
                  智能对话
                </button>
                <button 
                  className={`px-3 py-1 text-sm transition-colors ${activeTab === 'workflow' ? 'bg-blue-900/30 text-blue-400' : 'hover:bg-gray-700/50'}`}
                  onClick={() => setActiveTab('workflow')}
                >
                  工作流
                </button>
              </div>
            </div>
          </div>
          
          {/* AI面板内容 */}
          <div className="flex-grow overflow-hidden">
            {activeTab === 'chat' ? (
              <AIChatPanel 
                models={aiModels}
                selectedModelId={selectedModelId}
                onModelChange={handleModelChange}
                projectData={project}
                currentChapterContent={currentContent}
                theme={{
                  backgroundColor: currentThemeColors.background,
                  primaryColor: currentThemeColors.primary,
                  textColor: currentThemeColors.text,
                  borderColor: currentThemeColors.border
                }}
              />
            ) : (
              <AgentWorkflowEditor themeColors={currentThemeColors} />
            )}
          </div>
          
          {/* 快速操作栏 */}
          <div 
            className="p-3 border-t"
            style={{ borderColor: currentThemeColors.border }}
          >
            <h4 className="text-xs font-medium mb-2" style={{ color: currentThemeColors.text }}>快速操作</h4>
            <div className="grid grid-cols-2 gap-2">
              <button className="py-1.5 px-2 text-xs rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/40 transition-colors">
                生成段落
              </button>
              <button className="py-1.5 px-2 text-xs rounded bg-purple-900/30 text-purple-400 hover:bg-purple-900/40 transition-colors">
                润色文本
              </button>
              <button className="py-1.5 px-2 text-xs rounded bg-green-900/30 text-green-400 hover:bg-green-900/40 transition-colors">
                续写故事
              </button>
              <button className="py-1.5 px-2 text-xs rounded bg-orange-900/30 text-orange-400 hover:bg-orange-900/40 transition-colors">
                角色塑造
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default WritingSpace;