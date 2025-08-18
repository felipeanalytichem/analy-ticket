import { supabase } from '@/lib/supabase';
import { NotificationCache } from './NotificationCache';
import { RealtimeConnectionManager } from './RealtimeConnectionManager';
import { NotificationQueue } from './NotificationQueue';
import { NotificationErrorHandler } from './NotificationErrorHandler';

export interface NotificationQueryOptions {
  limit?: number;
  offset?: number;
  type?: string;
  priority?: 'low' | 'medium' | 'high';
  read?: boolean;
  ticketId?: string;
}

export interface CreateNotificationRequest {
  user_id: string;
  message: string;
  type: string;
  ticket_id?: string;
  priority?: 'low' | 'medium' | 'high';
  title: string;
  metadata?: Record<string, any>;
}

export interface NotificationCallback {
  (notification: any): void;
}

export interface Subscription {
  id: string;
  userId: string;
  unsubscribe: () => void;
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface NotificationPreferences {
  userId: string;
  emailNotifications: boolean;
  toastNotifications: boolean;
  soundNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  typePreferences: Record<string, {
    enabled: boolean;
    priority: 'low' | 'medium' | 'high';
    delivery: 'instant' | 'batched' | 'digest';
  }>;
  language: string;
  timezone: string;
}

export interface NotificationWithTicket {
  id?: string;
  user_id: string;
  message: string;
  type: string;
  ticket_id?: string;
  read?: boolean;
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at?: string;
  title: string;
  metadata?: Record<string, any>;
  ticket?: {
    id: string;
    title: string;
    ticket_number: string;
    status: string;
    priority: string;
  } | null;
}

/**
 * Enhanced NotificationManager with improved error handling, retry logic, and performance optimization
 */
export class NotificationManager {
  private static instance: NotificationManager;
  private cache: NotificationCache;
  private realtimeManager: RealtimeConnectionManager;
  private queue: NotificationQueue;
  private errorHandler: NotificationErrorHandler;
  private subscriptions: Map<string, Subscription> = new Map();

  private constructor() {
    this.cache = new NotificationCache();
    this.realtimeManager = new RealtimeConnectionManager();
    this.queue = new NotificationQueue();
    this.errorHandler = new NotificationErrorHandler();
  }

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Get notifications with caching and error handling
   */
  async getNotifications(userId: string, options: NotificationQueryOptions = {}): Promise<NotificationWithTicket[]> {
    const cacheKey = `notifications:${userId}:${JSON.stringify(options)}`;
    
    try {
      // Try to get from cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log('📦 Returning cached notifications for user:', userId);
        return cached;
      }

      // Build query
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options.limit) query = query.limit(options.limit);
      if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      if (options.type) query = query.eq('type', options.type);
      if (options.priority) query = query.eq('priority', options.priority);
      if (options.read !== undefined) query = query.eq('read', options.read);
      if (options.ticketId) query = query.eq('ticket_id', options.ticketId);

      const { data: notifications, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      if (!notifications) {
        return [];
      }

      // Enrich with ticket data
      const enrichedNotifications = await this.enrichWithTicketData(notifications);

      // Cache the results
      await this.cache.set(cacheKey, enrichedNotifications, 5 * 60 * 1000); // 5 minutes TTL

      return enrichedNotifications;
    } catch (error) {
      console.error('Error in getNotifications:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'getNotifications',
        userId,
        options
      });
      
