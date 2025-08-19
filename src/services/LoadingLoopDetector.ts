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
    // Do not automatically start monitoring to prevent infinite loops
    // Monitoring must be explicitly started via startMonitoring()
    console.log('🔍 LoadingLoopDetector: Initialized (monitoring disabled by default)');
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
    // DISABLED: Console interception was causing feedback loops
    // when the LoadingLoopDetector itself logs messages
    console.log('⚠️ Console interception disabled to prevent infinite feedback loops');
    return;
  }

  private setupFetchInterception(): void {
    // DISABLED: Fetch interception was causing performance issues and potential loops
    console.log('⚠️ Fetch interception disabled to prevent infinite loops');
    return;
  }

  private setupAuthStateMonitoring(): void {
    // DISABLED: Auth state monitoring was triggering during normal auth flows
    console.log('⚠️ Auth state monitoring disabled to prevent interference with normal auth flows');
    return;
  }

  private setupPerformanceMonitoring(): void {
    // DISABLED: Performance monitoring was causing additional overhead
    console.log('⚠️ Performance monitoring disabled to reduce overhead');
    return;
  }

  private setupReactDevToolsMonitoring(): void {
    // DISABLED: React monitoring was interfering with normal React operations
    console.log('⚠️ React DevTools monitoring disabled to prevent interference');
    return;
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
    // DISABLED: This monkey-patching was causing _acquireLock errors
    // by interfering with Supabase's internal auth methods
    console.log('⚠️ Session validation loop detection disabled to prevent _acquireLock errors');
    
    // Alternative: Monitor through event listeners instead of monkey-patching
    let validationCount = 0;
    
    // Listen to auth state changes instead of patching methods
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        validationCount++;
        
        if (validationCount > 10) {
          this.detectPattern('session-validation-loop', {
            name: 'Session Validation Loop',
            description: `Excessive session validation events: ${validationCount}`,
            severity: 'medium', // Reduced severity since we're not interfering
            pattern: `auth event: ${event}`,
            recommendations: [
              'Check session validation logic',
              'Review session management flow'
            ]
          });
        }
      }
    });

    // Reset counter every minute
    setInterval(() => {
      validationCount = 0;
    }, 60000);
  }

  private detectInfiniteRenderLoops(): void {
    // COMPLETELY DISABLED: DOM mutation monitoring was causing infinite feedback loops
    console.log('⚠️ DOM mutation monitoring completely disabled to prevent infinite loops');
    
    // No DOM monitoring to prevent infinite loops
    // This method is now a no-op to prevent performance issues
    return;
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