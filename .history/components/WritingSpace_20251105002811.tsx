import React, { useState, useEffect } from 'react';
import '../App.css';

// 项目列表项类型
interface Project {
  id: number;
  name: string;
  chapters: number;
}

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

const WritingSpace: React.FC = () => {
  // 项目数据 - 通过接口获取
  const [projects, setProjects] = useState<Project[]>([]);
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
      const mockProjects: Project[] = [
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
    setFontSize(parseInt(e.target.value));
  };

  // 处理主题切换
  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
    document.body.className = isDarkTheme ? '' : 'dark-theme';
  };

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
    
    alert(message);
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
    <div className="app-container">
      {/* 左侧项目列表区 */}
      <aside className="sidebar">
        <div className="section">
          <div className="section-header">
            <h3>项目列表</h3>
            <button className="add-btn">+</button>
          </div>
          {loading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <ul className="project-list">
              {projects.map((project) => (
                <li 
                  key={project.id} 
                  className={`project-item ${project.id === selectedProjectId ? 'active' : ''}`}
                  onClick={() => handleProjectSelect(project.id)}
                >
                  {project.name}
                  <span className="project-meta">{project.chapters}章</span>
                </li>
              ))}
              {projects.length === 0 && (
                <li className="empty-state">暂无项目</li>
              )}
            </ul>
          )}
        </div>

        <div className="section">
          <div className="section-header">
            <h3>章节管理</h3>
            <button className="add-btn">+</button>
          </div>
          {chapterLoading ? (
            <div className="loading-state">加载中...</div>
          ) : (
            <ul className="chapter-list">
              {chapters.map((chapter) => (
                <li 
                  key={chapter.id} 
                  className={`chapter-item ${chapter.id === selectedChapterId ? 'active' : ''}`}
                  onClick={() => handleChapterSelect(chapter.id)}
                >
                  <div className="chapter-info">
                    {chapter.name}
                    <span className="chapter-meta">{chapter.wordCount}字</span>
                  </div>
                  <span className={`chapter-status ${chapter.status}`}>
                    {chapter.status === '草稿' ? '草稿' : '已发布'}
                  </span>
                </li>
              ))}
              {chapters.length === 0 && (
                <li className="empty-state">暂无章节</li>
              )}
            </ul>
          )}
        </div>
      </aside>

      {/* 中间写作编辑区 */}
      <main className="editor">
        <div className="editor-header">
          <h2 className="editor-title">{getCurrentChapterTitle()}</h2>
          <div className="editor-controls">
            <button className="control-btn" title="字体样式">T</button>
            <div className="font-size-control">
              <input
                type="range"
                min="12"
                max="24"
                value={fontSize}
                onChange={handleFontSizeChange}
                className="font-size-slider"
              />
              <span className="font-size-display">{fontSize}px</span>
            </div>
            <button className="control-btn" onClick={toggleTheme} title="切换主题">⚡</button>
            <button className="control-btn" title="保存">💾</button>
          </div>
        </div>
        <div className="editor-toolbar">
          <button className="toolbar-btn" title="加粗">B</button>
          <button className="toolbar-btn" title="斜体">I</button>
          <button className="toolbar-btn" title="代码"><></button>
          <button className="toolbar-btn" title="段落">¶</button>
          <button className="toolbar-btn" title="左对齐">≡</button>
          <button className="toolbar-btn" title="右对齐">≡≡</button>
          <button className="toolbar-btn" title="插入图片">🖼️</button>
          <button className="toolbar-btn" title="插入链接">🔗</button>
        </div>
        <div className="editor-content">
          <textarea 
            className="editor-area"
            style={{ fontSize: `${fontSize}px` }}
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
              }
            }}
          />
        </div>
      </main>

      {/* 右侧AI助手区 */}
      <aside className="ai-panel">
        <div className="panel-header">
          <h3>AI 写作助手</h3>
          <div className="model-select-container">
            {modelLoading ? (
              <>
                <select className="model-select" disabled>
                  <option>加载中...</option>
                </select>
                <span className="model-loading">⟳</span>
              </>
            ) : (
              <>
                <select 
                  className="model-select" 
                  value={selectedModel}
                  onChange={(e) => handleModelSelect(e.target.value)}
                >
                  {aiModels.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <span className="model-select-arrow">▼</span>
              </>
            )}
          </div>
        </div>
        <div className="chat-section">
          <div className="chat-entry">
            <button 
              className="chat-btn" 
              disabled={modelLoading}
              onClick={() => alert('AI对话功能即将上线,敬请期待!')}
            >
              开始对话
            </button>
            <p className="chat-description">
              {modelLoading ? 'AI模型加载中,请稍候...' : '与AI助手开始对话,获取写作建议和创作支持'}
            </p>
          </div>
        </div>
        <div className="features-section">
          <div className="features-grid">
            <button 
              className="feature-btn blue" 
              disabled={modelLoading}
              onClick={() => handleAiFeature('生成段落')}
            >
              生成段落
            </button>
            <button 
              className="feature-btn purple" 
              disabled={modelLoading}
              onClick={() => handleAiFeature('润色文本')}
            >
              润色文本
            </button>
            <button 
              className="feature-btn green" 
              disabled={modelLoading}
              onClick={() => handleAiFeature('续写故事')}
            >
              续写故事
            </button>
            <button 
              className="feature-btn orange" 
              disabled={modelLoading}
              onClick={() => handleAiFeature('角色塑造')}
            >
              角色塑造
            </button>
            <button 
              className="feature-btn red" 
              disabled={modelLoading}
              onClick={() => handleAiFeature('情节大纲')}
            >
              情节大纲
            </button>
            <button 
              className="feature-btn yellow" 
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

export default WritingSpace;