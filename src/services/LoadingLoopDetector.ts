import { supabase } from '@/lib/supabase';

export interface LoadingLoopPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionCount: number;
  firstDetected: Date;
  lastDetected: Date;
  pattern: string;
  stackTrace?: string;
  recommendations: string[];
}

export interface LoadingLoopReport {
  isLoopDetected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  patterns: LoadingLoopPattern[];
  summary: string;
  recommendations: string[];
  timestamp: Date;
}

export class LoadingLoopDetector {
  private patterns: Map<string, LoadingLoopPattern> = new Map();
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private authCallCount = 0;
  private sessionCheckCount = 0;
  private renderCount = 0;
  private apiCallCount = 0;
  private errorCount = 0;
  
  // Thresholds for detection
  private readonly THRESHOLDS = {
    AUTH_CALLS_PER_MINUTE: 10,
    SESSION_CHECKS_PER_MINUTE: 20,
    API_CALLS_PER_MINUTE: 50,
    RENDERS_PER_MINUTE: 100,
    ERRORS_PER_MINUTE: 5
  };

  constructor() {
    this.setupMonitoring();
  }

  /**
   * Start monitoring for loading loops
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    console.log('🔍 LoadingLoopDetector: Starting monitoring...');
    this.isMonitoring = true;
    
    this.setupConsoleInterception();
    this.setupFetchInterception();
    this.setupAuthStateMonitoring();
    this.setupPerformanceMonitoring();
    this.setupReactDevToolsMonitoring();

    // Reset counters every minute
    this.monitoringInterval = setInterval(() => {
      this.analyzePatterns();
      this.resetCounters();
    }, 60000); // 1 minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('🔍 LoadingLoopDetector: Stopping monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current loading loop report
   */
  getReport(): LoadingLoopReport {
    const patterns = Array.from(this.patterns.values());
    const criticalPatterns = patterns.filter(p => p.severity === 'critical');
    const highPatterns = patterns.filter(p => p.severity === 'high');
    const mediumPatterns = patterns.filter(p => p.severity === 'medium');

    let severity: LoadingLoopReport['severity'] = 'none';
    let isLoopDetected = false;
    let summary = 'No loading loops detected';
    const recommendations: string[] = [];

    if (criticalPatterns.length > 0) {
      severity = 'critical';
      isLoopDetected = true;
      summary = `Critical loading loop detected: ${criticalPatterns.length} critical patterns`;
      recommendations.push(
        'Refresh the page immediately',
        'Clear browser cache and cookies',
        'Check browser console for detailed errors',
        'Consider logging out and back in'
      );
    } else if (highPatterns.length > 0) {
      severity = 'high';
      isLoopDetected = true;
      summary = `High-risk loading patterns detected: ${highPatterns.length} patterns`;
      recommendations.push(
        'Monitor the situation closely',
        'Refresh the page if performance degrades',
        'Check network connectivity'
      );
    } else if (mediumPatterns.length > 0) {
      severity = 'medium';
      summary = `Moderate loading activity detected: ${mediumPatterns.length} patterns`;
      recommendations.push(
        'Monitor system performance',
        'Check for any unusual behavior'
      );
    }

    return {
      isLoopDetected,
      severity,
      patterns,
      summary,
      recommendations,
      timestamp: new Date()
    };
  }

  /**
   * Force analyze current state
   */
  analyzeNow(): LoadingLoopReport {
    this.analyzePatterns();
    return this.getReport();
  }

  /**
   * Setup monitoring methods
   */
  private setupMonitoring(): void {
    // Monitor for specific loading loop indicators
    this.detectAuthenticationLoops();
    this.detectSessionValidationLoops();
    this.detectInfiniteRenderLoops();
    this.detectApiRequestLoops();
    this.detectMemoryLeaks();
  }

