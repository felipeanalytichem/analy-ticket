import { supabase } from '@/lib/supabase';

export interface SessionAnalytics {
  totalSessions: number;
  averageSessionDuration: number;
  sessionExpirationRate: number;
  tokenRefreshSuccessRate: number;
  connectionIssueFrequency: number;
  offlineModeUsage: number;
  errorRecoverySuccessRate: number;
}

export interface ConnectionAnalytics {
  averageLatency: number;
  connectionDropRate: number;
  reconnectionSuccessRate: number;
  offlineDuration: number;
  syncFailureRate: number;
}

export interface UserBehaviorAnalytics {
  mostVisitedPages: Array<{ page: string; visits: number }>;
  commonUserActions: Array<{ action: string; count: number }>;
  sessionExtensionRate: number;
  manualSyncUsage: number;
  errorRecoveryAttempts: number;
}

export interface SystemPerformanceAnalytics {
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  backgroundSyncEfficiency: number;
  memoryUsage: number;
}

class LogAggregationService {
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private cache = new Map<string, { data: any; timestamp: number }>();

  public async getSessionAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<SessionAnalytics> {
    const cacheKey = `session-analytics-${startDate.getTime()}-${endDate.getTime()}-${userId || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const { data: events, error } = await supabase
        .from('session_analytics_events')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .eq(userId ? 'user_id' : 'id', userId || 'id');

      if (error) throw error;

      const analytics = this.calculateSessionAnalytics(events || []);
      this.setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to get session analytics:', error);
      throw error;
    }
  }

  public async getConnectionAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ConnectionAnalytics> {
    const cacheKey = `connection-analytics-${startDate.getTime()}-${endDate.getTime()}-${userId || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const [eventsResult, metricsResult] = await Promise.all([
        supabase
          .from('session_analytics_events')
          .select('*')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .in('event_type', ['connection_lost', 'connection_restored', 'offline_mode'])
          .eq(userId ? 'user_id' : 'id', userId || 'id'),
        supabase
          .from('session_performance_metrics')
          .select('*')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .in('metric_type', ['connection_latency', 'offline_duration', 'sync_time'])
          .eq(userId ? 'user_id' : 'id', userId || 'id')
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (metricsResult.error) throw metricsResult.error;

      const analytics = this.calculateConnectionAnalytics(
        eventsResult.data || [],
        metricsResult.data || []
      );
      this.setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to get connection analytics:', error);
      throw error;
    }
  }

  public async getUserBehaviorAnalytics(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<UserBehaviorAnalytics> {
    const cacheKey = `behavior-analytics-${startDate.getTime()}-${endDate.getTime()}-${userId || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const { data: behaviors, error } = await supabase
        .from('user_behavior_analytics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .eq(userId ? 'user_id' : 'id', userId || 'id');

      if (error) throw error;

      const analytics = this.calculateUserBehaviorAnalytics(behaviors || []);
      this.setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to get user behavior analytics:', error);
      throw error;
    }
  }

  public async getSystemPerformanceAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<SystemPerformanceAnalytics> {
    const cacheKey = `performance-analytics-${startDate.getTime()}-${endDate.getTime()}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const { data: metrics, error } = await supabase
        .from('session_performance_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (error) throw error;

      const analytics = this.calculateSystemPerformanceAnalytics(metrics || []);
      this.setCachedData(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Failed to get system performance analytics:', error);
      throw error;
    }
  }

  public async generateAnalyticsReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<{
    session: SessionAnalytics;
    connection: ConnectionAnalytics;
    behavior: UserBehaviorAnalytics;
    performance: SystemPerformanceAnalytics;
    summary: {
      totalEvents: number;
      totalUsers: number;
      reportPeriod: string;
      generatedAt: Date;
    };
  }> {
    try {
      const [session, connection, behavior, performance] = await Promise.all([
        this.getSessionAnalytics(startDate, endDate, userId),
        this.getConnectionAnalytics(startDate, endDate, userId),
        this.getUserBehaviorAnalytics(startDate, endDate, userId),
        this.getSystemPerformanceAnalytics(startDate, endDate)
      ]);

      // Get summary statistics
      const { data: eventCount } = await supabase
        .from('session_analytics_events')
        .select('id', { count: 'exact' })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      const { data: userCount } = await supabase
        .from('session_analytics_events')
        .select('user_id')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .not('user_id', 'is', null);

      const uniqueUsers = new Set(userCount?.map(u => u.user_id) || []).size;

      return {
        session,
        connection,
        behavior,
        performance,
        summary: {
          totalEvents: eventCount?.length || 0,
          totalUsers: uniqueUsers,
          reportPeriod: `${startDate.toISOString()} to ${endDate.toISOString()}`,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Failed to generate analytics report:', error);
      throw error;
    }
  }

  private calculateSessionAnalytics(events: any[]): SessionAnalytics {
    const sessionStarts = events.filter(e => e.event_type === 'session_start');
    const sessionEnds = events.filter(e => e.event_type === 'session_end');
    const sessionExpired = events.filter(e => e.event_type === 'session_expired');
    const tokenRefreshes = events.filter(e => e.event_type === 'token_refresh');
    const connectionLost = events.filter(e => e.event_type === 'connection_lost');
    const offlineMode = events.filter(e => e.event_type === 'offline_mode');
    const errorOccurred = events.filter(e => e.event_type === 'error_occurred');

    // Calculate session durations
    const sessionDurations: number[] = [];
    sessionStarts.forEach(start => {
      const end = sessionEnds.find(e => e.session_id === start.session_id);
      if (end) {
        const duration = new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime();
        sessionDurations.push(duration);
      }
    });

    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 0;

    // Calculate success rates
    const totalSessions = sessionStarts.length;
    const sessionExpirationRate = totalSessions > 0 ? (sessionExpired.length / totalSessions) * 100 : 0;
    
    const tokenRefreshAttempts = tokenRefreshes.length;
    const tokenRefreshFailures = tokenRefreshes.filter(t => t.metadata?.success === false).length;
    const tokenRefreshSuccessRate = tokenRefreshAttempts > 0 
      ? ((tokenRefreshAttempts - tokenRefreshFailures) / tokenRefreshAttempts) * 100 
      : 100;

    const connectionIssueFrequency = totalSessions > 0 ? (connectionLost.length / totalSessions) * 100 : 0;
    const offlineModeUsage = totalSessions > 0 ? (offlineMode.length / totalSessions) * 100 : 0;

    const errorRecoveryAttempts = errorOccurred.length;
    const errorRecoverySuccesses = errorOccurred.filter(e => e.metadata?.recovered === true).length;
    const errorRecoverySuccessRate = errorRecoveryAttempts > 0 
      ? (errorRecoverySuccesses / errorRecoveryAttempts) * 100 
      : 100;

    return {
      totalSessions,
      averageSessionDuration: Math.round(averageSessionDuration / 1000 / 60), // Convert to minutes
      sessionExpirationRate: Math.round(sessionExpirationRate * 100) / 100,
      tokenRefreshSuccessRate: Math.round(tokenRefreshSuccessRate * 100) / 100,
      connectionIssueFrequency: Math.round(connectionIssueFrequency * 100) / 100,
      offlineModeUsage: Math.round(offlineModeUsage * 100) / 100,
      errorRecoverySuccessRate: Math.round(errorRecoverySuccessRate * 100) / 100
    };
  }

  private calculateConnectionAnalytics(events: any[], metrics: any[]): ConnectionAnalytics {
    const connectionLost = events.filter(e => e.event_type === 'connection_lost');
    const connectionRestored = events.filter(e => e.event_type === 'connection_restored');
    const latencyMetrics = metrics.filter(m => m.metric_type === 'connection_latency');
    const offlineDurationMetrics = metrics.filter(m => m.metric_type === 'offline_duration');
    const syncTimeMetrics = metrics.filter(m => m.metric_type === 'sync_time');

    const averageLatency = latencyMetrics.length > 0
      ? latencyMetrics.reduce((sum, m) => sum + m.value, 0) / latencyMetrics.length
      : 0;

    const totalConnectionAttempts = connectionLost.length;
    const successfulReconnections = connectionRestored.length;
    const connectionDropRate = totalConnectionAttempts > 0 ? (totalConnectionAttempts / (totalConnectionAttempts + successfulReconnections)) * 100 : 0;
    const reconnectionSuccessRate = totalConnectionAttempts > 0 ? (successfulReconnections / totalConnectionAttempts) * 100 : 100;

    const totalOfflineDuration = offlineDurationMetrics.reduce((sum, m) => sum + m.value, 0);
    const syncFailures = syncTimeMetrics.filter(m => m.metadata?.success === false).length;
    const syncFailureRate = syncTimeMetrics.length > 0 ? (syncFailures / syncTimeMetrics.length) * 100 : 0;

    return {
      averageLatency: Math.round(averageLatency),
      connectionDropRate: Math.round(connectionDropRate * 100) / 100,
      reconnectionSuccessRate: Math.round(reconnectionSuccessRate * 100) / 100,
      offlineDuration: Math.round(totalOfflineDuration / 1000 / 60), // Convert to minutes
      syncFailureRate: Math.round(syncFailureRate * 100) / 100
    };
  }

  private calculateUserBehaviorAnalytics(behaviors: any[]): UserBehaviorAnalytics {
    // Most visited pages
    const pageVisits = behaviors.reduce((acc, b) => {
      if (b.page) {
        acc[b.page] = (acc[b.page] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const mostVisitedPages = Object.entries(pageVisits)
      .map(([page, visits]) => ({ page, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    // Common user actions
    const actionCounts = behaviors.reduce((acc, b) => {
      if (b.event_type) {
        acc[b.event_type] = (acc[b.event_type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const commonUserActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate rates
    const sessionExtensions = behaviors.filter(b => b.event_type === 'session_extension').length;
    const totalSessions = new Set(behaviors.map(b => b.session_id)).size;
    const sessionExtensionRate = totalSessions > 0 ? (sessionExtensions / totalSessions) * 100 : 0;

    const manualSyncs = behaviors.filter(b => b.event_type === 'manual_sync').length;
    const manualSyncUsage = totalSessions > 0 ? (manualSyncs / totalSessions) * 100 : 0;

    const errorRecoveryAttempts = behaviors.filter(b => b.event_type === 'error_recovery_attempt').length;

    return {
      mostVisitedPages,
      commonUserActions,
      sessionExtensionRate: Math.round(sessionExtensionRate * 100) / 100,
      manualSyncUsage: Math.round(manualSyncUsage * 100) / 100,
      errorRecoveryAttempts
    };
  }

  private calculateSystemPerformanceAnalytics(metrics: any[]): SystemPerformanceAnalytics {
    const responseTimes = metrics.filter(m => m.metric_type === 'session_duration');
    const errorCounts = metrics.filter(m => m.metadata?.error === true);
    const cacheHits = metrics.filter(m => m.metadata?.cache_hit === true);
    const syncTimes = metrics.filter(m => m.metric_type === 'sync_time');

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, m) => sum + m.value, 0) / responseTimes.length
      : 0;

    const errorRate = metrics.length > 0 ? (errorCounts.length / metrics.length) * 100 : 0;
    const cacheHitRate = metrics.length > 0 ? (cacheHits.length / metrics.length) * 100 : 0;

    const successfulSyncs = syncTimes.filter(m => m.metadata?.success !== false).length;
    const backgroundSyncEfficiency = syncTimes.length > 0 ? (successfulSyncs / syncTimes.length) * 100 : 100;

    // Estimate memory usage from metadata
    const memoryUsageMetrics = metrics.filter(m => m.metadata?.memoryUsage);
    const memoryUsage = memoryUsageMetrics.length > 0
      ? memoryUsageMetrics.reduce((sum, m) => sum + (m.metadata.memoryUsage || 0), 0) / memoryUsageMetrics.length
      : 0;

    return {
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      backgroundSyncEfficiency: Math.round(backgroundSyncEfficiency * 100) / 100,
      memoryUsage: Math.round(memoryUsage)
    };
  }

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const logAggregationService = new LogAggregationService();