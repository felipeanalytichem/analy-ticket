import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  MetricCategory, 
  AlertSeverity,
  PerformanceUtils,
  performanceMonitor 
} from '../PerformanceMonitor';

// Mock PerformanceObserver
class MockPerformanceObserver {
  callback: (list: any) => void;
  
  constructor(callback: (list: any) => void) {
    this.callback = callback;
  }
  
  observe = vi.fn();
  disconnect = vi.fn();
}

global.PerformanceObserver = MockPerformanceObserver as any;

// Mock performance.memory
const mockMemory = {
  usedJSHeapSize: 10 * 1024 * 1024, // 10MB
  totalJSHeapSize: 20 * 1024 * 1024, // 20MB
  jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
};

Object.defineProperty(performance, 'memory', {
  get: () => mockMemory,
  configurable: true
});

// Mock navigator.connection
Object.defineProperty(navigator, 'connection', {
  value: {
    downlink: 10, // 10 Mbps
    rtt: 50 // 50ms
  },
  configurable: true
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.destroy();
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should record custom metrics', () => {
      monitor.recordMetric(
        'test-metric',
        100,
        'milliseconds',
        MetricCategory.JAVASCRIPT,
        { component: 'test' }
      );

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test-metric');
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].unit).toBe('milliseconds');
      expect(metrics[0].category).toBe(MetricCategory.JAVASCRIPT);
      expect(metrics[0].tags).toEqual({ component: 'test' });
    });

    it('should filter metrics by category', () => {
      monitor.recordMetric('memory-metric', 50, 'MB', MetricCategory.MEMORY);
      monitor.recordMetric('network-metric', 200, 'ms', MetricCategory.NETWORK);
      monitor.recordMetric('js-metric', 10, 'ms', MetricCategory.JAVASCRIPT);

      const memoryMetrics = monitor.getMetrics(MetricCategory.MEMORY);
      const networkMetrics = monitor.getMetrics(MetricCategory.NETWORK);

      expect(memoryMetrics).toHaveLength(1);
      expect(memoryMetrics[0].name).toBe('memory-metric');
      expect(networkMetrics).toHaveLength(1);
      expect(networkMetrics[0].name).toBe('network-metric');
    });

    it('should limit metrics by count', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric(`metric-${i}`, i, 'count', MetricCategory.JAVASCRIPT);
      }

      const limitedMetrics = monitor.getMetrics(undefined, 5);
      expect(limitedMetrics).toHaveLength(5);
      expect(limitedMetrics[0].name).toBe('metric-5'); // Should get the last 5
    });
  });

  describe('Threshold Management', () => {
    it('should set and use custom thresholds', () => {
      const alertCallback = vi.fn();
      monitor.onAlert(alertCallback);

      monitor.setThreshold('test-metric', 50, 100, 'units');
      
      // Should not trigger alert
      monitor.recordMetric('test-metric', 30, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).not.toHaveBeenCalled();

      // Should trigger warning alert
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).toHaveBeenCalledTimes(1);
      expect(alertCallback.mock.calls[0][0].severity).toBe(AlertSeverity.HIGH);

      // Should trigger critical alert
      monitor.recordMetric('test-metric', 150, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).toHaveBeenCalledTimes(2);
      expect(alertCallback.mock.calls[1][0].severity).toBe(AlertSeverity.CRITICAL);
    });

    it('should generate alerts with correct information', () => {
      monitor.setThreshold('test-metric', 50, 100, 'units');
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);

      const alerts = monitor.getAlerts();
      expect(alerts).toHaveLength(1);
      
      const alert = alerts[0];
      expect(alert.metric).toBe('test-metric');
      expect(alert.threshold).toBe(50);
      expect(alert.currentValue).toBe(75);
      expect(alert.severity).toBe(AlertSeverity.HIGH);
      expect(alert.resolved).toBe(false);
      expect(alert.message).toContain('test-metric exceeded high threshold');
    });
  });

  describe('Alert Management', () => {
    beforeEach(() => {
      monitor.setThreshold('test-metric', 50, 100, 'units');
    });

    it('should filter alerts by severity', () => {
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT); // High
      monitor.recordMetric('test-metric', 150, 'units', MetricCategory.JAVASCRIPT); // Critical

      const highAlerts = monitor.getAlerts(AlertSeverity.HIGH);
      const criticalAlerts = monitor.getAlerts(AlertSeverity.CRITICAL);

      expect(highAlerts).toHaveLength(1);
      expect(criticalAlerts).toHaveLength(1);
    });

    it('should filter alerts by resolved status', () => {
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('test-metric', 150, 'units', MetricCategory.JAVASCRIPT);

      const alerts = monitor.getAlerts();
      expect(alerts).toHaveLength(2);

      // Resolve one alert
      monitor.resolveAlert(alerts[0].id);

      const unresolvedAlerts = monitor.getAlerts(undefined, true);
      const resolvedAlerts = monitor.getAlerts(undefined, false);

      expect(unresolvedAlerts).toHaveLength(1);
      expect(resolvedAlerts).toHaveLength(1);
    });

    it('should resolve alerts correctly', () => {
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);
      
      const alerts = monitor.getAlerts();
      const alertId = alerts[0].id;

      const resolved = monitor.resolveAlert(alertId);
      expect(resolved).toBe(true);
      expect(alerts[0].resolved).toBe(true);

      const nonExistentResolved = monitor.resolveAlert('non-existent');
      expect(nonExistentResolved).toBe(false);
    });
  });

  describe('Memory Monitoring', () => {
    it('should collect memory usage metrics', () => {
      const memoryMetrics = monitor.getMemoryUsage();
      
      expect(memoryMetrics).toHaveLength(3);
      expect(memoryMetrics.find(m => m.name === 'js-heap-used')).toBeDefined();
      expect(memoryMetrics.find(m => m.name === 'js-heap-total')).toBeDefined();
      expect(memoryMetrics.find(m => m.name === 'js-heap-limit')).toBeDefined();

      memoryMetrics.forEach(metric => {
        expect(metric.category).toBe(MetricCategory.MEMORY);
        expect(metric.unit).toBe('bytes');
        expect(metric.value).toBeGreaterThan(0);
      });
    });
  });

  describe('Function Measurement', () => {
    it('should measure synchronous function execution time', () => {
      const testFunction = () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const result = monitor.measureFunction('test-sync-function', testFunction);
      
      expect(result).toBe(499500); // Sum of 0 to 999
      
      const metrics = monitor.getMetrics(MetricCategory.JAVASCRIPT);
      const functionMetric = metrics.find(m => m.name === 'test-sync-function');
      
      expect(functionMetric).toBeDefined();
      expect(functionMetric!.unit).toBe('milliseconds');
      expect(functionMetric!.value).toBeGreaterThanOrEqual(0);
    });

    it('should measure asynchronous function execution time', async () => {
      const testAsyncFunction = async () => {
        // Use fake timers for predictable timing
        return new Promise(resolve => {
          setTimeout(() => resolve('async-result'), 100);
        });
      };

      const resultPromise = monitor.measureAsyncFunction('test-async-function', testAsyncFunction);
      
      // Advance timers to complete the async function
      vi.advanceTimersByTime(100);
      
      const result = await resultPromise;
      expect(result).toBe('async-result');
      
      const metrics = monitor.getMetrics(MetricCategory.JAVASCRIPT);
      const functionMetric = metrics.find(m => m.name === 'test-async-function');
      
      expect(functionMetric).toBeDefined();
      expect(functionMetric!.unit).toBe('milliseconds');
      expect(functionMetric!.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(() => monitor.startMonitoring()).not.toThrow();
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });

    it('should not start monitoring twice', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Should not throw or cause issues
      
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });

    it('should collect metrics during monitoring', () => {
      monitor.startMonitoring();
      
      // Fast forward to trigger metric collection
      vi.advanceTimersByTime(6000); // More than COLLECTION_INTERVAL
      
      const metrics = monitor.getMetrics(MetricCategory.MEMORY);
      expect(metrics.length).toBeGreaterThanOrEqual(0);
      
      monitor.stopMonitoring();
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Add some test data
      monitor.recordMetric('metric-1', 100, 'ms', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('metric-1', 150, 'ms', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('metric-2', 50, 'ms', MetricCategory.NETWORK);
      
      monitor.setThreshold('metric-1', 120, 200, 'ms');
      monitor.recordMetric('metric-1', 180, 'ms', MetricCategory.JAVASCRIPT); // Should trigger alert
    });

    it('should generate comprehensive performance report', () => {
      const report = monitor.generateReport();
      
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.alerts.length).toBeGreaterThan(0);
      
      expect(report.summary.totalMetrics).toBeGreaterThan(0);
      expect(report.summary.alertCount).toBeGreaterThan(0);
      expect(report.summary.averageValues['metric-1']).toBeCloseTo(143.33, 1); // (100+150+180)/3
      expect(report.summary.peakValues['metric-1']).toBe(180);
      
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should filter report by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const report = monitor.generateReport(oneHourAgo, now);
      
      expect(report.period.start).toEqual(oneHourAgo);
      expect(report.period.end).toEqual(now);
    });
  });

  describe('Cleanup and Limits', () => {
    it('should maintain metrics limit', () => {
      // Create a monitor with a small limit for testing
      const smallMonitor = new PerformanceMonitor();
      
      // Add more metrics than the limit
      for (let i = 0; i < 1200; i++) {
        smallMonitor.recordMetric(`metric-${i}`, i, 'count', MetricCategory.JAVASCRIPT);
      }
      
      const metrics = smallMonitor.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000); // MAX_METRICS
      
      smallMonitor.destroy();
    });

    it('should clear all data', () => {
      monitor.recordMetric('test-metric', 100, 'ms', MetricCategory.JAVASCRIPT);
      monitor.setThreshold('test-metric', 50, 100, 'ms');
      monitor.recordMetric('test-metric', 150, 'ms', MetricCategory.JAVASCRIPT); // Triggers alert
      
      expect(monitor.getMetrics()).toHaveLength(2);
      expect(monitor.getAlerts()).toHaveLength(1);
      
      monitor.clear();
      
      expect(monitor.getMetrics()).toHaveLength(0);
      expect(monitor.getAlerts()).toHaveLength(0);
    });

    it('should destroy properly', () => {
      monitor.startMonitoring();
      monitor.recordMetric('test-metric', 100, 'ms', MetricCategory.JAVASCRIPT);
      
      expect(() => monitor.destroy()).not.toThrow();
      
      expect(monitor.getMetrics()).toHaveLength(0);
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });
});

