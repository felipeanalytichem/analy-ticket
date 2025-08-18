import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  MetricCategory, 
  AlertSeverity,
  PerformanceUtils
} from '../PerformanceMonitor';

describe('PerformanceMonitor - Core Functionality', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('Metric Recording', () => {
    it('should record and retrieve metrics', () => {
      monitor.recordMetric(
        'test-metric',
        100,
        'milliseconds',
        MetricCategory.JAVASCRIPT,
        { component: 'test' }
      );

      const metrics = monitor.getMetrics();
      expect(metrics).toHaveLength(1);
      
      const metric = metrics[0];
      expect(metric.name).toBe('test-metric');
      expect(metric.value).toBe(100);
      expect(metric.unit).toBe('milliseconds');
      expect(metric.category).toBe(MetricCategory.JAVASCRIPT);
      expect(metric.tags).toEqual({ component: 'test' });
      expect(metric.timestamp).toBeInstanceOf(Date);
    });

    it('should filter metrics by category', () => {
      monitor.recordMetric('memory-metric', 50, 'MB', MetricCategory.MEMORY);
      monitor.recordMetric('network-metric', 200, 'ms', MetricCategory.NETWORK);
      monitor.recordMetric('js-metric', 10, 'ms', MetricCategory.JAVASCRIPT);

      const memoryMetrics = monitor.getMetrics(MetricCategory.MEMORY);
      const networkMetrics = monitor.getMetrics(MetricCategory.NETWORK);
      const jsMetrics = monitor.getMetrics(MetricCategory.JAVASCRIPT);

      expect(memoryMetrics).toHaveLength(1);
      expect(memoryMetrics[0].name).toBe('memory-metric');
      expect(networkMetrics).toHaveLength(1);
      expect(networkMetrics[0].name).toBe('network-metric');
      expect(jsMetrics).toHaveLength(1);
      expect(jsMetrics[0].name).toBe('js-metric');
    });

    it('should limit returned metrics', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric(`metric-${i}`, i, 'count', MetricCategory.JAVASCRIPT);
      }

      const allMetrics = monitor.getMetrics();
      const limitedMetrics = monitor.getMetrics(undefined, 5);

      expect(allMetrics).toHaveLength(10);
      expect(limitedMetrics).toHaveLength(5);
      
      // Should return the last 5 metrics
      expect(limitedMetrics[0].name).toBe('metric-5');
      expect(limitedMetrics[4].name).toBe('metric-9');
    });
  });

  describe('Threshold and Alert Management', () => {
    it('should set thresholds and generate alerts', () => {
      const alertCallback = vi.fn();
      monitor.onAlert(alertCallback);

      monitor.setThreshold('test-metric', 50, 100, 'units');
      
      // Below threshold - no alert
      monitor.recordMetric('test-metric', 30, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).not.toHaveBeenCalled();

      // Warning threshold - high alert
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).toHaveBeenCalledTimes(1);
      expect(alertCallback.mock.calls[0][0].severity).toBe(AlertSeverity.HIGH);

      // Critical threshold - critical alert
      monitor.recordMetric('test-metric', 150, 'units', MetricCategory.JAVASCRIPT);
      expect(alertCallback).toHaveBeenCalledTimes(2);
      expect(alertCallback.mock.calls[1][0].severity).toBe(AlertSeverity.CRITICAL);
    });

    it('should manage alerts correctly', () => {
      monitor.setThreshold('test-metric', 50, 100, 'units');
      
      // Generate alerts
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT); // High
      monitor.recordMetric('test-metric', 150, 'units', MetricCategory.JAVASCRIPT); // Critical

      const allAlerts = monitor.getAlerts();
      expect(allAlerts).toHaveLength(2);

      const highAlerts = monitor.getAlerts(AlertSeverity.HIGH);
      const criticalAlerts = monitor.getAlerts(AlertSeverity.CRITICAL);

      expect(highAlerts).toHaveLength(1);
      expect(criticalAlerts).toHaveLength(1);

      // Test alert resolution
      const alertId = allAlerts[0].id;
      const resolved = monitor.resolveAlert(alertId);
      
      expect(resolved).toBe(true);
      expect(allAlerts[0].resolved).toBe(true);

      const unresolvedAlerts = monitor.getAlerts(undefined, true);
      expect(unresolvedAlerts).toHaveLength(1);
    });

    it('should generate alert with correct properties', () => {
      monitor.setThreshold('test-metric', 50, 100, 'units');
      monitor.recordMetric('test-metric', 75, 'units', MetricCategory.JAVASCRIPT);

      const alerts = monitor.getAlerts();
      const alert = alerts[0];

      expect(alert.id).toBeDefined();
      expect(alert.metric).toBe('test-metric');
      expect(alert.threshold).toBe(50);
      expect(alert.currentValue).toBe(75);
      expect(alert.severity).toBe(AlertSeverity.HIGH);
      expect(alert.resolved).toBe(false);
      expect(alert.timestamp).toBeInstanceOf(Date);
      expect(alert.message).toContain('test-metric exceeded high threshold');
    });
  });

  describe('Function Measurement', () => {
    it('should measure synchronous function execution', () => {
      const testFunction = () => {
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        return sum;
      };

      const result = monitor.measureFunction('test-sync-function', testFunction);
      
      expect(result).toBe(4950); // Sum of 0 to 99
      
      const metrics = monitor.getMetrics(MetricCategory.JAVASCRIPT);
      const functionMetric = metrics.find(m => m.name === 'test-sync-function');
      
      expect(functionMetric).toBeDefined();
      expect(functionMetric!.unit).toBe('milliseconds');
      expect(functionMetric!.value).toBeGreaterThanOrEqual(0);
    });

    it('should measure asynchronous function execution', async () => {
      const testAsyncFunction = async () => {
        return Promise.resolve('async-result');
      };

      const result = await monitor.measureAsyncFunction('test-async-function', testAsyncFunction);
      
      expect(result).toBe('async-result');
      
      const metrics = monitor.getMetrics(MetricCategory.JAVASCRIPT);
      const functionMetric = metrics.find(m => m.name === 'test-async-function');
      
      expect(functionMetric).toBeDefined();
      expect(functionMetric!.unit).toBe('milliseconds');
      expect(functionMetric!.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Add test data
      monitor.recordMetric('metric-1', 100, 'ms', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('metric-1', 150, 'ms', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('metric-1', 200, 'ms', MetricCategory.JAVASCRIPT);
      monitor.recordMetric('metric-2', 50, 'ms', MetricCategory.NETWORK);
      
      // Generate an alert
      monitor.setThreshold('metric-1', 120, 180, 'ms');
      monitor.recordMetric('metric-1', 190, 'ms', MetricCategory.JAVASCRIPT);
    });

    it('should generate comprehensive report', () => {
      const report = monitor.generateReport();
      
      expect(report.period.start).toBeInstanceOf(Date);
      expect(report.period.end).toBeInstanceOf(Date);
      expect(report.metrics.length).toBeGreaterThan(0);
      expect(report.alerts.length).toBeGreaterThan(0);
      
      expect(report.summary.totalMetrics).toBeGreaterThan(0);
      expect(report.summary.alertCount).toBeGreaterThan(0);
      expect(report.summary.averageValues).toBeDefined();
      expect(report.summary.peakValues).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate averages and peaks correctly', () => {
      const report = monitor.generateReport();
      
      // metric-1 values: 100, 150, 200, 190 = average 160, peak 200
      expect(report.summary.averageValues['metric-1']).toBe(160);
      expect(report.summary.peakValues['metric-1']).toBe(200);
      
      // metric-2 values: 50 = average 50, peak 50
      expect(report.summary.averageValues['metric-2']).toBe(50);
      expect(report.summary.peakValues['metric-2']).toBe(50);
    });

    it('should filter report by date range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const report = monitor.generateReport(oneHourAgo, now);
      
      expect(report.period.start).toEqual(oneHourAgo);
      expect(report.period.end).toEqual(now);
      
      // All metrics should be within the time range
      report.metrics.forEach(metric => {
        expect(metric.timestamp.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(metric.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });
  });

  describe('Lifecycle Management', () => {
    it('should start and stop monitoring without errors', () => {
      expect(() => monitor.startMonitoring()).not.toThrow();
      expect(() => monitor.stopMonitoring()).not.toThrow();
    });

    it('should handle multiple start/stop calls', () => {
      monitor.startMonitoring();
      monitor.startMonitoring(); // Should not cause issues
      
      monitor.stopMonitoring();
      monitor.stopMonitoring(); // Should not cause issues
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
      monitor.recordMetric('test-metric', 100, 'ms', MetricCategory.JAVASCRIPT);
      
      expect(() => monitor.destroy()).not.toThrow();
      
      expect(monitor.getMetrics()).toHaveLength(0);
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    it('should maintain metrics limit', () => {
      // Add more metrics than the internal limit
      for (let i = 0; i < 1200; i++) {
        monitor.recordMetric(`metric-${i}`, i, 'count', MetricCategory.JAVASCRIPT);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.length).toBeLessThanOrEqual(1000); // MAX_METRICS
    });

    it('should maintain alerts limit', () => {
      monitor.setThreshold('test-metric', 10, 20, 'units');
      
      // Generate more alerts than the limit
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('test-metric', 25, 'units', MetricCategory.JAVASCRIPT);
      }
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100); // MAX_ALERTS
    });
  });
});

describe('PerformanceUtils', () => {
  it('should provide utility functions', () => {
    expect(typeof PerformanceUtils.monitorApiCall).toBe('function');
    expect(typeof PerformanceUtils.monitorRender).toBe('function');
    expect(typeof PerformanceUtils.startSessionMonitoring).toBe('function');
    expect(typeof PerformanceUtils.getPerformanceSummary).toBe('function');
  });

  it('should monitor API calls', async () => {
    const mockApiCall = vi.fn().mockResolvedValue('api-result');
    
    const result = await PerformanceUtils.monitorApiCall('test-endpoint', mockApiCall);
    
    expect(result).toBe('api-result');
    expect(mockApiCall).toHaveBeenCalledOnce();
  });

  it('should monitor component renders', () => {
    const mockRenderFn = vi.fn().mockReturnValue('render-result');
    
    const result = PerformanceUtils.monitorRender('TestComponent', mockRenderFn);
    
    expect(result).toBe('render-result');
    expect(mockRenderFn).toHaveBeenCalledOnce();
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