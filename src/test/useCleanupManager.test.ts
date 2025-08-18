import { renderHook, act } from '@testing-library/react';
import { useCleanupManager } from '@/hooks/useCleanupManager';
import { vi } from 'vitest';

describe('useCleanupManager', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with empty cleanup functions', () => {
    const { result } = renderHook(() => useCleanupManager());

    expect(result.current.getActiveCleanups()).toEqual([]);
  });

  it('should add and execute cleanup functions', () => {
    const { result, unmount } = renderHook(() => useCleanupManager());
    const mockCleanup = vi.fn();

    act(() => {
      result.current.addCleanup(mockCleanup, 'test-cleanup');
    });

    expect(result.current.getActiveCleanups()).toContain('test-cleanup');

    // Cleanup should be called on unmount
    unmount();
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('should track and cleanup timers', () => {
    const { result, unmount } = renderHook(() => useCleanupManager());
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const timeoutId = setTimeout(() => {}, 1000);
    const intervalId = setInterval(() => {}, 1000);

    act(() => {
      result.current.addTimer(timeoutId, 'timeout', 'test-timeout');
      result.current.addTimer(intervalId, 'interval', 'test-interval');
    });

    expect(result.current.getActiveCleanups()).toContain('timer_test-timeout');
    expect(result.current.getActiveCleanups()).toContain('timer_test-interval');

    // Cleanup should clear timers on unmount
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);

    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('should track and cleanup subscriptions', () => {
    const { result, unmount } = renderHook(() => useCleanupManager());
    const mockUnsubscribe = vi.fn();

    const subscription = {
      unsubscribe: mockUnsubscribe,
      name: 'test-subscription'
    };

    act(() => {
      result.current.addSubscription(subscription);
    });

    expect(result.current.getActiveCleanups()).toContain('sub_test-subscription');

    // Cleanup should unsubscribe on unmount
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should clear specific timers', () => {
    const { result } = renderHook(() => useCleanupManager());
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const timeoutId = setTimeout(() => {}, 1000);

    act(() => {
      result.current.addTimer(timeoutId, 'timeout', 'test-timeout');
    });

    expect(result.current.getActiveCleanups()).toContain('timer_test-timeout');

    act(() => {
      result.current.clearTimer(timeoutId);
    });

    expect(result.current.getActiveCleanups()).not.toContain('timer_test-timeout');
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);

    clearTimeoutSpy.mockRestore();
  });

  it('should clear specific subscriptions', () => {
    const { result } = renderHook(() => useCleanupManager());
    const mockUnsubscribe = vi.fn();

    const subscription = {
      unsubscribe: mockUnsubscribe,
      name: 'test-subscription'
    };

    act(() => {
      result.current.addSubscription(subscription);
    });

    expect(result.current.getActiveCleanups()).toContain('sub_test-subscription');

    act(() => {
      result.current.clearSubscription('test-subscription');
    });

    expect(result.current.getActiveCleanups()).not.toContain('sub_test-subscription');
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should clear all cleanups', () => {
    const { result } = renderHook(() => useCleanupManager());
    const mockCleanup1 = vi.fn();
    const mockCleanup2 = vi.fn();
    const mockUnsubscribe = vi.fn();

    act(() => {
      result.current.addCleanup(mockCleanup1, 'cleanup1');
      result.current.addCleanup(mockCleanup2, 'cleanup2');
      result.current.addSubscription({
        unsubscribe: mockUnsubscribe,
        name: 'subscription1'
      });
    });

    expect(result.current.getActiveCleanups().length).toBeGreaterThan(0);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.getActiveCleanups()).toEqual([]);
    expect(mockCleanup1).toHaveBeenCalledTimes(1);
    expect(mockCleanup2).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('should handle cleanup errors gracefully', () => {
    const { result, unmount } = renderHook(() => useCleanupManager());
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const errorCleanup = vi.fn(() => {
      throw new Error('Cleanup error');
    });
    const normalCleanup = vi.fn();

    act(() => {
      result.current.addCleanup(errorCleanup, 'error-cleanup');
      result.current.addCleanup(normalCleanup, 'normal-cleanup');
    });

    // Should not throw and should continue with other cleanups
    unmount();
    
    expect(errorCleanup).toHaveBeenCalledTimes(1);
    expect(normalCleanup).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in cleanup error-cleanup'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});