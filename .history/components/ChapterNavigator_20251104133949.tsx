/**
 * ChapterNavigator - Left sidebar component for chapter navigation
 * Displays chapter tree with create/delete/reorder operations
 */

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Trash2, GripVertical, Search } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useChapterStore } from '../stores/chapterStore';
import type { Chapter } from '../types';

interface ChapterNavigatorProps {
  projectId: string;
}

export default function ChapterNavigator({ projectId }: ChapterNavigatorProps) {
  // Use useShallow to prevent unnecessary rerenders when only selecting specific state
  const { chapters, currentChapterId, isLoading } = useChapterStore(
    useShallow((state) => ({
      chapters: state.chapters,
      currentChapterId: state.currentChapterId,
      isLoading: state.isLoading
    }))
  );
  
  // Get actions separately (these are stable references)
  const setCurrentChapter = useChapterStore((state) => state.setCurrentChapter);
  const createChapter = useChapterStore((state) => state.createChapter);
  const removeChapter = useChapterStore((state) => state.removeChapter);
  const fetchChapters = useChapterStore((state) => state.fetchChapters);
  const reorderChaptersAPI = useChapterStore((state) => state.reorderChaptersAPI);
  const validateChapters = useChapterStore((state) => state.validateChapters);
  const fixChapterNumbers = useChapterStore((state) => state.fixChapterNumbers);
  const updateChapterTitleAndNumber = useChapterStore((state) => state.updateChapterTitleAndNumber);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [validationResult, setValidationResult] = useState<boolean | null>(null);

  // Track if initial fetch has happened
  const hasFetchedRef = useRef(false);
  const lastProjectIdRef = useRef<string | null>(null);
  
  // Load chapters on mount or when projectId changes
  useEffect(() => {
    if (projectId && (projectId !== lastProjectIdRef.current || !hasFetchedRef.current)) {
      fetchChapters(projectId);
      hasFetchedRef.current = true;
      lastProjectIdRef.current = projectId;
    }
  }, [projectId, fetchChapters]);

  // Filter chapters based on search term and sort by displayOrder
  const filteredChapters = chapters
    .filter(ch =>
      ch.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ch.chapterNumber.toString().includes(searchTerm)
    )
    .sort((a, b) => {
      // Sort by displayOrder if available, fallback to chapterNumber
      const orderA = a.displayOrder !== undefined ? a.displayOrder : a.chapterNumber;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : b.chapterNumber;
      return orderA - orderB;
    });

  // Handle create chapter
  const handleCreateChapter = async () => {
    if (!newChapterTitle.trim()) return;
    
    // Automatically calculate next chapter number
    const nextChapterNumber = chapters.length + 1;
    
    const result = await createChapter({
      projectId,
      chapterNumber: nextChapterNumber,
      title: newChapterTitle.trim()
    });
    
    if (result) {
      setNewChapterTitle('');
      setShowCreateDialog(false);
      setCurrentChapter(result.id);
    }
  };

  // Handle delete chapter
  const handleDeleteChapter = async (chapterId: string, chapterTitle: string) => {
    if (!confirm(`Delete chapter "${chapterTitle}"? This action cannot be undone.`)) {
      return;
    }
    await removeChapter(chapterId);
  };

  // Handle validate chapters
  const handleValidateChapters = async () => {
    const isValid = await validateChapters(projectId);
    setValidationResult(isValid);
    if (!isValid) {
      alert('章节序号存在问题，请点击"修复序号"按钮进行修复');
    } else {
      alert('章节序号正常');
    }
  };

  // Handle fix chapter numbers
  const handleFixChapterNumbers = async () => {
    const success = await fixChapterNumbers(projectId);
    if (success) {
      alert('章节序号已修复');
      setValidationResult(null);
    } else {
      alert('修复章节序号时出错');
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, chapterId: string) => {
    e.dataTransfer.setData('text/plain', chapterId);
    // Add visual feedback
    e.currentTarget.classList.add('opacity-50');
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Add visual feedback
    e.currentTarget.classList.add('bg-blue-50');
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Remove visual feedback
    e.currentTarget.classList.remove('bg-blue-50');
  };

  // Handle drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetChapterId: string) => {
    e.preventDefault();
    
    // Remove visual feedback
    e.currentTarget.classList.remove('bg-blue-50');
    const draggedChapterId = e.dataTransfer.getData('text/plain');
    
    if (draggedChapterId === targetChapterId) return;
    
    // Get the dragged and target chapters
    const draggedChapter = chapters.find(ch => ch.id === draggedChapterId);
    const targetChapter = chapters.find(ch => ch.id === targetChapterId);
    
    if (!draggedChapter || !targetChapter) return;
    
    // Create a new array with the chapters in the new order
    const newChapters = [...chapters];
    const draggedIndex = newChapters.findIndex(ch => ch.id === draggedChapterId);
    const targetIndex = newChapters.findIndex(ch => ch.id === targetChapterId);
    
    // Remove the dragged chapter from its original position
    const [removed] = newChapters.splice(draggedIndex, 1);
    
    // Insert it at the target position
    newChapters.splice(targetIndex, 0, removed);
    
    // Get the new order of chapter IDs
    const chapterIds = newChapters.map(ch => ch.id);
    
    // Call the API to reorder chapters
    try {
      await reorderChaptersAPI(projectId, chapterIds);
    } catch (error) {
      console.error('Failed to reorder chapters:', error);
      // Optionally show an error message to the user
    }
  };

  // Handle drag end (cleanup)
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // Remove all visual feedback
    e.currentTarget.classList.remove('opacity-50');
    const elements = document.querySelectorAll('.chapter-item');
    elements.forEach(el => {
      el.classList.remove('bg-blue-50');
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">章节</h2>
          <div className="flex space-x-1">
            <button
              onClick={handleValidateChapters}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="验证章节序号"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
            </button>
            {validationResult === false && (
              <button
                onClick={handleFixChapterNumbers}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="修复章节序号"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="创建新章节"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索章节..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">加载中...</div>
        ) : filteredChapters.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm ? '未找到章节' : '还没有章节,创建一个开始写作!'}
          </div>
        ) : (
          <div className="p-2">
            {filteredChapters.map((chapter) => (
              <ChapterItem
                key={chapter.id}
                chapter={chapter}
                isActive={chapter.id === currentChapterId}
                onClick={() => setCurrentChapter(chapter.id)}
                onDelete={() => handleDeleteChapter(chapter.id, chapter.title)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chapter count */}
      <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
        共 {chapters.length} 个章节
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">创建新章节</h3>
            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  章节标题
                </label>
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="章节标题..."
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewChapterTitle('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreateChapter}
                disabled={!newChapterTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual chapter item component
interface ChapterItemProps {
  chapter: Chapter;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, chapterId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetChapterId: string) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  // Add key to satisfy TypeScript, even though it's not actually used as a prop
  key?: string;
}

function ChapterItem({ 
  chapter, 
  isActive, 
  onClick, 
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: ChapterItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chapter.title);
  const [editChapterNumber, setEditChapterNumber] = useState(chapter.chapterNumber.toString());
  const titleInputRef = useRef<HTMLInputElement>(null);
  const updateChapterTitleAndNumber = useChapterStore((state) => state.updateChapterTitleAndNumber);

  // Update edit fields when chapter changes
  useEffect(() => {
    setEditTitle(chapter.title);
    setEditChapterNumber(chapter.chapterNumber.toString());
  }, [chapter.title, chapter.chapterNumber]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  const handleSaveEdit = async () => {
    const newChapterNumber = parseInt(editChapterNumber, 10);
    if (isNaN(newChapterNumber) || newChapterNumber <= 0) {
      alert('请输入有效的章节序号（正整数）');
      return;
    }

    // Update chapter with new title and chapter number
    await updateChapterTitleAndNumber(chapter.id, editTitle, newChapterNumber);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    // Reset to original values
    setEditTitle(chapter.title);
    setEditChapterNumber(chapter.chapterNumber.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={`
        chapter-item group relative p-3 rounded-lg cursor-pointer transition-colors mb-1
        ${isActive ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}
      `}
      draggable
      onDragStart={(e) => onDragStart(e, chapter.id)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, chapter.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (!isEditing) {
          onClick();
        }
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Drag handle */}
      <div className="absolute left-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-50 cursor-move">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="pl-4">
        {isEditing ? (
          // Edit mode
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editChapterNumber}
                onChange={(e) => setEditChapterNumber(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                ref={titleInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-1 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-1">
              <button
                onClick={handleSaveEdit}
                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                保存
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          // Display mode
          <>
            {/* Chapter number and title */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="text-xs text-gray-500 font-medium">序号: {chapter.chapterNumber}</span>
                </div>
                <h3 className={`text-sm font-medium mt-1 truncate ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>
                  {chapter.title}
                </h3>
              </div>

              {/* Actions */}
              {showActions && (
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    title="编辑章节"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="删除章节"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500">
              <span>{chapter.wordCount.toLocaleString()} 字</span>
              {chapter.tags && chapter.tags.length > 0 && (
                <span className="flex items-center space-x-1">
                  {chapter.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
