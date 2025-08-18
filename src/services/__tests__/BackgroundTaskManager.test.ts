import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  BackgroundTaskManager, 
  TaskPriority, 
  TaskStatus, 
  BackgroundTasks,
  backgroundTaskManager 
} from '../BackgroundTaskManager';

describe('BackgroundTaskManager', () => {
  let taskManager: BackgroundTaskManager;

  beforeEach(() => {
    vi.useFakeTimers();
    taskManager = new BackgroundTaskManager({
      maxConcurrentTasks: 2,
      defaultTimeout: 5000,
      retryDelay: 100,
      maxRetryDelay: 1000,
      cleanupInterval: 10000, // Longer interval to avoid interference
      taskHistoryLimit: 10
    });
  });

  afterEach(() => {
    taskManager.destroy();
    vi.useRealTimers();
  });

  describe('Task Scheduling', () => {
    it('should schedule a basic task', () => {
      const taskId = taskManager.scheduleTask({
        name: 'test-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 3,
        delay: 0
      });

      expect(taskId).toBeDefined();
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);
    });

    it('should schedule a high priority task', () => {
      const taskId = taskManager.scheduleHighPriorityTask({
        name: 'urgent-task',
        execute: vi.fn().mockResolvedValue('urgent-success'),
        maxRetries: 1,
        delay: 0
      });

      const tasks = taskManager.getTasks({ priority: TaskPriority.HIGH });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(taskId);
    });

    it('should schedule tasks with delays', () => {
      const taskId = taskManager.scheduleTask({
        name: 'delayed-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('delayed-success'),
        maxRetries: 1,
        delay: 1000
      });

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);
      
      // Task should not execute immediately
      vi.advanceTimersByTime(500);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);
      
      // Task should execute after delay
      vi.advanceTimersByTime(600);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.RUNNING);
    });

    it('should handle task dependencies', async () => {
      const dependency = taskManager.scheduleTask({
        name: 'dependency-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('dependency-done'),
        maxRetries: 1,
        delay: 0
      });

      const dependent = taskManager.scheduleTask({
        name: 'dependent-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('dependent-done'),
        maxRetries: 1,
        delay: 0,
        dependencies: [dependency]
      });

      // Wait for dependency to complete
      await vi.runOnlyPendingTimersAsync();
      
      expect(taskManager.getTaskStatus(dependency)).toBe(TaskStatus.COMPLETED);
      expect(taskManager.getTaskStatus(dependent)).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('Task Execution', () => {
    it('should execute tasks successfully', async () => {
      const executeFn = vi.fn().mockResolvedValue('task-result');
      const onSuccess = vi.fn();
      const onComplete = vi.fn();

      const taskId = taskManager.scheduleTask({
        name: 'success-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 1,
        delay: 0,
        onSuccess,
        onComplete
      });

      await vi.runOnlyPendingTimersAsync();

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);
      expect(taskManager.getTaskResult(taskId)).toBe('task-result');
      expect(executeFn).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledWith('task-result');
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should handle task failures with retries', async () => {
      const executeFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce('success-after-retries');

      const onError = vi.fn();
      const onComplete = vi.fn();

      const taskId = taskManager.scheduleTask({
        name: 'retry-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 3,
        delay: 0,
        onError,
        onComplete
      });

      // Process tasks step by step
      vi.advanceTimersByTime(200); // Initial execution
      await vi.runOnlyPendingTimersAsync();
      
      vi.advanceTimersByTime(200); // First retry
      await vi.runOnlyPendingTimersAsync();
      
      vi.advanceTimersByTime(200); // Second retry
      await vi.runOnlyPendingTimersAsync();

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);
      expect(taskManager.getTaskResult(taskId)).toBe('success-after-retries');
      expect(executeFn).toHaveBeenCalledTimes(3);
      expect(onError).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should fail task after max retries', async () => {
      const error = new Error('Persistent failure');
      const executeFn = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      const taskId = taskManager.scheduleTask({
        name: 'failing-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 2,
        delay: 0,
        onError
      });

      await vi.runAllTimersAsync();

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.FAILED);
      expect(taskManager.getTaskError(taskId)).toBe(error);
      expect(executeFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should handle task timeouts', async () => {
      const executeFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // Long running task
      );

      const taskId = taskManager.scheduleTask({
        name: 'timeout-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 1,
        delay: 0,
        timeout: 1000
      });

      await vi.runAllTimersAsync();

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.FAILED);
      expect(taskManager.getTaskError(taskId)?.message).toContain('timed out');
    });

    it('should respect max concurrent tasks limit', async () => {
      const executeFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('done'), 1000))
      );

      // Schedule 4 tasks with max concurrent = 2
      const taskIds = Array.from({ length: 4 }, (_, i) => 
        taskManager.scheduleTask({
          name: `concurrent-task-${i}`,
          priority: TaskPriority.NORMAL,
          execute: executeFn,
          maxRetries: 1,
          delay: 0
        })
      );

      // Advance time slightly to start processing
      vi.advanceTimersByTime(200);

      // Only 2 tasks should be running
      const runningTasks = taskManager.getTasks({ status: TaskStatus.RUNNING });
      expect(runningTasks).toHaveLength(2);

      // Complete first batch
      vi.advanceTimersByTime(1000);

      // Next batch should start
      vi.advanceTimersByTime(200);
      const newRunningTasks = taskManager.getTasks({ status: TaskStatus.RUNNING });
      expect(newRunningTasks).toHaveLength(2);
    });
  });

  describe('Task Priority', () => {
    it('should execute high priority tasks first', async () => {
      const executionOrder: string[] = [];

      const lowPriorityTask = taskManager.scheduleTask({
        name: 'low-priority',
        priority: TaskPriority.LOW,
        execute: vi.fn().mockImplementation(() => {
          executionOrder.push('low');
          return Promise.resolve('low-done');
        }),
        maxRetries: 1,
        delay: 0
      });

      const highPriorityTask = taskManager.scheduleTask({
        name: 'high-priority',
        priority: TaskPriority.HIGH,
        execute: vi.fn().mockImplementation(() => {
          executionOrder.push('high');
          return Promise.resolve('high-done');
        }),
        maxRetries: 1,
        delay: 0
      });

      const normalPriorityTask = taskManager.scheduleTask({
        name: 'normal-priority',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockImplementation(() => {
          executionOrder.push('normal');
          return Promise.resolve('normal-done');
        }),
        maxRetries: 1,
        delay: 0
      });

      await vi.runAllTimersAsync();

      expect(executionOrder).toEqual(['high', 'normal', 'low']);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel pending tasks', () => {
      const taskId = taskManager.scheduleTask({
        name: 'cancellable-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('should-not-execute'),
        maxRetries: 1,
        delay: 1000 // Delayed so it stays pending
      });

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);
      
      const cancelled = taskManager.cancelTask(taskId);
      expect(cancelled).toBe(true);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.CANCELLED);
    });

    it('should mark running tasks for cancellation', async () => {
      const executeFn = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('done'), 2000))
      );

      const taskId = taskManager.scheduleTask({
        name: 'running-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 1,
        delay: 0
      });

      // Start the task
      vi.advanceTimersByTime(200);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.RUNNING);

      // Cancel the running task
      const cancelled = taskManager.cancelTask(taskId);
      expect(cancelled).toBe(true);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.CANCELLED);
    });
  });

  describe('Recurring Tasks', () => {
    it('should schedule recurring tasks', async () => {
      let executionCount = 0;
      const executeFn = vi.fn().mockImplementation(() => {
        executionCount++;
        return Promise.resolve(`execution-${executionCount}`);
      });

      taskManager.scheduleRecurringTask({
        name: 'recurring-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 1,
        delay: 0
      }, 1000);

      // First execution
      await vi.runAllTimersAsync();
      expect(executionCount).toBe(1);

      // Second execution after interval
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(executionCount).toBe(2);

      // Third execution
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(executionCount).toBe(3);
    });
  });

  describe('Statistics and Management', () => {
    it('should provide accurate statistics', async () => {
      // Schedule various tasks
      const successTask = taskManager.scheduleTask({
        name: 'success-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      const failTask = taskManager.scheduleTask({
        name: 'fail-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockRejectedValue(new Error('fail')),
        maxRetries: 0,
        delay: 0
      });

      const pendingTask = taskManager.scheduleTask({
        name: 'pending-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('pending'),
        maxRetries: 1,
        delay: 5000 // Long delay to keep it pending
      });

      await vi.runAllTimersAsync();

      const stats = taskManager.getStats();
      expect(stats.totalTasks).toBe(3);
      expect(stats.completedTasks).toBe(1);
      expect(stats.failedTasks).toBe(1);
      expect(stats.pendingTasks).toBe(1);
      expect(stats.successRate).toBe(0.5); // 1 success out of 2 completed
    });

    it('should filter tasks by status and priority', () => {
      const highTask = taskManager.scheduleTask({
        name: 'high-task',
        priority: TaskPriority.HIGH,
        execute: vi.fn().mockResolvedValue('high'),
        maxRetries: 1,
        delay: 1000
      });

      const normalTask = taskManager.scheduleTask({
        name: 'normal-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('normal'),
        maxRetries: 1,
        delay: 1000
      });

      const highTasks = taskManager.getTasks({ priority: TaskPriority.HIGH });
      expect(highTasks).toHaveLength(1);
      expect(highTasks[0].id).toBe(highTask);

      const pendingTasks = taskManager.getTasks({ status: TaskStatus.PENDING });
      expect(pendingTasks).toHaveLength(2);
    });

    it('should clear task history', async () => {
      const taskId = taskManager.scheduleTask({
        name: 'history-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('done'),
        maxRetries: 1,
        delay: 0
      });

      await vi.runAllTimersAsync();
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);

      taskManager.clearHistory();
      expect(taskManager.getTaskStatus(taskId)).toBeNull();
    });

    it('should pause and resume processing', async () => {
      const executeFn = vi.fn().mockResolvedValue('done');

      taskManager.pause();

      const taskId = taskManager.scheduleTask({
        name: 'paused-task',
        priority: TaskPriority.NORMAL,
        execute: executeFn,
        maxRetries: 1,
        delay: 0
      });

      vi.advanceTimersByTime(1000);
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);
      expect(executeFn).not.toHaveBeenCalled();

      taskManager.resume();
      await vi.runAllTimersAsync();
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);
      expect(executeFn).toHaveBeenCalledOnce();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should cleanup old tasks', async () => {
      const taskId = taskManager.scheduleTask({
        name: 'old-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('old-done'),
        maxRetries: 1,
        delay: 0
      });

      await vi.runAllTimersAsync();
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.COMPLETED);

      // Advance time by more than 24 hours
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      // Trigger cleanup
      vi.advanceTimersByTime(1000);

      expect(taskManager.getTaskStatus(taskId)).toBeNull();
    });

    it('should destroy properly', () => {
      const taskId = taskManager.scheduleTask({
        name: 'destroy-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('destroy-done'),
        maxRetries: 1,
        delay: 1000
      });

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);

      taskManager.destroy();

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.CANCELLED);
      expect(() => taskManager.scheduleTask({
        name: 'after-destroy',
        priority: TaskPriority.NORMAL,
        execute: vi.fn(),
        maxRetries: 1,
        delay: 0
      })).toThrow('TaskManager has been destroyed');
    });
  });
});

