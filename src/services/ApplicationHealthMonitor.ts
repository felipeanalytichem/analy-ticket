import { supabase } from '@/lib/supabase';

export interface HealthMetrics {
  timestamp: Date;
  componentHealth: ComponentHealth[];
  performanceMetrics: PerformanceMetrics;
  errorRates: ErrorRates;
  systemStatus: 'healthy' | 'degraded' | 'critical';
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  details?: string;
}

export interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  renderTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
}

export interface ErrorRates {
  total: number;
  byType: Record<string, number>;
  byComponent: Record<string, number>;
  criticalErrors: number;
  lastHour: number;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retryAttempts: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
  };
}

export class ApplicationHealthMonitor {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics: HealthMetrics[] = [];
  private config: HealthCheckConfig;
  private listeners: ((metrics: HealthMetrics) => void)[] = [];
  private componentCheckers: Map<string, () => Promise<ComponentHealth>> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private performanceObserver: PerformanceObserver | null = null;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 5000,
      retryAttempts: 3,
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 2000, // 2 seconds
        memoryUsage: 0.8 // 80%
      },
      ...config
    };

    this.setupDefaultCheckers();
    this.setupPerformanceObserver();
  }

  private setupDefaultCheckers(): void {
    // Database connection health check
    this.componentCheckers.set('database', async () => {
      const startTime = Date.now();
      try {
        const { error } = await supabase
          .from('users')
          .select('id')
          .limit(1)
          .single();

        const responseTime = Date.now() - startTime;
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        return {
          name: 'database',
          status: responseTime > 1000 ? 'degraded' : 'healthy',
          lastCheck: new Date(),
          responseTime,
          errorCount: 0
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'critical',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          errorCount: this.incrementErrorCount('database'),
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Authentication service health check
    this.componentCheckers.set('auth', async () => {
      const startTime = Date.now();
      try {
        const { data, error } = await supabase.auth.getSession();
        const responseTime = Date.now() - startTime;

        if (error) {
          throw error;
        }

        return {
          name: 'auth',
          status: 'healthy',
          lastCheck: new Date(),
          responseTime,
          errorCount: 0
        };
      } catch (error) {
        return {
          name: 'auth',
          status: 'critical',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          errorCount: this.incrementErrorCount('auth'),
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Real-time subscriptions health check
    this.componentCheckers.set('realtime', async () => {
      const startTime = Date.now();
      try {
        // Check if realtime is connected
        const channels = supabase.getChannels();
        const responseTime = Date.now() - startTime;

        return {
          name: 'realtime',
          status: channels.length > 0 ? 'healthy' : 'degraded',
          lastCheck: new Date(),
          responseTime,
          errorCount: 0,
          details: `Active channels: ${channels.length}`
        };
      } catch (error) {
        return {
          name: 'realtime',
          status: 'critical',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          errorCount: this.incrementErrorCount('realtime'),
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Memory usage check
    this.componentCheckers.set('memory', async () => {
      try {
        const memoryInfo = (performance as any).memory;
        const memoryUsage = memoryInfo ? 
          memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit : 0;

        return {
          name: 'memory',
          status: memoryUsage > 0.8 ? 'critical' : memoryUsage > 0.6 ? 'degraded' : 'healthy',
          lastCheck: new Date(),
          errorCount: 0,
          details: `Memory usage: ${(memoryUsage * 100).toFixed(1)}%`
        };
      } catch (error) {
        return {
          name: 'memory',
          status: 'unknown',
          lastCheck: new Date(),
          errorCount: this.incrementErrorCount('memory'),
          details: 'Memory API not available'
        };
      }
    });
  }

  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        // Store performance entries for analysis
        entries.forEach(entry => {
          if (entry.entryType === 'navigation') {
            // Track page load performance
          } else if (entry.entryType === 'measure') {
            // Track custom measurements
          }
        });
      });

      try {
        this.performanceObserver.observe({ 
          entryTypes: ['navigation', 'measure', 'paint'] 
        });
      } catch (error) {
        console.warn('Performance observer not fully supported:', error);
      }
    }
  }

  private incrementErrorCount(component: string): number {
    const current = this.errorCounts.get(component) || 0;
    const newCount = current + 1;
    this.errorCounts.set(component, newCount);
    return newCount;
  }

  public addComponentChecker(name: string, checker: () => Promise<ComponentHealth>): void {
    this.componentCheckers.set(name, checker);
  }

  public removeComponentChecker(name: string): void {
    this.componentCheckers.delete(name);
  }

  public async performHealthCheck(): Promise<HealthMetrics> {
    const componentHealthPromises = Array.from(this.componentCheckers.entries()).map(
      async ([name, checker]) => {
        try {
          return await Promise.race([
            checker(),
            new Promise<ComponentHealth>((_, reject) => 
              setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
            )
          ]);
        } catch (error) {
          return {
            name,
            status: 'critical' as const,
            lastCheck: new Date(),
            errorCount: this.incrementErrorCount(name),
            details: error instanceof Error ? error.message : 'Health check failed'
          };
        }
      }
    );

    const componentHealth = await Promise.all(componentHealthPromises);
    const performanceMetrics = this.collectPerformanceMetrics();
    const errorRates = this.calculateErrorRates();

    const systemStatus = this.determineSystemStatus(componentHealth, errorRates);

    const metrics: HealthMetrics = {
      timestamp: new Date(),
      componentHealth,
      performanceMetrics,
      errorRates,
      systemStatus
    };

    this.metrics.push(metrics);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(metrics));

    // Check for alerts
    this.checkAlerts(metrics);

    return metrics;
  }

  private collectPerformanceMetrics(): PerformanceMetrics {
    const memoryInfo = (performance as any).memory;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    return {
      memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit : 0,
      cpuUsage: 0, // Not directly available in browser
      networkLatency: navigation ? navigation.responseEnd - navigation.requestStart : 0,
      renderTime: navigation ? navigation.loadEventEnd - navigation.responseEnd : 0,
      apiResponseTime: this.getAverageApiResponseTime(),
      cacheHitRate: this.getCacheHitRate()
    };
  }

  private getAverageApiResponseTime(): number {
    // Calculate from recent component health checks
    const recentChecks = this.metrics.slice(-10);
    if (recentChecks.length === 0) return 0;

    const totalResponseTime = recentChecks.reduce((sum, metrics) => {
      return sum + metrics.componentHealth.reduce((componentSum, component) => {
        return componentSum + (component.responseTime || 0);
      }, 0);
    }, 0);

    const totalChecks = recentChecks.reduce((sum, metrics) => {
      return sum + metrics.componentHealth.length;
    }, 0);

    return totalChecks > 0 ? totalResponseTime / totalChecks : 0;
  }

  private getCacheHitRate(): number {
    // This would be implemented based on your caching strategy
    // For now, return a placeholder
    return 0.85; // 85% cache hit rate
  }

  private calculateErrorRates(): ErrorRates {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > oneHourAgo);
    
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const criticalErrors = recentMetrics.reduce((sum, metrics) => {
      return sum + metrics.componentHealth.filter(c => c.status === 'critical').length;
    }, 0);

    const byType: Record<string, number> = {};
    const byComponent: Record<string, number> = {};

    this.errorCounts.forEach((count, component) => {
      byComponent[component] = count;
      byType['component_error'] = (byType['component_error'] || 0) + count;
    });

    return {
      total: totalErrors,
      byType,
      byComponent,
      criticalErrors,
      lastHour: recentMetrics.length
    };
  }

  private determineSystemStatus(
    componentHealth: ComponentHealth[], 
    errorRates: ErrorRates
  ): 'healthy' | 'degraded' | 'critical' {
    const criticalComponents = componentHealth.filter(c => c.status === 'critical');
    const degradedComponents = componentHealth.filter(c => c.status === 'degraded');

    if (criticalComponents.length > 0) {
      return 'critical';
    }

    if (degradedComponents.length > componentHealth.length * 0.3 || 
        errorRates.criticalErrors > 5) {
      return 'degraded';
    }

    return 'healthy';
  }

  private checkAlerts(metrics: HealthMetrics): void {
    const { alertThresholds } = this.config;

    // Check error rate threshold
    if (metrics.errorRates.lastHour > alertThresholds.errorRate * 100) {
      this.triggerAlert('high_error_rate', `Error rate exceeded threshold: ${metrics.errorRates.lastHour}%`);
    }

    // Check response time threshold
    if (metrics.performanceMetrics.apiResponseTime > alertThresholds.responseTime) {
      this.triggerAlert('slow_response', `API response time exceeded threshold: ${metrics.performanceMetrics.apiResponseTime}ms`);
    }

    // Check memory usage threshold
    if (metrics.performanceMetrics.memoryUsage > alertThresholds.memoryUsage) {
      this.triggerAlert('high_memory', `Memory usage exceeded threshold: ${(metrics.performanceMetrics.memoryUsage * 100).toFixed(1)}%`);
    }

    // Check system status
    if (metrics.systemStatus === 'critical') {
      this.triggerAlert('system_critical', 'System status is critical');
    }
  }

  private triggerAlert(type: string, message: string): void {
    console.warn(`[HEALTH ALERT] ${type}: ${message}`);
    
    // In a real implementation, you might want to:
    // - Send notifications to administrators
    // - Log to external monitoring service
    // - Trigger automated recovery procedures
    
    // Dispatch custom event for UI components to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('health-alert', {
        detail: { type, message, timestamp: new Date() }
      }));
    }
  }

  public startMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    // Perform initial health check
    this.performHealthCheck();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);
  }

  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }

  public onHealthUpdate(listener: (metrics: HealthMetrics) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getLatestMetrics(): HealthMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(count: number = 10): HealthMetrics[] {
    return this.metrics.slice(-count);
  }

  public getComponentStatus(componentName: string): ComponentHealth | null {
    const latest = this.getLatestMetrics();
    return latest?.componentHealth.find(c => c.name === componentName) || null;
  }

  public resetErrorCounts(): void {
    this.errorCounts.clear();
  }

  public updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
export const applicationHealthMonitor = new ApplicationHealthMonitor();