import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Send, User, Bot } from 'lucide-react';
import { ProjectData } from '../types.ts';
import * as agentService from '../sample_data/services/agentService.ts';

interface PlanningChatProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const providerLabel = (p?: 'openai' | 'bing' | 'baidu') =>
  p === 'openai' ? 'OpenAI' : p === 'bing' ? 'Bing' : p === 'baidu' ? '百度' : '默认';

const PlanningChat: React.FC<PlanningChatProps> = ({ isOpen, onClose, project }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        '你好!我是你的写作规划顾问.可以告诉我你目前的创作目标或遇到的难题吗?我会结合项目设置给出章节结构、角色设定和任务分解建议.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const projectSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(`项目名称: ${project.projectName}`);
    parts.push(`类型: ${project.projectGenre}`);
    if (project.chapterCount) parts.push(`规划章节数: ${project.chapterCount}`);
    if (project.wordsPerChapter) parts.push(`每章字数目标: ${project.wordsPerChapter}`);
    if (project.totalWords) parts.push(`总字数目标: ${project.totalWords}`);
    parts.push(`联网搜索: ${project.enableSearchGrounding ? '启用' : '禁用'}${project.enableSearchGrounding ? `(${providerLabel(project.searchProvider)})` : ''}`);
    parts.push(`思考模式: ${project.enableThinkingMode ? '启用' : '禁用'}`);
    return parts.join('\n');
  }, [project]);

  const buildPrompt = (history: ChatMessage[], lastUser: string) => {
    const system = `你是资深中文小说规划顾问.根据"项目摘要"和"创作要求",用要点和分步骤方式输出:章节结构建议、角色设定补充、世界观改进点、风格对齐建议,以及需要澄清的问题列表.避免冗长铺陈,优先给出可执行的计划.`;
    const req = project.projectRequirements || '(未填写创作要求)';
    const transcript = history
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}:${m.content}`)
      .join('\n');
    return [
      system,
      '',
      '【项目摘要】',
      projectSummary,
      '',
      '【创作要求】',
      req,
      '',
      '【对话记录】',
      transcript,
      '',
      '【用户当前问题】',
      lastUser,
      '',
      '请只输出这一轮的回答,不要重复历史记录.用中文回复.',
    ].join('\n');
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const prompt = buildPrompt(messages, text);
      const thinkingConfig = project.enableThinkingMode ? { thinkingBudget: 120 } : undefined;
      const enableSearchGrounding = !!project.enableSearchGrounding;
      const searchProvider = project.searchProvider; // 'openai' | 'bing' | 'baidu' | undefined

      const result = await agentService.runAgent(
        prompt,
        undefined, // free-form assistant reply
        undefined, // default model
        thinkingConfig,
        enableSearchGrounding,
        searchProvider
      );

      // Use agentService.runAgent's return shape: { text, groundingChunks? }
      const reply = (result?.text || '').trim() || '(未能生成有效回复,请稍后重试或检查模型配置)';

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `发生错误:${e?.message || e?.toString?.() || '未知错误'}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-3xl bg-white dark:bg-[#1E1E1E] rounded-lg shadow-lg border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">规划对话</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">项目:{project.projectName}(不自动保存,仅供规划参考)</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10" aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="p-3 h-[480px] overflow-y-auto space-y-2">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="mt-1 text-gray-500 dark:text-gray-400">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`max-w-[80%] p-2 rounded-lg text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-orange-500/15 text-orange-700 dark:text-orange-200'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-100'
                }`}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="mt-1 text-gray-500 dark:text-gray-400">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入你的问题或规划目标..."
              className="flex-1 h-9 px-3 rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] text-sm"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="h-9 px-3 rounded-md bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-50 text-orange-600 dark:text-orange-300 text-sm font-medium flex items-center gap-1"
            >
              <Send size={14} /> 发送
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            提示:已根据项目设置启用 {project.enableSearchGrounding ? `联网搜索(${providerLabel(project.searchProvider)})` : '离线模式'},{project.enableThinkingMode ? '开启思考模式' : '关闭思考模式'}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanningChat;