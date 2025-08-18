import { supabase } from '@/lib/supabase';

export interface ConnectionStatus {
  isConnected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  channel: any;
  callback: (data: any) => void;
  createdAt: Date;
  isActive: boolean;
}

export interface SubscriptionOptions {
  enableDeduplication?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

/**
 * SubscriptionManager handles robust real-time subscription management
 * with deduplication, connection tracking, and React Strict Mode compatibility
 */
export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions: Map<string, Subscription> = new Map();
  private connectionStates: Map<string, ConnectionStatus> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Default options
  private defaultOptions: Required<SubscriptionOptions> = {
    enableDeduplication: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000 // 30 seconds
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

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  /**
   * Create a new subscription with deduplication support
   */
  subscribe(
    userId: string,
    callback: (data: any) => void,
    options: SubscriptionOptions = {}
  ): Subscription | null {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const subscriptionKey = `notifications-${userId}`;

    console.log('🔔 [SubscriptionManager] Creating subscription for user:', userId);

    // Check for existing subscription (deduplication)
    if (mergedOptions.enableDeduplication && this.subscriptions.has(subscriptionKey)) {
      const existing = this.subscriptions.get(subscriptionKey)!;
      if (existing.isActive) {
        console.warn('🔔 [SubscriptionManager] Subscription already exists for user:', userId);
        return existing;
      } else {
        // Clean up inactive subscription
        this.unsubscribe(subscriptionKey);
      }
    }

    try {
      // Initialize connection state
      this.connectionStates.set(userId, {
        isConnected: false,
        status: 'connecting',
        reconnectAttempts: 0
      });

      // Create Supabase channel
      const channel = supabase
        .channel(subscriptionKey, {
          config: {
            broadcast: { self: false },
            presence: { key: userId }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 [SubscriptionManager] Notification INSERT:', payload.new);
            this.updateConnectionState(userId, { isConnected: true, status: 'connected' });
            callback(payload.new);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('🔔 [SubscriptionManager] Notification UPDATE:', payload.new);
            this.updateConnectionState(userId, { isConnected: true, status: 'connected' });
            callback(payload.new);
          }
        )
        .subscribe((status) => {
          console.log('🔔 [SubscriptionManager] Subscription status:', status);
          this.handleSubscriptionStatus(userId, status, mergedOptions);
        });

      // Create subscription object
      const subscription: Subscription = {
        id: subscriptionKey,
        userId,
        channel,
        callback,
        createdAt: new Date(),
        isActive: true
      };

      // Store subscription
      this.subscriptions.set(subscriptionKey, subscription);

      // Start heartbeat monitoring
      this.startHeartbeat(userId, mergedOptions.heartbeatInterval);

      console.log('✅ [SubscriptionManager] Subscription created successfully');
      return subscription;

    } catch (error) {
      console.error('❌ [SubscriptionManager] Error creating subscription:', error);
      this.updateConnectionState(userId, {
        isConnected: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(subscriptionId: string): boolean {
    console.log('🔔 [SubscriptionManager] Unsubscribing:', subscriptionId);

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn('🔔 [SubscriptionManager] Subscription not found:', subscriptionId);
      return false;
    }

    try {
      // Mark as inactive
      subscription.isActive = false;

      // Remove Supabase channel
      if (subscription.channel) {
        supabase.removeChannel(subscription.channel);
      }

      // Clean up timers
      this.stopHeartbeat(subscription.userId);
      this.clearReconnectTimeout(subscription.userId);

      // Update connection state
      this.updateConnectionState(subscription.userId, {
        isConnected: false,
        status: 'disconnected'
      });

      // Remove from maps
      this.subscriptions.delete(subscriptionId);
      this.connectionStates.delete(subscription.userId);

      console.log('✅ [SubscriptionManager] Unsubscribed successfully');
      return true;

    } catch (error) {
      console.error('❌ [SubscriptionManager] Error unsubscribing:', error);
      return false;
    }
  }

  /**
   * Get connection status for a user
   */
  getConnectionStatus(userId: string): ConnectionStatus | null {
    return this.connectionStates.get(userId) || null;
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription(userId: string): boolean {
    const subscriptionKey = `notifications-${userId}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    return subscription?.isActive || false;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  /**
   * Force reconnect for a user
   */
  reconnect(userId: string): void {
    const subscriptionKey = `notifications-${userId}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (!subscription) {
      console.warn('🔔 [SubscriptionManager] No subscription to reconnect for user:', userId);
      return;
    }

    console.log('🔄 [SubscriptionManager] Force reconnecting for user:', userId);
    
    // Unsubscribe and resubscribe
    this.unsubscribe(subscriptionKey);
    this.subscribe(userId, subscription.callback);
  }

  /**
   * Clean up all subscriptions (useful for app shutdown)
   */
  cleanup(): void {
    console.log('🧹 [SubscriptionManager] Cleaning up all subscriptions');
    
    const subscriptionIds = Array.from(this.subscriptions.keys());
    subscriptionIds.forEach(id => this.unsubscribe(id));
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  // Private methods

  private handleSubscriptionStatus(
    userId: string,
    status: string,
    options: Required<SubscriptionOptions>
  ): void {
    switch (status) {
      case 'SUBSCRIBED':
        this.updateConnectionState(userId, {
          isConnected: true,
          status: 'connected',
          lastConnected: new Date(),
          reconnectAttempts: 0
        });
        break;

      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        console.warn('🔔 [SubscriptionManager] Connection issue:', status);
        this.updateConnectionState(userId, {
          isConnected: false,
          status: 'error',
          error: status
        });
        this.scheduleReconnect(userId, options);
        break;

      case 'CLOSED':
        this.updateConnectionState(userId, {
          isConnected: false,
          status: 'disconnected'
        });
        break;
    }
  }

  private scheduleReconnect(userId: string, options: Required<SubscriptionOptions>): void {
    const connectionState = this.connectionStates.get(userId);
    if (!connectionState || connectionState.reconnectAttempts >= options.maxReconnectAttempts) {
      console.error('🔔 [SubscriptionManager] Max reconnect attempts reached for user:', userId);
      this.updateConnectionState(userId, {
        isConnected: false,
        status: 'error',
        error: 'Max reconnect attempts reached'
      });
      return;
    }

    // Clear existing timeout
    this.clearReconnectTimeout(userId);

    // Calculate exponential backoff delay
    const delay = options.reconnectDelay * Math.pow(2, connectionState.reconnectAttempts);
    
    console.log(`🔄 [SubscriptionManager] Scheduling reconnect for user ${userId} in ${delay}ms (attempt ${connectionState.reconnectAttempts + 1})`);
    
    this.updateConnectionState(userId, {
      status: 'reconnecting',
      reconnectAttempts: connectionState.reconnectAttempts + 1
    });

    const timeout = setTimeout(() => {
      this.reconnect(userId);
    }, delay);

    this.reconnectTimeouts.set(userId, timeout);
  }

  private startHeartbeat(userId: string, interval: number): void {
    this.stopHeartbeat(userId); // Clear existing heartbeat

    const heartbeat = setInterval(() => {
      const subscription = this.subscriptions.get(`notifications-${userId}`);
      if (!subscription || !subscription.isActive) {
        this.stopHeartbeat(userId);
        return;
      }

      // Send a heartbeat ping
      try {
        subscription.channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: Date.now() }
        });
      } catch (error) {
        console.warn('🔔 [SubscriptionManager] Heartbeat failed for user:', userId, error);
        this.updateConnectionState(userId, {
          isConnected: false,
          status: 'error',
          error: 'Heartbeat failed'
        });
      }
    }, interval);

    this.heartbeatIntervals.set(userId, heartbeat);
  }

  private stopHeartbeat(userId: string): void {
    const heartbeat = this.heartbeatIntervals.get(userId);
    if (heartbeat) {
      clearInterval(heartbeat);
      this.heartbeatIntervals.delete(userId);
    }
  }

  private clearReconnectTimeout(userId: string): void {
    const timeout = this.reconnectTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(userId);
    }
  }

  private updateConnectionState(userId: string, updates: Partial<ConnectionStatus>): void {
    const current = this.connectionStates.get(userId) || {
      isConnected: false,
      status: 'disconnected' as const,
      reconnectAttempts: 0
    };

    const updated = { ...current, ...updates };
    this.connectionStates.set(userId, updated);

    // Emit connection state change event for UI updates
    this.emitConnectionStateChange(userId, updated);
  }

  private emitConnectionStateChange(userId: string, state: ConnectionStatus): void {
    // Custom event for connection state changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('subscription-connection-change', {
        detail: { userId, state }
      }));
    }
  }

  // Browser event handlers

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      console.log('🔔 [SubscriptionManager] Tab became visible, checking connections');
      // Reconnect all subscriptions when tab becomes visible
      this.getActiveSubscriptions().forEach(sub => {
        const state = this.connectionStates.get(sub.userId);
        if (state && !state.isConnected) {
          this.reconnect(sub.userId);
        }
      });
    }
  }

  private handleOnline(): void {
    console.log('🔔 [SubscriptionManager] Network came online, reconnecting all subscriptions');
    this.getActiveSubscriptions().forEach(sub => {
      this.reconnect(sub.userId);
    });
  }

  private handleOffline(): void {
    console.log('🔔 [SubscriptionManager] Network went offline');
    this.connectionStates.forEach((state, userId) => {
      this.updateConnectionState(userId, {
        isConnected: false,
        status: 'disconnected',
        error: 'Network offline'
      });
    });
  }
}

// Export singleton instance
export const subscriptionManager = SubscriptionManager.getInstance();