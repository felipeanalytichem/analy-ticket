import { supabase } from '@/lib/supabase';

export interface SessionEvent {
  id: string;
  type: 'session_start' | 'session_end' | 'session_refresh' | 'session_warning' | 'session_expired' | 'token_refresh' | 'connection_lost' | 'connection_restored' | 'offline_mode' | 'sync_completed' | 'error_occurred';
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  tabId: string;
}

export interface PerformanceMetric {
  id: string;
  type: 'session_duration' | 'connection_latency' | 'sync_time' | 'error_recovery_time' | 'offline_duration';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'count';
  timestamp: Date;
  sessionId: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface UserBehaviorEvent {
  id: string;
  type: 'page_view' | 'form_interaction' | 'offline_action' | 'manual_sync' | 'session_extension' | 'error_recovery_attempt';
  userId?: string;
  sessionId: string;
  timestamp: Date;
  page?: string;
  action?: string;
  metadata: Record<string, any>;
}

class SessionAnalyticsLogger {
  private eventQueue: SessionEvent[] = [];
  private performanceQueue: PerformanceMetric[] = [];
  private behaviorQueue: UserBehaviorEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_QUEUE_SIZE = 100;
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeLogger();
    this.setupEventListeners();
  }

  private initializeLogger(): void {
    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flushQueues();
    }, this.FLUSH_INTERVAL);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushQueues();
    });
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.logSessionEvent('connection_restored', {
        previousState: 'offline',
        queuedEvents: this.eventQueue.length
      });
      this.flushQueues();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.logSessionEvent('connection_lost', {
        previousState: 'online'
      });
    });
  }

  public logSessionEvent(
    type: SessionEvent['type'],
    metadata: Record<string, any> = {},
    sessionId?: string
  ): void {
    const event: SessionEvent = {
      id: this.generateId(),
      type,
      userId: this.getCurrentUserId(),
      sessionId: sessionId || this.getCurrentSessionId(),
      timestamp: new Date(),
      metadata: {
        ...metadata,
        url: window.location.href,
        userAgent: navigator.userAgent
      },
      userAgent: navigator.userAgent,
      tabId: this.getTabId()
    };

    this.eventQueue.push(event);
    this.checkQueueSize();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SessionAnalytics]', type, metadata);
    }
  }

  public logPerformanceMetric(
    type: PerformanceMetric['type'],
    value: number,
    unit: PerformanceMetric['unit'],
    metadata: Record<string, any> = {}
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      type,
      value,
      unit,
      timestamp: new Date(),
      sessionId: this.getCurrentSessionId(),
      userId: this.getCurrentUserId(),
      metadata
    };

    this.performanceQueue.push(metric);
    this.checkQueueSize();
  }

  public logUserBehavior(
    type: UserBehaviorEvent['type'],
    metadata: Record<string, any> = {}
  ): void {
    const event: UserBehaviorEvent = {
      id: this.generateId(),
      type,
      userId: this.getCurrentUserId(),
      sessionId: this.getCurrentSessionId(),
      timestamp: new Date(),
      page: window.location.pathname,
      metadata
    };

    this.behaviorQueue.push(event);
    this.checkQueueSize();
  }

  public async flushQueues(): Promise<void> {
    if (!navigator.onLine) {
      return; // Don't flush when offline
    }

    try {
      await Promise.all([
        this.flushSessionEvents(),
        this.flushPerformanceMetrics(),
        this.flushUserBehavior()
      ]);
    } catch (error) {
      console.error('Failed to flush analytics queues:', error);
    }
  }

  private async flushSessionEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await supabase
        .from('session_analytics_events')
        .insert(events.map(event => ({
          id: event.id,
          event_type: event.type,
          user_id: event.userId,
          session_id: event.sessionId,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata,
          user_agent: event.userAgent,
          tab_id: event.tabId
        })));

      if (error) {
        // Re-queue events on error
        this.eventQueue.unshift(...events);
        throw error;
      }
    } catch (error) {
      console.error('Failed to flush session events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  private async flushPerformanceMetrics(): Promise<void> {
    if (this.performanceQueue.length === 0) return;

    const metrics = [...this.performanceQueue];
    this.performanceQueue = [];

    try {
      const { error } = await supabase
        .from('session_performance_metrics')
        .insert(metrics.map(metric => ({
          id: metric.id,
          metric_type: metric.type,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp.toISOString(),
          session_id: metric.sessionId,
          user_id: metric.userId,
          metadata: metric.metadata
        })));

      if (error) {
        this.performanceQueue.unshift(...metrics);
        throw error;
      }
    } catch (error) {
      console.error('Failed to flush performance metrics:', error);
      this.performanceQueue.unshift(...metrics);
    }
  }

  private async flushUserBehavior(): Promise<void> {
    if (this.behaviorQueue.length === 0) return;

    const behaviors = [...this.behaviorQueue];
    this.behaviorQueue = [];

    try {
      const { error } = await supabase
        .from('user_behavior_analytics')
        .insert(behaviors.map(behavior => ({
          id: behavior.id,
          event_type: behavior.type,
          user_id: behavior.userId,
          session_id: behavior.sessionId,
          timestamp: behavior.timestamp.toISOString(),
          page: behavior.page,
          action: behavior.action,
          metadata: behavior.metadata
        })));

      if (error) {
        this.behaviorQueue.unshift(...behaviors);
        throw error;
      }
    } catch (error) {
      console.error('Failed to flush user behavior:', error);
      this.behaviorQueue.unshift(...behaviors);
    }
  }

  private checkQueueSize(): void {
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE ||
        this.performanceQueue.length >= this.MAX_QUEUE_SIZE ||
        this.behaviorQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushQueues();
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    try {
      const session = supabase.auth.getSession();
      return session?.data?.session?.user?.id;
    } catch {
      return undefined;
    }
  }

  private getCurrentSessionId(): string {
    // Get or create session ID from sessionStorage
    let sessionId = sessionStorage.getItem('analytics-session-id');
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem('analytics-session-id', sessionId);
    }
    return sessionId;
  }

  private getTabId(): string {
    // Get or create tab ID from sessionStorage
    let tabId = sessionStorage.getItem('analytics-tab-id');
    if (!tabId) {
      tabId = this.generateId();
      sessionStorage.setItem('analytics-tab-id', tabId);
    }
    return tabId;
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushQueues();
  }
}

// Singleton instance
export const sessionAnalyticsLogger = new SessionAnalyticsLogger();