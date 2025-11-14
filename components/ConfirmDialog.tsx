/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消'
}) => {
  if (!visible) return null;
  
  // 使用onCancel作为关闭函数，如果没有提供则使用空函数
  const handleClose = onCancel || (() => {});

  return (
    <div 
      className="fixed inset-0 modal-overlay bg-black/60 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E2E2E2]">{title}</h3>
          <button 
            onClick={handleClose} 
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-white/10" 
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
          <button 
            onClick={handleClose}
            className="px-4 py-2 rounded-md bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 font-medium transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;