/**
 * ChapterEditor - Markdown editor with real-time preview
 * Uses native textarea + marked library for lightweight implementation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';
import { Save, Eye, EyeOff } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useChapterStore } from '../stores/chapterStore';
import { getCurrentTimestamp } from '../utils/timeUtils.ts';

interface ChapterEditorProps {
  projectId: string;
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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

  // Load chapter data when selection changes
  useEffect(() => {
    if (currentChapter && currentChapter.id !== lastChapterIdRef.current) {
      setTitle(currentChapter.title);
      setContent(currentChapter.content);
      setLastSaved(currentChapter.updatedAt);
      lastChapterIdRef.current = currentChapter.id;
    }
  }, [currentChapter?.id, currentChapter?.title, currentChapter?.content, currentChapter?.updatedAt]);

  // Auto-save handler with debounce (stable reference)
  const autoSaveRef = useRef(
    debounce(async (chapterId: string, updatedTitle: string, updatedContent: string, saveFn: typeof saveChapter) => {
      setIsSaving(true);
      try {
        await saveFn(chapterId, {
          title: updatedTitle,
          content: updatedContent
        });
        setLastSaved(getCurrentTimestamp());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, 3000)
  );

  // Trigger auto-save when content changes
  useEffect(() => {
    if (currentChapterId && currentChapter) {
      // Only save if content actually changed
      if (title !== currentChapter.title || content !== currentChapter.content) {
        autoSaveRef.current(currentChapterId, title, content, saveChapter);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, currentChapterId]);

  // Manual save handler
  const handleManualSave = async () => {
    if (!currentChapterId) return;
    setIsSaving(true);
    try {
      await saveChapter(currentChapterId, { title, content });
      setLastSaved(Date.now());
    } finally {
      setIsSaving(false);
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
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
            title="立即保存 (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '保存中...' : '保存'}</span>
          </button>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title={showPreview ? '隐藏预览' : '显示预览'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showPreview ? '隐藏' : '显示'} 预览</span>
          </button>
        </div>

        <div className="text-xs text-gray-500">
          {isSaving ? '保存中...' : lastSaved ? `已保存 ${formatLastSaved()}` : ''}
        </div>
      </div>

      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="章节标题..."
        className="px-4 py-3 text-2xl font-bold border-b border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full h-full p-4 font-mono text-sm border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
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