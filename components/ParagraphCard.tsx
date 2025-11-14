/**
 * 段落卡片组件
 * 
 * 功能:
 * - 展示单个段落内容(单行格式)
 * - 显示元数据(字节数、字符数、章节、标签等)
 * - 支持复制操作
 * - 语义标签彩色显示
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ParagraphMeta {
  chapter?: string;
  isDialogue?: boolean;
  semanticTags?: string[];
  position?: number;
  cleaned?: boolean;
  original_line_count?: number;
  completeness_score?: number;
}

interface ParagraphCardProps {
  index: number;
  content: string;
  length_bytes: number;
  length_chars: number;
  length_chinese: number;
  meta: ParagraphMeta;
  onCopy?: (content: string) => void;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({
  index,
  content,
  length_bytes,
  length_chars,
  length_chinese,
  meta,
  onCopy
}) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(content);
    });
  };
  
  // 语义标签颜色映射
  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      dialogue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      time_marker: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      space_marker: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      action: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      emotion_shift: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    };
    return colors[tag] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
  };
  
  return (
    <div className="bg-white dark:bg-[#2C2C2C] p-3 rounded-lg border border-gray-200 dark:border-white/10 hover:border-cyan-400 dark:hover:border-cyan-500 transition-colors">
      {/* 标题栏 */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm text-gray-800 dark:text-white/90">
            段落 #{index + 1}
          </h4>
          {meta.chapter && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {meta.chapter}
            </span>
          )}
          {meta.cleaned && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
              已清洗
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      
      {/* 段落内容(单行显示) */}
      <div className="text-sm text-gray-700 dark:text-white/80 bg-white dark:bg-[#2C2C2C] p-2 rounded mb-2 font-sans line-clamp-3">
        {content}
      </div>
      
      {/* 元数据显示 */}
      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">字节数</span>
          <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
            {length_bytes}B
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">字符数</span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
            {length_chars}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">中文字符</span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
            {length_chinese}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400">完整性</span>
          <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
            {meta.completeness_score ? (meta.completeness_score * 100).toFixed(0) : 0}%
          </span>
        </div>
      </div>
      
      {/* 语义标签 */}
      {meta.semanticTags && meta.semanticTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.semanticTags.map((tag, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 text-[10px] rounded ${getTagColor(tag)}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParagraphCard;