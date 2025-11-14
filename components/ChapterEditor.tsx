/**
 * ChapterEditor - Markdown editor with real-time preview
 * Uses native textarea + marked library for lightweight implementation
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { marked } from 'marked';
import { Save, Eye, EyeOff } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useChapterStore } from '../stores/chapterStore';
import { SaveQueue } from '../utils/SaveQueue';

interface ChapterEditorProps {
  projectId: string;
}

export default function ChapterEditor({ projectId }: ChapterEditorProps) {
  // Use useShallow to prevent unnecessary rerenders
  const { chapters, currentChapterId } = useChapterStore(
    useShallow((state) => ({
      chapters: state.chapters,
      currentChapterId: state.currentChapterId
    }))
  );
  
  // Get action separately (stable reference)
  const saveChapter = useChapterStore((state) => state.saveChapter);
  
  const currentChapter = chapters.find(ch => ch.id === currentChapterId);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Track last loaded chapter to prevent unnecessary reloads
  const lastChapterIdRef = useRef<string | null>(null);
  
  // Track if data is being loaded (prevent auto-save during load)
  const isLoadingRef = useRef(false);
  
  // 创建保存队列实例（稳定引用）
  const saveQueue = useMemo(() => {
    return new SaveQueue(async (chapterId, data) => {
      setIsSaving(true);
      try {
        await saveChapter(chapterId, data);
        setLastSaved(Date.now());
      } catch (error) {
        console.error('Auto-save failed:', error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    }, {
      debounceMs: 3000,      // 3秒防抖
      maxRetries: 3,         // 最多重试3次
      retryDelayMs: 2000,    // 重试延迟2秒
      maxConcurrent: 1       // 串行执行，避免并发
    });
  }, [saveChapter]);

  // Load chapter data when selection changes
  useEffect(() => {
    if (currentChapter && currentChapter.id !== lastChapterIdRef.current) {
      // 标记正在加载，阻止自动保存
      isLoadingRef.current = true;
      
      // 取消之前章节的保存任务
      if (lastChapterIdRef.current) {
        saveQueue.cancel(lastChapterIdRef.current);
      }
      
      setTitle(currentChapter.title);
      setContent(currentChapter.content);
      setLastSaved(currentChapter.updatedAt);
      lastChapterIdRef.current = currentChapter.id;
      
      // 延迟解除加载状态，确保不会立即触发保存
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 500);
    }
  }, [currentChapter?.id, currentChapter?.title, currentChapter?.content, currentChapter?.updatedAt, saveQueue]);

  // Trigger auto-save when content changes
  useEffect(() => {
    // 如果正在加载数据，不触发自动保存
    if (isLoadingRef.current) {
      return;
    }
    
    if (currentChapterId && currentChapter) {
      // Only save if content actually changed
      if (title !== currentChapter.title || content !== currentChapter.content) {
        // 使用保存队列处理自动保存
        saveQueue.enqueue(currentChapterId, { title, content });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, currentChapterId, saveQueue]);

  // Manual save handler
  const handleManualSave = async () => {
    if (!currentChapterId) return;
    
    try {
      // 立即保存（跳过队列和防抖）
      await saveQueue.saveNow(currentChapterId, { title, content });
      // 显示保存成功提示
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = '保存成功！';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    } catch (error) {
      console.error('Manual save failed:', error);
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      notification.textContent = `保存失败: ${errorMessage}`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 3000);
    }
  };

  // Calculate word count (removes whitespace for CJK text)
  const wordCount = content.replace(/\s+/g, '').length;

  // Format last saved time
  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const seconds = Math.floor((Date.now() - lastSaved) / 1000);
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
    return `${Math.floor(seconds / 3600)}小时前`;
  };

  // Save status indicator
  const getSaveStatusText = () => {
    if (isSaving) return '正在保存...';
    if (lastSaved) return `上次保存: ${new Date(lastSaved).toLocaleTimeString()}`;
    return '尚未保存';
  };

  // 获取保存状态的颜色
  const getSaveStatusColor = () => {
    if (isSaving) return 'text-yellow-600';
    if (lastSaved) return 'text-green-600';
    return 'text-red-600';
  };

  // Render preview HTML (sanitized by marked)
  const previewHtml = showPreview ? marked(content || '') : '';

  if (!currentChapter) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">未选择章节</p>
          <p className="text-sm">请从左侧侧边栏选择一个章节或创建新章节</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--editor-bg-color)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="立即保存 (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? '保存中...' : '保存'}</span>
          </button>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title={showPreview ? '隐藏预览' : '显示预览'}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPreview ? '隐藏' : '显示'} 预览</span>
          </button>
        </div>

        <div className={`text-xs ${getSaveStatusColor()}`}>
          {getSaveStatusText()}
        </div>
      </div>

      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="章节标题..."
        className="px-2 py-1 text-lg font-bold border-b border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Editor and preview area */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${showPreview ? 'grid grid-cols-2 gap-2' : ''} p-2`}>
          {/* Markdown editor */}
          <div className="h-full">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="开始使用 Markdown 格式写作...

## 示例标题
**粗体文字** 和 *斜体文字*

- 列表项 1
- 列表项 2

> 引用块"
              className="w-full h-full p-4 font-mono rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ color: 'var(--editor-text-color)', backgroundColor: 'var(--editor-bg-color)' }}
              spellCheck={false}
            />
          </div>

          {/* Preview pane */}
          {showPreview && (
            <div className="h-full overflow-y-auto p-4 border border-gray-200 rounded bg-gray-50">
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>{wordCount.toLocaleString()} words</span>
          <span>第 {currentChapter.chapterNumber} 章</span>
          {currentChapter.tags && currentChapter.tags.length > 0 && (
            <span className="flex items-center space-x-1">
              {currentChapter.tags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 bg-gray-200 rounded">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </div>
        <div>
          <span>Markdown 格式</span>
        </div>
      </div>
    </div>
  );
}