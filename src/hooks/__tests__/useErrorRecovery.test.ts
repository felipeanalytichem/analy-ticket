import { renderHook, act } from '@testing-library/react';
import { useErrorRecovery } from '../useErrorRecovery';
import { vi } from 'vitest';

// Mock timers
vi.useFakeTimers();

describe('useErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useErrorRecovery());

    expect(result.current.error).toBeNull();
    expect(result.current.isRecovering).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(true);
    expect(result.current.errorType).toBe('unknown');
  });

  it('should classify network errors correctly', () => {
    const { result } = renderHook(() => useErrorRecovery());

    act(() => {
      result.current.handleError(new Error('Network connection failed'));
    });

    expect(result.current.errorType).toBe('network');
    expect(result.current.error).toBe('Network connection failed');
  });

  it('should classify database errors correctly', () => {
    const { result } = renderHook(() => useErrorRecovery());

    act(() => {
      result.current.handleError(new Error('Database query failed'));
    });

    expect(result.current.errorType).toBe('database');
    expect(result.current.error).toBe('Database query failed');
  });

  it('should classify timeout errors correctly', () => {
    const { result } = renderHook(() => useErrorRecovery());

    act(() => {
      result.current.handleError(new Error('Request timeout'));
    });

    expect(result.current.errorType).toBe('timeout');
    expect(result.current.error).toBe('Request timeout');
  });

  it('should classify permission errors correctly', () => {
    const { result } = renderHook(() => useErrorRecovery());

    act(() => {
      result.current.handleError(new Error('Permission denied'));
    });

    expect(result.current.errorType).toBe('permission');
    expect(result.current.error).toBe('Permission denied');
  });

  it('should prevent retry during cooldown period', () => {
    const { result } = renderHook(() => 
      useErrorRecovery({ cooldownPeriod: 5000 })
    );

    // Handle an error
    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    // Should not be able to retry immediately
    expect(result.current.canRetryNow).toBe(false);
    expect(result.current.timeUntilRetry).toBeGreaterThan(0);
  });

  it('should allow retry after cooldown period', () => {
    const { result } = renderHook(() => 
      useErrorRecovery({ cooldownPeriod: 1000 })
    );

    // Handle an error
    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    // Fast-forward time past cooldown
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.canRetryNow).toBe(true);
    expect(result.current.timeUntilRetry).toBe(0);
  });

  it('should implement exponential backoff for retry delays', async () => {
    const mockRecoveryOperation = vi.fn().mockRejectedValue(new Error('Still failing'));
    const { result } = renderHook(() => 
      useErrorRecovery({ 
        baseRetryDelay: 1000,
        retryMultiplier: 2,
        cooldownPeriod: 0 // Disable cooldown for this test
      })
    );

    // First attempt
    await act(async () => {
      await result.current.attemptRecovery(mockRecoveryOperation);
    });

    expect(result.current.retryCount).toBe(1);

    // Second attempt should have longer delay
    await act(async () => {
      await result.current.attemptRecovery(mockRecoveryOperation);
    });

    expect(result.current.retryCount).toBe(2);
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useErrorRecovery({ onError }));

    const testError = new Error('Test error');
    act(() => {
      result.current.handleError(testError);
    });

    expect(onError).toHaveBeenCalledWith(testError, expect.objectContaining({
      error: 'Test error',
      retryCount: 0,
      errorType: 'unknown'
    }));
  });

  it('should call onRecovery callback when recovery succeeds', async () => {
    const onRecovery = vi.fn();
    const mockRecoveryOperation = vi.fn().mockResolvedValue(undefined);
    
    const { result } = renderHook(() => 
      useErrorRecovery({ 
        onRecovery,
        cooldownPeriod: 0 // Disable cooldown for this test
      })
    );

    await act(async () => {
      const success = await result.current.attemptRecovery(mockRecoveryOperation);
      expect(success).toBe(true);
    });

    expect(onRecovery).toHaveBeenCalledWith(0);
    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
  });

  it('should call onMaxRetriesReached when max retries exceeded', () => {
    const onMaxRetriesReached = vi.fn();
    const { result } = renderHook(() => 
      useErrorRecovery({ 
        maxRetries: 2,
        onMaxRetriesReached
      })
    );

    // Simulate reaching max retries
    act(() => {
      result.current.handleError(new Error('Error 1'));
    });
    act(() => {
      result.current.handleError(new Error('Error 2'));
    });
    act(() => {
      result.current.handleError(new Error('Error 3'));
    });

    expect(onMaxRetriesReached).toHaveBeenCalled();
  });

  it('should provide appropriate recovery actions based on error type', () => {
    const { result } = renderHook(() => useErrorRecovery());

    // Network error
    act(() => {
      result.current.handleError(new Error('Network failed'));
    });
    expect(result.current.recoveryActions).toContain('Check your internet connection');

    // Database error
    act(() => {
      result.current.handleError(new Error('Database query failed'));
    });
    expect(result.current.recoveryActions).toContain('This is usually temporary');

    // Permission error
    act(() => {
      result.current.handleError(new Error('Permission denied'));
    });
    expect(result.current.recoveryActions).toContain('Verify your access permissions');
  });

  it('should reset state completely', () => {
    const { result } = renderHook(() => useErrorRecovery());

    // Set up error state
    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    expect(result.current.error).toBe('Test error');
    expect(result.current.retryCount).toBe(0);

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isRecovering).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(true);
    expect(result.current.errorType).toBe('unknown');
  });

  it('should handle recovery operation storage and retry', async () => {
    const mockRecoveryOperation = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => 
      useErrorRecovery({ cooldownPeriod: 0 })
    );

    // Store recovery operation
    await act(async () => {
      await result.current.attemptRecovery(mockRecoveryOperation);
    });

    expect(result.current.hasRecoveryOperation).toBe(true);

    // Retry should use stored operation
    await act(async () => {
      const success = await result.current.retry();
      expect(success).toBe(true);
    });

    expect(mockRecoveryOperation).toHaveBeenCalledTimes(2);
  });
});