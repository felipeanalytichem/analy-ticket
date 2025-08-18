import { NotificationWithTicket } from '@/lib/notificationService';

export interface PendingUpdate {
  id: string;
  operation: 'markAsRead' | 'delete' | 'markAllAsRead';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  originalData?: any;
  rollbackData?: any;
  notificationId?: string;
  userId?: string;
  updateFunction?: (param: string) => Promise<boolean>;
}

export interface OptimisticUpdateOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableRollback?: boolean;
}

export type UpdateCallback = (notifications: NotificationWithTicket[]) => void;
export type ErrorCallback = (error: Error, update: PendingUpdate) => void;

/**
 * Manages optimistic updates for notifications with rollback capabilities
 * Provides immediate UI updates while handling background operations
 */
export class OptimisticUpdateManager {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private updateCallbacks: Set<UpdateCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly enableRollback: boolean;

  constructor(options: OptimisticUpdateOptions = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.enableRollback = options.enableRollback !== false;
  }

  /**
   * Subscribe to update notifications
   */
  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Subscribe to error notifications
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /**
   * Apply optimistic update to mark notification as read
   */
  async markAsReadOptimistic(
    notificationId: string,
    notifications: NotificationWithTicket[],
    actualUpdateFn: (id: string) => Promise<boolean>
  ): Promise<NotificationWithTicket[]> {
    const updateId = `markAsRead-${notificationId}-${Date.now()}`;
    
    // Find the notification to update
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);
    if (notificationIndex === -1) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const originalNotification = notifications[notificationIndex];
    
    // Create optimistic update
    const optimisticNotifications = [...notifications];
    optimisticNotifications[notificationIndex] = {
      ...originalNotification,
      read: true,
      updated_at: new Date().toISOString()
    };

    // Store pending update
    const pendingUpdate: PendingUpdate = {
      id: updateId,
      operation: 'markAsRead',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      originalData: originalNotification,
      rollbackData: notifications,
      notificationId,
      updateFunction: actualUpdateFn
    };

    this.pendingUpdates.set(updateId, pendingUpdate);

    // Notify subscribers of optimistic update
    this.notifyUpdateCallbacks(optimisticNotifications);

    // Execute actual update in background (next tick)
    setTimeout(() => this.executeUpdate(updateId, actualUpdateFn, optimisticNotifications), 0);