      // Return empty array on error to prevent UI crashes
      return [];
    }
  }

  /**
   * Create notification with retry logic and queuing
   */
  async createNotification(notification: CreateNotificationRequest): Promise<boolean> {
    try {
      const notificationData = {
        ...notification,
        read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert([notificationData]);

      if (error) {
        // Queue for retry if database operation fails
        await this.queue.enqueue({
          operation: 'create',
          data: notificationData,
          retryCount: 0,
          maxRetries: 3
        });
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      // Invalidate relevant cache entries
      await this.cache.invalidate(`notifications:${notification.user_id}:*`);

      console.log('✅ Notification created successfully');
      return true;
    } catch (error) {
      console.error('Error in createNotification:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'createNotification',
        notification
      });
      return false;
    }
  }

  /**
   * Mark notification as read with optimistic updates
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }

      // Invalidate cache for this notification
      await this.cache.invalidate(`notification:${notificationId}`);
      
      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'markAsRead',
        notificationId
      });
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        throw new Error(`Failed to mark all notifications as read: ${error.message}`);
      }

      // Invalidate all notification caches for this user
      await this.cache.invalidate(`notifications:${userId}:*`);
      
      return true;
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'markAllAsRead',
        userId
      });
      return false;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        throw new Error(`Failed to delete notification: ${error.message}`);
      }

      // Invalidate cache
      await this.cache.invalidate(`notification:${notificationId}`);
      
      return true;
    } catch (error) {
      console.error('Error in deleteNotification:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'deleteNotification',
        notificationId
      });
      return false;
    }
  }

  /**
   * Subscribe to real-time notifications with improved connection handling
   */
  subscribe(userId: string, callback: NotificationCallback): Subscription {
    const subscriptionId = `${userId}-${Date.now()}`;
    
    // Check if user already has an active subscription
    const existingSubscription = this.subscriptions.get(userId);
    if (existingSubscription) {
      console.warn('Subscription already exists for user:', userId);
      return existingSubscription;
    }

    try {
      const connection = this.realtimeManager.connect(userId, callback);
      
      const subscription: Subscription = {
        id: subscriptionId,
        userId,
        unsubscribe: () => {
          this.realtimeManager.disconnect(userId);
          this.subscriptions.delete(userId);
        }
      };

      this.subscriptions.set(userId, subscription);
      console.log('🔔 Created notification subscription:', subscriptionId);
      
      return subscription;
    } catch (error) {
      console.error('Error creating subscription:', error);
      this.errorHandler.handleError(error as Error, {
        operation: 'subscribe',
        userId
      });
      
      // Return a dummy subscription that does nothing
      return {
        id: subscriptionId,
        userId,
        unsubscribe: () => {}
      };
    }
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(subscription: Subscription): void {
    try {
      subscription.unsubscribe();
      this.subscriptions.delete(subscription.userId);
      console.log('🔔 Unsubscribed from notifications:', subscription.id);
    } catch (error) {
      console.error('Error unsubscribing:', error);
      this.errorHandler.handleError(error as Error, {
        operation: 'unsubscribe',
        subscriptionId: subscription.id
      });
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const cacheKey = `preferences:${userId}`;
    
    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to get user preferences: ${error.message}`);
      }

      const preferences = data ? {
        userId: data.user_id,
        ...data.preferences
      } : this.getDefaultPreferences(userId);

      // Cache for 10 minutes
      await this.cache.set(cacheKey, preferences, 10 * 60 * 1000);
      
      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'getUserPreferences',
        userId
      });
      return this.getDefaultPreferences(userId);
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          preferences: preferences,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      // Invalidate cache
      await this.cache.invalidate(`preferences:${userId}`);
      
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'updateUserPreferences',
        userId,
        preferences
      });
      return false;
    }
  }

  /**
   * Get connection status for a user
   */
  getConnectionStatus(userId: string): ConnectionStatus {
    return this.realtimeManager.getConnectionStatus(userId);
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = `unread_count:${userId}`;
    
    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        throw new Error(`Failed to get unread count: ${error.message}`);
      }

      const unreadCount = count || 0;
      
      // Cache for 1 minute
      await this.cache.set(cacheKey, unreadCount, 60 * 1000);
      
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread count:', error);
      await this.errorHandler.handleError(error as Error, {
        operation: 'getUnreadCount',
        userId
      });
      return 0;
    }
  }

  /**
   * Private helper methods
   */
  private async enrichWithTicketData(notifications: any[]): Promise<NotificationWithTicket[]> {
    const enrichedNotifications: NotificationWithTicket[] = [];

    for (const notification of notifications) {
      let ticket = null;
      
      if (notification.ticket_id) {
        try {
          const { data: ticketData } = await supabase
            .from('tickets_new')
            .select('id, title, ticket_number, status, priority')
            .eq('id', notification.ticket_id)
            .single();
          ticket = ticketData;
        } catch (error) {
          console.warn('Failed to fetch ticket data for notification:', notification.id);
        }
      }

      enrichedNotifications.push({
        ...notification,
        ticket
      });
    }

    return enrichedNotifications;
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      emailNotifications: true,
      toastNotifications: true,
      soundNotifications: false,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      typePreferences: {
        'ticket_created': { enabled: true, priority: 'medium', delivery: 'instant' },
        'ticket_assigned': { enabled: true, priority: 'high', delivery: 'instant' },
        'status_changed': { enabled: true, priority: 'medium', delivery: 'instant' },
        'comment_added': { enabled: true, priority: 'medium', delivery: 'instant' },
        'sla_warning': { enabled: true, priority: 'high', delivery: 'instant' },
        'sla_breach': { enabled: true, priority: 'high', delivery: 'instant' }
      },
      language: 'en',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up NotificationManager...');
    
    // Unsubscribe all active subscriptions
    for (const subscription of this.subscriptions.values()) {
      subscription.unsubscribe();
    }
    this.subscriptions.clear();

    // Cleanup other services
    await this.realtimeManager.cleanup();
    await this.queue.cleanup();
    await this.cache.clear();
  }
}