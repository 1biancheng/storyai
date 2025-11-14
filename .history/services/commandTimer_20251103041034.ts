/**
 * 命令执行时间测量工具
 * 用于测量API请求或其他操作的执行时间
 */

import { timeService } from './timeService';

export interface CommandMeasurement {
    command: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
}

class CommandTimer {
    private measurements: Map<string, CommandMeasurement> = new Map();
    private history: CommandMeasurement[] = [];
    private maxHistorySize: number = 100;

    /**
     * 开始测量命令执行时间
     * @param command 命令描述
     * @param id 唯一标识符（可选）
     * @returns 测量ID
     */
    startMeasurement(command: string, id?: string): string {
        const measurementId = id || `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const measurement: CommandMeasurement = {
            command,
            startTime: timeService.now(),
            status: 'pending'
        };
        
        this.measurements.set(measurementId, measurement);
        return measurementId;
    }

    /**
     * 结束测量并记录结果
     * @param id 测量ID
     * @param status 执行状态
     * @param error 错误信息（如果有）
     * @returns 执行时间（毫秒）
     */
    endMeasurement(id: string, status: 'completed' | 'failed' = 'completed', error?: string): number {
        const measurement = this.measurements.get(id);
        if (!measurement) {
            console.warn(`测量ID "${id}" 不存在`);
            return 0;
        }
        
        const endTime = timeService.now();
        const duration = endTime - measurement.startTime;
        
        measurement.endTime = endTime;
        measurement.duration = duration;
        measurement.status = status;
        if (error) {
            measurement.error = error;
        }
        
        // 移动到历史记录
        this.measurements.delete(id);
        this.addToHistory(measurement);
        
        return duration;
    }

    /**
     * 获取当前正在进行的测量
     * @param id 测量ID
     * @returns 测量对象
     */
    getMeasurement(id: string): CommandMeasurement | undefined {
        return this.measurements.get(id);
    }

    /**
     * 获取所有正在进行的测量
     * @returns 测量对象数组
     */
    getAllMeasurements(): CommandMeasurement[] {
        return Array.from(this.measurements.values());
    }

    /**
     * 获取历史记录
     * @param limit 返回记录数量限制
     * @returns 历史记录数组
     */
    getHistory(limit?: number): CommandMeasurement[] {
        const history = [...this.history].reverse();
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * 清除历史记录
     */
    clearHistory(): void {
        this.history = [];
    }

    /**
     * 获取统计信息
     * @returns 统计对象
     */
    getStatistics(): {
        total: number;
        completed: number;
        failed: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
    } {
        const completed = this.history.filter(m => m.status === 'completed');
        const failed = this.history.filter(m => m.status === 'failed');
        
        const durations = completed
            .filter(m => m.duration !== undefined)
            .map(m => m.duration as number);
        
        const averageDuration = durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
            
        const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        
        return {
            total: this.history.length,
            completed: completed.length,
            failed: failed.length,
            averageDuration,
            minDuration,
            maxDuration
        };
    }

    /**
     * 添加到历史记录
     * @param measurement 测量对象
     */
    private addToHistory(measurement: CommandMeasurement): void {
        this.history.push(measurement);
        
        // 限制历史记录大小
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * 测量函数执行时间
     * @param command 命令描述
     * @param fn 要执行的函数
     * @returns 包含结果和测量信息的对象
     */
    async measureFunction<T>(
        command: string,
        fn: () => Promise<T>
    ): Promise<{
        result: T;
        measurement: CommandMeasurement;
    }> {
        const id = this.startMeasurement(command);
        
        try {
            const result = await fn();
            this.endMeasurement(id, 'completed');
            
            const measurement = this.getHistory(1)[0];
            return { result, measurement };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.endMeasurement(id, 'failed', errorMessage);
            
            const measurement = this.getHistory(1)[0];
            throw { measurement, error };
        }
    }
}

// 导出单例实例
export const commandTimer = new CommandTimer();
export default commandTimer;