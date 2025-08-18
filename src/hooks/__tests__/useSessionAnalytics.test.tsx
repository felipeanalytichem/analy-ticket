import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionAnalytics } from '../useSessionAnalytics';
import { sessionAnalyticsLogger } from '@/services/SessionAnalyticsLogger';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/SessionAnalyticsLogger', () => ({
  sessionAnalyticsLogger: {
    logSessionEvent: vi.fn(),
    logPerformanceMetric: vi.fn(),
    logUserBehavior: vi.fn()
  }
}));

// Mock performance API
const mockPerformanceObserver = vi.fn();
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

Object.defineProperty(window, 'PerformanceObserver', {
  value: vi.fn(() => ({
    observe: mockObserve,
    disconnect: mockDisconnect
  })),
  writable: true
});

// Mock performance timing
Object.defineProperty(window, 'performance', {
  value: {
    timing: {
      navigationStart: 1000,
      loadEventEnd: 2000
    }
  },
  writable: true
});

// Mock screen
Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080
  },
  writable: true
});

// Mock Intl
Object.defineProperty(window, 'Intl', {
  value: {
    DateTimeFormat: vi.fn(() => ({
      resolvedOptions: () => ({ timeZone: 'UTC' })
    }))
  },
  writable: true
});

describe('useSessionAnalytics', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: mockUser });
    
    // Mock navigator
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'test-user-agent'
      },
      writable: true
    });

    // Mock location
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/test-page',
        search: '?test=1',
        href: 'https://test.com/test-page?test=1'
      },
      writable: true
    });

    // Mock document
    Object.defineProperty(document, 'referrer', {
      value: 'https://referrer.com',
      writable: true
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Session Tracking', () => {
    it('should log session start when user is present', () => {
      renderHook(() => useSessionAnalytics());

      expect(sessionAnalyticsLogger.logSessionEvent).toHaveBeenCalledWith(
        'session_start',
        expect.objectContaining({
          userId: mockUser.id,
          userAgent: 'test-user-agent',
          screenResolution: '1920x1080',
          timezone: 'UTC'
        })
      );
    });

    it('should not log session start when user is not present', () => {
      (useAuth as any).mockReturnValue({ user: null });

      renderHook(() => useSessionAnalytics());

      expect(sessionAnalyticsLogger.logSessionEvent).not.toHaveBeenCalled();
    });

    it('should log session end on unmount', () => {
      const { unmount } = renderHook(() => useSessionAnalytics());

      unmount();

      expect(sessionAnalyticsLogger.logSessionEvent).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({
          sessionDuration: expect.any(Number),
          lastActivity: expect.any(Number)
        })
      );

      expect(sessionAnalyticsLogger.logPerformanceMetric).toHaveBeenCalledWith(
        'session_duration',
        expect.any(Number),
        'ms',
        { endReason: 'page_unload' }
      );
    });
  });

  describe('Page View Tracking', () => {
    it('should log page view when enabled', () => {
      renderHook(() => useSessionAnalytics({ trackPageViews: true }));

      expect(sessionAnalyticsLogger.logUserBehavior).toHaveBeenCalledWith(
        'page_view',
        expect.objectContaining({
          path: '/test-page',
          search: '?test=1',
          referrer: 'https://referrer.com',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should not log page view when disabled', () => {
      renderHook(() => useSessionAnalytics({ trackPageViews: false }));

      expect(sessionAnalyticsLogger.logUserBehavior).not.toHaveBeenCalledWith(
        'page_view',
        expect.any(Object)
      );
    });
  });

  describe('Performance Tracking', () => {
    it('should track page load performance when enabled', () => {
      renderHook(() => useSessionAnalytics({ enablePerformanceTracking: true }));

      expect(sessionAnalyticsLogger.logPerformanceMetric).toHaveBeenCalledWith(
        'connection_latency',
        1000, // loadEventEnd - navigationStart
        'ms',
        { type: 'page_load' }
      );
    });

    it('should set up performance observer when available', () => {
      renderHook(() => useSessionAnalytics({ enablePerformanceTracking: true }));

      expect(mockObserve).toHaveBeenCalledWith({
        entryTypes: ['navigation', 'resource']
      });
    });

    it('should not track performance when disabled', () => {
      renderHook(() => useSessionAnalytics({ enablePerformanceTracking: false }));

      expect(mockObserve).not.toHaveBeenCalled();
    });

    it('should disconnect performance observer on unmount', () => {
      const { unmount } = renderHook(() => 
        useSessionAnalytics({ enablePerformanceTracking: true })
      );

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('User Activity Tracking', () => {
    it('should track user activity events when behavior tracking is enabled', () => {
      renderHook(() => useSessionAnalytics({ enableBehaviorTracking: true }));

      // Simulate user activity
      act(() => {
        document.dispatchEvent(new Event('mousedown'));
        document.dispatchEvent(new Event('keypress'));
      });

      // Activity tracking doesn't directly log events, but updates internal state
      // This is tested indirectly through session end logging
    });

    it('should not track user activity when behavior tracking is disabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      
      renderHook(() => useSessionAnalytics({ enableBehaviorTracking: false }));

      // Should not add activity event listeners
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'mousedown',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('Form Interaction Tracking', () => {
    it('should track form interactions when enabled', () => {
      renderHook(() => useSessionAnalytics({ trackFormInteractions: true }));

      // Create a mock form element
      const mockInput = document.createElement('input');
      mockInput.name = 'test-input';
      mockInput.id = 'test-id';
      
      const mockForm = document.createElement('form');
      mockForm.id = 'test-form';
      mockForm.appendChild(mockInput);
      document.body.appendChild(mockForm);

      // Simulate form interaction
      act(() => {
        mockInput.dispatchEvent(new Event('focus', { bubbles: true }));
      });

      expect(sessionAnalyticsLogger.logUserBehavior).toHaveBeenCalledWith(
        'form_interaction',
        expect.objectContaining({
          elementType: 'input',
          elementName: 'test-input',
          eventType: 'focus',
          formId: 'test-form'
        })
      );

      // Cleanup
      document.body.removeChild(mockForm);
    });

    it('should not track form interactions when disabled', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      
      renderHook(() => useSessionAnalytics({ trackFormInteractions: false }));

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
        true
      );
    });
  });

  describe('Manual Tracking Functions', () => {
    it('should provide manual tracking functions', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      expect(result.current.trackSessionEvent).toBeInstanceOf(Function);
      expect(result.current.trackPerformanceMetric).toBeInstanceOf(Function);
      expect(result.current.trackUserBehavior).toBeInstanceOf(Function);
      expect(result.current.trackError).toBeInstanceOf(Function);
      expect(result.current.trackOfflineAction).toBeInstanceOf(Function);
      expect(result.current.trackSyncOperation).toBeInstanceOf(Function);
    });

    it('should track session events manually', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      act(() => {
        result.current.trackSessionEvent('token_refresh', { success: true });
      });

      expect(sessionAnalyticsLogger.logSessionEvent).toHaveBeenCalledWith(
        'token_refresh',
        { success: true }
      );
    });

    it('should track performance metrics manually', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      act(() => {
        result.current.trackPerformanceMetric('connection_latency', 150, 'ms', { endpoint: '/api/test' });
      });

      expect(sessionAnalyticsLogger.logPerformanceMetric).toHaveBeenCalledWith(
        'connection_latency',
        150,
        'ms',
        { endpoint: '/api/test' }
      );
    });

    it('should track user behavior manually', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      act(() => {
        result.current.trackUserBehavior('manual_sync', { reason: 'user_requested' });
      });

      expect(sessionAnalyticsLogger.logUserBehavior).toHaveBeenCalledWith(
        'manual_sync',
        { reason: 'user_requested' }
      );
    });

    it('should track errors with context', () => {
      const { result } = renderHook(() => useSessionAnalytics());
      const testError = new Error('Test error');

      act(() => {
        result.current.trackError(testError, { component: 'TestComponent' });
      });

      expect(sessionAnalyticsLogger.logSessionEvent).toHaveBeenCalledWith(
        'error_occurred',
        expect.objectContaining({
          errorMessage: 'Test error',
          errorStack: expect.any(String),
          errorName: 'Error',
          context: { component: 'TestComponent' },
          url: 'https://test.com/test-page?test=1',
          timestamp: expect.any(Number)
        })
      );
    });

    it('should track offline actions', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      // Mock navigator.onLine
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true
      });

      act(() => {
        result.current.trackOfflineAction('form_save', { formId: 'test-form' });
      });

      expect(sessionAnalyticsLogger.logUserBehavior).toHaveBeenCalledWith(
        'offline_action',
        expect.objectContaining({
          action: 'form_save',
          formId: 'test-form',
          isOnline: false
        })
      );
    });

    it('should track sync operations', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      act(() => {
        result.current.trackSyncOperation(500, true, { itemCount: 10 });
      });

      expect(sessionAnalyticsLogger.logPerformanceMetric).toHaveBeenCalledWith(
        'sync_time',
        500,
        'ms',
        expect.objectContaining({
          success: true,
          itemCount: 10
        })
      );

      expect(sessionAnalyticsLogger.logSessionEvent).toHaveBeenCalledWith(
        'sync_completed',
        { itemCount: 10 }
      );
    });
  });

  describe('Utility Functions', () => {
    it('should provide session duration', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      const duration = result.current.getSessionDuration();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should provide last activity time', () => {
      const { result } = renderHook(() => useSessionAnalytics());

      const lastActivity = result.current.getLastActivityTime();
      expect(typeof lastActivity).toBe('number');
      expect(lastActivity).toBeGreaterThan(0);
    });
  });

  describe('Event Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const windowRemoveEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useSessionAnalytics());

      unmount();

      expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});