export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: MetricCategory;
  tags?: Record<string, string>;
}

export enum MetricCategory {
  MEMORY = 'memory',
  NETWORK = 'network',
  RENDERING = 'rendering',
  JAVASCRIPT = 'javascript',
  USER_INTERACTION = 'user_interaction',
  CACHE = 'cache',
  SESSION = 'session',
  ERROR = 'error'
}

export interface PerformanceAlert {
  id: string;
  metric: string;
  threshold: number;
  currentValue: number;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  summary: {
    totalMetrics: number;
    averageValues: Record<string, number>;
    peakValues: Record<string, number>;
    alertCount: number;
    criticalAlerts: number;
  };
  recommendations: string[];
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  
  private readonly MAX_METRICS = 1000;
  private readonly MAX_ALERTS = 100;
  private readonly COLLECTION_INTERVAL = 5000; // 5 seconds
  
  private isMonitoring = false;
  private onAlertCallback?: (alert: PerformanceAlert) => void;

  constructor() {
    this.setupDefaultThresholds();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.setupPerformanceObservers();
    this.startMetricCollection();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.cleanupObservers();
    this.cleanupIntervals();
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: string, 
    category: MetricCategory,
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      category,
      tags
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    this.maintainMetricsLimit();
  }

  /**
   * Set performance threshold for alerts
   */
  setThreshold(metric: string, warning: number, critical: number, unit: string): void {
    this.thresholds.set(metric, {
      metric,
      warning,
      critical,
      unit
    });
  }

  /**
   * Get current performance metrics
   */
  getMetrics(category?: MetricCategory, limit?: number): PerformanceMetric[] {
    let filteredMetrics = this.metrics;

    if (category) {
      filteredMetrics = filteredMetrics.filter(m => m.category === category);
    }

    if (limit) {
      filteredMetrics = filteredMetrics.slice(-limit);
    }

    return filteredMetrics;
  }

  /**
   * Get performance alerts
   */
  getAlerts(severity?: AlertSeverity, unresolved?: boolean): PerformanceAlert[] {
    let filteredAlerts = this.alerts;

    if (severity) {
      filteredAlerts = filteredAlerts.filter(a => a.severity === severity);
    }

    if (unresolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.resolved !== unresolved);
    }

    return filteredAlerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Generate performance report
   */
  generateReport(startDate?: Date, endDate?: Date): PerformanceReport {
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const end = endDate || new Date();

    const periodMetrics = this.metrics.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );

    const periodAlerts = this.alerts.filter(
      a => a.timestamp >= start && a.timestamp <= end
    );

    const averageValues: Record<string, number> = {};
    const peakValues: Record<string, number> = {};

    // Calculate averages and peaks
    const metricGroups = this.groupMetricsByName(periodMetrics);
    
    for (const [name, metrics] of metricGroups.entries()) {
      const values = metrics.map(m => m.value);
      averageValues[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
      peakValues[name] = Math.max(...values);
    }

    const recommendations = this.generateRecommendations(periodMetrics, periodAlerts);

    return {
      period: { start, end },
      metrics: periodMetrics,
      alerts: periodAlerts,
      summary: {
        totalMetrics: periodMetrics.length,
        averageValues,
        peakValues,
        alertCount: periodAlerts.length,
        criticalAlerts: periodAlerts.filter(a => a.severity === AlertSeverity.CRITICAL).length
      },
      recommendations
    };
  }

  /**
   * Set alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.onAlertCallback = callback;
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      
      metrics.push({
        name: 'js-heap-used',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp: new Date(),
        category: MetricCategory.MEMORY
      });

      metrics.push({
        name: 'js-heap-total',
        value: memory.totalJSHeapSize,
        unit: 'bytes',
        timestamp: new Date(),
        category: MetricCategory.MEMORY
      });

      metrics.push({
        name: 'js-heap-limit',
        value: memory.jsHeapSizeLimit,
        unit: 'bytes',
        timestamp: new Date(),
        category: MetricCategory.MEMORY
      });
    }

    return metrics;
  }

  /**
   * Measure function execution time
   */
  measureFunction<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();

    this.recordMetric(
      name,
      endTime - startTime,
      'milliseconds',
      MetricCategory.JAVASCRIPT
    );

