/**
 * SaveQueue - 基于消息队列的异步保存管理器
 * 
 * 功能：
 * 1. 防抖：相同章节的多次保存请求会被合并
 * 2. 队列：按顺序处理保存请求，避免并发冲突
 * 3. 重试：失败的请求自动重试
 * 4. 状态管理：跟踪每个章节的保存状态
 */

interface SaveTask {
  chapterId: string;
  data: {
    title: string;
    content: string;
  };
  timestamp: number;
  retryCount: number;
}

interface SaveQueueOptions {
  debounceMs?: number;      // 防抖延迟（默认3000ms）
  maxRetries?: number;       // 最大重试次数（默认3次）
  retryDelayMs?: number;     // 重试延迟（默认1000ms）
  maxConcurrent?: number;    // 最大并发数（默认1，串行执行）
}

type SaveHandler = (chapterId: string, data: { title: string; content: string }) => Promise<void>;

export class SaveQueue {
  private queue: Map<string, SaveTask> = new Map();
  private processing: Set<string> = new Set();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private saveHandler: SaveHandler;
  private options: Required<SaveQueueOptions>;
  private isProcessing = false;

  constructor(saveHandler: SaveHandler, options: SaveQueueOptions = {}) {
    this.saveHandler = saveHandler;
    this.options = {
      debounceMs: options.debounceMs ?? 3000,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      maxConcurrent: options.maxConcurrent ?? 1
    };
  }

  /**
   * 添加保存任务到队列
   */
  enqueue(chapterId: string, data: { title: string; content: string }): void {
    // 清除该章节的旧定时器
    const existingTimer = this.timers.get(chapterId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 创建新的防抖定时器
    const timer = setTimeout(() => {
      // 如果队列中已有该章节的任务，更新数据
      const existingTask = this.queue.get(chapterId);
      
      const task: SaveTask = {
        chapterId,
        data,
        timestamp: Date.now(),
        retryCount: existingTask?.retryCount ?? 0
      };

      this.queue.set(chapterId, task);
      this.timers.delete(chapterId);
      
      // 触发队列处理
      this.processQueue();
    }, this.options.debounceMs);

    this.timers.set(chapterId, timer);
  }

  /**
   * 立即保存（跳过防抖）
   */
  async saveNow(chapterId: string, data: { title: string; content: string }): Promise<void> {
    // 清除防抖定时器
    const timer = this.timers.get(chapterId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chapterId);
    }

    // 从队列中移除（如果存在）
    this.queue.delete(chapterId);

    // 立即执行保存
    await this.executeSave(chapterId, data, 0);
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.size > 0 || this.processing.size > 0) {
        // 等待当前处理的任务完成
        if (this.processing.size >= this.options.maxConcurrent) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // 获取下一个任务（按时间戳排序，最早的优先）
        const tasks = Array.from(this.queue.values()).sort((a, b) => a.timestamp - b.timestamp);
        const task = tasks[0];
        
        if (!task) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // 从队列中移除
        this.queue.delete(task.chapterId);
        
        // 标记为正在处理
        this.processing.add(task.chapterId);

        // 异步执行保存（不阻塞队列处理）
        this.executeSave(task.chapterId, task.data, task.retryCount).finally(() => {
          this.processing.delete(task.chapterId);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行保存操作（带重试）
   */
  private async executeSave(
    chapterId: string,
    data: { title: string; content: string },
    retryCount: number
  ): Promise<void> {
    try {
      await this.saveHandler(chapterId, data);
      console.log(`[SaveQueue] 保存成功: ${chapterId}`);
    } catch (error) {
      console.error(`[SaveQueue] 保存失败: ${chapterId}`, error);

      // 如果未达到最大重试次数，重新加入队列
      if (retryCount < this.options.maxRetries) {
        console.log(`[SaveQueue] 将在 ${this.options.retryDelayMs}ms 后重试 (第 ${retryCount + 1} 次)`);
        
        setTimeout(() => {
          const task: SaveTask = {
            chapterId,
            data,
            timestamp: Date.now(),
            retryCount: retryCount + 1
          };
          this.queue.set(chapterId, task);
          this.processQueue();
        }, this.options.retryDelayMs);
      } else {
        console.error(`[SaveQueue] 保存失败，已达最大重试次数: ${chapterId}`);
        throw error;
      }
    }
  }

  /**
   * 取消章节的保存任务
   */
  cancel(chapterId: string): void {
    // 清除防抖定时器
    const timer = this.timers.get(chapterId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chapterId);
    }

    // 从队列中移除
    this.queue.delete(chapterId);
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    // 清除所有定时器
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    // 清空队列
    this.queue.clear();
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueSize: this.queue.size,
      processingCount: this.processing.size,
      pendingTimers: this.timers.size
    };
  }
}
