/**
 * InlineAIChatPanel - Right sidebar inline chat with chapter creation tool
 * - Tool selector with "新建章节" form
 * - Calls runAgent for content generation
 * - Creates chapter at tail to avoid number conflict, then reorders
 */

import React, { useState, useMemo } from 'react';
import { useChapterStore } from '../stores/chapterStore';
import { apiClient } from '../services/apiClient';
import { runAgent } from '../sample_data/services/agentService';
import type { ProjectData, Chapter } from '../types';

interface InlineAIChatPanelProps {
  project: ProjectData;
}

type ToolKey = 'create' | 'continue' | 'rewrite' | 'dialogue';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export default function InlineAIChatPanel({ project }: InlineAIChatPanelProps) {
  const { chapters, createChapter, reorderChapters, setCurrentChapter } = useChapterStore();

  const [activeTool, setActiveTool] = useState<ToolKey>('create');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isWorking, setIsWorking] = useState(false);

  // Form state for "新建章节"
  const [chapterTitle, setChapterTitle] = useState('');
  const [contentPrompt, setContentPrompt] = useState('');
  const [targetWordCount, setTargetWordCount] = useState<number | ''>('');
  const [insertPosition, setInsertPosition] = useState<'before' | 'after'>('after');
  const [insertIndex, setInsertIndex] = useState<number>(Math.max(0, chapters.length));

  const orderedChapterIds = useMemo(() => {
    return [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber).map(ch => ch.id);
  }, [chapters]);

  const clampIndex = (idx: number) => {
    const max = chapters.length; // inserting among current items
    return Math.max(0, Math.min(idx, max));
  };

  const buildCreatePrompt = (): string => {
    const wc = typeof targetWordCount === 'number' && targetWordCount > 0 ? targetWordCount : undefined;
    return [
      `项目名称: ${project.projectName}`,
      `类型: ${project.projectGenre}`,
      `需求: ${project.projectRequirements}`,
      `章节标题: ${chapterTitle}`,
      wc ? `目标字数: ${wc}` : undefined,
      contentPrompt ? `写作提示: ${contentPrompt}` : undefined,
      '请以中文 Markdown 输出该章节草稿,避免封面或目录,聚焦正文内容.'
    ].filter(Boolean).join('\n');
  };

  const handleCreateChapter = async () => {
    if (!chapterTitle.trim()) {
      setMessages(m => [...m, { role: 'system', text: '请输入章节标题.' }]);
      return;
    }
    setIsWorking(true);
    const desiredIndexZero = clampIndex(insertPosition === 'before' ? insertIndex - 1 : insertIndex);

    try {
      // 1) Ask AI for content (non-streaming)
      setMessages(m => [...m, { role: 'user', text: `新建章节:<${chapterTitle}>` }]);
      const prompt = buildCreatePrompt();
      let generated = '';
      try {
        const resp = await runAgent(prompt);
        generated = resp.text || '';
        setMessages(m => [...m, { role: 'assistant', text: '已生成章节草稿.' }]);
      } catch (e: any) {
        setMessages(m => [...m, { role: 'system', text: `AI 生成失败,使用空内容占位.原因: ${e?.message || e}` }]);
      }

      // 2) Create chapter at tail number to avoid conflicts
      const tailNumber = chapters.length + 1;
      const created = await createChapter({
        projectId: project.id,
        chapterNumber: tailNumber,
        title: chapterTitle.trim(),
        content: generated || ''
      });
      if (!created) throw new Error('后端创建章节失败');

      // 3) Build new order with insertion at desired position
      const newOrder = [...orderedChapterIds];
      const insertAt = clampIndex(desiredIndexZero);
      newOrder.splice(insertAt, 0, created.id);

      // 4) Call backend reorder API, then update local order
      await apiClient.post(`/api/v1/chapters/project/${project.id}/reorder`, { chapter_ids: newOrder });
      reorderChapters(newOrder);
      setCurrentChapter(created.id);
      setMessages(m => [...m, { role: 'system', text: `章节<${chapterTitle}>已创建并插入至位置 ${insertAt + 1}.` }]);

      // Reset minimal form fields (keep prompt for convenience)
      setChapterTitle('');
    } catch (err: any) {
      setMessages(m => [...m, { role: 'system', text: `创建失败: ${err?.message || err}` }]);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        {(['create','continue','rewrite','dialogue'] as ToolKey[]).map(key => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            className={`px-3 py-1.5 text-sm rounded border ${activeTool === key ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {key === 'create' && '新建章节'}
            {key === 'continue' && '续写本章'}
            {key === 'rewrite' && '改写本章'}
            {key === 'dialogue' && '对话生成'}
          </button>
        ))}
      </div>

      {/* Tool panel */}
      <div className="rounded border border-gray-200 p-3">
        {activeTool === 'create' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">章节标题</label>
              <input
                value={chapterTitle}
                onChange={e => setChapterTitle(e.target.value)}
                placeholder="例如:第一章 风起云涌"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">插入位置</label>
                <select
                  value={insertPosition}
                  onChange={e => setInsertPosition(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="before">在第 N 章之前</option>
                  <option value="after">在第 N 章之后</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">N(当前共 {chapters.length} 章)</label>
                <input
                  type="number"
                  min={0}
                  max={chapters.length}
                  value={insertIndex}
                  onChange={e => setInsertIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">写作提示(可选)</label>
              <textarea
                value={contentPrompt}
                onChange={e => setContentPrompt(e.target.value)}
                placeholder="给 AI 的具体写作指令,背景、事件、人物等"
                className="w-full px-3 py-2 border rounded h-24"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">目标字数(可选)</label>
              <input
                type="number"
                value={targetWordCount === '' ? '' : targetWordCount}
                onChange={e => setTargetWordCount(e.target.value ? Number(e.target.value) : '')}
                placeholder="例如 1500"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreateChapter}
                disabled={isWorking}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isWorking ? '创建中…' : '创建章节'}
              </button>
            </div>
          </div>
        )}

        {activeTool !== 'create' && (
          <div className="text-sm text-gray-500">
            此工具将在后续版本完善:当前仅支持"新建章节".
          </div>
        )}
      </div>

      {/* Chat log */}
      <div className="mt-3 flex-1 overflow-auto border border-gray-200 rounded p-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-xs text-gray-500">暂无聊天记录</div>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === 'assistant' ? 'text-blue-700' : m.role === 'system' ? 'text-gray-600' : 'text-gray-800'}`}>
                <span className="font-medium mr-1">{m.role === 'assistant' ? 'AI' : m.role === 'system' ? '系统' : '我'}:</span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

