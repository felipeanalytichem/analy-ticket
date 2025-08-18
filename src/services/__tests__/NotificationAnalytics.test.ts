import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase with proper chain
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
const mockLimit = vi.fn().mockReturnValue({ range: mockRange });
const mockIn = vi.fn().mockReturnValue({ limit: mockLimit, range: mockRange });
const mockLte = vi.fn().mockReturnValue({ in: mockIn, limit: mockLimit, range: mockRange });
const mockGte = vi.fn().mockReturnValue({ lte: mockLte, in: mockIn, limit: mockLimit, range: mockRange });
const mockOrder = vi.fn().mockReturnValue({ gte: mockGte, lte: mockLte, in: mockIn, limit: mockLimit, range: mockRange });
const mockEq = vi.fn().mockReturnValue({ order: mockOrder, gte: mockGte, lte: mockLte, in: mockIn, limit: mockLimit, range: mockRange });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, order: mockOrder, gte: mockGte, lte: mockLte, in: mockIn, limit: mockLimit, range: mockRange });

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert
  })
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock navigator and window
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
    sendBeacon: vi.fn()
  },
  writable: true
});

Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test'
  },
  writable: true
});

Object.defineProperty(document, 'referrer', {
  value: 'http://localhost:3000',
  writable: true
});

