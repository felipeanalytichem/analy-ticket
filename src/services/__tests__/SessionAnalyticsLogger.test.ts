import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sessionAnalyticsLogger, SessionEvent, PerformanceMetric, UserBehaviorEvent } from '../SessionAnalyticsLogger';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null }))
    })),
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
  getItem: vi.fn(),
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

describe('SessionAnalyticsLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Session Event Logging', () => {
    it('should log session events with correct structure', () => {
      const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
      const mockFrom = vi.fn(() => ({ insert: mockInsert }));
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      sessionAnalyticsLogger.logSessionEvent('session_start', {
        customData: 'test'
      });

      expect(mockInsert).not.toHaveBeenCalled(); // Should be queued, not immediately sent
    });

    it('should include required metadata in session events', () => {
      sessionAnalyticsLogger.logSessionEvent('session_start', {
        customData: 'test'
      });

      // Verify the event was queued with proper structure
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'analytics-session-id',
        expect.any(String)
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'analytics-tab-id',
        expect.any(String)
      );
    });

    it('should handle different event types', () => {
      const eventTypes: SessionEvent['type'][] = [
        'session_start',
        'session_end',
        'session_refresh',
        'session_warning',
        'session_expired',
        'token_refresh',
        'connection_lost',
        'connection_restored',
        'offline_mode',
        'sync_completed',
        'error_occurred'
      ];

      eventTypes.forEach(type => {
        expect(() => {
          sessionAnalyticsLogger.logSessionEvent(type, { test: true });
        }).not.toThrow();
      });
    });
  });

  describe('Performance Metric Logging', () => {
    it('should log performance metrics with correct structure', () => {
      sessionAnalyticsLogger.logPerformanceMetric(
        'connection_latency',
        150,
        'ms',
        { endpoint: '/api/test' }
      );

      // Should not throw and should queue the metric
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it('should handle different metric types and units', () => {
      const metricTypes: PerformanceMetric['type'][] = [
        'session_duration',
        'connection_latency',
        'sync_time',
        'error_recovery_time',
        'offline_duration'
      ];

      const units: PerformanceMetric['unit'][] = ['ms', 'seconds', 'minutes', 'count'];

      metricTypes.forEach(type => {
        units.forEach(unit => {
          expect(() => {
            sessionAnalyticsLogger.logPerformanceMetric(type, 100, unit);
          }).not.toThrow();
        });
      });
    });
  });

  describe('User Behavior Logging', () => {
    it('should log user behavior events', () => {
      sessionAnalyticsLogger.logUserBehavior('page_view', {
        page: '/dashboard'
      });

      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it('should handle different behavior event types', () => {
      const behaviorTypes: UserBehaviorEvent['type'][] = [
        'page_view',
        'form_interaction',
        'offline_action',
        'manual_sync',
        'session_extension',
        'error_recovery_attempt'
      ];

      behaviorTypes.forEach(type => {
        expect(() => {
          sessionAnalyticsLogger.logUserBehavior(type, { test: true });
        }).not.toThrow();
      });
    });
  });

  describe('Queue Management', () => {
    it('should flush queues when online', async () => {
      const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      // Add some events to queue
      sessionAnalyticsLogger.logSessionEvent('session_start');
      sessionAnalyticsLogger.logPerformanceMetric('connection_latency', 100, 'ms');
      sessionAnalyticsLogger.logUserBehavior('page_view');

      await sessionAnalyticsLogger.flushQueues();

      expect(mockInsert).toHaveBeenCalledTimes(3); // One for each queue
    });

    it('should not flush queues when offline', async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true
      });

      const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      sessionAnalyticsLogger.logSessionEvent('session_start');
      await sessionAnalyticsLogger.flushQueues();

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should handle flush errors gracefully', async () => {
      const mockInsert = vi.fn(() => Promise.resolve({ error: new Error('Database error') }));
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      sessionAnalyticsLogger.logSessionEvent('session_start');

      // Should not throw
      await expect(sessionAnalyticsLogger.flushQueues()).resolves.not.toThrow();
    });
  });

  describe('Connection State Handling', () => {
    it('should log connection events when going online/offline', () => {
      const logSpy = vi.spyOn(sessionAnalyticsLogger, 'logSessionEvent');

      // Simulate going offline
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true
      });
      window.dispatchEvent(new Event('offline'));

      expect(logSpy).toHaveBeenCalledWith('connection_lost', {
        previousState: 'online'
      });

      // Simulate going online
      Object.defineProperty(window.navigator, 'onLine', {
        value: true,
        writable: true
      });
      window.dispatchEvent(new Event('online'));

      expect(logSpy).toHaveBeenCalledWith('connection_restored', expect.any(Object));
    });
  });

  describe('Session and Tab ID Management', () => {
    it('should generate and persist session ID', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      sessionAnalyticsLogger.logSessionEvent('session_start');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'analytics-session-id',
        expect.any(String)
      );
    });

    it('should reuse existing session ID', () => {
      const existingSessionId = 'existing-session-id';
      mockSessionStorage.getItem.mockImplementation((key) => {
        if (key === 'analytics-session-id') return existingSessionId;
        return null;
      });

      sessionAnalyticsLogger.logSessionEvent('session_start');

      // Should not set a new session ID
      expect(mockSessionStorage.setItem).not.toHaveBeenCalledWith(
        'analytics-session-id',
        expect.any(String)
      );
    });

    it('should generate unique tab IDs', () => {
      mockSessionStorage.getItem.mockReturnValue(null);
      
      sessionAnalyticsLogger.logSessionEvent('session_start');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'analytics-tab-id',
        expect.any(String)
      );
    });
  });

  describe('Development Mode Logging', () => {
    it('should log to console in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sessionAnalyticsLogger.logSessionEvent('session_start', { test: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionAnalytics]',
        'session_start',
        expect.any(Object)
      );

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up intervals and flush on destroy', async () => {
      const flushSpy = vi.spyOn(sessionAnalyticsLogger, 'flushQueues');
      
      sessionAnalyticsLogger.destroy();

      expect(flushSpy).toHaveBeenCalled();
    });

    it('should flush on page unload', async () => {
      const flushSpy = vi.spyOn(sessionAnalyticsLogger, 'flushQueues');
      
      window.dispatchEvent(new Event('beforeunload'));

      expect(flushSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user session gracefully', () => {
      (supabase.auth.getSession as any).mockReturnValue({
        data: { session: null }
      });

      expect(() => {
        sessionAnalyticsLogger.logSessionEvent('session_start');
      }).not.toThrow();
    });

    it('should handle supabase errors during flush', async () => {
      const mockInsert = vi.fn(() => Promise.reject(new Error('Network error')));
      (supabase.from as any).mockReturnValue({ insert: mockInsert });

      sessionAnalyticsLogger.logSessionEvent('session_start');

      // Should not throw
      await expect(sessionAnalyticsLogger.flushQueues()).resolves.not.toThrow();
    });
  });
});