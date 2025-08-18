import { supabase } from '@/lib/supabase';

export type NotificationEventType = 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'clicked' 
  | 'deleted' 
  | 'dismissed' 
  | 'failed'
  | 'retry'
  | 'opened'
  | 'closed';

export interface NotificationAnalyticsEvent {
  userId: string;
  notificationId?: string;
  eventType: NotificationEventType;
  metadata?: Record<string, any>;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface NotificationAnalyticsData {
  id: string;
  userId: string;
  notificationId?: string;
  eventType: NotificationEventType;
  timestamp: string;
  metadata: Record<string, any>;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface NotificationAnalyticsSummary {
  id: string;
  userId: string;
  date: string;
  totalSent: number;
  totalRead: number;
  totalDeleted: number;
  totalClicked: number;
  averageReadTimeSeconds: number;
  typeBreakdown: Record<string, number>;
  deliveryStats: {
    successful: number;
    failed: number;
    retried: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsQueryOptions {
  startDate?: string;
  endDate?: string;
  eventTypes?: NotificationEventType[];
  limit?: number;
  offset?: number;
}

export interface UserEngagementMetrics {
  totalNotifications: number;
  readRate: number;
  clickRate: number;
  deleteRate: number;
  averageReadTime: number;
  mostActiveHours: number[];
  preferredTypes: string[];
}

export class NotificationAnalytics {
  private static instance: NotificationAnalytics;
  private eventQueue: NotificationAnalyticsEvent[] = [];
  private isProcessing = false;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startBatchProcessor();
  }

  public static getInstance(): NotificationAnalytics {
    if (!NotificationAnalytics.instance) {
      NotificationAnalytics.instance = new NotificationAnalytics();
    }
    return NotificationAnalytics.instance;
  }

  /**
   * Track a notification event
   */
  public async trackEvent(event: NotificationAnalyticsEvent): Promise<void> {
    try {
      const enrichedEvent: NotificationAnalyticsEvent = {
        ...event,
        sessionId: event.sessionId || this.sessionId,
        userAgent: event.userAgent || navigator.userAgent,
        metadata: {
          ...event.metadata,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          referrer: document.referrer
        }
      };

      // Add to queue for batch processing
      this.eventQueue.push(enrichedEvent);

      // If queue is full, process immediately
      if (this.eventQueue.length >= this.batchSize) {
        await this.processBatch();
      }
    } catch (error) {
      console.error('Failed to track notification event:', error);
    }
  }

  /**
   * Track notification sent event
   */
  public async trackNotificationSent(userId: string, notificationId: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      userId,
      notificationId,
      eventType: 'sent',
      metadata
    });
  }

  /**
   * Track notification read event
   */
  public async trackNotificationRead(userId: string, notificationId: string, readTime?: number): Promise<void> {
    await this.trackEvent({
      userId,
      notificationId,
      eventType: 'read',
      metadata: {
        readTime: readTime || 0,
        readAt: new Date().toISOString()
      }
    });
  }

  /**
   * Track notification clicked event
   */
  public async trackNotificationClicked(userId: string, notificationId: string, clickTarget?: string): Promise<void> {
    await this.trackEvent({
      userId,
      notificationId,
      eventType: 'clicked',
      metadata: {
        clickTarget,
        clickedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Track notification deleted event
   */
  public async trackNotificationDeleted(userId: string, notificationId: string): Promise<void> {
    await this.trackEvent({
      userId,
      notificationId,
      eventType: 'deleted',
      metadata: {
        deletedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Get analytics data for a user
   */
  public async getUserAnalytics(userId: string, options: AnalyticsQueryOptions = {}): Promise<NotificationAnalyticsData[]> {
    try {
      let query = supabase
        .from('notification_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

      if (options.startDate) {
        query = query.gte('timestamp', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('timestamp', options.endDate);
      }

      if (options.eventTypes && options.eventTypes.length > 0) {
        query = query.in('event_type', options.eventTypes);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data?.map(item => ({
        id: item.id,
        userId: item.user_id,
        notificationId: item.notification_id,
        eventType: item.event_type,
        timestamp: item.timestamp,
        metadata: item.metadata || {},
        sessionId: item.session_id,
        userAgent: item.user_agent,
        ipAddress: item.ip_address,
        createdAt: item.created_at
      })) || [];
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      return [];
    }
  }

  /**
   * Get analytics summary for a user
   */
  public async getUserAnalyticsSummary(userId: string, startDate?: string, endDate?: string): Promise<NotificationAnalyticsSummary[]> {
    try {
      let query = supabase
        .from('notification_analytics_summary')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data?.map(item => ({
        id: item.id,
        userId: item.user_id,
        date: item.date,
        totalSent: item.total_sent || 0,
        totalRead: item.total_read || 0,
        totalDeleted: item.total_deleted || 0,
        totalClicked: item.total_clicked || 0,
        averageReadTimeSeconds: item.average_read_time_seconds || 0,
        typeBreakdown: item.type_breakdown || {},
        deliveryStats: item.delivery_stats || { successful: 0, failed: 0, retried: 0 },
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) || [];
    } catch (error) {
      console.error('Failed to get user analytics summary:', error);
      return [];
    }
  }

  /**
   * Get user engagement metrics
   */
  public async getUserEngagementMetrics(userId: string, days: number = 30): Promise<UserEngagementMetrics> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const analytics = await this.getUserAnalytics(userId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const totalNotifications = analytics.filter(a => a.eventType === 'sent').length;
      const readNotifications = analytics.filter(a => a.eventType === 'read').length;
      const clickedNotifications = analytics.filter(a => a.eventType === 'clicked').length;
      const deletedNotifications = analytics.filter(a => a.eventType === 'deleted').length;

      const readTimes = analytics
        .filter(a => a.eventType === 'read' && a.metadata.readTime)
        .map(a => a.metadata.readTime as number);

      const averageReadTime = readTimes.length > 0 
        ? readTimes.reduce((sum, time) => sum + time, 0) / readTimes.length 
        : 0;

      // Calculate most active hours
      const hourCounts = new Array(24).fill(0);
      analytics.forEach(a => {
        const hour = new Date(a.timestamp).getHours();
        hourCounts[hour]++;
      });

      const mostActiveHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(item => item.hour);

      return {
        totalNotifications,
        readRate: totalNotifications > 0 ? (readNotifications / totalNotifications) * 100 : 0,
        clickRate: totalNotifications > 0 ? (clickedNotifications / totalNotifications) * 100 : 0,
        deleteRate: totalNotifications > 0 ? (deletedNotifications / totalNotifications) * 100 : 0,
        averageReadTime,
        mostActiveHours,
        preferredTypes: [] // TODO: Implement based on notification types
      };
    } catch (error) {
      console.error('Failed to get user engagement metrics:', error);
      return {
        totalNotifications: 0,
        readRate: 0,
        clickRate: 0,
        deleteRate: 0,
        averageReadTime: 0,
        mostActiveHours: [],
        preferredTypes: []
      };
    }
  }

  /**
   * Get system-wide analytics (admin only)
   */
  public async getSystemAnalytics(options: AnalyticsQueryOptions = {}): Promise<{
    totalUsers: number;
    totalNotifications: number;
    averageEngagement: number;
    topPerformingTypes: string[];
    dailyStats: Array<{ date: string; sent: number; read: number; clicked: number }>;
  }> {
    try {
      // This would require admin permissions check
      const { data, error } = await supabase
        .from('notification_analytics_summary')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      const uniqueUsers = new Set(data?.map(item => item.user_id) || []).size;
      const totalNotifications = data?.reduce((sum, item) => sum + (item.total_sent || 0), 0) || 0;
      const totalRead = data?.reduce((sum, item) => sum + (item.total_read || 0), 0) || 0;
      const averageEngagement = totalNotifications > 0 ? (totalRead / totalNotifications) * 100 : 0;

      // Group by date for daily stats
      const dailyStatsMap = new Map();
      data?.forEach(item => {
        const existing = dailyStatsMap.get(item.date) || { date: item.date, sent: 0, read: 0, clicked: 0 };
        existing.sent += item.total_sent || 0;
        existing.read += item.total_read || 0;
        existing.clicked += item.total_clicked || 0;
        dailyStatsMap.set(item.date, existing);
      });

      const dailyStats = Array.from(dailyStatsMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30); // Last 30 days

      return {
        totalUsers: uniqueUsers,
        totalNotifications,
        averageEngagement,
        topPerformingTypes: [], // TODO: Implement based on type breakdown
        dailyStats
      };
    } catch (error) {
      console.error('Failed to get system analytics:', error);
      return {
        totalUsers: 0,
        totalNotifications: 0,
        averageEngagement: 0,
        topPerformingTypes: [],
        dailyStats: []
      };
    }
  }

  /**
   * Process queued events in batches
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.eventQueue.splice(0, this.batchSize);
      
      const analyticsData = batch.map(event => ({
        user_id: event.userId,
        notification_id: event.notificationId,
        event_type: event.eventType,
        metadata: event.metadata || {},
        session_id: event.sessionId,
        user_agent: event.userAgent,
        ip_address: event.ipAddress
      }));

      const { error } = await supabase
        .from('notification_analytics')
        .insert(analyticsData);

      if (error) {
        console.error('Failed to insert analytics batch:', error);
        // Re-add failed events to queue for retry
        this.eventQueue.unshift(...batch);
      }
    } catch (error) {
      console.error('Failed to process analytics batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start the batch processor
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.processBatch();
      }
    }, this.flushInterval);

    // Process remaining events before page unload
    window.addEventListener('beforeunload', () => {
      if (this.eventQueue.length > 0) {
        // Use sendBeacon for reliable delivery during page unload
        const data = JSON.stringify(this.eventQueue);
        navigator.sendBeacon('/api/analytics', data);
      }
    });
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Flush all queued events immediately
   */
  public async flush(): Promise<void> {
    await this.processBatch();
  }

  /**
   * Clear all queued events
   */
  public clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.eventQueue.length;
  }
}