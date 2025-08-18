import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  BackgroundTaskManager, 
  TaskPriority, 
  TaskStatus, 
  BackgroundTasks
} from '../BackgroundTaskManager';

describe('BackgroundTaskManager - Core Functionality', () => {
  let taskManager: BackgroundTaskManager;

  beforeEach(() => {
    taskManager = new BackgroundTaskManager({
      maxConcurrentTasks: 2,
      defaultTimeout: 5000,
      retryDelay: 100,
      maxRetryDelay: 1000,
      cleanupInterval: 60000, // Long interval to avoid interference
      taskHistoryLimit: 10
    });
  });

  afterEach(() => {
    taskManager.destroy();
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
      expect(tasks[0].priority).toBe(TaskPriority.HIGH);
    });

    it('should generate unique task IDs', () => {
      const taskId1 = taskManager.scheduleTask({
        name: 'task-1',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      const taskId2 = taskManager.scheduleTask({
        name: 'task-2',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      expect(taskId1).not.toBe(taskId2);
    });
  });

  describe('Task Management', () => {
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

    it('should return false when cancelling non-existent task', () => {
      const cancelled = taskManager.cancelTask('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should get task result and error', () => {
      const taskId = taskManager.scheduleTask({
        name: 'test-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('test-result'),
        maxRetries: 1,
        delay: 0
      });

      // Initially no result or error
      expect(taskManager.getTaskResult(taskId)).toBeNull();
      expect(taskManager.getTaskError(taskId)).toBeNull();
    });
  });

  describe('Task Filtering', () => {
    it('should filter tasks by status', () => {
      const pendingTask = taskManager.scheduleTask({
        name: 'pending-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 1000
      });

      const cancelledTask = taskManager.scheduleTask({
        name: 'cancelled-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 1000
      });

      taskManager.cancelTask(cancelledTask);

      const pendingTasks = taskManager.getTasks({ status: TaskStatus.PENDING });
      const cancelledTasks = taskManager.getTasks({ status: TaskStatus.CANCELLED });

      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].id).toBe(pendingTask);
      expect(cancelledTasks).toHaveLength(1);
      expect(cancelledTasks[0].id).toBe(cancelledTask);
    });

    it('should filter tasks by priority', () => {
      const highTask = taskManager.scheduleTask({
        name: 'high-task',
        priority: TaskPriority.HIGH,
        execute: vi.fn().mockResolvedValue('high'),
        maxRetries: 1,
        delay: 0
      });

      const normalTask = taskManager.scheduleTask({
        name: 'normal-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('normal'),
        maxRetries: 1,
        delay: 0
      });

      const lowTask = taskManager.scheduleTask({
        name: 'low-task',
        priority: TaskPriority.LOW,
        execute: vi.fn().mockResolvedValue('low'),
        maxRetries: 1,
        delay: 0
      });

      const highTasks = taskManager.getTasks({ priority: TaskPriority.HIGH });
      const normalTasks = taskManager.getTasks({ priority: TaskPriority.NORMAL });
      const lowTasks = taskManager.getTasks({ priority: TaskPriority.LOW });

      expect(highTasks).toHaveLength(1);
      expect(highTasks[0].id).toBe(highTask);
      expect(normalTasks).toHaveLength(1);
      expect(normalTasks[0].id).toBe(normalTask);
      expect(lowTasks).toHaveLength(1);
      expect(lowTasks[0].id).toBe(lowTask);
    });

    it('should return all tasks when no filter provided', () => {
      taskManager.scheduleTask({
        name: 'task-1',
        priority: TaskPriority.HIGH,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      taskManager.scheduleTask({
        name: 'task-2',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      const allTasks = taskManager.getTasks();
      expect(allTasks).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    it('should provide basic statistics', () => {
      taskManager.scheduleTask({
        name: 'task-1',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 0
      });

      taskManager.scheduleTask({
        name: 'task-2',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('success'),
        maxRetries: 1,
        delay: 1000
      });

      const stats = taskManager.getStats();
      expect(stats.totalTasks).toBe(2);
      expect(stats.pendingTasks).toBe(2);
      expect(stats.runningTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });
  });

  describe('Pause and Resume', () => {
    it('should pause and resume processing', () => {
      expect(() => taskManager.pause()).not.toThrow();
      expect(() => taskManager.resume()).not.toThrow();
    });
  });

  describe('History Management', () => {
    it('should clear task history', () => {
      const taskId = taskManager.scheduleTask({
        name: 'history-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('done'),
        maxRetries: 1,
        delay: 0
      });

      // Cancel the task to simulate completion
      taskManager.cancelTask(taskId);
      
      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.CANCELLED);

      taskManager.clearHistory();
      expect(taskManager.getTaskStatus(taskId)).toBeNull();
    });
  });

  describe('Destruction', () => {
    it('should destroy properly and prevent new tasks', () => {
      const taskId = taskManager.scheduleTask({
        name: 'destroy-task',
        priority: TaskPriority.NORMAL,
        execute: vi.fn().mockResolvedValue('destroy-done'),
        maxRetries: 1,
        delay: 0
      });

      expect(taskManager.getTaskStatus(taskId)).toBe(TaskStatus.PENDING);

      taskManager.destroy();

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
  it('should provide utility functions for common tasks', () => {
    expect(typeof BackgroundTasks.scheduleCacheCleanup).toBe('function');
    expect(typeof BackgroundTasks.scheduleSessionValidation).toBe('function');
    expect(typeof BackgroundTasks.scheduleDataSync).toBe('function');
    expect(typeof BackgroundTasks.scheduleAnalyticsCollection).toBe('function');
  });

  it('should schedule data sync task', () => {
    const syncFn = vi.fn().mockResolvedValue('synced');
    const taskId = BackgroundTasks.scheduleDataSync(syncFn, TaskPriority.HIGH);
    expect(taskId).toBeDefined();
  });
});