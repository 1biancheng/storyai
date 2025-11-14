import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react';

interface FeedbackPanelProps {
  splicingId: string;
  paragraphIds: string[];
  query: string;
  onFeedbackSubmit: (type: string, comment?: string) => Promise<void>;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({
  splicingId,
  paragraphIds,
  query,
  onFeedbackSubmit
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const handleFeedback = async (type: 'thumbs_up' | 'thumbs_down' | 'store') => {
    setSubmitting(true);
    try {
      await onFeedbackSubmit(type, comment);
      setSubmitted(type);
      setTimeout(() => setSubmitted(null), 3000);
    } catch (e) {
      console.error('Feedback failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#1C1C1C]">
      <h4 className="text-sm font-semibold mb-3">您对此结果满意吗?</h4>
      
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => handleFeedback('thumbs_up')}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
          满意
        </button>
        
        <button
          onClick={() => handleFeedback('thumbs_down')}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
          不满意
        </button>
        
        <button
          onClick={() => handleFeedback('store')}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          入库
        </button>
      </div>
      
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="可选:添加文字评论"
        className="w-full h-16 p-2 text-sm rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#2C2C2C]"
      />
      
      {submitted && (
        <div className="mt-2 text-sm text-green-600">
          ✅ 反馈已提交,Q值已更新
        </div>
      )}
    </div>
  );
};
