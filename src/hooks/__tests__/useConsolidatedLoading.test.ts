import { renderHook, act } from '@testing-library/react';
import { useConsolidatedLoading } from '../useConsolidatedLoading';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

// Mock timers for testing
vi.useFakeTimers();

describe('useConsolidatedLoading', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingType).toBe(null);
    expect(result.current.loadingPhase).toBe('initializing');
    expect(result.current.error).toBe(null);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(true);
    expect(result.current.operation).toBe(null);
    expect(result.current.hasActiveOperations).toBe(false);
  });

  it('should start loading operation correctly', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    act(() => {
      const operationId = result.current.startLoading('initial', 'loadUsers', 'Loading users...');
      expect(operationId).toBeDefined();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingType).toBe('initial');
    expect(result.current.loadingPhase).toBe('loading');
    expect(result.current.operation).toBe('loadUsers');
    expect(result.current.message).toBe('Loading users...');
    expect(result.current.error).toBe(null);
    expect(result.current.isInitialLoad).toBe(true);
  });

  it('should complete loading operation successfully', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useConsolidatedLoading({ onSuccess }));

    let operationId: string;
    act(() => {
      operationId = result.current.startLoading('initial', 'loadUsers');
    });

    act(() => {
      result.current.completeLoading(operationId);
    });

    // Fast-forward past minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingType).toBe(null);
    expect(result.current.loadingPhase).toBe('ready');
    expect(result.current.operation).toBe(null);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('should handle loading operation errors', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useConsolidatedLoading({ onError }));

    let operationId: string;
    act(() => {
      operationId = result.current.startLoading('initial', 'loadUsers');
    });

    act(() => {
      result.current.completeLoading(operationId, { error: 'Network error' });
    });

    // Fast-forward past minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingPhase).toBe('error');
    expect(result.current.error).toBe('Network error');
    expect(result.current.canRetry).toBe(true);
    expect(onError).toHaveBeenCalledWith(new Error('Network error'), 0);
  });

  it('should execute operations with loading state', async () => {
    const mockOperation = vi.fn().mockResolvedValue('success');
    const { result } = renderHook(() => useConsolidatedLoading());

    let promise: Promise<string>;
    act(() => {
      promise = result.current.executeWithLoading(
        mockOperation,
        'action',
        'saveUser',
        'Saving user...'
      );
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadingType).toBe('action');
    expect(result.current.operation).toBe('saveUser');
    expect(result.current.message).toBe('Saving user...');
    expect(result.current.isPerformingAction).toBe(true);

    // Fast-forward past minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      const result = await promise;
      expect(result).toBe('success');
    });

    expect(mockOperation).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingPhase).toBe('ready');
  });

  it('should handle executeWithLoading errors', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
    const { result } = renderHook(() => useConsolidatedLoading());

    let promise: Promise<string>;
    act(() => {
      promise = result.current.executeWithLoading(
        mockOperation,
        'form',
        'submitForm'
      );
    });

    expect(result.current.isSubmitting).toBe(true);

    // Fast-forward past minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await act(async () => {
      await expect(promise).rejects.toThrow('Operation failed');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingPhase).toBe('error');
    expect(result.current.error).toBe('Operation failed');
  });

  it('should handle multiple concurrent operations', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    let operationId1: string, operationId2: string;
    act(() => {
      operationId1 = result.current.startLoading('initial', 'loadUsers');
      operationId2 = result.current.startLoading('action', 'saveUser');
    });

    expect(result.current.hasActiveOperations).toBe(true);
    expect(result.current.isLoading).toBe(true);

    // Complete first operation
    act(() => {
      result.current.completeLoading(operationId1);
    });

    // Should still be loading because second operation is active
    expect(result.current.isLoading).toBe(true);

    // Complete second operation
    act(() => {
      result.current.completeLoading(operationId2);
    });

    // Fast-forward past minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasActiveOperations).toBe(false);
  });

  it('should handle retry functionality', async () => {
    const { result } = renderHook(() => useConsolidatedLoading({ maxRetries: 2, retryDelay: 100 }));

    // Set error state
    act(() => {
      const operationId = result.current.startLoading('initial', 'loadUsers');
      result.current.completeLoading(operationId, { error: 'Network error' });
      vi.advanceTimersByTime(300);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.canRetry).toBe(true);
    expect(result.current.retryCount).toBe(0);

    // Retry
    act(() => {
      result.current.retry();
    });

    expect(result.current.retryCount).toBe(1);
    expect(result.current.error).toBe(null);

    // Fast-forward retry delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
  });

  it('should prevent retry after max attempts', () => {
    const { result } = renderHook(() => useConsolidatedLoading({ maxRetries: 1 }));

    // Set error state with max retries reached
    act(() => {
      const operationId = result.current.startLoading('initial', 'loadUsers');
      result.current.completeLoading(operationId, { error: 'Network error' });
      vi.advanceTimersByTime(300);
    });

    // First retry
    act(() => {
      result.current.retry();
    });

    expect(result.current.retryCount).toBe(1);

    // Second retry should be blocked
    act(() => {
      result.current.retry();
    });

    expect(result.current.canRetry).toBe(false);
    expect(result.current.error).toContain('Maximum retry attempts');
  });

  it('should reset state correctly', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    // Set some state
    act(() => {
      const operationId = result.current.startLoading('initial', 'loadUsers');
      result.current.completeLoading(operationId, { error: 'Some error' });
      vi.advanceTimersByTime(300);
    });

    expect(result.current.error).toBe('Some error');
    expect(result.current.loadingPhase).toBe('error');

    // Reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadingType).toBe(null);
    expect(result.current.loadingPhase).toBe('initializing');
    expect(result.current.error).toBe(null);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(true);
  });

  it('should update progress correctly', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    act(() => {
      result.current.updateProgress(50, 'Halfway done...');
    });

    expect(result.current.progress).toBe(50);
    expect(result.current.message).toBe('Halfway done...');

    // Test progress bounds
    act(() => {
      result.current.updateProgress(150);
    });

    expect(result.current.progress).toBe(100);

    act(() => {
      result.current.updateProgress(-10);
    });

    expect(result.current.progress).toBe(0);
  });

  it('should set phase correctly', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    act(() => {
      result.current.setPhase('ready');
    });

    expect(result.current.loadingPhase).toBe('ready');
  });

  it('should call onStateChange callback', () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useConsolidatedLoading({ onStateChange }));

    act(() => {
      result.current.startLoading('initial', 'loadUsers');
    });

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isLoading: true,
        loadingType: 'initial',
        operation: 'loadUsers'
      })
    );
  });

  it('should enforce minimum loading time to prevent flickering', async () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    let operationId: string;

    act(() => {
      operationId = result.current.startLoading('initial', 'quickOperation');
    });

    // Complete immediately
    act(() => {
      result.current.completeLoading(operationId);
    });

    // Should still be loading
    expect(result.current.isLoading).toBe(true);

    // Fast-forward to minimum loading time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now should be complete
    expect(result.current.isLoading).toBe(false);
  });

  it('should provide correct computed properties', () => {
    const { result } = renderHook(() => useConsolidatedLoading());

    // Test initial load
    act(() => {
      result.current.startLoading('initial', 'loadUsers');
    });

    expect(result.current.isInitialLoad).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isPerformingAction).toBe(false);

    // Test refresh
    act(() => {
      result.current.reset();
      result.current.startLoading('refresh', 'refreshData');
    });

    expect(result.current.isInitialLoad).toBe(false);
    expect(result.current.isRefreshing).toBe(true);

    // Test form submission
    act(() => {
      result.current.reset();
      result.current.startLoading('form', 'submitForm');
    });

    expect(result.current.isSubmitting).toBe(true);

    // Test action
    act(() => {
      result.current.reset();
      result.current.startLoading('action', 'deleteUser');
    });

    expect(result.current.isPerformingAction).toBe(true);
  });
});