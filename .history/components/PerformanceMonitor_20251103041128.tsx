import React, { useState, useEffect } from 'react';
import { commandTimer } from '../services/commandTimer';
import { timeService } from '../services/timeService';

interface PerformanceStats {
    total: number;
    completed: number;
    failed: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
}

const PerformanceMonitor: React.FC = () => {
    const [stats, setStats] = useState<PerformanceStats>({
        total: 0,
        completed: 0,
        failed: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0
    });
    const [recentRequests, setRecentRequests] = useState<any[]>([]);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // 定期更新统计数据
        const interval = setInterval(() => {
            const newStats = commandTimer.getStatistics();
            setStats(newStats);
            
            // 获取最近10个请求
            const recent = commandTimer.getHistory(10);
            setRecentRequests(recent);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatDuration = (ms: number): string => {
        return timeService.formatDuration(ms);
    };

    const clearHistory = () => {
        commandTimer.clearHistory();
        setRecentRequests([]);
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full shadow-lg"
                aria-label="Toggle Performance Monitor"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            </button>
            
            {isVisible && (
                <div className="absolute bottom-12 right-0 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">性能监控</h3>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* 统计信息 */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <div className="text-sm text-gray-500 dark:text-gray-400">总请求数</div>
                            <div className="text-xl font-semibold text-gray-900 dark:text-white">{stats.total}</div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <div className="text-sm text-gray-500 dark:text-gray-400">成功率</div>
                            <div className="text-xl font-semibold text-green-600 dark:text-green-400">
                                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <div className="text-sm text-gray-500 dark:text-gray-400">平均响应时间</div>
                            <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                                {formatDuration(stats.averageDuration)}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                            <div className="text-sm text-gray-500 dark:text-gray-400">最大响应时间</div>
                            <div className="text-xl font-semibold text-red-600 dark:text-red-400">
                                {formatDuration(stats.maxDuration)}
                            </div>
                        </div>
                    </div>
                    
                    {/* 最近请求 */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-md font-medium text-gray-900 dark:text-white">最近请求</h4>
                            <button
                                onClick={clearHistory}
                                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                清除历史
                            </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                            {recentRequests.length === 0 ? (
                                <div className="text-sm text-gray-500 dark:text-gray-400">暂无请求记录</div>
                            ) : (
                                <ul className="space-y-1">
                                    {recentRequests.map((req, index) => (
                                        <li key={index} className="text-xs flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <div className="flex-1 truncate mr-2">
                                                <div className={`font-medium ${req.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {req.command}
                                                </div>
                                                {req.error && (
                                                    <div className="text-red-500 dark:text-red-400 truncate">{req.error}</div>
                                                )}
                                            </div>
                                            <div className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {req.duration ? formatDuration(req.duration) : 'N/A'}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    
                    {/* 当前时间 */}
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                        当前时间: {timeService.getCurrentTime()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceMonitor;