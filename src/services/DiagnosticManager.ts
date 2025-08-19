import { supabase } from '@/lib/supabase';

export interface DiagnosticCheck {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'session' | 'database' | 'network' | 'performance' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: () => Promise<DiagnosticResult>;
}

export interface DiagnosticResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'running';
  message: string;
  details?: any;
  timestamp: Date;
  recommendations?: string[];
}

export interface LoadingLoopIndicator {
  type: 'auth_loop' | 'session_loop' | 'render_loop' | 'api_loop' | 'memory_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  count: number;
  lastOccurrence: Date;
  pattern?: string;
}

export class DiagnosticManager {
  private checks: Map<string, DiagnosticCheck> = new Map();
  private results: Map<string, DiagnosticResult> = new Map();
  private loadingLoopIndicators: LoadingLoopIndicator[] = [];
  private monitoringActive = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeChecks();
    this.startLoadingLoopMonitoring();
  }

  /**
   * Initialize all diagnostic checks
   */
  private initializeChecks(): void {
    // Authentication checks
    this.registerCheck({
      id: 'auth-session-validity',
      name: 'Authentication Session Validity',
      description: 'Checks if the current authentication session is valid and not expired',
      category: 'auth',
      severity: 'critical',
      check: this.checkAuthSessionValidity.bind(this)
    });

    this.registerCheck({
      id: 'auth-token-refresh',
      name: 'Token Refresh Capability',
      description: 'Tests the ability to refresh authentication tokens',
      category: 'auth',
      severity: 'high',
      check: this.checkTokenRefreshCapability.bind(this)
    });

    this.registerCheck({
      id: 'auth-storage-consistency',
      name: 'Auth Storage Consistency',
      description: 'Verifies consistency between localStorage and session state',
      category: 'auth',
      severity: 'medium',
      check: this.checkAuthStorageConsistency.bind(this)
    });

    // Session checks
    this.registerCheck({
      id: 'session-recovery-state',
      name: 'Session Recovery State',
      description: 'Checks for excessive session recovery attempts',
      category: 'session',
      severity: 'high',
      check: this.checkSessionRecoveryState.bind(this)
    });



    // Database checks
    this.registerCheck({
      id: 'database-connection-health',
      name: 'Database Connection Health',
      description: 'Tests database connectivity and response times',
      category: 'database',
      severity: 'critical',
      check: this.checkDatabaseConnectionHealth.bind(this)
    });

    this.registerCheck({
      id: 'database-query-performance',
      name: 'Database Query Performance',
      description: 'Measures database query response times',
      category: 'database',
      severity: 'medium',
      check: this.checkDatabaseQueryPerformance.bind(this)
    });

    // Network checks
    this.registerCheck({
      id: 'network-connectivity',
      name: 'Network Connectivity',
      description: 'Tests general network connectivity',
      category: 'network',
      severity: 'high',
      check: this.checkNetworkConnectivity.bind(this)
    });

    // Performance checks
    this.registerCheck({
      id: 'memory-usage',
      name: 'Memory Usage',
      description: 'Monitors JavaScript heap memory usage',
      category: 'performance',
      severity: 'medium',
      check: this.checkMemoryUsage.bind(this)
    });

    this.registerCheck({
      id: 'loading-loop-detection',
      name: 'Loading Loop Detection',
      description: 'Detects potential infinite loading loops',
      category: 'system',
      severity: 'critical',
      check: this.checkLoadingLoops.bind(this)
    });

    // System checks
    this.registerCheck({
      id: 'console-error-monitoring',
      name: 'Console Error Monitoring',
      description: 'Monitors console for repeated errors',
      category: 'system',
      severity: 'medium',
      check: this.checkConsoleErrors.bind(this)
    });
  }

  /**
   * Register a new diagnostic check
   */
  registerCheck(check: DiagnosticCheck): void {
    this.checks.set(check.id, check);
  }

  /**
   * Run all diagnostic checks
   */
  async runAllChecks(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    for (const [id, check] of this.checks) {
      try {
        console.log(`🔍 Running diagnostic: ${check.name}`);
        const result = await check.check();
        this.results.set(id, result);
        results.push(result);
      } catch (error) {
        const errorResult: DiagnosticResult = {
          id,
          name: check.name,
          status: 'fail',
          message: `Diagnostic check failed: ${error}`,
          timestamp: new Date(),
          recommendations: ['Check console for detailed error information']
        };
        this.results.set(id, errorResult);
        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * Run a specific diagnostic check
   */
  async runCheck(checkId: string): Promise<DiagnosticResult | null> {
    const check = this.checks.get(checkId);
    if (!check) {
      return null;
    }

    try {
      const result = await check.check();
      this.results.set(checkId, result);
      return result;
    } catch (error) {
      const errorResult: DiagnosticResult = {
        id: checkId,
        name: check.name,
        status: 'fail',
        message: `Diagnostic check failed: ${error}`,
        timestamp: new Date()
      };
      this.results.set(checkId, errorResult);
      return errorResult;
    }
  }

  /**
   * Get loading loop indicators
   */
  getLoadingLoopIndicators(): LoadingLoopIndicator[] {
    return this.loadingLoopIndicators;
  }

  /**
   * Start monitoring for loading loops
   */
  private startLoadingLoopMonitoring(): void {
    if (this.monitoringActive) return;

    this.monitoringActive = true;
    this.setupConsoleMonitoring();
    this.setupPerformanceMonitoring();
    this.setupAuthStateMonitoring();

    // Periodic analysis
    this.monitoringInterval = setInterval(() => {
      this.analyzeLoadingPatterns();
    }, 10000); // Every 10 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.monitoringActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Individual diagnostic check implementations
   */
  private async checkAuthSessionValidity(): Promise<DiagnosticResult> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return {
          id: 'auth-session-validity',
          name: 'Authentication Session Validity',
          status: 'fail',
          message: `Session validation error: ${error.message}`,
          details: { error },
          timestamp: new Date(),
          recommendations: [
            'Try refreshing the page',
            'Clear browser cache and cookies',
            'Log out and log back in'
          ]
        };
      }

      if (!session) {
        return {
          id: 'auth-session-validity',
          name: 'Authentication Session Validity',
          status: 'fail',
          message: 'No active session found',
          timestamp: new Date(),
          recommendations: [
            'Log in to create a new session',
            'Check if cookies are enabled'
          ]
        };
      }

      const now = new Date().getTime();
      const expiresAt = new Date(session.expires_at! * 1000).getTime();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        return {
          id: 'auth-session-validity',
          name: 'Authentication Session Validity',
          status: 'fail',
          message: 'Session has expired',
          details: { expiresAt: new Date(expiresAt) },
          timestamp: new Date(),
          recommendations: [
            'Refresh the session',
            'Log out and log back in'
          ]
        };
      }

      if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
        return {
          id: 'auth-session-validity',
          name: 'Authentication Session Validity',
          status: 'warning',
          message: `Session expires in ${Math.floor(timeUntilExpiry / 60000)} minutes`,
          details: { expiresAt: new Date(expiresAt), timeUntilExpiry },
          timestamp: new Date(),
          recommendations: [
            'Session will be refreshed automatically',
            'Save any unsaved work'
          ]
        };
      }

      return {
        id: 'auth-session-validity',
        name: 'Authentication Session Validity',
        status: 'pass',
        message: `Session valid for ${Math.floor(timeUntilExpiry / 60000)} minutes`,
        details: { expiresAt: new Date(expiresAt), timeUntilExpiry },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'auth-session-validity',
        name: 'Authentication Session Validity',
        status: 'fail',
        message: `Session validity check failed: ${error}`,
        timestamp: new Date(),
        recommendations: [
          'Check network connectivity',
          'Refresh the page'
        ]
      };
    }
  }

  private async checkTokenRefreshCapability(): Promise<DiagnosticResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return {
          id: 'auth-token-refresh',
          name: 'Token Refresh Capability',
          status: 'fail',
          message: 'No session available for token refresh test',
          timestamp: new Date()
        };
      }

      if (!session.refresh_token) {
        return {
          id: 'auth-token-refresh',
          name: 'Token Refresh Capability',
          status: 'fail',
          message: 'No refresh token available',
          timestamp: new Date(),
          recommendations: [
            'Log out and log back in to get a new refresh token'
          ]
        };
      }

      // Test token refresh
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          id: 'auth-token-refresh',
          name: 'Token Refresh Capability',
          status: 'fail',
          message: `Token refresh failed: ${error.message}`,
          details: { error },
          timestamp: new Date(),
          recommendations: [
            'Log out and log back in',
            'Check if refresh token has expired'
          ]
        };
      }

      return {
        id: 'auth-token-refresh',
        name: 'Token Refresh Capability',
        status: 'pass',
        message: 'Token refresh successful',
        details: { newExpiresAt: new Date(data.session!.expires_at! * 1000) },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'auth-token-refresh',
        name: 'Token Refresh Capability',
        status: 'fail',
        message: `Token refresh test failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  private async checkAuthStorageConsistency(): Promise<DiagnosticResult> {
    try {
      const authKey = 'sb-plbmgjqitlxedsmdqpld-auth-token';
      const storedAuth = localStorage.getItem(authKey);
      const { data: { session } } = await supabase.auth.getSession();

      if (!storedAuth && !session) {
        return {
          id: 'auth-storage-consistency',
          name: 'Auth Storage Consistency',
          status: 'pass',
          message: 'No auth data in storage or session (consistent)',
          timestamp: new Date()
        };
      }

      if (!storedAuth && session) {
        return {
          id: 'auth-storage-consistency',
          name: 'Auth Storage Consistency',
          status: 'warning',
          message: 'Session exists but no stored auth data',
          timestamp: new Date(),
          recommendations: [
            'This may indicate a storage issue',
            'Try refreshing the page'
          ]
        };
      }

      if (storedAuth && !session) {
        return {
          id: 'auth-storage-consistency',
          name: 'Auth Storage Consistency',
          status: 'warning',
          message: 'Stored auth data exists but no active session',
          timestamp: new Date(),
          recommendations: [
            'Try refreshing the page',
            'Clear stored auth data if issue persists'
          ]
        };
      }

      // Both exist, check consistency
      try {
        const parsedAuth = JSON.parse(storedAuth!);
        const tokenMatch = parsedAuth.access_token === session!.access_token;
        
        if (!tokenMatch) {
          return {
            id: 'auth-storage-consistency',
            name: 'Auth Storage Consistency',
            status: 'fail',
            message: 'Stored auth data does not match active session',
            timestamp: new Date(),
            recommendations: [
              'Clear browser storage',
              'Log out and log back in'
            ]
          };
        }

        return {
          id: 'auth-storage-consistency',
          name: 'Auth Storage Consistency',
          status: 'pass',
          message: 'Auth storage and session are consistent',
          timestamp: new Date()
        };
      } catch (parseError) {
        return {
          id: 'auth-storage-consistency',
          name: 'Auth Storage Consistency',
          status: 'fail',
          message: 'Cannot parse stored auth data',
          details: { parseError },
          timestamp: new Date(),
          recommendations: [
            'Clear browser storage',
            'Refresh the page'
          ]
        };
      }
    } catch (error) {
      return {
        id: 'auth-storage-consistency',
        name: 'Auth Storage Consistency',
        status: 'fail',
        message: `Storage consistency check failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  private async checkSessionRecoveryState(): Promise<DiagnosticResult> {
    try {
      // Check for session recovery indicators in localStorage
      const recoveryKeys = Object.keys(localStorage).filter(key => 
        key.includes('session-recovery') || key.includes('recovery-state')
      );

      let totalRecoveryAttempts = 0;
      let activeRecoveries = 0;
      let lastRecoveryTime: Date | null = null;

      for (const key of recoveryKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.recoveryAttempts) {
            totalRecoveryAttempts += data.recoveryAttempts;
          }
          if (data.isRecovering) {
            activeRecoveries++;
          }
          if (data.lastRecoveryAttempt) {
            const recoveryTime = new Date(data.lastRecoveryAttempt);
            if (!lastRecoveryTime || recoveryTime > lastRecoveryTime) {
              lastRecoveryTime = recoveryTime;
            }
          }
        } catch (e) {
          // Skip invalid data
        }
      }

      if (totalRecoveryAttempts > 10) {
        return {
          id: 'session-recovery-state',
          name: 'Session Recovery State',
          status: 'fail',
          message: `Excessive recovery attempts detected: ${totalRecoveryAttempts}`,
          details: { totalRecoveryAttempts, activeRecoveries, lastRecoveryTime },
          timestamp: new Date(),
          recommendations: [
            'Clear browser storage',
            'Log out and log back in',
            'Check network connectivity'
          ]
        };
      }

      if (activeRecoveries > 0) {
        return {
          id: 'session-recovery-state',
          name: 'Session Recovery State',
          status: 'warning',
          message: `${activeRecoveries} active recovery processes`,
          details: { totalRecoveryAttempts, activeRecoveries, lastRecoveryTime },
          timestamp: new Date(),
          recommendations: [
            'Wait for recovery to complete',
            'Refresh page if recovery takes too long'
          ]
        };
      }

      return {
        id: 'session-recovery-state',
        name: 'Session Recovery State',
        status: 'pass',
        message: 'Session recovery system healthy',
        details: { totalRecoveryAttempts, activeRecoveries, lastRecoveryTime },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'session-recovery-state',
        name: 'Session Recovery State',
        status: 'fail',
        message: `Recovery state check failed: ${error}`,
        timestamp: new Date()
      };
    }
  }



  private async checkDatabaseConnectionHealth(): Promise<DiagnosticResult> {
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        return {
          id: 'database-connection-health',
          name: 'Database Connection Health',
          status: 'fail',
          message: `Database connection failed: ${error.message}`,
          details: { error, latency },
          timestamp: new Date(),
          recommendations: [
            'Check network connectivity',
            'Verify database service status',
            'Try refreshing the page'
          ]
        };
      }

      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = `Database connection healthy (${latency}ms)`;
      const recommendations: string[] = [];

      if (latency > 5000) {
        status = 'fail';
        message = `Database connection very slow (${latency}ms)`;
        recommendations.push('Check network connection', 'Contact system administrator');
      } else if (latency > 2000) {
        status = 'warning';
        message = `Database connection slow (${latency}ms)`;
        recommendations.push('Monitor connection performance');
      }

      return {
        id: 'database-connection-health',
        name: 'Database Connection Health',
        status,
        message,
        details: { latency, recordCount: data?.length || 0 },
        timestamp: new Date(),
        recommendations
      };
    } catch (error) {
      return {
        id: 'database-connection-health',
        name: 'Database Connection Health',
        status: 'fail',
        message: `Database health check failed: ${error}`,
        timestamp: new Date(),
        recommendations: [
          'Check network connectivity',
          'Refresh the page'
        ]
      };
    }
  }

  private async checkDatabaseQueryPerformance(): Promise<DiagnosticResult> {
    try {
      const queries = [
        { name: 'Users', query: () => supabase.from('users').select('id').limit(5) },
        { name: 'Tickets', query: () => supabase.from('tickets').select('id').limit(5) },
        { name: 'Categories', query: () => supabase.from('categories').select('id').limit(5) }
      ];

      const results = await Promise.allSettled(
        queries.map(async ({ name, query }) => {
          const startTime = Date.now();
          const { error } = await query();
          const latency = Date.now() - startTime;
          return { name, latency, error };
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
      const slow = successful.filter(r => r.status === 'fulfilled' && r.value.latency > 1000);

      if (failed.length > 0) {
        return {
          id: 'database-query-performance',
          name: 'Database Query Performance',
          status: 'fail',
          message: `${failed.length} queries failed`,
          details: results,
          timestamp: new Date(),
          recommendations: [
            'Check database connectivity',
            'Verify table permissions'
          ]
        };
      }

      if (slow.length > 0) {
        return {
          id: 'database-query-performance',
          name: 'Database Query Performance',
          status: 'warning',
          message: `${slow.length} queries are slow`,
          details: results,
          timestamp: new Date(),
          recommendations: [
            'Monitor database performance',
            'Check network conditions'
          ]
        };
      }

      const avgLatency = successful.reduce((sum, r) => 
        sum + (r.status === 'fulfilled' ? r.value.latency : 0), 0
      ) / successful.length;

      return {
        id: 'database-query-performance',
        name: 'Database Query Performance',
        status: 'pass',
        message: `All queries healthy (avg: ${Math.round(avgLatency)}ms)`,
        details: results,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'database-query-performance',
        name: 'Database Query Performance',
        status: 'fail',
        message: `Query performance check failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  private async checkNetworkConnectivity(): Promise<DiagnosticResult> {
    try {
      if (!navigator.onLine) {
        return {
          id: 'network-connectivity',
          name: 'Network Connectivity',
          status: 'fail',
          message: 'Browser reports offline status',
          timestamp: new Date(),
          recommendations: [
            'Check internet connection',
            'Try refreshing the page when online'
          ]
        };
      }

      // Test actual connectivity
      const startTime = Date.now();
      const response = await fetch('https://www.google.com/favicon.ico', { 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const latency = Date.now() - startTime;

      return {
        id: 'network-connectivity',
        name: 'Network Connectivity',
        status: 'pass',
        message: `Network connection active (${latency}ms)`,
        details: { latency },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'network-connectivity',
        name: 'Network Connectivity',
        status: 'fail',
        message: `Network connectivity test failed: ${error}`,
        timestamp: new Date(),
        recommendations: [
          'Check internet connection',
          'Try refreshing the page'
        ]
      };
    }
  }

  private async checkMemoryUsage(): Promise<DiagnosticResult> {
    try {
      // @ts-ignore - performance.memory is not in all browsers
      const memory = performance.memory;
      
      if (!memory) {
        return {
          id: 'memory-usage',
          name: 'Memory Usage',
          status: 'warning',
          message: 'Memory usage information not available in this browser',
          timestamp: new Date()
        };
      }

      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      
      const usagePercent = (usedMB / limitMB) * 100;
      
      let status: 'pass' | 'warning' | 'fail' = 'pass';
      let message = `Memory usage: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`;
      const recommendations: string[] = [];
      
      if (usagePercent > 90) {
        status = 'fail';
        message = `Critical memory usage: ${usagePercent.toFixed(1)}%`;
        recommendations.push(
          'Close other browser tabs',
          'Refresh the page to free memory',
          'Restart the browser if issues persist'
        );
      } else if (usagePercent > 75) {
        status = 'warning';
        message = `High memory usage: ${usagePercent.toFixed(1)}%`;
        recommendations.push(
          'Monitor memory usage',
          'Consider closing other tabs'
        );
      }

      return {
        id: 'memory-usage',
        name: 'Memory Usage',
        status,
        message,
        details: { usedMB, totalMB, limitMB, usagePercent },
        timestamp: new Date(),
        recommendations
      };
    } catch (error) {
      return {
        id: 'memory-usage',
        name: 'Memory Usage',
        status: 'fail',
        message: `Memory usage check failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  private async checkLoadingLoops(): Promise<DiagnosticResult> {
    try {
      const indicators = this.getLoadingLoopIndicators();
      const criticalIndicators = indicators.filter(i => i.severity === 'critical');
      const highIndicators = indicators.filter(i => i.severity === 'high');

      if (criticalIndicators.length > 0) {
        return {
          id: 'loading-loop-detection',
          name: 'Loading Loop Detection',
          status: 'fail',
          message: `${criticalIndicators.length} critical loading loop indicators detected`,
          details: { indicators: criticalIndicators },
          timestamp: new Date(),
          recommendations: [
            'Refresh the page immediately',
            'Clear browser cache',
            'Check console for error details'
          ]
        };
      }

      if (highIndicators.length > 0) {
        return {
          id: 'loading-loop-detection',
          name: 'Loading Loop Detection',
          status: 'warning',
          message: `${highIndicators.length} potential loading loop indicators detected`,
          details: { indicators: highIndicators },
          timestamp: new Date(),
          recommendations: [
            'Monitor the situation',
            'Refresh page if performance degrades'
          ]
        };
      }

      return {
        id: 'loading-loop-detection',
        name: 'Loading Loop Detection',
        status: 'pass',
        message: 'No loading loop indicators detected',
        details: { indicators },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'loading-loop-detection',
        name: 'Loading Loop Detection',
        status: 'fail',
        message: `Loading loop detection failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  private async checkConsoleErrors(): Promise<DiagnosticResult> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd need to intercept console.error calls
      
      const errorCount = this.loadingLoopIndicators.filter(i => 
        i.type === 'auth_loop' || i.type === 'session_loop'
      ).length;

      if (errorCount > 10) {
        return {
          id: 'console-error-monitoring',
          name: 'Console Error Monitoring',
          status: 'fail',
          message: `High error count detected: ${errorCount}`,
          timestamp: new Date(),
          recommendations: [
            'Check browser console for details',
            'Refresh the page'
          ]
        };
      }

      if (errorCount > 5) {
        return {
          id: 'console-error-monitoring',
          name: 'Console Error Monitoring',
          status: 'warning',
          message: `Moderate error count: ${errorCount}`,
          timestamp: new Date(),
          recommendations: [
            'Monitor console for recurring errors'
          ]
        };
      }

      return {
        id: 'console-error-monitoring',
        name: 'Console Error Monitoring',
        status: 'pass',
        message: 'Console error levels normal',
        timestamp: new Date()
      };
    } catch (error) {
      return {
        id: 'console-error-monitoring',
        name: 'Console Error Monitoring',
        status: 'fail',
        message: `Console error monitoring failed: ${error}`,
        timestamp: new Date()
      };
    }
  }

  /**
   * Monitoring setup methods
   */
  private setupConsoleMonitoring(): void {
    // Monitor console.error for repeated patterns
    const originalError = console.error;
    const errorCounts = new Map<string, number>();

    console.error = (...args) => {
      const message = args.join(' ');
      const count = errorCounts.get(message) || 0;
      errorCounts.set(message, count + 1);

      // Check for loading loop patterns
      if (count > 5 && (
        message.includes('auth') || 
        message.includes('session') || 
        message.includes('token') ||
        message.includes('loading')
      )) {
        this.addLoadingLoopIndicator({
          type: 'auth_loop',
          severity: 'high',
          description: `Repeated error: ${message}`,
          count: count + 1,
          lastOccurrence: new Date(),
          pattern: message
        });
      }

      originalError.apply(console, args);
    };
  }

  private setupPerformanceMonitoring(): void {
    // Monitor for excessive re-renders or API calls
    let apiCallCount = 0;
    const apiCallWindow = 5000; // 5 seconds

    setInterval(() => {
      if (apiCallCount > 20) {
        this.addLoadingLoopIndicator({
          type: 'api_loop',
          severity: 'critical',
          description: `Excessive API calls: ${apiCallCount} in ${apiCallWindow}ms`,
          count: apiCallCount,
          lastOccurrence: new Date()
        });
      }
      apiCallCount = 0;
    }, apiCallWindow);

    // Intercept fetch to count API calls
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      apiCallCount++;
      return originalFetch.apply(window, args);
    };
  }

  private setupAuthStateMonitoring(): void {
    // Monitor auth state changes for loops
    let authStateChanges = 0;
    const authWindow = 10000; // 10 seconds

    supabase.auth.onAuthStateChange((event) => {
      authStateChanges++;
      
      if (authStateChanges > 10) {
        this.addLoadingLoopIndicator({
          type: 'auth_loop',
          severity: 'critical',
          description: `Excessive auth state changes: ${authStateChanges} in ${authWindow}ms`,
          count: authStateChanges,
          lastOccurrence: new Date()
        });
      }
    });

    setInterval(() => {
      authStateChanges = 0;
    }, authWindow);
  }

  private analyzeLoadingPatterns(): void {
    // Clean up old indicators
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    this.loadingLoopIndicators = this.loadingLoopIndicators.filter(
      indicator => indicator.lastOccurrence > fiveMinutesAgo
    );
  }

  private addLoadingLoopIndicator(indicator: LoadingLoopIndicator): void {
    // Check if similar indicator already exists
    const existing = this.loadingLoopIndicators.find(
      i => i.type === indicator.type && i.pattern === indicator.pattern
    );

    if (existing) {
      existing.count = indicator.count;
      existing.lastOccurrence = indicator.lastOccurrence;
    } else {
      this.loadingLoopIndicators.push(indicator);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.results.clear();
    this.loadingLoopIndicators = [];
  }
}