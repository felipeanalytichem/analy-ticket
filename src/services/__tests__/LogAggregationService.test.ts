import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAggregationService, SessionAnalytics, ConnectionAnalytics } from '../LogAggregationService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('LogAggregationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Analytics', () => {
    it('should calculate session analytics correctly', async () => {
      const mockEvents = [
        {
          id: '1',
          event_type: 'session_start',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T10:00:00Z',
          metadata: {}
        },
        {
          id: '2',
          event_type: 'session_end',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T11:00:00Z',
          metadata: {}
        },
        {
          id: '3',
          event_type: 'token_refresh',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T10:30:00Z',
          metadata: { success: true }
        },
        {
          id: '4',
          event_type: 'session_expired',
          user_id: 'user2',
          session_id: 'session2',
          timestamp: '2024-01-01T12:00:00Z',
          metadata: {}
        }
      ];

      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockEvents, error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const analytics = await logAggregationService.getSessionAnalytics(startDate, endDate);

      expect(analytics).toEqual({
        totalSessions: 1, // Only one session_start event
        averageSessionDuration: 60, // 1 hour in minutes
        sessionExpirationRate: 0, // No expired sessions from the started ones
        tokenRefreshSuccessRate: 100, // 1 successful refresh out of 1
        connectionIssueFrequency: 0, // No connection_lost events
        offlineModeUsage: 0, // No offline_mode events
        errorRecoverySuccessRate: 100 // No error events
      });
    });

    it('should handle empty event data', async () => {
      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const analytics = await logAggregationService.getSessionAnalytics(startDate, endDate);

      expect(analytics).toEqual({
        totalSessions: 0,
        averageSessionDuration: 0,
        sessionExpirationRate: 0,
        tokenRefreshSuccessRate: 100,
        connectionIssueFrequency: 0,
        offlineModeUsage: 0,
        errorRecoverySuccessRate: 100
      });
    });

    it('should handle database errors', async () => {
      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: new Error('Database error') }))
          }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      await expect(
        logAggregationService.getSessionAnalytics(startDate, endDate)
      ).rejects.toThrow('Database error');
    });
  });

  describe('Connection Analytics', () => {
    it('should calculate connection analytics correctly', async () => {
      const mockEvents = [
        {
          id: '1',
          event_type: 'connection_lost',
          timestamp: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          event_type: 'connection_restored',
          timestamp: '2024-01-01T10:05:00Z'
        }
      ];

      const mockMetrics = [
        {
          id: '1',
          metric_type: 'connection_latency',
          value: 150,
          unit: 'ms',
          timestamp: '2024-01-01T10:00:00Z'
        },
        {
          id: '2',
          metric_type: 'offline_duration',
          value: 300000, // 5 minutes in ms
          unit: 'ms',
          timestamp: '2024-01-01T10:05:00Z'
        }
      ];

      const mockSelect = vi.fn()
        .mockReturnValueOnce({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: mockEvents, error: null }))
              }))
            }))
          }))
        })
        .mockReturnValueOnce({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ data: mockMetrics, error: null }))
              }))
            }))
          }))
        });

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const analytics = await logAggregationService.getConnectionAnalytics(startDate, endDate);

      expect(analytics).toEqual({
        averageLatency: 150,
        connectionDropRate: 50, // 1 drop out of 2 total events
        reconnectionSuccessRate: 100, // 1 restoration out of 1 drop
        offlineDuration: 5, // 5 minutes
        syncFailureRate: 0 // No sync failures
      });
    });
  });

  describe('User Behavior Analytics', () => {
    it('should calculate user behavior analytics correctly', async () => {
      const mockBehaviors = [
        {
          id: '1',
          event_type: 'page_view',
          page: '/dashboard',
          session_id: 'session1'
        },
        {
          id: '2',
          event_type: 'page_view',
          page: '/dashboard',
          session_id: 'session1'
        },
        {
          id: '3',
          event_type: 'page_view',
          page: '/tickets',
          session_id: 'session2'
        },
        {
          id: '4',
          event_type: 'session_extension',
          session_id: 'session1'
        },
        {
          id: '5',
          event_type: 'manual_sync',
          session_id: 'session2'
        }
      ];

      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockBehaviors, error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const analytics = await logAggregationService.getUserBehaviorAnalytics(startDate, endDate);

      expect(analytics.mostVisitedPages).toEqual([
        { page: '/dashboard', visits: 2 },
        { page: '/tickets', visits: 1 }
      ]);

      expect(analytics.sessionExtensionRate).toBe(50); // 1 extension out of 2 sessions
      expect(analytics.manualSyncUsage).toBe(50); // 1 manual sync out of 2 sessions
    });
  });

  describe('System Performance Analytics', () => {
    it('should calculate system performance analytics correctly', async () => {
      const mockMetrics = [
        {
          id: '1',
          metric_type: 'session_duration',
          value: 1000,
          metadata: {}
        },
        {
          id: '2',
          metric_type: 'session_duration',
          value: 2000,
          metadata: {}
        },
        {
          id: '3',
          metric_type: 'sync_time',
          value: 500,
          metadata: { success: true, cache_hit: true }
        },
        {
          id: '4',
          metric_type: 'sync_time',
          value: 1500,
          metadata: { error: true }
        }
      ];

      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ data: mockMetrics, error: null }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const analytics = await logAggregationService.getSystemPerformanceAnalytics(startDate, endDate);

      expect(analytics).toEqual({
        averageResponseTime: 1500, // Average of session_duration metrics
        errorRate: 25, // 1 error out of 4 metrics
        cacheHitRate: 25, // 1 cache hit out of 4 metrics
        backgroundSyncEfficiency: 50, // 1 successful sync out of 2 sync_time metrics
        memoryUsage: 0 // No memory usage data
      });
    });
  });

  describe('Analytics Report Generation', () => {
    it('should generate comprehensive analytics report', async () => {
      // Mock all the individual analytics methods
      const mockSessionAnalytics = {
        totalSessions: 10,
        averageSessionDuration: 30,
        sessionExpirationRate: 5,
        tokenRefreshSuccessRate: 95,
        connectionIssueFrequency: 2,
        offlineModeUsage: 1,
        errorRecoverySuccessRate: 90
      };

      const mockConnectionAnalytics = {
        averageLatency: 200,
        connectionDropRate: 3,
        reconnectionSuccessRate: 95,
        offlineDuration: 10,
        syncFailureRate: 2
      };

      const mockBehaviorAnalytics = {
        mostVisitedPages: [{ page: '/dashboard', visits: 50 }],
        commonUserActions: [{ action: 'page_view', count: 100 }],
        sessionExtensionRate: 20,
        manualSyncUsage: 5,
        errorRecoveryAttempts: 3
      };

      const mockPerformanceAnalytics = {
        averageResponseTime: 500,
        errorRate: 2,
        cacheHitRate: 85,
        backgroundSyncEfficiency: 95,
        memoryUsage: 50
      };

      // Mock the individual methods
      vi.spyOn(logAggregationService, 'getSessionAnalytics')
        .mockResolvedValue(mockSessionAnalytics);
      vi.spyOn(logAggregationService, 'getConnectionAnalytics')
        .mockResolvedValue(mockConnectionAnalytics);
      vi.spyOn(logAggregationService, 'getUserBehaviorAnalytics')
        .mockResolvedValue(mockBehaviorAnalytics);
      vi.spyOn(logAggregationService, 'getSystemPerformanceAnalytics')
        .mockResolvedValue(mockPerformanceAnalytics);

      // Mock summary data queries
      const mockSelect = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => Promise.resolve({ data: new Array(100), error: null }))
            }))
          }))
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                not: vi.fn(() => Promise.resolve({ 
                  data: [{ user_id: 'user1' }, { user_id: 'user2' }], 
                  error: null 
                }))
              }))
            }))
          }))
        });

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const report = await logAggregationService.generateAnalyticsReport(startDate, endDate);

      expect(report).toEqual({
        session: mockSessionAnalytics,
        connection: mockConnectionAnalytics,
        behavior: mockBehaviorAnalytics,
        performance: mockPerformanceAnalytics,
        summary: {
          totalEvents: 100,
          totalUsers: 2,
          reportPeriod: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          generatedAt: expect.any(Date)
        }
      });
    });
  });

  describe('Caching', () => {
    it('should cache analytics results', async () => {
      const mockEvents = [
        {
          id: '1',
          event_type: 'session_start',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T10:00:00Z',
          metadata: {}
        }
      ];

      const mockSelect = vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockEvents, error: null }))
          }))
        }))
      }));

      (supabase.from as any).mockReturnValue({
        select: mockSelect
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      // First call
      await logAggregationService.getSessionAnalytics(startDate, endDate);
      
      // Second call should use cache
      await logAggregationService.getSessionAnalytics(startDate, endDate);

      // Should only call the database once
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when requested', async () => {
      logAggregationService.clearCache();
      
      // Should not throw
      expect(() => logAggregationService.clearCache()).not.toThrow();
    });
  });
});