  private setupConsoleInterception(): void {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Intercept console.log for auth-related messages
    console.log = (...args) => {
      const message = args.join(' ');
      
      if (message.includes('🔐') || message.includes('SessionManager') || message.includes('auth')) {
        this.authCallCount++;
        this.detectPattern('auth-console-activity', {
          name: 'Authentication Console Activity',
          description: 'High frequency of authentication-related console messages',
          severity: this.authCallCount > this.THRESHOLDS.AUTH_CALLS_PER_MINUTE ? 'critical' : 'medium',
          pattern: message,
          recommendations: [
            'Check for authentication loops',
            'Verify session management logic',
            'Clear browser storage if needed'
          ]
        });
      }

      if (message.includes('Session') || message.includes('session')) {
        this.sessionCheckCount++;
      }

      originalLog.apply(console, args);
    };

    // Intercept console.error for error patterns
    console.error = (...args) => {
      const message = args.join(' ');
      this.errorCount++;

      if (message.includes('JWT') || message.includes('token') || message.includes('auth')) {
        this.detectPattern('auth-error-loop', {
          name: 'Authentication Error Loop',
          description: 'Repeated authentication errors detected',
          severity: 'critical',
          pattern: message,
          recommendations: [
            'Clear authentication tokens',
            'Log out and log back in',
            'Check token refresh logic'
          ]
        });
      }

      if (message.includes('PGRST301') || message.includes('database')) {
        this.detectPattern('database-error-loop', {
          name: 'Database Error Loop',
          description: 'Repeated database connection errors',
          severity: 'high',
          pattern: message,
          recommendations: [
            'Check database connectivity',
            'Verify authentication status',
            'Refresh the page'
          ]
        });
      }

      originalError.apply(console, args);
    };

    // Intercept console.warn for warning patterns
    console.warn = (...args) => {
      const message = args.join(' ');
      
      if (message.includes('session') || message.includes('token')) {
        this.detectPattern('session-warning-pattern', {
          name: 'Session Warning Pattern',
          description: 'Repeated session-related warnings',
          severity: 'medium',
          pattern: message,
          recommendations: [
            'Monitor session health',
            'Check session timeout settings'
          ]
        });
      }

      originalWarn.apply(console, args);
    };
  }

