import { supabase } from '@/lib/supabase';
import { NotificationWithTicket } from '@/lib/notificationService';

export interface PaginationOptions {
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface NotificationQueryOptions extends PaginationOptions {
  userId?: string;
  type?: string;
  read?: boolean;
  priority?: 'low' | 'medium' | 'high';
  ticketId?: string;
  search?: string;
}

export class NotificationPagination {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  /**
   * Get paginated notifications with cursor-based pagination
   */
  static async getPaginatedNotifications(
    options: NotificationQueryOptions = {}
  ): Promise<PaginatedResult<NotificationWithTicket>> {
    try {
      const {
        userId,
        limit = this.DEFAULT_LIMIT,
        cursor,
        direction = 'forward',
        type,
        read,
        priority,
        ticketId,
        search
      } = options;

      // Ensure limit doesn't exceed maximum
      const safeLimit = Math.min(limit, this.MAX_LIMIT);

      // Build base query
      let query = supabase
        .from('notifications')
        .select(`
          *,
          ticket:tickets_new(
            id,
            title,
            ticket_number,
            status,
            priority
          )
        `)
        .order('created_at', { ascending: false })
        .limit(safeLimit + 1); // Get one extra to check if there are more

      // Apply filters
      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (type) {
        query = query.eq('type', type);
      }

      if (read !== undefined) {
        query = query.eq('read', read);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (ticketId) {
        query = query.eq('ticket_id', ticketId);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
      }

      // Apply cursor-based pagination
      if (cursor) {
        if (direction === 'forward') {
          query = query.lt('created_at', cursor);
        } else {
          query = query.gt('created_at', cursor);
        }
      }

      const { data: rawNotifications, error } = await query;

      if (error) {
        console.error('Error fetching paginated notifications:', error);
        throw error;
      }

      if (!rawNotifications) {
        return {
          data: [],
          hasMore: false
        };
      }

      // Check if there are more results
      const hasMore = rawNotifications.length > safeLimit;
      const notifications = hasMore ? rawNotifications.slice(0, safeLimit) : rawNotifications;

      // Transform data to match expected format
      const transformedNotifications: NotificationWithTicket[] = notifications.map(notification => ({
        id: notification.id,
        user_id: notification.user_id,
        message: notification.message || notification.title || 'Notification',
        type: notification.type,
        ticket_id: notification.ticket_id,
        read: notification.read !== undefined ? notification.read : false,
        priority: notification.priority || 'medium',
        created_at: notification.created_at,
        updated_at: notification.updated_at,
        title: notification.title,
        ticket: notification.ticket
      }));

      // Calculate cursors
      const nextCursor = hasMore && transformedNotifications.length > 0 
        ? transformedNotifications[transformedNotifications.length - 1].created_at
        : undefined;

      const prevCursor = transformedNotifications.length > 0 
        ? transformedNotifications[0].created_at
        : undefined;

      return {
        data: transformedNotifications,
        nextCursor,
        prevCursor,
        hasMore
      };
    } catch (error) {
      console.error('Error in getPaginatedNotifications:', error);
      throw error;
    }
  }

  /**
   * Get total count of notifications for a user (for UI display)
   */
  static async getTotalCount(userId: string, filters?: Partial<NotificationQueryOptions>): Promise<number> {
    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Apply same filters as pagination query
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.read !== undefined) {
        query = query.eq('read', filters.read);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.ticketId) {
        query = query.eq('ticket_id', filters.ticketId);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error getting notification count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getTotalCount:', error);
      return 0;
    }
  }

  /**
   * Load notification details lazily (for preview functionality)
   */
  static async loadNotificationDetails(notificationId: string): Promise<NotificationWithTicket | null> {
    try {
      const { data: notification, error } = await supabase
        .from('notifications')
        .select(`
          *,
          ticket:tickets_new(
            id,
            title,
            ticket_number,
            status,
            priority,
            description,
            created_at,
            updated_at,
            user:users(
              id,
              full_name,
              email
            ),
            assigned_user:users!tickets_new_assigned_to_fkey(
              id,
              full_name,
              email
            ),
            category:categories(
              id,
              name
            )
          )
        `)
        .eq('id', notificationId)
        .single();

      if (error) {
        console.error('Error loading notification details:', error);
        return null;
      }

      if (!notification) {
        return null;
      }

      return {
        id: notification.id,
        user_id: notification.user_id,
        message: notification.message || notification.title || 'Notification',
        type: notification.type,
        ticket_id: notification.ticket_id,
        read: notification.read !== undefined ? notification.read : false,
        priority: notification.priority || 'medium',
        created_at: notification.created_at,
        updated_at: notification.updated_at,
        title: notification.title,
        ticket: notification.ticket
      };
    } catch (error) {
      console.error('Error in loadNotificationDetails:', error);
      return null;
    }
  }

  /**
   * Prefetch next page of notifications for better UX
   */
  static async prefetchNextPage(
    options: NotificationQueryOptions,
    currentCursor?: string
  ): Promise<void> {
    try {
      // Only prefetch if we have a cursor and haven't reached the end
      if (!currentCursor) return;

      const prefetchOptions = {
        ...options,
        cursor: currentCursor,
        direction: 'forward' as const,
        limit: options.limit || this.DEFAULT_LIMIT
      };

      // Fire and forget - just load into cache
      await this.getPaginatedNotifications(prefetchOptions);
    } catch (error) {
      // Silently fail prefetch - it's not critical
      console.warn('Prefetch failed:', error);
    }
  }

  /**
   * Get notifications around a specific notification (for context)
   */
  static async getNotificationContext(
    notificationId: string,
    userId: string,
    contextSize: number = 5
  ): Promise<NotificationWithTicket[]> {
    try {
      // First get the target notification to get its timestamp
      const { data: targetNotification, error: targetError } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('id', notificationId)
        .single();

      if (targetError || !targetNotification) {
        console.error('Error getting target notification:', targetError);
        return [];
      }

      // Get notifications before and after the target
      const { data: contextNotifications, error } = await supabase
        .from('notifications')
        .select(`
          *,
          ticket:tickets_new(
            id,
            title,
            ticket_number,
            status,
            priority
          )
        `)
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.parse(targetNotification.created_at) - (contextSize * 24 * 60 * 60 * 1000)).toISOString())
        .lte('created_at', new Date(Date.parse(targetNotification.created_at) + (contextSize * 24 * 60 * 60 * 1000)).toISOString())
        .order('created_at', { ascending: false })
        .limit(contextSize * 2 + 1);

      if (error) {
        console.error('Error getting notification context:', error);
        return [];
      }

      if (!contextNotifications) {
        return [];
      }

      return contextNotifications.map(notification => ({
        id: notification.id,
        user_id: notification.user_id,
        message: notification.message || notification.title || 'Notification',
        type: notification.type,
        ticket_id: notification.ticket_id,
        read: notification.read !== undefined ? notification.read : false,
        priority: notification.priority || 'medium',
        created_at: notification.created_at,
        updated_at: notification.updated_at,
        title: notification.title,
        ticket: notification.ticket
      }));
    } catch (error) {
      console.error('Error in getNotificationContext:', error);
      return [];
    }
  }
}