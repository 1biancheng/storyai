/**
 * WritingSpaceEnhanced - Enhanced writing space with advanced features
 * Features: file upload, drag-and-drop chapter reordering, prompt cards, content links
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Upload, 
  Link, 
  MessageSquare, 
  Settings, 
  FileText,
  FolderOpen,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Search,
  X
} from 'lucide-react';
import EnhancedChapterList from './EnhancedChapterList';
import WritingDesk from './ChatInterface';
import type { 
  ProjectData, 
  Chapter, 
  AIModel, 
  ContentLink, 
  FileAttachment,
  PromptCard,
  WritingProcessStatus
} from '../types';
import * as cardEditorService from '../services/cardEditorService';
import * as modelManager from '../services/modelManager';

interface WritingSpaceEnhancedProps {
  project?: ProjectData;
}

export default function WritingSpaceEnhanced({ project }: WritingSpaceEnhancedProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(project?.id || null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [contentLinks, setContentLinks] = useState<ContentLink[]>([]);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showPromptCards, setShowPromptCards] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showContentLinks, setShowContentLinks] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load projects from localStorage
  useEffect(() => {
    const savedProjects = localStorage.getItem('storyWeaverProjects');
    if (savedProjects) {
      try {
        const loadedProjects = JSON.parse(savedProjects) as ProjectData[];
        setProjects(loadedProjects);
        
        // Auto-select first project if no project selected and no prop project
        if (!project && !selectedProjectId && loadedProjects.length > 0) {
          setSelectedProjectId(loadedProjects[0].id);
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    }
  }, []);

  // Load chapters when project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    
    const savedChapters = localStorage.getItem(`chapters_${selectedProjectId}`);
    if (savedChapters) {
      try {
        const loadedChapters = JSON.parse(savedChapters) as Chapter[];
        setChapters(loadedChapters);
      } catch (error) {
        console.error('Failed to load chapters:', error);
        setChapters([]);
      }
    } else {
      setChapters([]);
    }
    
    // Load content links
    const savedLinks = localStorage.getItem(`contentLinks_${selectedProjectId}`);
    if (savedLinks) {
      try {
        const loadedLinks = JSON.parse(savedLinks) as ContentLink[];
        setContentLinks(loadedLinks);
      } catch (error) {
        console.error('Failed to load content links:', error);
        setContentLinks([]);
      }
    } else {
      setContentLinks([]);
    }
    
    // Load file attachments
    const savedFiles = localStorage.getItem(`fileAttachments_${selectedProjectId}`);
    if (savedFiles) {
      try {
        const loadedFiles = JSON.parse(savedFiles) as FileAttachment[];
        setFileAttachments(loadedFiles);
      } catch (error) {
        console.error('Failed to load file attachments:', error);
        setFileAttachments([]);
      }
    } else {
      setFileAttachments([]);
    }
  }, [selectedProjectId]);

  // Load prompt cards and AI models
  useEffect(() => {
    try {
      const cards = cardEditorService.getPromptCards();
      setPromptCards(cards);
      
      const models = modelManager.getModelConfigs().map(config => ({
        id: config.id,
        name: config.name,
        provider: config.type || 'unknown',
        modelId: config.modelId,
        isDefault: config.isDefault
      }));
      setAiModels(models);
      
      // Set default model
      const defaultModel = models.find(m => m.isDefault) || models[0];
      if (defaultModel) {
        setSelectedModelId(defaultModel.id);
      }
    } catch (error) {
      console.error('Failed to load models or cards:', error);
    }
  }, []);

  // Save chapters to localStorage
  const saveChapters = (updatedChapters: Chapter[]) => {
    setChapters(updatedChapters);
    if (selectedProjectId) {
      localStorage.setItem(`chapters_${selectedProjectId}`, JSON.stringify(updatedChapters));
    }
  };

  // Save content links to localStorage
  const saveContentLinks = (updatedLinks: ContentLink[]) => {
    setContentLinks(updatedLinks);
    if (selectedProjectId) {
      localStorage.setItem(`contentLinks_${selectedProjectId}`, JSON.stringify(updatedLinks));
    }
  };

  // Save file attachments to localStorage
  const saveFileAttachments = (updatedFiles: FileAttachment[]) => {
    setFileAttachments(updatedFiles);
    if (selectedProjectId) {
      localStorage.setItem(`fileAttachments_${selectedProjectId}`, JSON.stringify(updatedFiles));
    }
  };

  // Create new chapter
  const handleCreateChapter = (position: number) => {
    if (!selectedProjectId) return;
    
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      projectId: selectedProjectId,
      chapterNumber: position + 1,
      title: `第${position + 1}章`,
      content: '',
      wordCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const updatedChapters = [...chapters];
    updatedChapters.splice(position, 0, newChapter);
    
    // Update chapter numbers
    updatedChapters.forEach((chapter, index) => {
      chapter.chapterNumber = index + 1;
    });
    
    saveChapters(updatedChapters);
    setSelectedChapterId(newChapter.id);
  };

  // Delete chapters
  const handleDeleteChapters = (chapterIds: string[]) => {
    const updatedChapters = chapters.filter(ch => !chapterIds.includes(ch.id));
    
    // Update chapter numbers
    updatedChapters.forEach((chapter, index) => {
      chapter.chapterNumber = index + 1;
    });
    
    saveChapters(updatedChapters);
    
    // Clear selection if deleted chapter was selected
    if (selectedChapterId && chapterIds.includes(selectedChapterId)) {
      setSelectedChapterId(null);
      setEditorContent('');
      setIsEditing(false);
    }
  };

  // Duplicate chapter
  const handleDuplicateChapter = (chapterId: string) => {
    const chapterToDuplicate = chapters.find(ch => ch.id === chapterId);
    if (!chapterToDuplicate) return;
    
    const newChapter: Chapter = {
      ...chapterToDuplicate,
      id: crypto.randomUUID(),
      title: `${chapterToDuplicate.title} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const chapterIndex = chapters.findIndex(ch => ch.id === chapterId);
    const updatedChapters = [...chapters];
    updatedChapters.splice(chapterIndex + 1, 0, newChapter);
    
    saveChapters(updatedChapters);
  };

  // Reorder chapters
  const handleReorderChapters = (fromIndex: number, toIndex: number) => {
    const updatedChapters = [...chapters];
    const [movedChapter] = updatedChapters.splice(fromIndex, 1);
    updatedChapters.splice(toIndex, 0, movedChapter);
    
    // Update chapter numbers
    updatedChapters.forEach((chapter, index) => {
      chapter.chapterNumber = index + 1;
    });
    
    saveChapters(updatedChapters);
  };

  // Update chapter
  const handleUpdateChapter = (chapterId: string, updates: Partial<Chapter>) => {
    const updatedChapters = chapters.map(ch => 
      ch.id === chapterId 
        ? { ...ch, ...updates, updatedAt: Date.now() }
        : ch
    );
    saveChapters(updatedChapters);
  };

  // Handle chapter selection
  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    const selectedChapter = chapters.find(ch => ch.id === chapterId);
    if (selectedChapter) {
      setEditorContent(selectedChapter.content);
      setIsEditing(true);
    }
  };

  // Save current chapter content
  const handleSaveChapter = () => {
    if (!selectedChapterId) return;
    
    const wordCount = editorContent.replace(/\s+/g, '').length;
    handleUpdateChapter(selectedChapterId, {
      content: editorContent,
      wordCount
    });
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newAttachments: FileAttachment[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString()
    }));
    
    const updatedFiles = [...fileAttachments, ...newAttachments];
    saveFileAttachments(updatedFiles);
    setShowFileUpload(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Create content link
  const handleCreateContentLink = (title: string, type: 'chapter' | 'section' | 'note', targetId: string) => {
    if (!selectedProjectId) return;
    
    const newLink: ContentLink = {
      id: crypto.randomUUID(),
      title,
      type,
      targetId,
      projectId: selectedProjectId
    };
    
    const updatedLinks = [...contentLinks, newLink];
    saveContentLinks(updatedLinks);
  };

  // Delete content link
  const handleDeleteContentLink = (linkId: string) => {
    const updatedLinks = contentLinks.filter(link => link.id !== linkId);
    saveContentLinks(updatedLinks);
  };

  // Delete file attachment
  const handleDeleteFileAttachment = (fileId: string) => {
    const updatedFiles = fileAttachments.filter(file => file.id !== fileId);
    saveFileAttachments(updatedFiles);
  };

  // Apply prompt card to editor
  const handleApplyPromptCard = (card: PromptCard) => {
    if (!isEditing) return;
    
    // Insert prompt at cursor position or append to content
    const cursorPosition = editorContent.length;
    const newContent = editorContent.substring(0, cursorPosition) + 
                      '\n\n' + card.prompt + '\n\n' + 
                      editorContent.substring(cursorPosition);
    
    setEditorContent(newContent);
  };

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const selectedChapter = chapters.find(ch => ch.id === selectedChapterId);
  const selectedModel = aiModels.find(m => m.id === selectedModelId);

  // Filter chapters based on search term
  const filteredChapters = chapters.filter(chapter => 
    chapter.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chapter.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Fixed Menu Bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-20">
        <div className="px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">星达小说创作系统</h1>
            <nav className="hidden md:flex space-x-1">
              <button className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md">
                创作空间
              </button>
              <button 
                onClick={() => window.location.hash = '#project'}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                项目管理
              </button>
              <button 
                onClick={() => window.location.hash = '#elements'}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                元素库
              </button>
              <button 
                onClick={() => window.location.hash = '#templates'}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                模板引擎
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 z-10">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Project Selector */}
            <button
              onClick={() => setShowProjectManager(!showProjectManager)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <FolderOpen size={16} className="text-blue-600" />
              <span className="text-sm font-medium">
                {activeProject?.projectName || '未选择项目'}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-500 transition-transform ${showProjectManager ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索章节标题和内容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Action Buttons */}
            <button
              onClick={() => setShowPromptCards(!showPromptCards)}
              className={`p-2 rounded-md transition-colors ${
                showPromptCards 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="提示词卡片"
            >
              <FileText size={18} />
            </button>
            
            <button
              onClick={() => setShowFileUpload(!showFileUpload)}
              className={`p-2 rounded-md transition-colors ${
                showFileUpload 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="文件上传"
            >
              <Upload size={18} />
            </button>
            
            <button
              onClick={() => setShowContentLinks(!showContentLinks)}
              className={`p-2 rounded-md transition-colors ${
                showContentLinks 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="内容链接"
            >
              <Link size={18} />
            </button>
            
            <button
              onClick={handleSaveChapter}
              disabled={!isEditing || !selectedChapterId}
              className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="保存章节"
            >
              <Save size={18} />
            </button>
          </div>
        </div>

        {/* Project Manager Dropdown */}
        {showProjectManager && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop to prevent clicks outside */}
            <div 
              className="absolute inset-0 bg-black bg-opacity-20"
              onClick={() => setShowProjectManager(false)}
            />
            {/* Dropdown content */}
            <div className="absolute top-full left-0 right-0 mt-1 px-4">
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-200">
                  <button
                    onClick={() => {
                      // Navigate to project manager
                      window.location.hash = '#project';
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    <Plus size={14} />
                    <span>项目管理</span>
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setShowProjectManager(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        p.id === selectedProjectId
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium truncate">{p.projectName}</div>
                      <div className="text-xs text-gray-500">{p.projectGenre}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Chapter List */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          {/* Save Button */}
          <div className="px-4 py-3 border-b border-gray-200">
            <button
              onClick={handleSaveChapter}
              disabled={!isEditing || !selectedChapterId}
              className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
            >
              <Save size={14} />
              保存章节
            </button>
          </div>
          <EnhancedChapterList
            chapters={filteredChapters}
            selectedChapterId={selectedChapterId}
            onChapterSelect={handleChapterSelect}
            onChapterCreate={handleCreateChapter}
            onChapterDelete={handleDeleteChapters}
            onChapterDuplicate={handleDuplicateChapter}
            onChapterReorder={handleReorderChapters}
            onChapterUpdate={handleUpdateChapter}
          />
        </div>

        {/* Center - Editor */}
        <div className="flex-1 bg-white flex flex-col">
          {isEditing && selectedChapter ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  {selectedChapter.chapterNumber}. {selectedChapter.title}
                </h2>
                <div className="text-sm text-gray-500">
                  {selectedChapter.wordCount.toLocaleString()} 字
                  {selectedChapter.updatedAt && (
                    <span className="ml-2">
                      更新于 {new Date(selectedChapter.updatedAt * 1000).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="开始写作..."
                  className="w-full h-full p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p>选择一个章节开始编辑</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Tools and Panels */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-hidden flex flex-col">
          {/* Model Selector Panel */}
          <div className="border-b border-gray-200">
            <div className="px-4 py-3 flex justify-between items-center">
              <h3 className="font-medium text-gray-900">模型选择</h3>
              <Settings size={16} className="text-gray-400" />
            </div>
            <div className="px-4 pb-3">
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {aiModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project and Prompt Cards Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Project Selector */}
            <div className="border-b border-gray-200">
              <div className="px-4 py-3 flex justify-between items-center">
                <h3 className="font-medium text-gray-900">项目选择</h3>
                <button
                  onClick={() => setShowProjectManager(!showProjectManager)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown size={16} className={`transition-transform ${showProjectManager ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className="px-4 pb-3">
                <div className="text-sm text-gray-700 truncate">
                  {projects.find(p => p.id === selectedProjectId)?.projectName || '未选择项目'}
                </div>
                <div className="text-xs text-gray-500">
                  {projects.find(p => p.id === selectedProjectId)?.projectGenre || ''}
                </div>
              </div>
            </div>

            {/* Prompt Cards */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-medium text-gray-900">提示词卡片</h3>
                <button
                  onClick={() => setShowPromptCards(!showPromptCards)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown size={16} className={`transition-transform ${showPromptCards ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {promptCards.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无提示词卡片</p>
                ) : (
                  <div className="space-y-2">
                    {promptCards.map(card => (
                      <div
                        key={card.id}
                        onClick={() => handleApplyPromptCard(card)}
                        className="p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-gray-900">{card.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {card.prompt.substring(0, 100)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 p-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setShowFileUpload(!showFileUpload)}
                className={`p-2 rounded-md transition-colors flex flex-col items-center justify-center ${
                  showFileUpload 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="文件上传"
              >
                <Upload size={16} />
                <span className="text-xs mt-1">文件</span>
              </button>
              
              <button
                onClick={() => setShowContentLinks(!showContentLinks)}
                className={`p-2 rounded-md transition-colors flex flex-col items-center justify-center ${
                  showContentLinks 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="内容链接"
              >
                <Link size={16} />
                <span className="text-xs mt-1">链接</span>
              </button>
              
              <button
                onClick={handleSaveChapter}
                disabled={!isEditing || !selectedChapterId}
                className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex flex-col items-center justify-center"
                title="保存章节"
              >
                <Save size={16} />
                <span className="text-xs mt-1">保存</span>
              </button>
            </div>
          </div>

          {/* AI Chat Panel */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">AI 对话</h3>
              <div className="text-xs text-gray-500">
                {selectedModel?.name || '未选择模型'}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <WritingDesk 
                logs={[]}
                status={'IDLE' as WritingProcessStatus}
                projectData={projects.find(p => p.id === selectedProjectId) || null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}