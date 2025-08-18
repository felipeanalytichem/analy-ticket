import { supabase } from '@/lib/supabase';

export interface QueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  lastAttempt?: Date;
  error?: string;
}

/**
 * NotificationQueue - Handles failed operations with retry logic
 */
export class NotificationQueue {
  private queue: Map<string, QueueItem> = new Map();
  private processingTimer: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_QUEUE_SIZE = 1000;
  private isProcessing = false;

  constructor() {
    this.startProcessing();
  }

  /**
   * Add item to queue for retry
   */
  async enqueue(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<string> {
    // Check queue size limit
    if (this.queue.size >= this.MAX_QUEUE_SIZE) {
      console.warn('⚠️ Queue is full, removing oldest item');
      this.removeOldestItem();
    }

    const queueItem: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      ...item
    };

    this.queue.set(queueItem.id, queueItem);
    
    console.log(`📥 Added item to queue: ${queueItem.id} (operation: ${queueItem.operation})`);
    
    return queueItem.id;
  }

  /**
   * Remove item from queue
   */
  dequeue(itemId: string): boolean {
    const removed = this.queue.delete(itemId);
    if (removed) {
      console.log(`📤 Removed item from queue: ${itemId}`);
    }
    return removed;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Get queue items (for debugging)
   */
  getItems(): QueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Clear all items from queue
   */
  clear(): void {
    const size = this.queue.size;
    this.queue.clear();
    console.log(`🗑️ Cleared queue: ${size} items removed`);
  }

  /**
   * Start processing queue items
   */
  private startProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);

    console.log('🔄 Started queue processing');
  }

  /**
   * Process queue items
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing queue: ${this.queue.size} items`);

    const itemsToProcess = Array.from(this.queue.values())
      .filter(item => item.retryCount < item.maxRetries)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const item of itemsToProcess) {
      try {
        await this.processItem(item);
      } catch (error) {
        console.error('Error processing queue item:', error);
      }
    }

    // Remove items that have exceeded max retries
    this.cleanupFailedItems();

    this.isProcessing = false;
  }

  /**
   * Process individual queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    console.log(`🔄 Processing queue item: ${item.id} (attempt ${item.retryCount + 1})`);

    item.retryCount++;
    item.lastAttempt = new Date();

    try {
      let success = false;

      switch (item.operation) {
        case 'create':
          success = await this.retryCreateNotification(item.data);
          break;
        case 'update':
          success = await this.retryUpdateNotification(item.data);
          break;
        case 'delete':
          success = await this.retryDeleteNotification(item.data);
          break;
        default:
          console.error('Unknown operation:', item.operation);
          success = false;
      }

      if (success) {
        console.log(`✅ Successfully processed queue item: ${item.id}`);
        this.dequeue(item.id);
      } else {
        console.warn(`⚠️ Failed to process queue item: ${item.id} (attempt ${item.retryCount})`);
        item.error = 'Operation failed';
      }
    } catch (error) {
      console.error(`❌ Error processing queue item ${item.id}:`, error);
      item.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Retry creating a notification
   */
  private async retryCreateNotification(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([data]);

      if (error) {
        console.error('Retry create notification error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in retryCreateNotification:', error);
      return false;
    }
  }

  /**
   * Retry updating a notification
   */
  private async retryUpdateNotification(data: any): Promise<boolean> {
    try {
      const { id, ...updateData } = data;
      
      const { error } = await supabase
        .from('notifications')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Retry update notification error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in retryUpdateNotification:', error);
      return false;
    }
  }

  /**
   * Retry deleting a notification
   */
  private async retryDeleteNotification(data: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', data.id);

      if (error) {
        console.error('Retry delete notification error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in retryDeleteNotification:', error);
      return false;
    }
  }

  /**
   * Remove items that have exceeded max retries
   */
  private cleanupFailedItems(): void {
    const failedItems: string[] = [];

    for (const [id, item] of this.queue.entries()) {
      if (item.retryCount >= item.maxRetries) {
        failedItems.push(id);
      }
    }

    for (const id of failedItems) {
      const item = this.queue.get(id);
      console.error(`❌ Removing failed queue item: ${id} (${item?.retryCount}/${item?.maxRetries} attempts)`);
      this.queue.delete(id);
    }

    if (failedItems.length > 0) {
      console.log(`🗑️ Cleaned up ${failedItems.length} failed queue items`);
    }
  }

  /**
   * Remove oldest item when queue is full
   */
  private removeOldestItem(): void {
    let oldestId = '';
    let oldestTime = Date.now();

    for (const [id, item] of this.queue.entries()) {
      if (item.createdAt.getTime() < oldestTime) {
        oldestTime = item.createdAt.getTime();
        oldestId = id;
      }
    }

    if (oldestId) {
      this.queue.delete(oldestId);
      console.log(`🗑️ Removed oldest queue item: ${oldestId}`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    processing: boolean;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const items = Array.from(this.queue.values());
    
    return {
      size: this.queue.size,
      maxSize: this.MAX_QUEUE_SIZE,
      processing: this.isProcessing,
      oldestItem: items.length > 0 ? new Date(Math.min(...items.map(i => i.createdAt.getTime()))) : undefined,
      newestItem: items.length > 0 ? new Date(Math.max(...items.map(i => i.createdAt.getTime()))) : undefined
    };
  }

  /**
   * Stop processing queue
   */
  stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    console.log('⏹️ Stopped queue processing');
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up NotificationQueue...');
    
    this.stopProcessing();
    
    // Process remaining items one last time
    if (this.queue.size > 0) {
      console.log(`🔄 Processing ${this.queue.size} remaining queue items...`);
      await this.processQueue();
    }
    
    this.clear();
    console.log('✅ NotificationQueue cleanup complete');
  }
}