  private setupFetchInterception(): void {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      this.apiCallCount++;
      
      const url = args[0]?.toString() || '';
      
      // Detect excessive API calls
      if (this.apiCallCount > this.THRESHOLDS.API_CALLS_PER_MINUTE) {
        this.detectPattern('excessive-api-calls', {
          name: 'Excessive API Calls',
          description: `High frequency of API calls detected: ${this.apiCallCount} calls per minute`,
          severity: 'high',
          pattern: `API call to: ${url}`,
          recommendations: [
            'Check for API request loops',
            'Verify request caching',
            'Monitor network tab in browser'
          ]
        });
      }

      // Detect auth-related API loops
      if (url.includes('auth') || url.includes('session') || url.includes('token')) {
        this.authCallCount++;
        
        if (this.authCallCount > this.THRESHOLDS.AUTH_CALLS_PER_MINUTE) {
          this.detectPattern('auth-api-loop', {
            name: 'Authentication API Loop',
            description: 'Excessive authentication API calls detected',
            severity: 'critical',
            pattern: `Auth API call: ${url}`,
            recommendations: [
              'Check authentication flow logic',
              'Verify token refresh implementation',
              'Clear browser storage'
            ]
          });
        }
      }

      try {
        const response = await originalFetch.apply(window, args);
        
        // Check for repeated 401 errors (auth loops)
        if (response.status === 401) {
          this.detectPattern('repeated-401-errors', {
            name: 'Repeated 401 Errors',
            description: 'Multiple authentication failures detected',
            severity: 'critical',
            pattern: `401 error on: ${url}`,
            recommendations: [
              'Clear authentication tokens',
              'Log out and log back in',
              'Check server authentication status'
            ]
          });
        }

        return response;
      } catch (error) {
        this.errorCount++;
        throw error;
      }
    };
  }

  private setupAuthStateMonitoring(): void {
    let authStateChangeCount = 0;
    
    supabase.auth.onAuthStateChange((event, session) => {
      authStateChangeCount++;
      
      console.log(`🔍 Auth state change: ${event} (count: ${authStateChangeCount})`);
      
      if (authStateChangeCount > 10) {
        this.detectPattern('auth-state-loop', {
          name: 'Authentication State Loop',
          description: `Excessive auth state changes: ${authStateChangeCount} changes`,
          severity: 'critical',
          pattern: `Auth event: ${event}`,
          recommendations: [
            'Check auth state management logic',
            'Verify session initialization',
            'Clear browser storage and refresh'
          ]
        });
      }

      // Reset counter every 2 minutes
      setTimeout(() => {
        authStateChangeCount = Math.max(0, authStateChangeCount - 1);
      }, 120000);
    });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor memory usage growth
    setInterval(() => {
      // @ts-ignore
      const memory = performance.memory;
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const usagePercent = (usedMB / limitMB) * 100;
        
        if (usagePercent > 90) {
          this.detectPattern('memory-leak', {
            name: 'Memory Leak Detection',
            description: `High memory usage: ${usagePercent.toFixed(1)}%`,
            severity: 'critical',
            pattern: `Memory usage: ${usedMB}MB / ${limitMB}MB`,
            recommendations: [
              'Refresh the page to free memory',
              'Close other browser tabs',
              'Check for memory leaks in console'
            ]
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private setupReactDevToolsMonitoring(): void {
    // Monitor for excessive re-renders (simplified)
    let renderCount = 0;
    
    // This is a simplified approach - in a real implementation,
    // you'd use React DevTools Profiler API
    const originalSetState = React.Component.prototype.setState;
    
    if (originalSetState) {
      React.Component.prototype.setState = function(...args) {
        renderCount++;
        
        if (renderCount > this.THRESHOLDS.RENDERS_PER_MINUTE) {
          this.detectPattern('excessive-renders', {
            name: 'Excessive Re-renders',
            description: `High frequency of component re-renders: ${renderCount}`,
            severity: 'high',
            pattern: 'Component re-render',
            recommendations: [
              'Check for unnecessary state updates',
              'Verify useEffect dependencies',
              'Use React DevTools Profiler'
            ]
          });
        }
        
        return originalSetState.apply(this, args);
      };
    }

    // Reset render count every minute
    setInterval(() => {
      renderCount = 0;
    }, 60000);
  }

  /**
   * Specific loop detection methods
   */
  private detectAuthenticationLoops(): void {
    // Monitor localStorage for rapid auth token changes
    let lastAuthToken = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
    let tokenChangeCount = 0;
    
    setInterval(() => {
      const currentAuthToken = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
      
      if (currentAuthToken !== lastAuthToken) {
        tokenChangeCount++;
        lastAuthToken = currentAuthToken;
        
        if (tokenChangeCount > 5) {
          this.detectPattern('rapid-token-changes', {
            name: 'Rapid Token Changes',
            description: `Authentication token changing rapidly: ${tokenChangeCount} changes`,
            severity: 'critical',
            pattern: 'Token change detected',
            recommendations: [
              'Check token refresh logic',
              'Clear browser storage',
              'Log out and log back in'
            ]
          });
        }
      }
      
      // Reset counter every 2 minutes
      if (tokenChangeCount > 0) {
        setTimeout(() => {
          tokenChangeCount = Math.max(0, tokenChangeCount - 1);
        }, 120000);
      }
    }, 5000); // Check every 5 seconds
  }

  private detectSessionValidationLoops(): void {
    let validationCount = 0;
    const originalGetSession = supabase.auth.getSession;
    
    supabase.auth.getSession = async function() {
      validationCount++;
      
      if (validationCount > 20) {
        this.detectPattern('session-validation-loop', {
          name: 'Session Validation Loop',
          description: `Excessive session validation calls: ${validationCount}`,
          severity: 'critical',
          pattern: 'getSession() call',
          recommendations: [
            'Check session validation logic',
            'Verify session caching',
            'Review session management flow'
          ]
        });
      }
      
      return originalGetSession.apply(this);
    }.bind(this);

    // Reset counter every minute
    setInterval(() => {
      validationCount = 0;
    }, 60000);
  }

  private detectInfiniteRenderLoops(): void {
    // Monitor for rapid DOM changes
    let domChangeCount = 0;
    
    const observer = new MutationObserver((mutations) => {
      domChangeCount += mutations.length;
      
      if (domChangeCount > 1000) {
        this.detectPattern('infinite-render-loop', {
          name: 'Infinite Render Loop',
          description: `Excessive DOM changes detected: ${domChangeCount}`,
          severity: 'critical',
          pattern: 'DOM mutation',
          recommendations: [
            'Check for infinite re-render loops',
            'Verify useEffect dependencies',
            'Use React DevTools to identify problematic components'
          ]
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Reset counter every minute
    setInterval(() => {
      domChangeCount = 0;
    }, 60000);
  }

  private detectApiRequestLoops(): void {
    const requestCounts = new Map<string, number>();
    
    // This is handled in setupFetchInterception, but we can add more specific detection here
    setInterval(() => {
      for (const [url, count] of requestCounts.entries()) {
        if (count > 10) {
          this.detectPattern('api-request-loop', {
            name: 'API Request Loop',
            description: `Repeated requests to same endpoint: ${count} requests to ${url}`,
            severity: 'high',
            pattern: `API: ${url}`,
            recommendations: [
              'Check request caching logic',
              'Verify API call conditions',
              'Review network tab in browser'
            ]
          });
        }
      }
      requestCounts.clear();
    }, 60000);
  }

  private detectMemoryLeaks(): void {
    let previousMemoryUsage = 0;
    let memoryGrowthCount = 0;
    
    setInterval(() => {
      // @ts-ignore
      const memory = performance.memory;
      if (memory) {
        const currentUsage = memory.usedJSHeapSize;
        
        if (currentUsage > previousMemoryUsage * 1.1) { // 10% growth
          memoryGrowthCount++;
          
          if (memoryGrowthCount > 5) {
            this.detectPattern('memory-leak', {
              name: 'Memory Leak',
              description: `Continuous memory growth detected: ${memoryGrowthCount} consecutive increases`,
              severity: 'high',
              pattern: `Memory: ${Math.round(currentUsage / 1024 / 1024)}MB`,
              recommendations: [
                'Check for memory leaks',
                'Clear browser cache',
                'Refresh the page'
              ]
            });
          }
        } else {
          memoryGrowthCount = 0;
        }
        
        previousMemoryUsage = currentUsage;
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Pattern detection and management
   */
  private detectPattern(id: string, patternData: Omit<LoadingLoopPattern, 'id' | 'detectionCount' | 'firstDetected' | 'lastDetected'>): void {
    const existing = this.patterns.get(id);
    const now = new Date();
    
    if (existing) {
      existing.detectionCount++;
      existing.lastDetected = now;
      existing.severity = patternData.severity;
      existing.pattern = patternData.pattern;
    } else {
      this.patterns.set(id, {
        id,
        ...patternData,
        detectionCount: 1,
        firstDetected: now,
        lastDetected: now
      });
    }

    // Log critical patterns immediately
    if (patternData.severity === 'critical') {
      console.error(`🚨 Critical loading loop detected: ${patternData.name}`, patternData);
    }
  }

  private analyzePatterns(): void {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Remove old patterns
    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.lastDetected < fiveMinutesAgo) {
        this.patterns.delete(id);
      }
    }

    // Analyze current patterns for escalation
    for (const pattern of this.patterns.values()) {
      if (pattern.detectionCount > 10 && pattern.severity !== 'critical') {
        pattern.severity = 'critical';
        console.error(`🚨 Pattern escalated to critical: ${pattern.name}`);
      }
    }
  }

  private resetCounters(): void {
    this.authCallCount = 0;
    this.sessionCheckCount = 0;
    this.renderCount = 0;
    this.apiCallCount = 0;
    this.errorCount = 0;
  }

  /**
   * Utility methods
   */
  clearPatterns(): void {
    this.patterns.clear();
  }

  getPattern(id: string): LoadingLoopPattern | undefined {
    return this.patterns.get(id);
  }

  getAllPatterns(): LoadingLoopPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.patterns.clear();
  }
}

// Export singleton instance
export const loadingLoopDetector = new LoadingLoopDetector();