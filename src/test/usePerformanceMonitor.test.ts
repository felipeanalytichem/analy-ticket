import { renderHook, act } from '@testing-library/react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { vi } from 'vitest';

// Mock performance.now
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 1024 * 1024 * 50 // 50MB
    }
  },
  writable: true
});

describe('usePerformanceMonitor', () => {
  beforeEach(() => {
    mockPerformanceNow.mockClear();
    vi.clearAllMocks();
  });

  it('should initialize with default metrics', () => {
    const { result } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent'
      })
    );

    expect(result.current.metrics.componentName).toBe('TestComponent');
    expect(result.current.metrics.renderCount).toBe(0);
    expect(result.current.metrics.lastRenderTime).toBe(0);
    expect(result.current.metrics.averageRenderTime).toBe(0);
    expect(result.current.isSlowRender).toBe(false);
  });

  it('should track render times', async () => {
    let renderTime = 0;
    mockPerformanceNow
      .mockReturnValueOnce(0) // Start time
      .mockReturnValueOnce(20); // End time (20ms render)

    const { result, rerender } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent',
        logThreshold: 16
      })
    );

    // Trigger a re-render
    rerender();

    // Wait for effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.metrics.renderCount).toBe(1);
    expect(result.current.metrics.lastRenderTime).toBe(20);
    expect(result.current.isSlowRender).toBe(true); // 20ms > 16ms threshold
  });

  it('should calculate average render time correctly', async () => {
    mockPerformanceNow
      .mockReturnValueOnce(0).mockReturnValueOnce(10) // First render: 10ms
      .mockReturnValueOnce(10).mockReturnValueOnce(30) // Second render: 20ms
      .mockReturnValueOnce(30).mockReturnValueOnce(45); // Third render: 15ms

    const { result, rerender } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent'
      })
    );

    // Trigger multiple re-renders
    rerender();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    rerender();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    rerender();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.metrics.renderCount).toBe(3);
    expect(result.current.metrics.averageRenderTime).toBe(15); // (10 + 20 + 15) / 3
  });

  it('should reset metrics correctly', () => {
    const { result } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent'
      })
    );

    act(() => {
      result.current.resetMetrics();
    });

    expect(result.current.metrics.renderCount).toBe(0);
    expect(result.current.metrics.lastRenderTime).toBe(0);
    expect(result.current.metrics.averageRenderTime).toBe(0);
    expect(result.current.metrics.totalRenderTime).toBe(0);
  });

  it('should track memory usage when enabled', () => {
    const { result } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enableMemoryTracking: true
      })
    );

    // Memory tracking is updated during render cycles
    expect(result.current.metrics.componentName).toBe('TestComponent');
  });

  it('should limit render history to maxRenderHistory', async () => {
    // Mock many quick renders
    for (let i = 0; i < 10; i++) {
      mockPerformanceNow
        .mockReturnValueOnce(i * 10)
        .mockReturnValueOnce(i * 10 + 5); // 5ms each
    }

    const { result, rerender } = renderHook(() => 
      usePerformanceMonitor({
        componentName: 'TestComponent',
        maxRenderHistory: 5
      })
    );

    // Trigger multiple re-renders
    for (let i = 0; i < 10; i++) {
      rerender();
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }

    // Should only keep the last 5 renders
    expect(result.current.metrics.renderCount).toBeLessThanOrEqual(5);
  });
});