describe('BackgroundTasks Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should schedule cache cleanup task', () => {
    const taskId = BackgroundTasks.scheduleCacheCleanup(5000);
    expect(taskId).toBeDefined();
    
    const task = backgroundTaskManager.getTasks().find(t => t.id === taskId);
    expect(task?.name).toBe('cache-cleanup');
    expect(task?.priority).toBe(TaskPriority.LOW);
  });

  it('should schedule session validation task', () => {
    const taskId = BackgroundTasks.scheduleSessionValidation(30000);
    expect(taskId).toBeDefined();
    
    const task = backgroundTaskManager.getTasks().find(t => t.id === taskId);
    expect(task?.name).toBe('session-validation');
    expect(task?.priority).toBe(TaskPriority.HIGH);
  });

  it('should schedule data sync task', () => {
    const syncFn = vi.fn().mockResolvedValue('synced');
    const taskId = BackgroundTasks.scheduleDataSync(syncFn, TaskPriority.HIGH);
    expect(taskId).toBeDefined();
    
    const task = backgroundTaskManager.getTasks().find(t => t.id === taskId);
    expect(task?.name).toBe('data-sync');
    expect(task?.priority).toBe(TaskPriority.HIGH);
  });

  it('should schedule analytics collection task', () => {
    const taskId = BackgroundTasks.scheduleAnalyticsCollection(600000);
    expect(taskId).toBeDefined();
    
    const task = backgroundTaskManager.getTasks().find(t => t.id === taskId);
    expect(task?.name).toBe('analytics-collection');
    expect(task?.priority).toBe(TaskPriority.LOW);
  });
});