    return optimisticNotifications;
  }

  /**
   * Apply optimistic update to delete notification
   */
  async deleteOptimistic(
    notificationId: string,
    notifications: NotificationWithTicket[],
    actualDeleteFn: (id: string) => Promise<boolean>
  ): Promise<NotificationWithTicket[]> {
    const updateId = `delete-${notificationId}-${Date.now()}`;
    
    // Find the notification to delete
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);
    if (notificationIndex === -1) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    const originalNotification = notifications[notificationIndex];
    
    // Create optimistic update (remove notification)
    const optimisticNotifications = notifications.filter(n => n.id !== notificationId);

    // Store pending update
    const pendingUpdate: PendingUpdate = {
      id: updateId,
      operation: 'delete',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      originalData: originalNotification,
      rollbackData: notifications,
      notificationId,
      updateFunction: actualDeleteFn
    };

    this.pendingUpdates.set(updateId, pendingUpdate);

    // Notify subscribers of optimistic update
    this.notifyUpdateCallbacks(optimisticNotifications);

    // Execute actual delete in background (next tick)
    setTimeout(() => this.executeUpdate(updateId, actualDeleteFn, optimisticNotifications), 0);

    return optimisticNotifications;
  }

  /**
   * Apply optimistic update to mark all notifications as read
   */
  async markAllAsReadOptimistic(
    userId: string,
    notifications: NotificationWithTicket[],
    actualUpdateFn: (userId: string) => Promise<boolean>
  ): Promise<NotificationWithTicket[]> {
    const updateId = `markAllAsRead-${userId}-${Date.now()}`;
    
    // Create optimistic update (mark all as read)
    const optimisticNotifications = notifications.map(notification => ({
      ...notification,
      read: true,
      updated_at: new Date().toISOString()
    }));

    // Store pending update
    const pendingUpdate: PendingUpdate = {
      id: updateId,
      operation: 'markAllAsRead',
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.maxRetries,
      originalData: notifications,
      rollbackData: notifications,
      userId,
      updateFunction: actualUpdateFn
    };

    this.pendingUpdates.set(updateId, pendingUpdate);

    // Notify subscribers of optimistic update
    this.notifyUpdateCallbacks(optimisticNotifications);

    // Execute actual update in background (next tick)
    setTimeout(() => this.executeUpdate(updateId, actualUpdateFn, optimisticNotifications), 0);

    return optimisticNotifications;
  }

  /**
   * Execute the actual update operation
   */
  private async executeUpdate(
    updateId: string,
    updateFn: (param: string) => Promise<boolean>,
    optimisticData: NotificationWithTicket[]
  ): Promise<void> {
    const pendingUpdate = this.pendingUpdates.get(updateId);
    if (!pendingUpdate) {
      console.warn(`Pending update ${updateId} not found`);
      return;
    }

    try {
      // Determine the parameter to pass to the update function
      let param: string;
      switch (pendingUpdate.operation) {
        case 'markAsRead':
        case 'delete':
          param = pendingUpdate.notificationId!;
          break;
        case 'markAllAsRead':
          param = pendingUpdate.userId!;
          break;
        default:
          throw new Error(`Unknown operation: ${pendingUpdate.operation}`);
      }

      // Execute the actual update
      const success = await updateFn(param);

      if (success) {
        // Update succeeded, remove from pending updates
        this.pendingUpdates.delete(updateId);
        console.log(`✅ Optimistic update ${updateId} completed successfully`);
      } else {
        // Update failed, handle retry or rollback
        await this.handleUpdateFailure(updateId, new Error('Update operation returned false'));
      }
    } catch (error) {
      console.error(`❌ Optimistic update ${updateId} failed:`, error);
      await this.handleUpdateFailure(updateId, error as Error);
    }
  }

  /**
   * Handle update failure with retry logic
   */
  private async handleUpdateFailure(updateId: string, error: Error): Promise<void> {
    const pendingUpdate = this.pendingUpdates.get(updateId);
    if (!pendingUpdate) {
      return;
    }

    pendingUpdate.retryCount++;

    if (pendingUpdate.retryCount <= pendingUpdate.maxRetries) {
      // Schedule retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, pendingUpdate.retryCount - 1);
      console.log(`🔄 Retrying optimistic update ${updateId} in ${delay}ms (attempt ${pendingUpdate.retryCount}/${pendingUpdate.maxRetries})`);
      
      const timeout = setTimeout(async () => {
        this.retryTimeouts.delete(updateId);
        
        // Retry the update
        const updateFn = this.createRetryFunction(pendingUpdate);
        await this.executeUpdate(updateId, updateFn, []);
      }, delay);

      this.retryTimeouts.set(updateId, timeout);
    } else {
      // Max retries reached, rollback if enabled
      console.error(`💥 Optimistic update ${updateId} failed after ${pendingUpdate.maxRetries} attempts`);
      
      if (this.enableRollback && pendingUpdate.rollbackData) {
        await this.rollbackUpdate(updateId);
      }

      // Notify error callbacks
      this.notifyErrorCallbacks(error, pendingUpdate);
      
      // Remove from pending updates
      this.pendingUpdates.delete(updateId);
    }
  }

  /**
   * Create a retry function for the pending update
   */
  private createRetryFunction(pendingUpdate: PendingUpdate): (param: string) => Promise<boolean> {
    if (!pendingUpdate.updateFunction) {
      throw new Error('Update function not found for pending update');
    }
    return pendingUpdate.updateFunction;
  }

  /**
   * Rollback an optimistic update
   */
  private async rollbackUpdate(updateId: string): Promise<void> {
    const pendingUpdate = this.pendingUpdates.get(updateId);
    if (!pendingUpdate || !pendingUpdate.rollbackData) {
      return;
    }

    console.log(`🔙 Rolling back optimistic update ${updateId}`);
    
    // Restore original data
    this.notifyUpdateCallbacks(pendingUpdate.rollbackData as NotificationWithTicket[]);
  }

  /**
   * Get pending updates for debugging
   */
  getPendingUpdates(): PendingUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  /**
   * Check if there are any pending updates
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Cancel a pending update
   */
  cancelUpdate(updateId: string): boolean {
    const timeout = this.retryTimeouts.get(updateId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(updateId);
    }

    const wasDeleted = this.pendingUpdates.delete(updateId);
    if (wasDeleted) {
      console.log(`🚫 Cancelled optimistic update ${updateId}`);
    }
    
    return wasDeleted;
  }

  /**
   * Cancel all pending updates
   */
  cancelAllUpdates(): void {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // Clear all pending updates
    const count = this.pendingUpdates.size;
    this.pendingUpdates.clear();

    if (count > 0) {
      console.log(`🚫 Cancelled ${count} pending optimistic updates`);
    }
  }

  /**
   * Clean up expired updates
   */
  cleanup(maxAge: number = 5 * 60 * 1000): number {
    const now = Date.now();
    const expiredUpdates: string[] = [];

    for (const [updateId, update] of this.pendingUpdates.entries()) {
      if (now - update.timestamp > maxAge) {
        expiredUpdates.push(updateId);
      }
    }

    expiredUpdates.forEach(updateId => {
      this.cancelUpdate(updateId);
    });

    if (expiredUpdates.length > 0) {
      console.log(`🧹 Cleaned up ${expiredUpdates.length} expired optimistic updates`);
    }

    return expiredUpdates.length;
  }

  /**
   * Notify update callbacks
   */
  private notifyUpdateCallbacks(notifications: NotificationWithTicket[]): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(notifications);
      } catch (error) {
        console.error('Error in update callback:', error);
      }
    });
  }

  /**
   * Notify error callbacks
   */
  private notifyErrorCallbacks(error: Error, update: PendingUpdate): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error, update);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy(): void {
    this.cancelAllUpdates();
    this.updateCallbacks.clear();
    this.errorCallbacks.clear();
  }
}

// Singleton instance for global use
export const optimisticUpdateManager = new OptimisticUpdateManager({
  maxRetries: 3,
  retryDelay: 1000,
  enableRollback: true
});