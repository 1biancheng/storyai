/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Hash, Save, AlertCircle } from 'lucide-react';

interface ChapterCounterToolProps {
  isEnabled: boolean;
  selectedProjectId?: string;
  currentChapterNumber?: number;
  onAutoSave?: (chapterNumber: number, title: string, content: string) => void;
}

export default function ChapterCounterTool({
  isEnabled,
  selectedProjectId,
  currentChapterNumber,
  onAutoSave
}: ChapterCounterToolProps) {
  const [chapterCount, setChapterCount] = useState(0);
  const [autoSaveQueue, setAutoSaveQueue] = useState<Array<{title: string, content: string}>>([]);
  const [lastSavedChapter, setLastSavedChapter] = useState<number | null>(null);

  // 提取章节标题的函数
  const extractChapterTitle = (content: string): string => {
    // 尝试从AI回复中提取章节标题
    const titleMatch = content.match(/第[一二三四五六七八九十\d]+章[::]([^\n]+)/);
    if (titleMatch) {
      return titleMatch[0].trim();
    }
    
    // 如果没有明确的章节格式,尝试提取第一个有意义的标题
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines) {
      if (line.length > 5 && line.length < 50 && !line.startsWith('```')) {
        return line.trim();
      }
    }
    
    // 默认标题
    return `第${currentChapterNumber || chapterCount + 1}章: AI生成内容`;
  };

  // 处理AI内容并自动保存
  const processAIContent = (content: string) => {
    if (!isEnabled || !content.trim()) return;
    
    const title = extractChapterTitle(content);
    const newChapterNumber = currentChapterNumber || chapterCount + 1;
    
    // 添加到自动保存队列
    const newItem = { title, content };
    setAutoSaveQueue(prev => [...prev, newItem]);
    setChapterCount(prev => prev + 1);
    
    // 触发自动保存
    if (onAutoSave && selectedProjectId) {
      onAutoSave(newChapterNumber, title, content);
      setLastSavedChapter(newChapterNumber);
    }
  };

  // 手动保存队列中的内容
  const saveQueuedContent = async () => {
    if (autoSaveQueue.length === 0 || !selectedProjectId) return;
    
    try {
      for (const item of autoSaveQueue) {
        const chapterNumber = (currentChapterNumber || lastSavedChapter || 0) + 1;
        await onAutoSave?.(chapterNumber, item.title, item.content);
      }
      console.log('章节内容自动保存成功');
      setAutoSaveQueue([]);
      setLastSavedChapter((currentChapterNumber || lastSavedChapter || 0) + autoSaveQueue.length);
    } catch (error) {
      console.error('自动保存失败:', error);
      const errorMessage = error instanceof Error ? error.message : '自动保存失败';
      alert(`自动保存失败: ${errorMessage}`);
    }
  };

  // 清空队列
  const clearQueue = () => {
    setAutoSaveQueue([]);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* 工具头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Hash size={16} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">章节计数器</h3>
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
            {chapterCount}
          </span>
        </div>
        
      </div>

      {/* 状态信息 */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">项目状态:</span>
          <span className={selectedProjectId ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {selectedProjectId ? '已选择项目' : '未选择项目'}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">待保存章节:</span>
          <span className="text-blue-600 dark:text-blue-400">{autoSaveQueue.length}</span>
        </div>
        
        {lastSavedChapter && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">最后保存:</span>
            <span className="text-gray-800 dark:text-gray-200">第{lastSavedChapter}章</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-2">
        <button
          onClick={saveQueuedContent}
          disabled={autoSaveQueue.length === 0 || !selectedProjectId}
          className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          <Save size={12} />
          <span>保存队列</span>
        </button>
        
        <button
          onClick={clearQueue}
          disabled={autoSaveQueue.length === 0}
          className="px-3 py-2 text-xs bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
        >
          清空
        </button>
      </div>

      {/* 警告信息 */}
      {!selectedProjectId && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs text-yellow-700 dark:text-yellow-300">
              请先选择一个项目以启用自动保存功能
            </span>
          </div>
        </div>
      )}

      {/* 待保存章节预览 */}
      {autoSaveQueue.length > 0 && (
        <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">待保存章节预览:</h4>
          <div className="space-y-1 max-h-20 overflow-y-auto">
            {autoSaveQueue.map((item, index) => (
              <div key={index} className="text-xs text-gray-600 dark:text-gray-400 truncate">
                {item.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 导出工具信息
export const chapterCounterToolInfo = {
  id: 'chapterCounter',
  name: '章节计数器',
  icon: Hash,
  description: '自动创建章节并保存AI生成内容',
  defaultEnabled: false
};