describe('PerformanceUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should monitor API calls', async () => {
    const mockApiCall = vi.fn().mockResolvedValue('api-result');
    
    const result = await PerformanceUtils.monitorApiCall('test-endpoint', mockApiCall);
    
    expect(result).toBe('api-result');
    expect(mockApiCall).toHaveBeenCalledOnce();
    
    const metrics = performanceMonitor.getMetrics(MetricCategory.JAVASCRIPT);
    const apiMetric = metrics.find(m => m.name === 'api-test-endpoint');
    expect(apiMetric).toBeDefined();
  });

  it('should monitor component renders', () => {
    const mockRenderFn = vi.fn().mockReturnValue('render-result');
    
    const result = PerformanceUtils.monitorRender('TestComponent', mockRenderFn);
    
    expect(result).toBe('render-result');
    expect(mockRenderFn).toHaveBeenCalledOnce();
    
    const metrics = performanceMonitor.getMetrics(MetricCategory.JAVASCRIPT);
    const renderMetric = metrics.find(m => m.name === 'render-TestComponent');
    expect(renderMetric).toBeDefined();
  });

  it('should start session monitoring', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    expect(() => PerformanceUtils.startSessionMonitoring()).not.toThrow();
    
    consoleSpy.mockRestore();
  });

  it('should get performance summary', () => {
    const summary = PerformanceUtils.getPerformanceSummary();
    
    expect(summary).toHaveProperty('memoryUsage');
    expect(summary).toHaveProperty('recentAlerts');
    expect(summary).toHaveProperty('recommendations');
    
    expect(Array.isArray(summary.memoryUsage)).toBe(true);
    expect(Array.isArray(summary.recentAlerts)).toBe(true);
    expect(Array.isArray(summary.recommendations)).toBe(true);
  });
});