describe('NotificationAnalytics', () => {
  let NotificationAnalytics: any;
  let analytics: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import and reset singleton
    const module = await import('../NotificationAnalytics');
    NotificationAnalytics = module.NotificationAnalytics;
    (NotificationAnalytics as any).instance = undefined;
    analytics = NotificationAnalytics.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationAnalytics.getInstance();
      const instance2 = NotificationAnalytics.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Event Tracking', () => {
    it('should track a basic event', async () => {
      const event = {
        userId: 'user-123',
        notificationId: 'notif-456',
        eventType: 'read' as const,
        metadata: { test: 'data' }
      };

      await analytics.trackEvent(event);
      expect(analytics.getQueueSize()).toBe(1);
    });

    it('should track notification sent event', async () => {
      await analytics.trackNotificationSent('user-123', 'notif-456', { type: 'ticket_update' });
      expect(analytics.getQueueSize()).toBe(1);
    });

    it('should track notification read event with read time', async () => {
      await analytics.trackNotificationRead('user-123', 'notif-456', 5000);
      expect(analytics.getQueueSize()).toBe(1);
    });

    it('should track notification clicked event', async () => {
      await analytics.trackNotificationClicked('user-123', 'notif-456', 'ticket-link');
      expect(analytics.getQueueSize()).toBe(1);
    });

    it('should track notification deleted event', async () => {
      await analytics.trackNotificationDeleted('user-123', 'notif-456');
      expect(analytics.getQueueSize()).toBe(1);
    });

    it('should enrich events with session and browser data', async () => {
      const event = {
        userId: 'user-123',
        eventType: 'sent' as const
      };

      await analytics.trackEvent(event);
      
      // The event should be enriched and queued
      expect(analytics.getQueueSize()).toBe(1);
    });
  });

  describe('Analytics Retrieval', () => {
    it('should call correct Supabase methods for getUserAnalytics', async () => {
      mockRange.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            user_id: 'user-123',
            notification_id: 'notif-456',
            event_type: 'read',
            timestamp: '2024-01-01T10:00:00Z',
            metadata: { readTime: 5000 },
            session_id: 'session-123',
            user_agent: 'test-agent',
            ip_address: '127.0.0.1',
            created_at: '2024-01-01T10:00:00Z'
          }
        ],
        error: null
      });

      const result = await analytics.getUserAnalytics('user-123');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_analytics');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        userId: 'user-123',
        notificationId: 'notif-456',
        eventType: 'read'
      });
    });

    it('should handle analytics retrieval errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockRange.mockResolvedValueOnce({ data: null, error: new Error('Database error') });

      const result = await analytics.getUserAnalytics('user-123');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should apply query options correctly', async () => {
      const options = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        eventTypes: ['read', 'clicked'] as const,
        limit: 10,
        offset: 0
      };

      await analytics.getUserAnalytics('user-123', options);
      
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_analytics');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockGte).toHaveBeenCalledWith('timestamp', '2024-01-01');
      expect(mockLte).toHaveBeenCalledWith('timestamp', '2024-01-31');
      expect(mockIn).toHaveBeenCalledWith('event_type', ['read', 'clicked']);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockRange).toHaveBeenCalledWith(0, 9);
    });
  });

  describe('Analytics Summary', () => {
    it('should get user analytics summary', async () => {
      mockLte.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            user_id: 'user-123',
            date: '2024-01-01',
            total_sent: 10,
            total_read: 8,
            total_deleted: 1,
            total_clicked: 5,
            average_read_time_seconds: 30,
            type_breakdown: { ticket_update: 5, comment: 3 },
            delivery_stats: { successful: 9, failed: 1, retried: 0 },
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T23:59:59Z'
          }
        ],
        error: null
      });

      const result = await analytics.getUserAnalyticsSummary('user-123');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_analytics_summary');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        userId: 'user-123',
        date: '2024-01-01',
        totalSent: 10,
        totalRead: 8,
        totalDeleted: 1,
        totalClicked: 5
      });
    });
  });

  describe('User Engagement Metrics', () => {
    it('should calculate user engagement metrics correctly', async () => {
      mockRange.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            user_id: 'user-123',
            event_type: 'sent',
            timestamp: '2024-01-01T10:00:00Z',
            metadata: {}
          },
          {
            id: '2',
            user_id: 'user-123',
            event_type: 'read',
            timestamp: '2024-01-01T10:05:00Z',
            metadata: { readTime: 5000 }
          },
          {
            id: '3',
            user_id: 'user-123',
            event_type: 'clicked',
            timestamp: '2024-01-01T10:10:00Z',
            metadata: {}
          }
        ],
        error: null
      });

      const metrics = await analytics.getUserEngagementMetrics('user-123', 30);
      
      expect(metrics.totalNotifications).toBe(1); // 1 sent event
      expect(metrics.readRate).toBe(100); // 1 read out of 1 sent
      expect(metrics.clickRate).toBe(100); // 1 clicked out of 1 sent
      expect(metrics.deleteRate).toBe(0);
      expect(metrics.averageReadTime).toBe(5000);
      expect(metrics.mostActiveHours).toHaveLength(3);
    });

    it('should handle zero notifications gracefully', async () => {
      mockRange.mockResolvedValueOnce({ data: [], error: null });

      const metrics = await analytics.getUserEngagementMetrics('user-123');
      
      expect(metrics).toMatchObject({
        totalNotifications: 0,
        readRate: 0,
        clickRate: 0,
        deleteRate: 0,
        averageReadTime: 0,
        preferredTypes: []
      });
      expect(metrics.mostActiveHours).toHaveLength(3); // Top 3 hours even if all are 0
    });
  });

  describe('System Analytics', () => {
    it('should get system-wide analytics', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          {
            user_id: 'user-1',
            date: '2024-01-01',
            total_sent: 5,
            total_read: 4,
            total_clicked: 2
          },
          {
            user_id: 'user-2',
            date: '2024-01-01',
            total_sent: 3,
            total_read: 2,
            total_clicked: 1
          }
        ],
        error: null
      });

      const result = await analytics.getSystemAnalytics();
      
      expect(result).toMatchObject({
        totalUsers: 2,
        totalNotifications: 8,
        averageEngagement: 75, // 6 read out of 8 sent
        topPerformingTypes: [],
        dailyStats: expect.any(Array)
      });
    });

    it('should group daily stats correctly', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [
          {
            user_id: 'user-1',
            date: '2024-01-01',
            total_sent: 5,
            total_read: 4,
            total_clicked: 2
          },
          {
            user_id: 'user-2',
            date: '2024-01-01',
            total_sent: 3,
            total_read: 2,
            total_clicked: 1
          }
        ],
        error: null
      });

      const result = await analytics.getSystemAnalytics();
      
      expect(result.dailyStats).toHaveLength(1);
      expect(result.dailyStats[0]).toMatchObject({
        date: '2024-01-01',
        sent: 8,
        read: 6,
        clicked: 3
      });
    });
  });

  describe('Queue Management', () => {
    it('should flush events manually', async () => {
      await analytics.trackEvent({
        userId: 'user-123',
        eventType: 'sent'
      });
      
      expect(analytics.getQueueSize()).toBe(1);
      
      await analytics.flush();
      
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should clear queue', async () => {
      await analytics.trackEvent({
        userId: 'user-123',
        eventType: 'sent'
      });
      
      expect(analytics.getQueueSize()).toBe(1);
      
      analytics.clearQueue();
      
      expect(analytics.getQueueSize()).toBe(0);
    });

    it('should handle batch processing errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockInsert.mockResolvedValueOnce({ data: null, error: new Error('Insert failed') });
      
      await analytics.trackEvent({
        userId: 'user-123',
        eventType: 'sent'
      });
      
      await analytics.flush();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Browser Integration', () => {
    it('should use sendBeacon on page unload', async () => {
      const sendBeaconSpy = vi.spyOn(navigator, 'sendBeacon');
      
      await analytics.trackEvent({
        userId: 'user-123',
        eventType: 'sent'
      });
      
      // Simulate page unload
      window.dispatchEvent(new Event('beforeunload'));
      
      expect(sendBeaconSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle tracking errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // This should not throw even with invalid data
      await analytics.trackEvent({
        userId: null as any,
        eventType: 'invalid' as any
      });
      
      // Should still queue the event
      expect(analytics.getQueueSize()).toBe(1);
      consoleSpy.mockRestore();
    });

    it('should handle getUserAnalytics errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockRange.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await analytics.getUserAnalytics('user-123');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle getUserEngagementMetrics errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockRange.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await analytics.getUserEngagementMetrics('user-123');
      
      expect(result).toMatchObject({
        totalNotifications: 0,
        readRate: 0,
        clickRate: 0,
        deleteRate: 0,
        averageReadTime: 0,
        mostActiveHours: [],
        preferredTypes: []
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});