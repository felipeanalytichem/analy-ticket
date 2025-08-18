export interface BackgroundTask {
  id: string;
  name: string;
  priority: TaskPriority;
  execute: () => Promise<any>;
  retryCount: number;
  maxRetries: number;
  delay: number;
  createdAt: Date;
  scheduledAt: Date;
  lastExecutedAt?: Date;
  status: TaskStatus;
  result?: any;
  error?: Error;
  dependencies?: string[];
  timeout?: number;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export interface TaskManagerConfig {
  maxConcurrentTasks: number;
  defaultTimeout: number;
  retryDelay: number;
  maxRetryDelay: number;
  cleanupInterval: number;
  taskHistoryLimit: number;
}

export interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  successRate: number;
}

export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>();
  private runningTasks = new Set<string>();
  private taskQueue: BackgroundTask[] = [];
  private completedTasks: BackgroundTask[] = [];
  private failedTasks: BackgroundTask[] = [];
  
  private config: TaskManagerConfig = {
    maxConcurrentTasks: 3,
    defaultTimeout: 30000, // 30 seconds
    retryDelay: 1000, // 1 second
    maxRetryDelay: 30000, // 30 seconds
    cleanupInterval: 60000, // 1 minute
    taskHistoryLimit: 100
  };
  
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isDestroyed = false;

  constructor(config?: Partial<TaskManagerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.startProcessing();
    this.startCleanup();
  }

  /**
   * Schedule a background task
   */
  scheduleTask(task: Omit<BackgroundTask, 'id' | 'createdAt' | 'scheduledAt' | 'status' | 'retryCount'>): string {
    if (this.isDestroyed) {
      throw new Error('TaskManager has been destroyed');
    }

    const taskId = this.generateTaskId();
    const backgroundTask: BackgroundTask = {
      id: taskId,
      createdAt: new Date(),
      scheduledAt: new Date(Date.now() + (task.delay || 0)),
      status: TaskStatus.PENDING,
      retryCount: 0,
      maxRetries: task.maxRetries || 3,
      timeout: task.timeout || this.config.defaultTimeout,
      ...task
    };

    this.tasks.set(taskId, backgroundTask);
    this.addToQueue(backgroundTask);
    
    return taskId;
  }

  /**
   * Schedule a task with high priority
   */
  scheduleHighPriorityTask(task: Omit<BackgroundTask, 'id' | 'createdAt' | 'scheduledAt' | 'status' | 'retryCount' | 'priority'>): string {
    return this.scheduleTask({
      ...task,
      priority: TaskPriority.HIGH
    });
  }

  /**
   * Schedule a recurring task
   */
  scheduleRecurringTask(
    task: Omit<BackgroundTask, 'id' | 'createdAt' | 'scheduledAt' | 'status' | 'retryCount'>,
    interval: number
  ): string {
    const taskId = this.scheduleTask(task);
    
    // Set up recurring execution
    const originalOnComplete = task.onComplete;
    const taskInstance = this.tasks.get(taskId);
    
    if (taskInstance) {
      taskInstance.onComplete = () => {
        if (originalOnComplete) {
          originalOnComplete();
        }
        
        // Reschedule the task
        if (!this.isDestroyed) {
          setTimeout(() => {
            this.scheduleTask({
              ...task,
              delay: interval,
              onComplete: taskInstance.onComplete
            });
          }, interval);
        }
      };
    }
    
    return taskId;
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      return false;
    }
    
    if (task.status === TaskStatus.RUNNING) {
      // Mark for cancellation - the task will check this flag
      task.status = TaskStatus.CANCELLED;
      return true;
    }
    
    if (task.status === TaskStatus.PENDING) {
      task.status = TaskStatus.CANCELLED;
      this.removeFromQueue(taskId);
      return true;
    }
    
    return false;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    const task = this.tasks.get(taskId);
    return task ? task.status : null;
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): any {
    const task = this.tasks.get(taskId);
    return task ? (task.result ?? null) : null;
  }

  /**
   * Get task error
   */
  getTaskError(taskId: string): Error | null {
    const task = this.tasks.get(taskId);
    return task ? (task.error ?? null) : null;
  }

  /**
   * Get all tasks with optional filtering
   */
  getTasks(filter?: { status?: TaskStatus; priority?: TaskPriority }): BackgroundTask[] {
    const allTasks = Array.from(this.tasks.values());
    
    if (!filter) {
      return allTasks;
    }
    
    return allTasks.filter(task => {
      if (filter.status && task.status !== filter.status) {
        return false;
      }
      if (filter.priority && task.priority !== filter.priority) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get task manager statistics
   */
  getStats(): TaskStats {
    const allTasks = Array.from(this.tasks.values());
    const completedTasks = allTasks.filter(t => t.status === TaskStatus.COMPLETED);
    const failedTasks = allTasks.filter(t => t.status === TaskStatus.FAILED);
    
    const executionTimes = completedTasks
      .filter(t => t.lastExecutedAt)
      .map(t => t.lastExecutedAt!.getTime() - t.createdAt.getTime());
    
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    const successRate = allTasks.length > 0 
      ? completedTasks.length / (completedTasks.length + failedTasks.length) 
      : 0;

    return {
      totalTasks: allTasks.length,
      pendingTasks: allTasks.filter(t => t.status === TaskStatus.PENDING).length,
      runningTasks: allTasks.filter(t => t.status === TaskStatus.RUNNING).length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      averageExecutionTime,
      successRate
    };
  }

  /**
   * Clear completed and failed tasks
   */
  clearHistory(): void {
    const tasksToRemove: string[] = [];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED || task.status === TaskStatus.CANCELLED) {
        tasksToRemove.push(taskId);
      }
    }
    
    tasksToRemove.forEach(taskId => {
      this.tasks.delete(taskId);
    });
    
    this.completedTasks.length = 0;
    this.failedTasks.length = 0;
  }

  /**
   * Pause task processing
   */
  pause(): void {
    this.isProcessing = false;
  }

  /**
   * Resume task processing
   */
  resume(): void {
    this.isProcessing = true;
  }

  /**
   * Destroy the task manager and cleanup resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Cancel all pending and running tasks
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING) {
        task.status = TaskStatus.CANCELLED;
        this.tasks.set(taskId, task); // Ensure the change is persisted
      }
    }
    
    this.tasks.clear();
    this.taskQueue.length = 0;
    this.runningTasks.clear();
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToQueue(task: BackgroundTask): void {
    // Insert task in priority order
    let insertIndex = this.taskQueue.length;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
  }

  private removeFromQueue(taskId: string): void {
    const index = this.taskQueue.findIndex(task => task.id === taskId);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
    }
  }

  private startProcessing(): void {
    this.isProcessing = true;
    
    this.processingInterval = setInterval(() => {
      if (this.isProcessing && !this.isDestroyed) {
        this.processQueue();
      }
    }, 100); // Check every 100ms
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      if (!this.isDestroyed) {
        this.cleanup();
      }
    }, this.config.cleanupInterval);
  }

  private async processQueue(): Promise<void> {
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }
    
    // Find next task to execute
    const now = new Date();
    const taskIndex = this.taskQueue.findIndex(task => 
      task.status === TaskStatus.PENDING && 
      task.scheduledAt <= now &&
      this.areDependenciesMet(task)
    );
    
    if (taskIndex === -1) {
      return;
    }
    
    const task = this.taskQueue.splice(taskIndex, 1)[0];
    await this.executeTask(task);
  }

  private areDependenciesMet(task: BackgroundTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    
    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === TaskStatus.COMPLETED;
    });
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    if (task.status === TaskStatus.CANCELLED) {
      return;
    }
    
    task.status = TaskStatus.RUNNING;
    task.lastExecutedAt = new Date();
    this.runningTasks.add(task.id);
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(task);
      
      if (task.status === TaskStatus.CANCELLED) {
        return;
      }
      
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      this.completedTasks.push(task);
      
      if (task.onSuccess) {
        try {
          task.onSuccess(result);
        } catch (error) {
          console.warn(`Task ${task.id} success callback failed:`, error);
        }
      }
      
    } catch (error) {
      await this.handleTaskError(task, error as Error);
    } finally {
      this.runningTasks.delete(task.id);
      
      if (task.onComplete) {
        try {
          task.onComplete();
        } catch (error) {
          console.warn(`Task ${task.id} complete callback failed:`, error);
        }
      }
    }
  }

  private async executeWithTimeout(task: BackgroundTask): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${task.timeout}ms`));
      }, task.timeout);
      
      task.execute()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async handleTaskError(task: BackgroundTask, error: Error): Promise<void> {
    task.error = error;
    
    if (task.retryCount < task.maxRetries) {
      // Retry with exponential backoff
      task.retryCount++;
      task.status = TaskStatus.RETRYING;
      
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, task.retryCount - 1),
        this.config.maxRetryDelay
      );
      
      task.scheduledAt = new Date(Date.now() + delay);
      this.addToQueue(task);
      
    } else {
      // Max retries exceeded
      task.status = TaskStatus.FAILED;
      this.failedTasks.push(task);
      
      if (task.onError) {
        try {
          task.onError(error);
        } catch (callbackError) {
          console.warn(`Task ${task.id} error callback failed:`, callbackError);
        }
      }
    }
  }

  private cleanup(): void {
    // Remove old completed and failed tasks
    const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    const tasksToRemove: string[] = [];
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.lastExecutedAt &&
        task.lastExecutedAt < cutoffTime
      ) {
        tasksToRemove.push(taskId);
      }
    }
    
    tasksToRemove.forEach(taskId => {
      this.tasks.delete(taskId);
    });
    
    // Limit history size
    if (this.completedTasks.length > this.config.taskHistoryLimit) {
      this.completedTasks.splice(0, this.completedTasks.length - this.config.taskHistoryLimit);
    }
    
    if (this.failedTasks.length > this.config.taskHistoryLimit) {
      this.failedTasks.splice(0, this.failedTasks.length - this.config.taskHistoryLimit);
    }
  }
}

// Global background task manager instance
export const backgroundTaskManager = new BackgroundTaskManager();

// Utility functions for common background tasks
export const BackgroundTasks = {
  /**
   * Schedule cache cleanup task
   */
  scheduleCacheCleanup: (interval: number = 5 * 60 * 1000) => {
    return backgroundTaskManager.scheduleRecurringTask({
      name: 'cache-cleanup',
      priority: TaskPriority.LOW,
      execute: async () => {
        const { cacheManager } = await import('./CacheManager');
        cacheManager.cleanup();
        return { cleaned: true, timestamp: new Date() };
      },
      maxRetries: 1,
      delay: 0
    }, interval);
  },

  /**
   * Schedule session validation task
   */
  scheduleSessionValidation: (interval: number = 30 * 1000) => {
    return backgroundTaskManager.scheduleRecurringTask({
      name: 'session-validation',
      priority: TaskPriority.HIGH,
      execute: async () => {
        const { sessionManager } = await import('./SessionManager');
        const isValid = await sessionManager.validateSession();
        return { isValid, timestamp: new Date() };
      },
      maxRetries: 2,
      delay: 0
    }, interval);
  },

  /**
   * Schedule data synchronization task
   */
  scheduleDataSync: (syncFunction: () => Promise<any>, priority: TaskPriority = TaskPriority.NORMAL) => {
    return backgroundTaskManager.scheduleTask({
      name: 'data-sync',
      priority,
      execute: syncFunction,
      maxRetries: 3,
      delay: 0
    });
  },

  /**
   * Schedule analytics data collection
   */
  scheduleAnalyticsCollection: (interval: number = 10 * 60 * 1000) => {
    return backgroundTaskManager.scheduleRecurringTask({
      name: 'analytics-collection',
      priority: TaskPriority.LOW,
      execute: async () => {
        // Collect performance metrics, user interactions, etc.
        const metrics = {
          timestamp: new Date(),
          memoryUsage: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null,
          connectionType: (navigator as any).connection?.effectiveType || 'unknown'
        };
        
        return metrics;
      },
      maxRetries: 1,
      delay: 0
    }, interval);
  }
};