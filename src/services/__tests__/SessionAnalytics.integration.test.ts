import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sessionAnalyticsLogger } from '../SessionAnalyticsLogger';
import { logAggregationService } from '../LogAggregationService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(() => ({
        data: {
          session: {
            user: { id: 'test-user-id' }
          }
        }
      }))
    }
  }
}));

describe('Session Analytics Integration', () => {
  let mockInsertedData: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertedData = [];

    // Mock navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        onLine: true,
        userAgent: 'test-user-agent'
      },
      writable: true
    });

    // Mock sessionStorage
    const mockSessionStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage
    });

    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://test.com/page',
        pathname: '/page'
      },
      writable: true
    });

    // Mock Supabase insert to capture data
    const mockInsert = vi.fn((data) => {
      mockInsertedData.push(...data);
      return Promise.resolve({ error: null });
    });

    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                not: vi.fn(() => Promise.resolve({ data: mockInsertedData, error: null }))
              }))
            }))
          }))
        }))
      }))
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('End-to-End Analytics Flow', () => {
    it('should log events and aggregate them correctly', async () => {
      // Log various session events
      sessionAnalyticsLogger.logSessionEvent('session_start', {
        userId: 'test-user-id'
      });

      sessionAnalyticsLogger.logSessionEvent('token_refresh', {
        success: true
      });

      sessionAnalyticsLogger.logPerformanceMetric(
        'connection_latency',
        150,
        'ms',
        { endpoint: '/api/test' }
      );

      sessionAnalyticsLogger.logUserBehavior('page_view', {
        page: '/dashboard'
      });

      // Flush the queues to simulate data being sent to database
      await sessionAnalyticsLogger.flushQueues();

      // Verify data was inserted
      expect(mockInsertedData.length).toBeGreaterThan(0);

      // Now test aggregation with the mocked data
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      // Mock the aggregation service to return our inserted data
      const sessionEvents = mockInsertedData.filter(item => item.event_type);
      const performanceMetrics = mockInsertedData.filter(item => item.metric_type);
      const behaviorEvents = mockInsertedData.filter(item => item.page);

      // Override the supabase mock for aggregation queries
      (supabase.from as any).mockImplementation((table) => {
        if (table === 'session_analytics_events') {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  eq: () => Promise.resolve({ data: sessionEvents, error: null }),
                  in: () => ({
                    eq: () => Promise.resolve({ data: sessionEvents, error: null })
                  })
                })
              })
            })
          };
        }
        if (table === 'session_performance_metrics') {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  eq: () => Promise.resolve({ data: performanceMetrics, error: null }),
                  in: () => ({
                    eq: () => Promise.resolve({ data: performanceMetrics, error: null })
                  })
                })
              })
            })
          };
        }
        if (table === 'user_behavior_analytics') {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  eq: () => Promise.resolve({ data: behaviorEvents, error: null })
                })
              })
            })
          };
        }
        return {
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: [], error: null })
            })
          })
        };
      });

      const analytics = await logAggregationService.getSessionAnalytics(startDate, endDate);

      expect(analytics).toBeDefined();
      expect(typeof analytics.totalSessions).toBe('number');
      expect(typeof analytics.tokenRefreshSuccessRate).toBe('number');
    });

    it('should handle offline/online transitions correctly', async () => {
      // Start online
      expect(navigator.onLine).toBe(true);

      // Log some events
      sessionAnalyticsLogger.logSessionEvent('session_start');
      sessionAnalyticsLogger.logPerformanceMetric('connection_latency', 100, 'ms');

      // Simulate going offline
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true
      });

      // Try to flush - should not send data
      await sessionAnalyticsLogger.flushQueues();

      // Log offline events
      sessionAnalyticsLogger.logSessionEvent('connection_lost');
      sessionAnalyticsLogger.logUserBehavior('offline_action', { action: 'form_save' });

      // Simulate coming back online
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        writable: true
      });

      // Should now flush all queued events
      await sessionAnalyticsLogger.flushQueues();

      expect(mockInsertedData.length).toBeGreaterThan(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockInsert = vi.fn(() => Promise.resolve({ 
        error: new Error('Database connection failed') 
      }));

      (supabase.from as any).mockReturnValue({
        insert: mockInsert
      });

      // Log events
      sessionAnalyticsLogger.logSessionEvent('session_start');
      sessionAnalyticsLogger.logPerformanceMetric('connection_latency', 100, 'ms');

      // Should not throw even with database errors
      await expect(sessionAnalyticsLogger.flushQueues()).resolves.not.toThrow();
    });

    it('should generate comprehensive analytics report', async () => {
      // Mock data for comprehensive report
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
        }
      ];

      const mockMetrics = [
        {
          id: '1',
          metric_type: 'connection_latency',
          value: 150,
          unit: 'ms',
          timestamp: '2024-01-01T10:00:00Z',
          session_id: 'session1',
          user_id: 'user1',
          metadata: {}
        },
        {
          id: '2',
          metric_type: 'session_duration',
          value: 3600000,
          unit: 'ms',
          timestamp: '2024-01-01T11:00:00Z',
          session_id: 'session1',
          user_id: 'user1',
          metadata: {}
        }
      ];

      const mockBehaviors = [
        {
          id: '1',
          event_type: 'page_view',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T10:00:00Z',
          page: '/dashboard',
          metadata: {}
        },
        {
          id: '2',
          event_type: 'session_extension',
          user_id: 'user1',
          session_id: 'session1',
          timestamp: '2024-01-01T10:45:00Z',
          metadata: {}
        }
      ];

      // Mock supabase responses for different tables
      (supabase.from as any).mockImplementation((table) => {
        const mockSelect = vi.fn();
        
        if (table === 'session_analytics_events') {
          mockSelect.mockReturnValue({
            gte: () => ({
              lte: () => ({
                eq: () => Promise.resolve({ data: mockEvents, error: null }),
                in: () => ({
                  eq: () => Promise.resolve({ data: mockEvents, error: null })
                })
              })
            }),
            select: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: mockEvents, error: null })
              })
            })
          });
        } else if (table === 'session_performance_metrics') {
          mockSelect.mockReturnValue({
            gte: () => ({
              lte: () => ({
                eq: () => Promise.resolve({ data: mockMetrics, error: null }),
                in: () => ({
                  eq: () => Promise.resolve({ data: mockMetrics, error: null })
                })
              })
            }),
            select: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: mockMetrics, error: null })
              })
            })
          });
        } else if (table === 'user_behavior_analytics') {
          mockSelect.mockReturnValue({
            gte: () => ({
              lte: () => ({
                eq: () => Promise.resolve({ data: mockBehaviors, error: null })
              })
            }),
            select: () => ({
              gte: () => ({
                lte: () => ({
                  not: () => Promise.resolve({ data: mockBehaviors, error: null })
                })
              })
            })
          });
        }

        return { select: mockSelect };
      });

      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      const report = await logAggregationService.generateAnalyticsReport(startDate, endDate);

      expect(report).toBeDefined();
      expect(report.session).toBeDefined();
      expect(report.connection).toBeDefined();
      expect(report.behavior).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.summary).toBeDefined();

      expect(report.summary.reportPeriod).toContain('2024-01-01');
      expect(report.summary.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large volumes of events efficiently', async () => {
      const startTime = Date.now();

      // Log a large number of events
      for (let i = 0; i < 1000; i++) {
        sessionAnalyticsLogger.logSessionEvent('session_start', { iteration: i });
        sessionAnalyticsLogger.logPerformanceMetric('connection_latency', i, 'ms');
        sessionAnalyticsLogger.logUserBehavior('page_view', { page: `/page-${i}` });
      }

      const loggingTime = Date.now() - startTime;

      // Should complete logging quickly (under 1 second)
      expect(loggingTime).toBeLessThan(1000);

      // Flush should also be efficient
      const flushStartTime = Date.now();
      await sessionAnalyticsLogger.flushQueues();
      const flushTime = Date.now() - flushStartTime;

      expect(flushTime).toBeLessThan(5000); // Should flush within 5 seconds
    });

    it('should properly clean up resources', () => {
      // Create a new logger instance to test cleanup
      const logger = sessionAnalyticsLogger;

      // Should not throw when destroying
      expect(() => logger.destroy()).not.toThrow();
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should handle multiple tabs logging simultaneously', async () => {
      // Simulate multiple tabs by creating different session IDs
      const mockSessionStorage1 = {
        getItem: vi.fn((key) => key === 'analytics-session-id' ? 'session-1' : 'tab-1'),
        setItem: vi.fn()
      };

      const mockSessionStorage2 = {
        getItem: vi.fn((key) => key === 'analytics-session-id' ? 'session-1' : 'tab-2'),
        setItem: vi.fn()
      };

      // Tab 1 logs events
      Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage1 });
      sessionAnalyticsLogger.logSessionEvent('session_start', { tab: 1 });

      // Tab 2 logs events
      Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage2 });
      sessionAnalyticsLogger.logSessionEvent('token_refresh', { tab: 2 });

      await sessionAnalyticsLogger.flushQueues();

      // Both events should be logged
      expect(mockInsertedData.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from network failures', async () => {
      let failCount = 0;
      const mockInsert = vi.fn(() => {
        failCount++;
        if (failCount <= 2) {
          return Promise.resolve({ error: new Error('Network error') });
        }
        return Promise.resolve({ error: null });
      });

      (supabase.from as any).mockReturnValue({
        insert: mockInsert
      });

      sessionAnalyticsLogger.logSessionEvent('session_start');

      // First flush should fail
      await sessionAnalyticsLogger.flushQueues();
      expect(mockInsert).toHaveBeenCalledTimes(3); // One call per queue type

      // Events should be re-queued and succeed on retry
      await sessionAnalyticsLogger.flushQueues();
      expect(mockInsert).toHaveBeenCalledTimes(6); // Another attempt
    });

    it('should handle malformed data gracefully', async () => {
      // Log events with potentially problematic data
      sessionAnalyticsLogger.logSessionEvent('session_start', {
        circularRef: {} as any,
        undefinedValue: undefined,
        nullValue: null,
        largeString: 'x'.repeat(10000)
      });

      // Should not throw
      await expect(sessionAnalyticsLogger.flushQueues()).resolves.not.toThrow();
    });
  });
});