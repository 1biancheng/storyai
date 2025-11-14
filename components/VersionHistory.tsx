/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { VersionHistory } from '../types.ts';
import { X, Eye, RotateCcw } from 'lucide-react';
import { marked } from 'marked';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: VersionHistory[];
  onRevert: (version: VersionHistory) => void;
  projectName: string;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose, history, onRevert, projectName }) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Sort history newest first, and select the newest one by default for preview
  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const selectedVersion = useMemo(() => {
    if (selectedVersionId) {
        return sortedHistory.find(v => v.id === selectedVersionId);
    }
    return sortedHistory.length > 0 ? sortedHistory[0] : null;
  }, [selectedVersionId, sortedHistory]);

  const previewMarkup = selectedVersion ? marked.parse(selectedVersion.content) as string : '';

  return (
    <div className="fixed inset-0 modal-overlay bg-black/60 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="version-history-title">
      <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex-shrink-0 flex justify-between items-center">
          <h2 id="version-history-title" className="text-lg font-semibold text-gray-900 dark:text-[#E2E2E2]">"{projectName}" 的版本历史</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10" aria-label="关闭版本历史">
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow flex overflow-hidden">
          {/* Left: Version List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-white/10 overflow-y-auto">
            {sortedHistory.length > 0 ? (
              <ul>
                {sortedHistory.map((version, index) => (
                  <li key={version.id}>
                    <button 
                        onClick={() => setSelectedVersionId(version.id)}
                        className={`w-full text-left border-b border-gray-200 dark:border-white/10 p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${selectedVersion?.id === version.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                    >
                        <p className={`font-medium text-sm ${selectedVersion?.id === version.id ? 'text-blue-800 dark:text-blue-200' : ''}`}>
                            {new Date(version.timestamp).toLocaleString()}
                            {index === 0 && <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(最新)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{version.content.substring(0, 70)}...</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-gray-500">未找到此项目的历史记录.</p>
            )}
          </div>
          {/* Right: Preview Pane */}
          <div className="w-2/3 flex flex-col overflow-hidden">
            {selectedVersion ? (
                <>
                    <div className="p-3 border-b border-gray-200 dark:border-white/10 flex-shrink-0 flex justify-between items-center bg-gray-50 dark:bg-[#2C2C2C]">
                         <p className="text-sm font-medium">预览版本 {new Date(selectedVersion.timestamp).toLocaleString()}</p>
                         <button onClick={() => onRevert(selectedVersion)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 font-semibold transition-colors">
                            <RotateCcw size={14} /> 恢复到此版本
                        </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewMarkup }} />
                    </div>
                </>
            ) : (
                <div className="flex-grow flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <p>选择一个版本进行预览.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;