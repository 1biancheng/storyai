/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import { AgentLog, ProjectData, WritingProcessStatus, StoryContentType } from '../types.ts';
import AgentLogItem from './MessageItem.tsx';
import { Menu, Bot, Download } from 'lucide-react';
import { marked } from 'marked';

// New component to render the structured story content or fallback to the old format
const StoryContentDisplay: React.FC<{ projectData: ProjectData }> = ({ projectData }) => {
  // Prefer the new structured content if it exists
  if (projectData.storyContent && projectData.storyContent.length > 0) {
    return (
      <div className="space-y-4">
        {projectData.storyContent.map(item => {
          let contentHtml;
          // Handle outline JSON formatting
          if (item.type === StoryContentType.OUTLINE) {
            try {
              // Pretty-print the JSON string
              const parsedJson = JSON.parse(item.content);
              contentHtml = `<pre class="text-xs bg-gray-200 dark:bg-black p-2 rounded-md max-h-60 overflow-auto whitespace-pre-wrap"><code>${JSON.stringify(parsedJson, null, 2)}</code></pre>`;
            } catch (e) {
              // Fallback for invalid JSON
              contentHtml = `<pre><code>${item.content}</code></pre>`;
            }
          } else {
            // Render markdown for chapters and summaries
            contentHtml = marked.parse(item.content) as string;
          }
          return (
            <div key={item.id} className="p-3 rounded-md bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-white/10">
              <h4 className="font-bold text-md text-gray-800 dark:text-white">{item.title}</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none mt-2" dangerouslySetInnerHTML={{ __html: contentHtml }} />
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback for older projects with only finalText
  if (projectData.finalText) {
    const rawMarkup = marked.parse(projectData.finalText) as string;
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rawMarkup }} />
    );
  }

  return null;
};


interface WritingDeskProps {
  logs: AgentLog[];
  status: WritingProcessStatus;
  projectData: ProjectData | null;
}

const WritingDesk: React.FC<WritingDeskProps> = ({
  logs,
  status,
  projectData,
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // Only scroll if the user is already near the bottom of the chat container
    // This prevents unwanted auto-scrolls when the user is viewing earlier content
    if (logsEndRef.current) {
      const chatContainer = logsEndRef.current.closest('.chat-container');
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        // Only auto-scroll if user is already near the bottom (within 100px)
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (isNearBottom) {
          logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);


  const handleExport = () => {
      if (!projectData || (!projectData.finalText && !projectData.storyContent)) return;

      let textToExport = '';

      if (projectData.storyContent && projectData.storyContent.length > 0) {
        // For new projects, export only the chapter content for a clean manuscript
        textToExport = projectData.storyContent
          .filter(item => item.type === StoryContentType.CHAPTER)
          .map(item => `## ${item.title}\n\n${item.content}`)
          .join('\n\n---\n\n');
      } else {
        // Fallback for old projects
        textToExport = projectData.finalText || '';
      }

      if (!textToExport) return;

      const blob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `${projectData.projectName.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_')}.txt`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };
  
  const renderGeneratedContent = () => {
    if (!projectData || (!projectData.storyContent && !projectData.finalText)) return null;

    return (
       <div className="mt-6 p-4 bg-gray-100 dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">生成内容: {projectData.projectName}</h3>
            <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                aria-label="Export story as .txt file"
            >
                <Download size={14} />
                Export .txt
            </button>
          </div>
          <StoryContentDisplay projectData={projectData} />
       </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1E1E1E] rounded-xl shadow-md border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
      <div className="p-4 border-b border-gray-200 dark:border-[rgba(255,255,255,0.05)] flex justify-between items-center flex-wrap gap-y-2">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-[#E2E2E2]">
                <Bot size={22} className="inline-block -mt-1 mr-2"/>
                StoryWeaver AI Desk
            </h2>
            <p className="text-xs text-gray-500 dark:text-[#A8ABB4] mt-1">Your multi-agent writing workspace.</p>
          </div>
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto chat-container bg-gray-50 dark:bg-[#121212]">
        <div className="max-w-4xl mx-auto w-full">
            <>
              {logs.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-[#777777]">
                  <p>The writing desk is ready.</p>
                  <p className="text-sm">Configure a new story to begin the writing process.</p>
                </div>
              )}
              {logs.map((log) => (
                <AgentLogItem key={log.id} log={log} />
              ))}

              {status === WritingProcessStatus.COMPLETE && (
                <div className="my-4 text-center p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20">
                    <h3 className="font-bold">写作流程完成!</h3>
                    <p className="text-sm">您的故事已生成.生成的内容显示在下方.</p>
                </div>
              )}
              
              {renderGeneratedContent()}
            </>
          <div ref={logsEndRef} />
        </div>
      </div>
       <div className="p-2 border-t border-gray-200 dark:border-[rgba(255,255,255,0.05)] bg-white dark:bg-[#1E1E1E] rounded-b-xl">
         <p className="text-xs text-center text-gray-500 dark:text-[#777777]">Multi-Agent Writing Assistant powered by GPT-4o</p>
       </div>
    </div>
  );
};

export default WritingDesk;