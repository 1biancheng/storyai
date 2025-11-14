/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Settings, RefreshCw } from 'lucide-react';
import { runAgent, runAgentStream } from '../sample_data/services/agentService';
import type { AIModel, ProjectData } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
}

interface AIChatPanelProps {
  models: AIModel[];
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  projectData?: ProjectData | null;
  currentChapterContent?: string;
}

export default function AIChatPanel({
  models,
  selectedModelId,
  onModelChange,
  projectData,
  currentChapterContent
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const selectedModel = models.find(m => m.id === selectedModelId);

  const enhancePromptWithContext = (prompt: string): string => {
    let enhancedPrompt = prompt;
    
    if (projectData) {
      enhancedPrompt = `项目:${projectData.projectName}\n类型:${projectData.projectGenre}\n${enhancedPrompt}`;
    }
    
    if (currentChapterContent) {
      enhancedPrompt = `当前章节内容:\n${currentChapterContent}\n\n${enhancedPrompt}`;
    }
    
    return enhancedPrompt;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      model: selectedModel?.name
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const enhancedPrompt = enhancePromptWithContext(userMessage.content);
      
      // 尝试流式响应
      let assistantContent = '';
      const assistantMessageId = (Date.now() + 1).toString();
      
      const streamMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        model: selectedModel?.name
      };
      
      setMessages(prev => [...prev, streamMessage]);
      setIsStreaming(true);

      await runAgentStream(
        enhancedPrompt,
        (chunk) => {
          assistantContent += chunk;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        },
        selectedModelId
      );

    } catch (error) {
      console.error('AI对话错误:', error);
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: '抱歉,发生了错误.请稍后重试.',
        timestamp: new Date(),
        model: selectedModel?.name
      };
      setMessages(prev => [...prev.filter(msg => msg.id !== (Date.now() + 1).toString()), errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1E1E1E] rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-[rgba(255,255,255,0.05)] flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-blue-600 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">AI 写作助手</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedModelId}
            onChange={(e) => onModelChange(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {models.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleClearChat}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="清空对话"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Bot size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">开始与AI助手对话</p>
            <p className="text-xs mt-1">我可以帮您生成段落、润色文本、续写故事等</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-gray-600 dark:text-gray-300" />
                  </div>
                )}
                <div className={`px-4 py-2 rounded-lg ${message.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}>
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                  <div className={`text-xs mt-1 opacity-70 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatTime(message.timestamp)}
                    {message.model && ` · ${message.model}`}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="flex gap-2 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-blue-600 dark:text-blue-400 animate-pulse" />
              </div>
              <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-[rgba(255,255,255,0.05)]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send size={16} />
            发送
          </button>
        </div>
      </div>
    </div>
  );
}