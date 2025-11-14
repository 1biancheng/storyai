/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Wand2, X, Loader } from 'lucide-react';

interface AIContextMenuProps {
  top: number;
  left: number;
  onClose: () => void;
  onPolish: (prompt: string) => Promise<void>;
}

const AIContextMenu: React.FC<AIContextMenuProps> = ({ top, left, onClose, onPolish }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the menu opens
    inputRef.current?.focus();

    // Close the menu if the user clicks outside of it
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    await onPolish(prompt);
    // The parent component will handle closing after polishing is done.
    setIsLoading(false);
    onClose();
  };

  const quickActions = [
    { label: '润色', prompt: '润色这段文字，使其更清晰、更有吸引力。' },
    { label: '缩短', prompt: '缩短这段文字，同时保留核心信息。' },
    { label: '扩展', prompt: '扩展这段文字，增加更多细节和深度。' },
  ];

  const handleQuickAction = (quickPrompt: string) => {
    setPrompt(quickPrompt);
    inputRef.current?.focus();
  };

  return (
      <div
        ref={menuRef}
        className="absolute z-30 bg-white dark:bg-[#333333] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 p-3 flex flex-col gap-2"
        style={{ top: top + 5, left: left + 5, width: '280px' }}
        // Prevent the editor's context menu from re-opening
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Wand2 size={14}/> AI 助理</p>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.prompt)}
              className="px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="或输入自定义指令..."
            className="w-full h-8 px-2 border border-gray-300 dark:border-[rgba(255,255,255,0.1)] bg-white dark:bg-[#2C2C2C] text-gray-900 dark:text-[#E2E2E2] rounded-md text-sm focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-semibold transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader size={14} className="animate-spin" /> : <Wand2 size={14} />}
            <span>{isLoading ? '处理中...' : '开始'}</span>
          </button>
        </form>
      </div>
  );
};

export default AIContextMenu;