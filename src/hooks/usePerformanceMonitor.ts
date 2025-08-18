import { useRef, useEffect, useCallback, useState } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
  memoryUsage?: number;
  componentName: string;
}

interface PerformanceMonitorOptions {
  componentName: string;
  enableMemoryTracking?: boolean;
  logThreshold?: number; // Log if render time exceeds this (ms)
  maxRenderHistory?: number;
}

interface PerformanceMonitorReturn {
  metrics: PerformanceMetrics;
  logPerformance: () => void;
  resetMetrics: () => void;
  isSlowRender: boolean;
}

export function usePerformanceMonitor({
  componentName,
  enableMemoryTracking = false,
  logThreshold = 16, // 16ms = 60fps threshold
  maxRenderHistory = 100
}: PerformanceMonitorOptions): PerformanceMonitorReturn {
  const renderStartTime = useRef<number>(0);
  const renderTimes = useRef<number[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    totalRenderTime: 0,
    componentName
  });

  // Track render start
  const trackRenderStart = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // Track render end and update metrics
  const trackRenderEnd = useCallback(() => {
    const endTime = performance.now();
    const renderTime = endTime - renderStartTime.current;
    
    // Add to render times history
    renderTimes.current.push(renderTime);
    
    // Keep only recent render times
    if (renderTimes.current.length > maxRenderHistory) {
      renderTimes.current = renderTimes.current.slice(-maxRenderHistory);
    }

    // Calculate metrics
    const totalRenderTime = renderTimes.current.reduce((sum, time) => sum + time, 0);
    const averageRenderTime = totalRenderTime / renderTimes.current.length;
    
    // Get memory usage if enabled
    let memoryUsage: number | undefined;
    if (enableMemoryTracking && 'memory' in performance) {
      memoryUsage = (performance as any).memory?.usedJSHeapSize;
    }

    const newMetrics: PerformanceMetrics = {
      renderCount: renderTimes.current.length,
      lastRenderTime: renderTime,
      averageRenderTime,
      totalRenderTime,
      memoryUsage,
      componentName
    };

    setMetrics(newMetrics);

    // Log if render time exceeds threshold
    if (renderTime > logThreshold) {
      console.warn(`[Performance] Slow render detected in ${componentName}:`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        threshold: `${logThreshold}ms`,
        renderCount: newMetrics.renderCount,
        averageRenderTime: `${averageRenderTime.toFixed(2)}ms`
      });
    }
  }, [componentName, logThreshold, maxRenderHistory, enableMemoryTracking]);

  // Log current performance metrics
  const logPerformance = useCallback(() => {
    console.log(`[Performance] ${componentName} metrics:`, {
      renderCount: metrics.renderCount,
      lastRenderTime: `${metrics.lastRenderTime.toFixed(2)}ms`,
      averageRenderTime: `${metrics.averageRenderTime.toFixed(2)}ms`,
      totalRenderTime: `${metrics.totalRenderTime.toFixed(2)}ms`,
      memoryUsage: metrics.memoryUsage ? `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB` : 'N/A'
    });
  }, [metrics, componentName]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    renderTimes.current = [];
    setMetrics({
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      totalRenderTime: 0,
      componentName
    });
  }, [componentName]);

  // Track render cycles
  useEffect(() => {
    trackRenderStart();
    return () => {
      trackRenderEnd();
    };
  });

  // Determine if last render was slow
  const isSlowRender = metrics.lastRenderTime > logThreshold;

  return {
    metrics,
    logPerformance,
    resetMetrics,
    isSlowRender
  };
}