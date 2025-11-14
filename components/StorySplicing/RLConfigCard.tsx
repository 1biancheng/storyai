import React from 'react';
import { Brain } from 'lucide-react';

interface RLConfigCardProps {
  enabled: boolean;
  explorationRate: number;
  learningRate: number;
  qStats?: {
    avgQValue: number;
    qVariance: number;
    updateCount: number;
  };
  onEnabledChange: (enabled: boolean) => void;
  onExplorationRateChange: (rate: number) => void;
  onLearningRateChange: (rate: number) => void;
}

export const RLConfigCard: React.FC<RLConfigCardProps> = ({
  enabled,
  explorationRate,
  learningRate,
  qStats,
  onEnabledChange,
  onExplorationRateChange,
  onLearningRateChange
}) => {
  return (
    <div className="mt-4 p-3 rounded-md border-2 border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-600" />
          <label className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            强化学习策略(Q-Learning)
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs">启用RL</span>
        </label>
      </div>
      
      {enabled && (
        <>
          <div className="space-y-2">
            <div>
              <label className="block text-xs mb-1">探索率(ε-greedy): {explorationRate.toFixed(2)}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={explorationRate}
                onChange={(e) => onExplorationRateChange(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-0.5">
                探索率越高,越倾向尝试新段落组合
              </div>
            </div>
            
            <div>
              <label className="block text-xs mb-1">学习率(α): {learningRate.toFixed(2)}</label>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={learningRate}
                onChange={(e) => onLearningRateChange(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-0.5">
                学习率控制Q值更新速度
              </div>
            </div>
          </div>
          
          {qStats && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                <div className="text-gray-500">平均Q值</div>
                <div className="font-semibold text-purple-600">{qStats.avgQValue.toFixed(3)}</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                <div className="text-gray-500">Q值方差</div>
                <div className="font-semibold text-gray-600">{qStats.qVariance.toFixed(3)}</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-[#2C2C2C]">
                <div className="text-gray-500">更新次数</div>
                <div className="font-semibold text-blue-600">{qStats.updateCount}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
