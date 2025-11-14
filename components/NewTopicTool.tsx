import React, { useState } from 'react';
import { MessageSquare, Save, X } from 'lucide-react';

interface NewTopicToolProps {
  onNewTopic?: () => void;
  onSaveChat?: (title: string) => void;
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
    borderColor?: string;
  };
}

export default function NewTopicTool({ 
  onNewTopic, 
  onSaveChat,
  theme = {
    backgroundColor: '#1E1E1E',
    primaryColor: '#007ACC',
    textColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.05)'
  }
}: NewTopicToolProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [chatTitle, setChatTitle] = useState('');

  const handleNewTopic = () => {
    onNewTopic?.();
  };

  const handleSaveClick = () => {
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = () => {
    if (chatTitle.trim()) {
      onSaveChat?.(chatTitle.trim());
      setChatTitle('');
      setShowSaveDialog(false);
    }
  };

  const handleSaveCancel = () => {
    setChatTitle('');
    setShowSaveDialog(false);
  };

  return (
    <div className="w-full h-full p-4">
      <div className="flex flex-col gap-4">
        {/* 新话题按钮 */}
        <button
          onClick={handleNewTopic}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 hover:opacity-80"
          style={{
            backgroundColor: theme.primaryColor,
            color: theme.textColor
          }}
        >
          <MessageSquare size={16} />
          <span>开始新话题</span>
        </button>

        {/* 保存聊天记录按钮 */}
        <button
          onClick={handleSaveClick}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 hover:opacity-80"
          style={{
            backgroundColor: theme.primaryColor + '20',
            color: theme.primaryColor,
            border: `1px solid ${theme.primaryColor}`
          }}
        >
          <Save size={16} />
          <span>保存当前话题</span>
        </button>

        {/* 保存对话框 */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div 
              className="rounded-lg p-6 w-80 shadow-xl"
              style={{
                backgroundColor: theme.backgroundColor,
                border: `1px solid ${theme.borderColor}`
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 
                  className="text-lg font-medium"
                  style={{ color: theme.textColor }}
                >
                  保存聊天记录
                </h3>
                <button
                  onClick={handleSaveCancel}
                  className="p-1 rounded hover:opacity-70 transition-opacity"
                  style={{ color: theme.textColor }}
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="mb-4">
                <label 
                  className="block text-sm mb-2"
                  style={{ color: theme.textColor }}
                >
                  话题标题
                </label>
                <input
                  type="text"
                  value={chatTitle}
                  onChange={(e) => setChatTitle(e.target.value)}
                  placeholder="请输入话题标题..."
                  className="w-full px-3 py-2 rounded border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.backgroundColor,
                    color: theme.textColor,
                    borderColor: theme.borderColor,
                    focusRingColor: theme.primaryColor
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveConfirm();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleSaveCancel}
                  className="px-4 py-2 rounded transition-colors duration-200"
                  style={{
                    backgroundColor: theme.borderColor,
                    color: theme.textColor
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveConfirm}
                  className="px-4 py-2 rounded transition-colors duration-200 hover:opacity-80"
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.textColor
                  }}
                  disabled={!chatTitle.trim()}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}