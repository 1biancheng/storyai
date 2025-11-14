/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { AgentLog, AgentRole } from '../types.ts';
import { Bot, FileText, ListOrdered, BookOpenText, ClipboardCheck, PenSquare, AlertTriangle, User, Highlighter, BadgeCheck, ScrollText, Sparkles, Link, BarChartHorizontal, Copy, Check } from 'lucide-react';

interface AgentLogItemProps {
  log: AgentLog;
}

const AgentAvatar: React.FC<{ agent: AgentRole }> = ({ agent }) => {
  const commonClasses = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white";
  const iconSize = 18;

  switch (agent) {
    case AgentRole.DATA_ANALYZER:
      return <div className={`${commonClasses} bg-sky-500/50`}><BarChartHorizontal size={iconSize} /></div>;
    case AgentRole.OUTLINE_GENERATOR:
      return <div className={`${commonClasses} bg-purple-500/50`}><ListOrdered size={iconSize} /></div>;
    case AgentRole.GENERATOR_AGENT:
      return <div className={`${commonClasses} bg-pink-500/50`}><Sparkles size={iconSize} /></div>;
    case AgentRole.CHAPTER_WRITER:
      return <div className={`${commonClasses} bg-green-500/50`}><BookOpenText size={iconSize} /></div>;
    case AgentRole.SECTION_WRITER:
      return <div className={`${commonClasses} bg-lime-500/50`}><Highlighter size={iconSize} /></div>;
    case AgentRole.REVIEWER:
      return <div className={`${commonClasses} bg-yellow-500/50`}><ClipboardCheck size={iconSize} /></div>;
    case AgentRole.QUALITY_EVALUATOR:
      return <div className={`${commonClasses} bg-orange-500/50`}><BadgeCheck size={iconSize} /></div>;
    case AgentRole.EDITOR:
      return <div className={`${commonClasses} bg-teal-500/50`}><PenSquare size={iconSize} /></div>;
    case AgentRole.SUMMARY_AGENT:
      return <div className={`${commonClasses} bg-indigo-500/50`}><ScrollText size={iconSize} /></div>;
    case AgentRole.SYSTEM:
      return <div className={`${commonClasses} bg-red-500/50`}><AlertTriangle size={iconSize} /></div>;
    case AgentRole.COORDINATOR:
    default:
      return <div className={`${commonClasses} bg-gray-500/50`}><Bot size={iconSize} /></div>;
  }
};

const AgentLogItem: React.FC<AgentLogItemProps> = ({ log }) => {
  const [copied, setCopied] = useState(false);

  const contentToCopy = useMemo(() => {
    // Exclude agents that log truncated data snippets, as copying them isn't useful.
    if (log.agent === AgentRole.CHAPTER_WRITER || log.agent === AgentRole.SUMMARY_AGENT) {
        return null;
    }

    let content: string | null = null;
    if (log.data) {
        content = typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2);
    } else {
        content = log.message;
    }
    
    // Also exclude messages that are just status updates and don't contain meaningful AI output.
    if (!log.data && (log.message.includes('开始项目') || log.message.includes('使用工作流') || log.message.includes('执行步骤'))) {
        return null;
    }

    return content;
  }, [log]);

  const handleCopy = () => {
      if (!contentToCopy) return;
      navigator.clipboard.writeText(contentToCopy).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset icon after 2 seconds
      });
  };

  const renderMessageContent = () => {
    let content = <p className="text-sm text-gray-800 dark:text-[#E2E2E2]">{log.message}</p>;
    
    if (log.data) {
        let dataContent;
        if (typeof log.data === 'string') {
            dataContent = <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{log.data}"</p>;
        } else {
            dataContent = (
                <pre className="text-xs bg-gray-200 dark:bg-[#121212] p-2 rounded-md mt-2 max-h-40 overflow-auto">
                    <code>{JSON.stringify(log.data, null, 2)}</code>
                </pre>
            );
        }
        content = <>
            {content}
            {dataContent}
        </>;
    }

    if (log.groundingChunks && log.groundingChunks.length > 0) {
      const uniqueUris = new Set<string>();
      const links = log.groundingChunks
        .filter((chunk: any) => (chunk.web && chunk.web.uri) || (chunk.maps && chunk.maps.uri) || (chunk.maps?.placeAnswerSources && chunk.maps.placeAnswerSources.length > 0))
        .map((chunk: any) => {
          let uri = '';
          let title = '';
          if (chunk.web) {
            uri = chunk.web.uri;
            title = chunk.web.title || new URL(uri).hostname;
          } else if (chunk.maps) {
            uri = chunk.maps.uri;
            title = chunk.maps.title || 'Maps';
            // Also add review snippets if they exist
            if (chunk.maps.placeAnswerSources && Array.isArray(chunk.maps.placeAnswerSources)) {
                chunk.maps.placeAnswerSources.forEach((source: any) => {
                    if (source.reviewSnippets && source.reviewSnippets.length > 0) {
                        source.reviewSnippets.forEach((snippet: any) => {
                            if (snippet.uri && !uniqueUris.has(snippet.uri)) {
                                uniqueUris.add(snippet.uri);
                                links.push(
                                    <a
                                        key={snippet.uri}
                                        href={snippet.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-blue-500 hover:underline dark:text-blue-400 text-xs"
                                    >
                                        <Link size={12} /> {snippet.title || `Review for ${title}`}
                                    </a>
                                );
                            }
                        });
                    }
                });
            }
          }

          if (uri && !uniqueUris.has(uri)) {
            uniqueUris.add(uri);
            return (
              <a
                key={uri}
                href={uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-500 hover:underline dark:text-blue-400 text-xs"
              >
                <Link size={12} /> {title}
              </a>
            );
          }
          return null;
        })
        .filter(Boolean); // Remove null entries

      if (links.length > 0) {
        content = (
          <>
            {content}
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                <p className="font-semibold mb-1">参考资料:</p>
                <div className="flex flex-wrap gap-2">
                    {links}
                </div>
            </div>
          </>
        );
      }
    }

    return content;
  };

  return (
    <div className="flex items-start gap-3 mb-4">
      <AgentAvatar agent={log.agent} />
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{log.agent}</p>
            {log.isLoading && (
                 <div className="flex items-center space-x-1.5 text-gray-500 dark:text-[#A8ABB4]">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                 </div>
            )}
        </div>
        <div className="p-3 mt-1 rounded-lg bg-gray-100 border border-gray-200 dark:bg-white/5 dark:border-white/5 w-full relative group">
            {contentToCopy && !log.isLoading && log.agent !== AgentRole.SYSTEM && (
                <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200/50 dark:bg-black/20 text-gray-500 dark:text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-gray-300/70 dark:hover:bg-black/40"
                    aria-label={copied ? "已复制" : "复制到剪贴板"}
                    title={copied ? "已复制" : "复制到剪贴板"}
                >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
            )}
            {renderMessageContent()}
        </div>
      </div>
    </div>
  );
};

export default AgentLogItem;