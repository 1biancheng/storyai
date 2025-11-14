/**
 * 时间工具服务
 * 提供时间测量和格式化功能
 */

class TimeService {
    private timers: Map<string, number> = new Map();

    /**
     * 开始计时
     * @param label 计时标签
     * @returns 当前时间戳
     */
    startTimer(label: string = 'default'): number {
        const startTime = Date.now();
        this.timers.set(label, startTime);
        return startTime;
    }

    /**
     * 结束计时并返回耗时
     * @param label 计时标签
     * @returns 耗时(毫秒)
     */
    endTimer(label: string = 'default'): number {
        const startTime = this.timers.get(label);
        if (!startTime) {
            console.warn(`计时器 "${label}" 不存在`);
            return 0;
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        this.timers.delete(label);
        
        return duration;
    }

    /**
     * 测量函数执行时间
     * @param fn 要测量的函数
     * @param label 计时标签
     * @returns 包含结果和执行时间的对象
     */
    async measureExecution<T>(
        fn: () => Promise<T> | T,
        label: string = 'execution'
    ): Promise<{ result: T; duration: number }> {
        this.startTimer(label);
        const result = await fn();
        const duration = this.endTimer(label);
        
        return { result, duration };
    }

    /**
     * 格式化时间显示
     * @param milliseconds 毫秒数
     * @returns 格式化的时间字符串
     */
    formatDuration(milliseconds: number): string {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`;
        }
        
        const seconds = Math.floor(milliseconds / 1000);
        const remainingMs = milliseconds % 1000;
        
        if (seconds < 60) {
            return `${seconds}.${Math.floor(remainingMs / 100)}s`;
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes < 60) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * 获取当前时间戳
     * @returns 当前时间戳(毫秒)
     */
    now(): number {
        return Date.now();
    }

    /**
     * 获取格式化的当前时间
     * @param format 时间格式
     * @returns 格式化的时间字符串
     */
    getCurrentTime(format: 'full' | 'time' | 'date' | 'timestamp' = 'full'): string {
        const now = new Date();
        
        switch (format) {
            case 'time':
                return now.toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            case 'date':
                return now.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            case 'timestamp':
                return now.getTime().toString();
            case 'full':
            default:
                return now.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
        }
    }

    /**
     * 计算两个时间点之间的差值
     * @param startTime 开始时间戳
     * @param endTime 结束时间戳(默认为当前时间)
     * @returns 时间差对象
     */
    getTimeDifference(startTime: number, endTime: number = Date.now()): {
        milliseconds: number;
        seconds: number;
        minutes: number;
        hours: number;
        days: number;
        formatted: string;
    } {
        const diff = Math.abs(endTime - startTime);
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const milliseconds = diff % 1000;
        
        let formatted = '';
        if (days > 0) formatted += `${days}d `;
        if (hours > 0) formatted += `${hours}h `;
        if (minutes > 0) formatted += `${minutes}m `;
        if (seconds > 0) formatted += `${seconds}s `;
        if (milliseconds > 0 && days === 0 && hours === 0 && minutes === 0) {
            formatted += `${milliseconds}ms`;
        }
        
        return {
            milliseconds: diff,
            seconds,
            minutes,
            hours,
            days,
            formatted: formatted.trim()
        };
    }
}

// 导出单例实例
export const timeService = new TimeService();
export default timeService;