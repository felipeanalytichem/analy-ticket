import { supabase } from '@/lib/supabase';
import { NotificationService } from '@/lib/notificationService';

export interface ReconnectionOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  heartbeatInterval: number;
  syncOnReconnect: boolean;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  lastHeartbeat: Date | null;
  consecutiveFailures: number;
  lastError?: string;
}

export interface MissedNotificationSync {
  userId: string;
  lastSyncTimestamp: Date;
  missedNotifications: any[];
}

/**
 * ReconnectionManager handles automatic reconnection with exponential backoff
 * and missed notification synchronization
 */
export class ReconnectionManager {
  private static instance: ReconnectionManager;
  private reconnectionAttempts: Map<string, number> = new Map();
  private reconnectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private lastSyncTimestamps: Map<string, Date> = new Map();
  
  private defaultOptions: ReconnectionOptions = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    heartbeatInterval: 30000, // 30 seconds
    syncOnReconnect: true
  };

  private constructor() {
    // Bind methods to preserve context
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    // Listen for browser events
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  static getInstance(): ReconnectionManager {
    if (!ReconnectionManager.instance) {
      ReconnectionManager.instance = new ReconnectionManager();
    }
    return ReconnectionManager.instance;
  }

  /**
   * Start monitoring connection health for a user
   */
  startHealthMonitoring(
    userId: string, 
    reconnectCallback: () => void,
    options: Partial<ReconnectionOptions> = {}
  ): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    console.log('🔄 [ReconnectionManager] Starting health monitoring for user:', userId);
    
    // Initialize connection health
    this.connectionHealth.set(userId, {
      isHealthy: true,
      lastHeartbeat: new Date(),
      consecutiveFailures: 0
    });

    // Initialize last sync timestamp
    this.lastSyncTimestamps.set(userId, new Date());

    // Start heartbeat monitoring
    this.startHeartbeat(userId, reconnectCallback, mergedOptions);
  }

  /**
   * Stop monitoring connection health for a user
   */
  stopHealthMonitoring(userId: string): void {
    console.log('🔄 [ReconnectionManager] Stopping health monitoring for user:', userId);
    
    // Clear heartbeat
    this.stopHeartbeat(userId);
    
    // Clear reconnection timeout
    this.clearReconnectionTimeout(userId);
    
    // Clean up state
    this.connectionHealth.delete(userId);
    this.reconnectionAttempts.delete(userId);
    this.lastSyncTimestamps.delete(userId);
  }

  /**
   * Handle connection failure and start reconnection process
   */
  handleConnectionFailure(
    userId: string,
    error: string,
    reconnectCallback: () => void,
    options: Partial<ReconnectionOptions> = {}
  ): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    console.warn('🔄 [ReconnectionManager] Connection failure for user:', userId, error);
    
    // Update connection health
    const health = this.connectionHealth.get(userId);
    if (health) {
      health.isHealthy = false;
      health.consecutiveFailures += 1;
      health.lastError = error;
      this.connectionHealth.set(userId, health);
    }

    // Start reconnection process
    this.scheduleReconnection(userId, reconnectCallback, mergedOptions);
  }

  /**
   * Handle successful connection
   */
  handleConnectionSuccess(userId: string): void {
    console.log('✅ [ReconnectionManager] Connection successful for user:', userId);
    
    // Reset connection health
    const health = this.connectionHealth.get(userId);
    if (health) {
      health.isHealthy = true;
      health.lastHeartbeat = new Date();
      health.consecutiveFailures = 0;
      health.lastError = undefined;
      this.connectionHealth.set(userId, health);
    }

    // Reset reconnection attempts
    this.reconnectionAttempts.set(userId, 0);
    
    // Clear any pending reconnection
    this.clearReconnectionTimeout(userId);

    // Sync missed notifications
    this.syncMissedNotifications(userId);
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(userId: string): ConnectionHealth | null {
    return this.connectionHealth.get(userId) || null;
  }

  /**
   * Force reconnection for a user
   */
  forceReconnection(userId: string, reconnectCallback: () => void): void {
    console.log('🔄 [ReconnectionManager] Forcing reconnection for user:', userId);
    
    // Clear existing timeout
    this.clearReconnectionTimeout(userId);
    
    // Reset attempts
    this.reconnectionAttempts.set(userId, 0);
    
    // Trigger reconnection immediately
    reconnectCallback();
  }

  /**
   * Cleanup all monitoring
   */
  cleanup(): void {
    console.log('🧹 [ReconnectionManager] Cleaning up all monitoring');
    
    // Clear all heartbeats
    this.heartbeatIntervals.forEach((interval, userId) => {
      this.stopHeartbeat(userId);
    });

    // Clear all reconnection timeouts
    this.reconnectionTimeouts.forEach((timeout, userId) => {
      this.clearReconnectionTimeout(userId);
    });

    // Clear all state
    this.connectionHealth.clear();
    this.reconnectionAttempts.clear();
    this.lastSyncTimestamps.clear();

    // Remove event listeners
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  // Private methods

  private startHeartbeat(
    userId: string,
    reconnectCallback: () => void,
    options: ReconnectionOptions
  ): void {
    // Clear existing heartbeat
    this.stopHeartbeat(userId);

    const interval = setInterval(() => {
      this.performHeartbeat(userId, reconnectCallback, options);
    }, options.heartbeatInterval);

    this.heartbeatIntervals.set(userId, interval);
  }

  private stopHeartbeat(userId: string): void {
    const interval = this.heartbeatIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(userId);
    }
  }

  private async performHeartbeat(
    userId: string,
    reconnectCallback: () => void,
    options: ReconnectionOptions
  ): Promise<void> {
    try {
      // Simple heartbeat: try to fetch user's notification count
      const { data, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        throw new Error(`Heartbeat failed: ${error.message}`);
      }

      // Update health status
      const health = this.connectionHealth.get(userId);
      if (health) {
        health.isHealthy = true;
        health.lastHeartbeat = new Date();
        health.consecutiveFailures = 0;
        health.lastError = undefined;
        this.connectionHealth.set(userId, health);
      }

      console.log('💓 [ReconnectionManager] Heartbeat successful for user:', userId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown heartbeat error';
      console.warn('💔 [ReconnectionManager] Heartbeat failed for user:', userId, errorMessage);
      
      this.handleConnectionFailure(userId, errorMessage, reconnectCallback, options);
    }
  }

  private scheduleReconnection(
    userId: string,
    reconnectCallback: () => void,
    options: ReconnectionOptions
  ): void {
    const currentAttempts = this.reconnectionAttempts.get(userId) || 0;
    
    if (currentAttempts >= options.maxRetries) {
      console.error('🔄 [ReconnectionManager] Max reconnection attempts reached for user:', userId);
      
      // Update health status
      const health = this.connectionHealth.get(userId);
      if (health) {
        health.lastError = 'Max reconnection attempts reached';
        this.connectionHealth.set(userId, health);
      }
      
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      options.baseDelay * Math.pow(options.backoffMultiplier, currentAttempts),
      options.maxDelay
    );

    console.log(`🔄 [ReconnectionManager] Scheduling reconnection for user ${userId} in ${delay}ms (attempt ${currentAttempts + 1}/${options.maxRetries})`);

    // Clear existing timeout
    this.clearReconnectionTimeout(userId);

    // Schedule reconnection
    const timeout = setTimeout(() => {
      this.reconnectionAttempts.set(userId, currentAttempts + 1);
      
      console.log(`🔄 [ReconnectionManager] Attempting reconnection for user ${userId} (attempt ${currentAttempts + 1})`);
      
      // Trigger reconnection
      reconnectCallback();
      
    }, delay);

    this.reconnectionTimeouts.set(userId, timeout);
  }

  private clearReconnectionTimeout(userId: string): void {
    const timeout = this.reconnectionTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectionTimeouts.delete(userId);
    }
  }

  private async syncMissedNotifications(userId: string): Promise<void> {
    const lastSync = this.lastSyncTimestamps.get(userId);
    if (!lastSync) {
      console.log('🔄 [ReconnectionManager] No last sync timestamp for user:', userId);
      return;
    }

    try {
      console.log('🔄 [ReconnectionManager] Syncing missed notifications for user:', userId, 'since:', lastSync);

      // Fetch notifications created since last sync
      const { data: missedNotifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', lastSync.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('🔄 [ReconnectionManager] Error syncing missed notifications:', error);
        return;
      }

      if (missedNotifications && missedNotifications.length > 0) {
        console.log(`🔄 [ReconnectionManager] Found ${missedNotifications.length} missed notifications for user:`, userId);

        // Emit missed notifications through custom event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('missed-notifications-sync', {
            detail: {
              userId,
              notifications: missedNotifications,
              syncTimestamp: new Date()
            }
          }));
        }

        // Update last sync timestamp
        this.lastSyncTimestamps.set(userId, new Date());
      } else {
        console.log('🔄 [ReconnectionManager] No missed notifications for user:', userId);
      }

    } catch (error) {
      console.error('🔄 [ReconnectionManager] Exception during missed notification sync:', error);
    }
  }

  // Browser event handlers

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      console.log('🔄 [ReconnectionManager] Tab became visible, checking all connections');
      
      // Check health of all monitored connections
      this.connectionHealth.forEach((health, userId) => {
        if (!health.isHealthy) {
          // Emit reconnection needed event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('reconnection-needed', {
              detail: { userId, reason: 'tab-visible' }
            }));
          }
        }
      });
    }
  }

  private handleOnline(): void {
    console.log('🔄 [ReconnectionManager] Network came online, triggering reconnections');
    
    // Trigger reconnection for all users
    this.connectionHealth.forEach((health, userId) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reconnection-needed', {
          detail: { userId, reason: 'network-online' }
        }));
      }
    });
  }

  private handleOffline(): void {
    console.log('🔄 [ReconnectionManager] Network went offline');
    
    // Mark all connections as unhealthy
    this.connectionHealth.forEach((health, userId) => {
      health.isHealthy = false;
      health.lastError = 'Network offline';
      this.connectionHealth.set(userId, health);
    });
  }
}

// Export singleton instance
export const reconnectionManager = ReconnectionManager.getInstance();