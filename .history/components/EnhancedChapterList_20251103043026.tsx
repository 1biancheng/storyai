/**
 * Enhanced Chapter List Component
 * Features: drag-and-drop reordering, batch operations, chapter selection
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  GripVertical, 
  Plus, 
  Trash2, 
  Copy,
  FileText,
  CheckSquare,
  Square
} from 'lucide-react';
import type { Chapter } from '../types';

interface EnhancedChapterListProps {
  chapters: Chapter[];
  selectedChapterId: string | null;
  onChapterSelect: (chapterId: string) => void;
  onChapterCreate: (position: number) => void;
  onChapterDelete: (chapterIds: string[]) => void;
  onChapterDuplicate: (chapterId: string) => void;
  onChapterReorder: (fromIndex: number, toIndex: number) => void;
  onChapterUpdate: (chapterId: string, updates: Partial<Chapter>) => void;
}

export default function EnhancedChapterList({
  chapters,
  selectedChapterId,
  onChapterSelect,
  onChapterCreate,
  onChapterDelete,
  onChapterDuplicate,
  onChapterReorder,
  onChapterUpdate
}: EnhancedChapterListProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedChapterIndex, setDraggedChapterIndex] = useState<number | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const dragCounter = useRef(0);

  // Toggle chapter expansion
  const toggleChapterExpansion = (chapterId: string) => {
    setExpandedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // Toggle chapter selection for batch operations
  const toggleChapterSelection = (chapterId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent triggering chapter selection
    }
    
    setSelectedChapters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  };

  // Select all chapters
  const selectAllChapters = () => {
    if (selectedChapters.size === chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(chapters.map(ch => ch.id)));
    }
  };

  // Delete selected chapters
  const deleteSelectedChapters = () => {
    if (selectedChapters.size === 0) return;
    
    if (window.confirm(`确定要删除选中的 ${selectedChapters.size} 个章节吗?此操作无法撤销.`)) {
      onChapterDelete(Array.from(selectedChapters));
      setSelectedChapters(new Set());
      setIsBatchMode(false);
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setIsDragging(true);
    setDraggedChapterIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    
    // Store the chapter ID in the data transfer
    e.dataTransfer.setData('text/html', chapters[index].id);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drag enter
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      // Reset visual feedback
    }
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    dragCounter.current = 0;
    
    if (draggedChapterIndex !== null && draggedChapterIndex !== dropIndex) {
      onChapterReorder(draggedChapterIndex, dropIndex);
    }
    
    setIsDragging(false);
    setDraggedChapterIndex(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedChapterIndex(null);
    dragCounter.current = 0;
  };

  // Calculate word count for all chapters
  const totalWordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">章节列表</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBatchMode(!isBatchMode)}
              className={`p-1.5 rounded-md transition-colors ${
                isBatchMode 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title={isBatchMode ? "退出批量操作" : "批量操作"}
            >
              {isBatchMode ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <button
              onClick={() => onChapterCreate(chapters.length)}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              title="添加章节"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        
        {/* Batch operations toolbar */}
        {isBatchMode && (
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllChapters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {selectedChapters.size === chapters.length ? '取消全选' : '全选'}
              </button>
              <span className="text-sm text-gray-500">
                已选择 {selectedChapters.size} 个章节
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={deleteSelectedChapters}
                disabled={selectedChapters.size === 0}
                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent transition-colors"
                title="删除选中章节"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="text-xs text-gray-500">
          共 {chapters.length} 章,约 {totalWordCount.toLocaleString()} 字
        </div>
      </div>

      {/* Chapter List */}
      <div className="flex-1 overflow-y-auto">
        {chapters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText size={32} className="mb-2 text-gray-300" />
            <p>暂无章节</p>
            <button
              onClick={() => onChapterCreate(0)}
              className="mt-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              创建第一章
            </button>
          </div>
        ) : (
          <div className="p-2">
            {chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                draggable={!isBatchMode}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`mb-1 rounded-md transition-colors ${
                  selectedChapterId === chapter.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                } ${isDragging ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center p-2">
                  {/* Drag handle or checkbox */}
                  {isBatchMode ? (
                    <button
                      onClick={(e) => toggleChapterSelection(chapter.id, e)}
                      className="mr-2 p-1 rounded text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      {selectedChapters.has(chapter.id) ? (
                        <CheckSquare size={16} className="text-blue-600" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  ) : (
                    <div className="mr-2 p-1 cursor-move text-gray-400">
                      <GripVertical size={16} />
                    </div>
                  )}

                  {/* Expand/Collapse button */}
                  <button
                    onClick={() => toggleChapterExpansion(chapter.id)}
                    className="mr-2 p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {expandedChapters.has(chapter.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>

                  {/* Chapter content */}
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => !isBatchMode && onChapterSelect(chapter.id)}
                  >
                    <div className="font-medium text-gray-900 truncate">
                      {chapter.chapterNumber}. {chapter.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {chapter.wordCount.toLocaleString()} 字
                      {chapter.updatedAt && (
                        <span className="ml-2">
                          更新于 {new Date(chapter.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2">
                    {!isBatchMode && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onChapterDuplicate(chapter.id);
                          }}
                          className="p-1 rounded text-gray-400 hover:text-blue-600 transition-colors"
                          title="复制章节"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要删除章节 "${chapter.title}" 吗?此操作无法撤销.`)) {
                              onChapterDelete([chapter.id]);
                            }
                          }}
                          className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                          title="删除章节"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {expandedChapters.has(chapter.id) && (
                  <div className="px-2 pb-2 text-sm text-gray-600 border-t border-gray-100 mt-1 pt-2">
                    {chapter.summary ? (
                      <div>
                        <div className="font-medium text-gray-700 mb-1">摘要</div>
                        <p className="text-xs">{chapter.summary}</p>
                      </div>
                    ) : (
                      <div className="text-gray-400 text-xs">暂无摘要</div>
                    )}
                    
                    {chapter.tags && chapter.tags.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium text-gray-700 mb-1">标签</div>
                        <div className="flex flex-wrap gap-1">
                          {chapter.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}