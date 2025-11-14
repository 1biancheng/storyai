/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { ProjectData } from '../types.ts';
import { X, Save } from 'lucide-react';
import * as editorAIService from "../sample_data/services/editorAIService.ts";
import AIContextMenu from './AIContextMenu.tsx';

interface ProjectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData | null;
  onSave: (updatedText: string) => void;
}

const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({ isOpen, onClose, project, onSave }) => {
    const [content, setContent] = useState('');
    const [scrollTop, setScrollTop] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalContentRef = useRef<HTMLDivElement>(null);

    // Subscribe to the centralized AI service state
    const [editorServiceState, setEditorServiceState] = useState(editorAIService.getState());
    useEffect(() => {
        const unsubscribe = editorAIService.subscribe(setEditorServiceState);
        return () => unsubscribe();
    }, []);

    // Load project content when the modal opens
    useEffect(() => {
        if (isOpen) {
            setContent(project?.finalText || '这个项目还没有生成任何内容.');
        } else {
            // Close context menu when modal closes
            editorAIService.closeContextMenu();
        }
    }, [isOpen, project]);

    // Debounced real-time saving effect
    useEffect(() => {
        if (!isOpen || !project || content === project.finalText) {
            return;
        }

        const handler = setTimeout(() => {
            onSave(content);
        }, 800);

        return () => {
            clearTimeout(handler);
        };
    }, [content, isOpen, onSave, project]);

    // Effect to restore scroll position after AI polishing
    useEffect(() => {
        if (scrollTop !== null && textareaRef.current) {
            textareaRef.current.scrollTop = scrollTop;
            setScrollTop(null);
        }
    }, [content, scrollTop]);
    
    // Wrapper function to call the service's polish handler with component state
    const handlePolishRequest = async (customPrompt: string) => {
        await editorAIService.handlePolish(
            customPrompt,
            () => content, // Pass a function to get current content
            setContent,
            setScrollTop,
            textareaRef.current
        );
    };

    const handleSaveAndClose = () => {
        onSave(content);
        onClose();
    };

    if (!isOpen) return null;

    // Use the state from the service to render the context menu
    const { contextMenu, isPolishing } = editorServiceState;

    return (
        <div className="fixed inset-0 modal-overlay bg-black/60 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-[#E2E2E2]">编辑: {project?.projectName}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={handleSaveAndClose} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 font-semibold transition-colors">
                            <Save size={14} /> 保存并关闭
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10" aria-label="关闭">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="flex-grow p-4 overflow-hidden relative" ref={modalContentRef}>
                    {contextMenu.visible && (
                       <AIContextMenu
                            top={contextMenu.top}
                            left={contextMenu.left}
                            onClose={editorAIService.closeContextMenu}
                            onPolish={handlePolishRequest} // Use the new wrapper function
                        />
                    )}
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onContextMenu={editorAIService.handleContextMenu} // Delegate to the service
                        className="w-full h-full p-2 bg-gray-50 dark:bg-[#2C2C2C] rounded-md resize-none border-gray-200 dark:border-white/10 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-base leading-relaxed"
                        placeholder="在此处编辑您的故事..."
                        disabled={isPolishing} // Disable textarea during polishing
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectEditorModal;