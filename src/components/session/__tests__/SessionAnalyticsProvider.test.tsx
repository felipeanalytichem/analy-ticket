import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionAnalyticsProvider, useSessionAnalyticsContext } from '../SessionAnalyticsProvider';
import { useSessionAnalytics } from '@/hooks/useSessionAnalytics';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

// Mock dependencies
vi.mock('@/hooks/useSessionAnalytics');
vi.mock('@/hooks/useSessionManager');
vi.mock('@/hooks/useConnectionMonitor');

const mockAnalytics = {
  trackSessionEvent: vi.fn(),
  trackPerformanceMetric: vi.fn(),
  trackUserBehavior: vi.fn(),
  trackError: vi.fn(),
  trackOfflineAction: vi.fn(),
  trackSyncOperation: vi.fn(),
  getSessionDuration: vi.fn(() => 1000),
  getLastActivityTime: vi.fn(() => Date.now())
};

const mockSessionStatus = {
  isActive: true,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  timeUntilExpiry: 30 * 60 * 1000,
  lastActivity: new Date(),
  refreshToken: 'refresh-token',
  accessToken: 'access-token'
};

const mockConnectionStatus = {
  isOnline: true,
  quality: 'good' as const,
  latency: 150,
  lastConnected: new Date(),
  reconnectAttempts: 0
};

function TestComponent() {
  const analytics = useSessionAnalyticsContext();
  
  return (
    <div>
      <button onClick={() => analytics.trackSessionEvent('test_event')}>
        Track Event
      </button>
      <button onClick={() => analytics.trackError(new Error('Test error'))}>
        Track Error
      </button>
    </div>
  );
}

describe('SessionAnalyticsProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (useSessionAnalytics as any).mockReturnValue(mockAnalytics);
    (useSessionManager as any).mockReturnValue({ sessionStatus: mockSessionStatus });
    (useConnectionMonitor as any).mockReturnValue({ connectionStatus: mockConnectionStatus });
  });

  it('should provide analytics context to children', () => {
    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(screen.getByText('Track Event')).toBeInTheDocument();
    expect(screen.getByText('Track Error')).toBeInTheDocument();
  });

  it('should initialize session analytics with correct options', () => {
    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(useSessionAnalytics).toHaveBeenCalledWith({
      enablePerformanceTracking: true,
      enableBehaviorTracking: true,
      trackPageViews: true,
      trackFormInteractions: true
    });
  });

  it('should track session refresh when session is active', () => {
    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(mockAnalytics.trackSessionEvent).toHaveBeenCalledWith('session_refresh', {
      expiresAt: mockSessionStatus.expiresAt,
      timeUntilExpiry: mockSessionStatus.timeUntilExpiry
    });
  });

  it('should track connection events when connection status changes', () => {
    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(mockAnalytics.trackSessionEvent).toHaveBeenCalledWith('connection_restored', {
      quality: mockConnectionStatus.quality,
      latency: mockConnectionStatus.latency,
      reconnectAttempts: mockConnectionStatus.reconnectAttempts
    });

    expect(mockAnalytics.trackPerformanceMetric).toHaveBeenCalledWith(
      'connection_latency',
      mockConnectionStatus.latency,
      'ms',
      { quality: mockConnectionStatus.quality }
    );
  });

  it('should track connection lost when offline', () => {
    const offlineConnectionStatus = {
      ...mockConnectionStatus,
      isOnline: false
    };

    (useConnectionMonitor as any).mockReturnValue({ 
      connectionStatus: offlineConnectionStatus 
    });

    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(mockAnalytics.trackSessionEvent).toHaveBeenCalledWith('connection_lost', {
      lastConnected: offlineConnectionStatus.lastConnected,
      reconnectAttempts: offlineConnectionStatus.reconnectAttempts
    });
  });

  it('should track session warning when session is about to expire', () => {
    const expiringSessionStatus = {
      ...mockSessionStatus,
      timeUntilExpiry: 4 * 60 * 1000 // 4 minutes
    };

    (useSessionManager as any).mockReturnValue({ 
      sessionStatus: expiringSessionStatus 
    });

    render(
      <SessionAnalyticsProvider>
        <TestComponent />
      </SessionAnalyticsProvider>
    );

    expect(mockAnalytics.trackSessionEvent).toHaveBeenCalledWith('session_warning', {
      timeUntilExpiry: expiringSessionStatus.timeUntilExpiry,
      lastActivity: expiringSessionStatus.lastActivity
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSessionAnalyticsContext must be used within SessionAnalyticsProvider');

    consoleSpy.mockRestore();
  });

  it('should provide all analytics functions through context', () => {
    let contextValue: any;

    function TestContextComponent() {
      contextValue = useSessionAnalyticsContext();
      return <div>Test</div>;
    }

    render(
      <SessionAnalyticsProvider>
        <TestContextComponent />
      </SessionAnalyticsProvider>
    );

    expect(contextValue.trackSessionEvent).toBe(mockAnalytics.trackSessionEvent);
    expect(contextValue.trackPerformanceMetric).toBe(mockAnalytics.trackPerformanceMetric);
    expect(contextValue.trackUserBehavior).toBe(mockAnalytics.trackUserBehavior);
    expect(contextValue.trackError).toBe(mockAnalytics.trackError);
    expect(contextValue.trackOfflineAction).toBe(mockAnalytics.trackOfflineAction);
    expect(contextValue.trackSyncOperation).toBe(mockAnalytics.trackSyncOperation);
  });
});