    return result;
  }

  /**
   * Measure async function execution time
   */
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    this.recordMetric(
      name,
      endTime - startTime,
      'milliseconds',
      MetricCategory.JAVASCRIPT
    );

    return result;
  }

  /**
   * Clear all metrics and alerts
   */
  clear(): void {
    this.metrics.length = 0;
    this.alerts.length = 0;
  }

  /**
   * Destroy the performance monitor
   */
  destroy(): void {
    this.stopMonitoring();
    this.clear();
    this.thresholds.clear();
  }

  private setupDefaultThresholds(): void {
    // Memory thresholds
    this.setThreshold('js-heap-used', 50 * 1024 * 1024, 100 * 1024 * 1024, 'bytes'); // 50MB warning, 100MB critical
    
    // Performance thresholds
    this.setThreshold('page-load-time', 3000, 5000, 'milliseconds'); // 3s warning, 5s critical
    this.setThreshold('first-contentful-paint', 1500, 3000, 'milliseconds');
    this.setThreshold('largest-contentful-paint', 2500, 4000, 'milliseconds');
    this.setThreshold('cumulative-layout-shift', 0.1, 0.25, 'score');
    this.setThreshold('first-input-delay', 100, 300, 'milliseconds');
    
    // Network thresholds
    this.setThreshold('api-response-time', 1000, 3000, 'milliseconds');
    this.setThreshold('cache-miss-rate', 0.2, 0.5, 'ratio');
  }

  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    // Navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            
            this.recordMetric(
              'page-load-time',
              navEntry.loadEventEnd - navEntry.navigationStart,
              'milliseconds',
              MetricCategory.RENDERING
            );

            this.recordMetric(
              'dom-content-loaded',
              navEntry.domContentLoadedEventEnd - navEntry.navigationStart,
              'milliseconds',
              MetricCategory.RENDERING
            );
          }
        }
      });

      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.set('navigation', navObserver);
    } catch (error) {
      console.warn('Failed to setup navigation observer:', error);
    }

    // Paint timing
    try {
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            entry.name,
            entry.startTime,
            'milliseconds',
            MetricCategory.RENDERING
          );
        }
      });

      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.set('paint', paintObserver);
    } catch (error) {
      console.warn('Failed to setup paint observer:', error);
    }

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        
        this.recordMetric(
          'largest-contentful-paint',
          lastEntry.startTime,
          'milliseconds',
          MetricCategory.RENDERING
        );
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.set('lcp', lcpObserver);
    } catch (error) {
      console.warn('Failed to setup LCP observer:', error);
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric(
            'first-input-delay',
            (entry as any).processingStart - entry.startTime,
            'milliseconds',
            MetricCategory.USER_INTERACTION
          );
        }
      });

      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.set('fid', fidObserver);
    } catch (error) {
      console.warn('Failed to setup FID observer:', error);
    }

    // Layout Shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        
        this.recordMetric(
          'cumulative-layout-shift',
          clsValue,
          'score',
          MetricCategory.RENDERING
        );
      });

      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.set('cls', clsObserver);
    } catch (error) {
      console.warn('Failed to setup CLS observer:', error);
    }
  }

  private startMetricCollection(): void {
    // Collect memory metrics periodically
    const memoryInterval = setInterval(() => {
      if (!this.isMonitoring) return;
      
      const memoryMetrics = this.getMemoryUsage();
      memoryMetrics.forEach(metric => {
        this.metrics.push(metric);
        this.checkThresholds(metric);
      });
      
      this.maintainMetricsLimit();
    }, this.COLLECTION_INTERVAL);

    this.intervals.set('memory', memoryInterval);

    // Collect connection information
    if ('connection' in navigator) {
      const connectionInterval = setInterval(() => {
        if (!this.isMonitoring) return;
        
        const connection = (navigator as any).connection;
        
        this.recordMetric(
          'connection-downlink',
          connection.downlink,
          'mbps',
          MetricCategory.NETWORK
        );

        this.recordMetric(
          'connection-rtt',
          connection.rtt,
          'milliseconds',
          MetricCategory.NETWORK
        );
      }, this.COLLECTION_INTERVAL * 2); // Less frequent

      this.intervals.set('connection', connectionInterval);
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold) return;

    let severity: AlertSeverity | null = null;
    
    if (metric.value >= threshold.critical) {
      severity = AlertSeverity.CRITICAL;
    } else if (metric.value >= threshold.warning) {
      severity = AlertSeverity.HIGH;
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metric: metric.name,
        threshold: severity === AlertSeverity.CRITICAL ? threshold.critical : threshold.warning,
        currentValue: metric.value,
        severity,
        message: `${metric.name} exceeded ${severity} threshold: ${metric.value}${metric.unit} (threshold: ${severity === AlertSeverity.CRITICAL ? threshold.critical : threshold.warning}${threshold.unit})`,
        timestamp: new Date(),
        resolved: false
      };

      this.alerts.push(alert);
      this.maintainAlertsLimit();

      if (this.onAlertCallback) {
        this.onAlertCallback(alert);
      }
    }
  }

  private maintainMetricsLimit(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics.splice(0, this.metrics.length - this.MAX_METRICS);
    }
  }

  private maintainAlertsLimit(): void {
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.splice(0, this.alerts.length - this.MAX_ALERTS);
    }
  }

  private groupMetricsByName(metrics: PerformanceMetric[]): Map<string, PerformanceMetric[]> {
    const groups = new Map<string, PerformanceMetric[]>();
    
    for (const metric of metrics) {
      if (!groups.has(metric.name)) {
        groups.set(metric.name, []);
      }
      groups.get(metric.name)!.push(metric);
    }
    
    return groups;
  }

  private generateRecommendations(metrics: PerformanceMetric[], alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    const memoryAlerts = alerts.filter(a => a.metric.includes('heap'));
    if (memoryAlerts.length > 0) {
      recommendations.push('Consider implementing memory cleanup strategies or reducing memory usage');
    }

    // Performance recommendations
    const renderingAlerts = alerts.filter(a => 
      a.metric.includes('paint') || a.metric.includes('layout') || a.metric.includes('load')
    );
    if (renderingAlerts.length > 0) {
      recommendations.push('Optimize rendering performance by reducing DOM complexity or implementing code splitting');
    }

    // Network recommendations
    const networkAlerts = alerts.filter(a => 
      a.metric.includes('response') || a.metric.includes('connection')
    );
    if (networkAlerts.length > 0) {
      recommendations.push('Improve network performance by implementing caching or optimizing API calls');
    }

    // Cache recommendations
    const cacheMetrics = metrics.filter(m => m.category === MetricCategory.CACHE);
    const highMissRate = cacheMetrics.some(m => m.name.includes('miss') && m.value > 0.3);
    if (highMissRate) {
      recommendations.push('Review cache strategy to improve hit rates');
    }

    return recommendations;
  }

  private cleanupObservers(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }

  private cleanupIntervals(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions for performance monitoring
export const PerformanceUtils = {
  /**
   * Monitor API call performance
   */
  monitorApiCall: async <T>(
    name: string,
    apiCall: () => Promise<T>
  ): Promise<T> => {
    return performanceMonitor.measureAsyncFunction(`api-${name}`, apiCall);
  },

  /**
   * Monitor component render performance
   */
  monitorRender: <T>(componentName: string, renderFn: () => T): T => {
    return performanceMonitor.measureFunction(`render-${componentName}`, renderFn);
  },

  /**
   * Start monitoring session performance
   */
  startSessionMonitoring: (): void => {
    performanceMonitor.startMonitoring();
    
    // Set up session-specific metrics
    performanceMonitor.onAlert((alert) => {
      console.warn('Performance Alert:', alert);
      
      // Could integrate with notification system
      if (alert.severity === AlertSeverity.CRITICAL) {
        // Handle critical performance issues
        console.error('Critical performance issue detected:', alert.message);
      }
    });
  },

  /**
   * Get performance summary for debugging
   */
  getPerformanceSummary: (): {
    memoryUsage: PerformanceMetric[];
    recentAlerts: PerformanceAlert[];
    recommendations: string[];
  } => {
    const report = performanceMonitor.generateReport(
      new Date(Date.now() - 60 * 60 * 1000), // Last hour
      new Date()
    );

    return {
      memoryUsage: performanceMonitor.getMemoryUsage(),
      recentAlerts: performanceMonitor.getAlerts(undefined, true), // Unresolved alerts
      recommendations: report.recommendations
    };
  }
};