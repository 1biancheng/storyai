/**
 * ChapterNavigator - 章节导航组件
 * 包含章节列表展示和拖拽排序功能
 */

import React, { useState } from 'react';
import { useChapterStore } from '../stores/chapterStore';
import { Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface ChapterNavigatorProps {
  projectId: string;
  selectedChapterId: string | null;
  onChapterSelect: (chapterId: string) => void;
  onChapterCreate: () => void;
}

export default function ChapterNavigator({ 
  projectId, 
  selectedChapterId, 
  onChapterSelect,
  onChapterCreate 
}: ChapterNavigatorProps) {
  const { chapters, reorderChaptersAPI, removeChapter } = useChapterStore();
  
  // 拖拽排序相关状态
  const [draggedChapter, setDraggedChapter] = useState<string | null>(null);
  const [dragOverChapter, setDragOverChapter] = useState<string | null>(null);
  
  // 删除确认对话框状态
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [chapterToDelete, setChapterToDelete] = useState<{id: string, title: string} | null>(null);

  // 过滤并排序当前项目的章节
  const currentProjectChapters = chapters
    .filter(ch => ch.projectId === projectId)
    .sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : a.chapterNumber;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : b.chapterNumber;
      return orderA - orderB;
    });

  // 拖拽排序相关函数
  const handleDragStart = (e: React.DragEvent, chapterId: string) => {
    setDraggedChapter(chapterId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedChapter(null);
    setDragOverChapter(null);
  };

  const handleDragOver = (e: React.DragEvent, chapterId: string) => {
    e.preventDefault();
    // 只允许在同一项目内拖拽
    const draggedChapterObj = chapters.find(ch => ch.id === draggedChapter);
    const targetChapterObj = chapters.find(ch => ch.id === chapterId);
    
    if (draggedChapterObj && targetChapterObj && 
        draggedChapterObj.projectId === targetChapterObj.projectId &&
        draggedChapter !== chapterId) {
      setDragOverChapter(chapterId);
    }
  };

  const handleDragLeave = () => {
    setDragOverChapter(null);
  };

  const handleDrop = async (e: React.DragEvent, targetChapterId: string) => {
    e.preventDefault();
    if (!draggedChapter || draggedChapter === targetChapterId || !projectId) return;

    // 只处理当前项目的章节
    const draggedChapterObj = currentProjectChapters.find(ch => ch.id === draggedChapter);
    const targetChapterObj = currentProjectChapters.find(ch => ch.id === targetChapterId);
    
    if (!draggedChapterObj || !targetChapterObj) return;

    const draggedIndex = currentProjectChapters.findIndex(ch => ch.id === draggedChapter);
    const targetIndex = currentProjectChapters.findIndex(ch => ch.id === targetChapterId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // 重新排序当前项目的章节
    const newCurrentProjectChapters = [...currentProjectChapters];
    const [draggedItem] = newCurrentProjectChapters.splice(draggedIndex, 1);
    newCurrentProjectChapters.splice(targetIndex, 0, draggedItem);
    
    // 获取新的章节ID顺序
    const chapterIds = newCurrentProjectChapters.map(ch => ch.id);
    
    // 更新到后端API
    try {
      await reorderChaptersAPI(projectId, chapterIds);
      
      // 显示成功通知
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '章节顺序更新成功!';
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 2000);
    } catch (error) {
      console.error('更新章节顺序失败:', error);
      // 显示错误通知
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '章节顺序更新失败,请重试!';
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 2000);
    }
    
    setDragOverChapter(null);
  };

  // 删除章节相关函数
  const handleDeleteClick = (e: React.MouseEvent, chapterId: string, chapterTitle: string) => {
    e.stopPropagation(); // 阻止事件冒泡，不触发章节选择
    setChapterToDelete({ id: chapterId, title: chapterTitle });
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!chapterToDelete) return;
    
    try {
      await removeChapter(chapterToDelete.id);
      
      // 显示成功通知
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = `章节「${chapterToDelete.title}」删除成功！`;
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 2000);
    } catch (error) {
      console.error('删除章节失败:', error);
      // 显示错误通知
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '删除章节失败，请重试！';
      document.body.appendChild(notification);
      setTimeout(() => {
        notification.remove();
      }, 2000);
    } finally {
      setDeleteConfirmVisible(false);
      setChapterToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setChapterToDelete(null);
  };

  return (
    <div className="p-4 flex-grow overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">章节管理</h3>
        <button
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          onClick={onChapterCreate}
          title="创建新章节"
        >
          +
        </button>
      </div>
      <ul className="space-y-1">
        {currentProjectChapters.map((chapter) => (
          <li 
            key={chapter.id}
            draggable
            onDragStart={(e) => handleDragStart(e, chapter.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, chapter.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, chapter.id)}
            className={`group p-2 rounded-lg cursor-pointer transition-colors ${
              chapter.id === selectedChapterId ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
            } ${
              draggedChapter === chapter.id ? 'opacity-50' : ''
            } ${
              dragOverChapter === chapter.id ? 'border-t-2 border-blue-500' : ''
            }`}
            onClick={() => onChapterSelect(chapter.id)}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm truncate flex-1">{chapter.title}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  草稿
                </span>
                <button
                  onClick={(e) => handleDeleteClick(e, chapter.id, chapter.title)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                  title="删除章节"
                >
                  <Trash2 size={14} className="text-red-500" />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">{chapter.wordCount} 字</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                章节
              </span>
            </div>
          </li>
        ))}
        {currentProjectChapters.length === 0 && (
          <li className="p-2 text-gray-500 dark:text-gray-400 text-sm italic">暂无章节</li>
        )}
      </ul>
      
      {/* 删除确认对话框 */}
      <ConfirmDialog
        visible={deleteConfirmVisible}
        title="确认删除章节"
        message={`您确定要删除章节「${chapterToDelete?.title}」吗？此操作不可恢复！`}
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
