/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as agentService from '../sample_data/services/agentService.ts';
import { BrainCircuit, Languages, MessageSquareQuote, Bot, Edit, Trash2, Plus, ArrowLeft, Save } from 'lucide-react';

interface AIPrompt {
    id: string;
    name: string;
    prompt: string;
    icon: 'analyze' | 'translate' | 'explain' | 'custom';
}

const DEFAULT_PROMPTS: AIPrompt[] = [
    { id: '1', name: '分析文本', prompt: '你是一个专业的文本分析师.请分析以下文本的主要主题、情感倾向和关键词.\n\n文本:\n"{{selectedText}}"', icon: 'analyze' },
    { id: '2', name: '翻译 (英文)', prompt: '将以下文本翻译成英文:\n\n"{{selectedText}}"', icon: 'translate' },
    { id: '3', name: '解释', prompt: '用更简单的语言解释以下文本的含义:\n\n"{{selectedText}}"', icon: 'explain' },
];

const PROMPT_STORAGE_KEY = 'aiAssistantPrompts';

const getIcon = (icon: AIPrompt['icon'], size = 24) => {
    switch (icon) {
        case 'analyze': return <BrainCircuit size={size} />;
        case 'translate': return <Languages size={size} />;
        case 'explain': return <MessageSquareQuote size={size} />;
        default: return <Bot size={size} />;
    }
};

// --- Settings View Sub-component ---
const SettingsView: React.FC<{
    prompts: AIPrompt[];
    onSave: (prompts: AIPrompt[]) => void;
    onBack: () => void;
}> = ({ prompts, onSave, onBack }) => {
    const [localPrompts, setLocalPrompts] = useState(prompts);
    const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);

    const handleSave = () => {
        onSave(localPrompts);
        alert('提示词已保存!');
    };

    const handleAddPrompt = () => {
        setEditingPrompt({ id: crypto.randomUUID(), name: '', prompt: '例如: 为这段文字润色: "{{selectedText}}"', icon: 'custom' });
    };
    
    const handleUpdatePrompt = (promptToSave: AIPrompt) => {
        if (!promptToSave.name.trim() || !promptToSave.prompt.trim()) {
            alert('名称和提示词内容不能为空.');
            return;
        }
        
        const isEditing = localPrompts.some(p => p.id === promptToSave.id);
        const updatedPrompts = isEditing
            ? localPrompts.map(p => p.id === promptToSave.id ? promptToSave : p)
            : [...localPrompts, promptToSave];
            
        setLocalPrompts(updatedPrompts);
        setEditingPrompt(null);
    };

    const handleDeletePrompt = (id: string) => {
        if (window.confirm('您确定要删除此提示词吗?')) {
            setLocalPrompts(localPrompts.filter(p => p.id !== id));
        }
    };
    
    return (
        <>
            <div className="ai-assistant-settings-header">
                <button onClick={onBack} className="ai-assistant-back-button"><ArrowLeft size={18} /></button>
                <h3 className="ai-assistant-settings-title">编辑提示词</h3>
                <button onClick={handleSave} className="ai-assistant-save-button"><Save size={16} /> 保存</button>
            </div>
            <div className="ai-assistant-settings-content">
                <div className="ai-assistant-prompt-list">
                    {localPrompts.map(prompt => (
                        <div key={prompt.id} className="ai-assistant-prompt-item">
                            <div className="ai-assistant-prompt-info">
                                <span className="ai-assistant-prompt-icon">{getIcon(prompt.icon, 18)}</span>
                                <span className="ai-assistant-prompt-name">{prompt.name}</span>
                            </div>
                            <div className="ai-assistant-prompt-actions">
                                <button onClick={() => setEditingPrompt(prompt)}><Edit size={14} /></button>
                                <button onClick={() => handleDeletePrompt(prompt.id)}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <button onClick={handleAddPrompt} className="ai-assistant-add-button"><Plus size={16} /> 添加新提示词</button>
                {editingPrompt && (
                    <div className="ai-assistant-prompt-editor">
                        <h4 className="ai-assistant-editor-title">{localPrompts.some(p => p.id === editingPrompt.id) ? '编辑提示词' : '添加新提示词'}</h4>
                        <input
                            type="text"
                            placeholder="提示词名称"
                            value={editingPrompt.name}
                            onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                            className="ai-assistant-editor-input"
                        />
                         <textarea
                            placeholder="提示词内容... 使用 {{selectedText}} 代表选中的文本"
                            value={editingPrompt.prompt}
                            onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                            rows={4}
                            className="ai-assistant-editor-textarea"
                         />
                         <div className="ai-assistant-editor-actions">
                             <button onClick={() => setEditingPrompt(null)} className="ai-assistant-editor-button">取消</button>
                             <button onClick={() => handleUpdatePrompt(editingPrompt)} className="ai-assistant-editor-button primary">保存</button>
                         </div>
                    </div>
                )}
            </div>
        </>
    );
};


// --- Main Assistant View Sub-component ---
const AssistantView: React.FC<{
    prompts: AIPrompt[];
    selectedText: string;
    onAskAI: () => void;
    onShowSettings: () => void;
    onExecutePrompt: (prompt: AIPrompt) => void;
}> = ({ prompts, selectedText, onAskAI, onShowSettings, onExecutePrompt }) => {
    return (
        <>
            <div className="ai-assistant-content">
                <div className="ai-assistant-selected-text">"{selectedText}"</div>
                <div className="ai-assistant-features">
                    {prompts.slice(0, 6).map(prompt => (
                        <div key={prompt.id} className="feature-item" onClick={() => onExecutePrompt(prompt)}>
                            <div className="feature-icon">{getIcon(prompt.icon)}</div>
                            <div className="feature-text">{prompt.name}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="ai-assistant-actions">
                <button className="ai-assistant-button" onClick={onShowSettings}>设置</button>
                <button className="ai-assistant-button primary" onClick={onAskAI}>咨询AI</button>
            </div>
        </>
    );
};

// 新增:允许根据当前视图决定是否启用 AI 助理
interface AIAssistantProps { activeView?: string }

// --- Main Component ---
const AIAssistant: React.FC<AIAssistantProps> = ({ activeView }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [view, setView] = useState<'assistant' | 'settings'>('assistant');
    const [prompts, setPrompts] = useState<AIPrompt[]>([]);

    // 仅在指定视图启用(默认:写作空间/卡片编辑/文本解构)
    const enabledViews = ['space', 'cards', 'deconstruction'];
    const isEnabled = !activeView || enabledViews.includes(activeView);

    // 如果当前视图不启用,直接不渲染组件,避免产生任何遮挡
    const popupRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const ignoreNextClickRef = useRef(false);

    useEffect(() => {
        try {
            const savedPrompts = localStorage.getItem(PROMPT_STORAGE_KEY);
            if (savedPrompts) {
                setPrompts(JSON.parse(savedPrompts));
            } else {
                setPrompts(DEFAULT_PROMPTS);
            }
        } catch (e) {
            console.error("Failed to load AI prompts:", e);
            setPrompts(DEFAULT_PROMPTS);
        }
    }, []);

    const savePrompts = (newPrompts: AIPrompt[]) => {
        try {
            localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(newPrompts));
            setPrompts(newPrompts);
        } catch (e) {
            console.error("Failed to save AI prompts:", e);
        }
    };

    const closePopup = useCallback(() => {
        setIsVisible(false);
        setSelectedText('');
        setView('assistant');
    }, []);
    
    const handleExecutePrompt = async (prompt: AIPrompt) => {
        try {
            const fullPrompt = prompt.prompt.replace('{{selectedText}}', selectedText);
            alert(`正在为 "${prompt.name}" 请求AI...\n\n提示词: ${fullPrompt}`);
            const response = await agentService.runAgent(fullPrompt);
            alert(`AI 回复:\n\n${response.text}`);
        } catch (error) {
            alert(`AI 操作失败: ${(error as Error).message}`);
        }
    };

    const askAI = () => {
        alert(`正在咨询AI关于:\n\n"${selectedText}"\n\nAI回复:这是一个演示功能.在实际应用中,我会调用AI API来提供智能回复.`);
    };

    // Effect for mounting event listeners and styles
    useEffect(() => {
        // 非启用视图下,直接跳过事件绑定
        if (!isEnabled) return;

        const handleTextSelection = (event: MouseEvent) => {
            if (isDraggingRef.current) return;
            if (popupRef.current && popupRef.current.contains(event.target as Node)) {
                return;
            }

            const selection = window.getSelection();
            const text = selection?.toString().trim();
            if (selection && text && text.length > 5 && text.length < 2000) { // Add length constraints
                setSelectedText(text);

                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const popupWidth = 320;
                const popupHeight = 420; // A safe estimation of the popup's height
                const margin = 10; // Space from selection and screen edges

                // --- Viewport-relative positioning logic ---

                // Horizontal positioning
                let viewportLeft = rect.left + rect.width / 2 - popupWidth / 2;
                if (viewportLeft < margin) {
                    viewportLeft = margin;
                }
                if (viewportLeft + popupWidth > window.innerWidth - margin) {
                    viewportLeft = window.innerWidth - popupWidth - margin;
                }

                // Vertical positioning
                let viewportTop;
                const canFitBelow = rect.bottom + popupHeight + margin < window.innerHeight;
                const canFitAbove = rect.top - popupHeight - margin > 0;

                if (canFitBelow) {
                    // Prefer to position below the selection
                    viewportTop = rect.bottom + margin;
                } else if (canFitAbove) {
                    // Otherwise, position above
                    viewportTop = rect.top - popupHeight - margin;
                } else {
                    // If it fits neither above nor below, try to center it vertically in the viewport.
                    viewportTop = (window.innerHeight - popupHeight) / 2;
                    // Ensure it's not positioned off-screen at the top.
                    if (viewportTop < margin) {
                        viewportTop = margin;
                    }
                }
                
                // --- Convert to absolute document coordinates ---
                const finalLeft = viewportLeft + window.scrollX;
                const finalTop = viewportTop + window.scrollY;
                
                setPosition({ top: finalTop, left: finalLeft });
                setIsVisible(true);
                
                // Set a flag to ignore the 'click' event that follows this 'mouseup' event.
                // This prevents the popup from immediately closing due to a race condition.
                ignoreNextClickRef.current = true;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current && popupRef.current) {
                const x = e.clientX - dragOffsetRef.current.x;
                const y = e.clientY - dragOffsetRef.current.y;
                setPosition({ top: y, left: x });
            }
        };
        
        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                if (popupRef.current) popupRef.current.style.cursor = 'default';
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
        
        const handleDocumentClick = (e: MouseEvent) => {
            // Check and reset the flag. If the flag is set, this click event is the one
            // that triggered the selection, so we ignore it to keep the popup open.
            if (ignoreNextClickRef.current) {
                ignoreNextClickRef.current = false;
                return;
            }
            
            // Standard click-outside logic to close the popup.
            if (isVisible && popupRef.current && !popupRef.current.contains(e.target as Node)) {
                closePopup();
            }
        };

        const handleScroll = () => { if (isVisible) closePopup(); };
        
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleDocumentClick);
        window.addEventListener('scroll', handleScroll, true);
        
        const style = document.createElement('style');
        style.id = "ai-assistant-styles";
        style.textContent = `
            .ai-assistant-popup {
                position: absolute; width: 320px; background: white; border-radius: 12px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); border: 1px solid #e5e7eb;
                overflow: hidden; pointer-events: none; transition: opacity 0.3s ease, transform 0.3s ease;
                z-index: 99999; opacity: 0; transform: translateY(-20px); display: flex; flex-direction: column;
            }
            .ai-assistant-popup.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
            .ai-assistant-header { display: flex; align-items: center; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; cursor: move; flex-shrink: 0; }
            .ai-assistant-avatar { margin-right: 12px; }
            .ai-assistant-title { flex: 1; }
            .ai-assistant-name { font-size: 16px; font-weight: 600; }
            .ai-assistant-version { font-size: 12px; opacity: 0.8; }
            .ai-assistant-close { cursor: pointer; padding: 4px; border-radius: 50%; transition: background 0.2s; }
            .ai-assistant-close:hover { background: rgba(255, 255, 255, 0.2); }
            .ai-assistant-content { padding: 16px; flex-grow: 1; }
            .ai-assistant-selected-text { background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #4A6CF7; margin-bottom: 16px; font-size: 14px; color: #374151; max-height: 100px; overflow-y: auto; }
            .ai-assistant-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .feature-item { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 8px; background: #f8fafc; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; height: 80px; }
            .feature-item:hover { background: #e2e8f0; border-color: #cbd5e1; transform: translateY(-2px); }
            .feature-icon { margin-bottom: 6px; color: #4A6CF7; }
            .feature-text { font-size: 12px; color: #4b5563; text-align: center; }
            .ai-assistant-actions { display: flex; gap: 8px; padding: 16px; border-top: 1px solid #e5e7eb; background: #f9fafb; flex-shrink: 0; }
            .ai-assistant-button { flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 8px; background: white; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
            .ai-assistant-button:hover { background: #f3f4f6; }
            .ai-assistant-button.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
            .ai-assistant-button.primary:hover { background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%); }
            /* Settings View Styles */
            .ai-assistant-settings-header { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
            .ai-assistant-settings-title { flex: 1; text-align: center; font-size: 16px; font-weight: 600; }
            .ai-assistant-back-button, .ai-assistant-save-button { padding: 4px; border-radius: 4px; background: #f3f4f6; display: flex; align-items: center; gap: 4px; font-size: 12px; }
            .ai-assistant-settings-content { padding: 12px; flex-grow: 1; overflow-y: auto; }
            .ai-assistant-prompt-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
            .ai-assistant-prompt-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px; }
            .ai-assistant-prompt-info { display: flex; align-items: center; gap: 8px; font-size: 14px; }
            .ai-assistant-prompt-actions button { margin-left: 8px; color: #6b7280; }
            .ai-assistant-add-button { width: 100%; padding: 8px; background: #e5e7eb; border-radius: 6px; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; }
            .ai-assistant-prompt-editor { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
            .ai-assistant-editor-title { font-weight: 600; margin-bottom: 8px; }
            .ai-assistant-editor-input, .ai-assistant-editor-textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; font-size: 14px; margin-bottom: 8px; }
            .ai-assistant-editor-actions { display: flex; justify-content: flex-end; gap: 8px; }
            .ai-assistant-editor-button { padding: 6px 12px; border-radius: 6px; font-size: 14px; }
            .ai-assistant-editor-button.primary { background: #4A6CF7; color: white; }
        `;
        if(!document.getElementById('ai-assistant-styles')) {
            document.head.appendChild(style);
        }

        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleDocumentClick);
            window.removeEventListener('scroll', handleScroll, true);
            const styleElement = document.getElementById('ai-assistant-styles');
            if (styleElement) styleElement.remove();
        };
    }, [isVisible, closePopup, isEnabled]);

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        if(popupRef.current) {
            const rect = popupRef.current.getBoundingClientRect();
            dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            popupRef.current.style.cursor = 'grabbing';
        }
    };

    return isEnabled ? (
        <div
            ref={popupRef}
            className={`ai-assistant-popup ${isVisible ? 'visible' : ''}`}
            style={{ top: `${position.top}px`, left: `${position.left}px` }}
            onClick={(e) => e.stopPropagation()}
            aria-hidden={!isVisible}
        >
             <div className="ai-assistant-header" onMouseDown={handleDragStart}>
                <div className="ai-assistant-avatar">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#4A6CF7"/><path d="M16 8C12.6863 8 10 10.6863 10 14V18C10 21.3137 12.6863 24 16 24C19.3137 24 22 21.3137 22 18V14C22 10.6863 19.3137 8 16 8Z" fill="white"/><path d="M8 14H6C6 10.6863 8.68629 8 12 8H14C14 5.79086 15.7909 4 18 4H20C22.2091 4 24 5.79086 24 8V10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div className="ai-assistant-title"><div className="ai-assistant-name">AI助理</div><div className="ai-assistant-version">版本 1.0.0</div></div>
                <div className="ai-assistant-close" onClick={(e) => { e.stopPropagation(); closePopup(); }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" stroke="#FFF" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6L18 18" stroke="#FFF" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
            </div>

            {view === 'assistant' ? (
                <AssistantView
                    prompts={prompts}
                    selectedText={selectedText}
                    onExecutePrompt={handleExecutePrompt}
                    onAskAI={askAI}
                    onShowSettings={() => setView('settings')}
                />
            ) : (
                <SettingsView
                    prompts={prompts}
                    onSave={savePrompts}
                    onBack={() => setView('assistant')}
                />
            )}
        </div>
    ) : null;
};

export default AIAssistant;
