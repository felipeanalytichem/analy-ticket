import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeConnection {
  userId: string;
  channel: RealtimeChannel;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: Date;
  reconnectAttempts: number;
  callback: (notification: any) => void;
}

export interface ConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
  error?: string;
}

/**
 * RealtimeConnectionManager - Robust WebSocket connection handling with automatic reconnection
 */
export class RealtimeConnectionManager {
  private connections: Map<string, RealtimeConnection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly INITIAL_RECONNECT_DELAY = 1000; // 1 second
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 seconds
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  /**
   * Connect to real-time notifications for a user
   */
  connect(userId: string, callback: (notification: any) => void): RealtimeConnection {
    console.log('🔌 Connecting to real-time notifications for user:', userId);

    // Check if already connected
    const existingConnection = this.connections.get(userId);
    if (existingConnection && existingConnection.status === 'connected') {
      console.log('🔌 Already connected for user:', userId);
      return existingConnection;
    }

    // Clean up existing connection if any
    if (existingConnection) {
      this.disconnect(userId);
    }

    const channel = supabase
      .channel(`notifications-${userId}`, {
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
          console.log('🔔 [Realtime] Notification INSERT:', payload.new);
          this.handleNotificationEvent(userId, payload.new);
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
          console.log('🔔 [Realtime] Notification UPDATE:', payload.new);
          this.handleNotificationEvent(userId, payload.new);
        }
      )
      .subscribe((status, error) => {
        console.log('🔌 Subscription status for user', userId, ':', status);
        
        const connection = this.connections.get(userId);
        if (!connection) return;

        if (status === 'SUBSCRIBED') {
          connection.status = 'connected';
          connection.lastConnected = new Date();
          connection.reconnectAttempts = 0;
          this.startHeartbeat(userId);
          console.log('✅ Successfully connected to real-time notifications for user:', userId);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          connection.status = 'error';
          console.error('❌ Real-time connection error for user:', userId, error);
          this.handleConnectionError(userId, error);
        }
      });

    const connection: RealtimeConnection = {
      userId,
      channel,
      status: 'connecting',
      reconnectAttempts: 0,
      callback
    };

    this.connections.set(userId, connection);
    return connection;
  }

  /**
   * Disconnect from real-time notifications
   */
  disconnect(userId: string): void {
    console.log('🔌 Disconnecting real-time notifications for user:', userId);

    const connection = this.connections.get(userId);
    if (connection) {
      // Unsubscribe from channel
      connection.channel.unsubscribe();
      connection.status = 'disconnected';
    }

    // Clear timers
    this.clearReconnectTimer(userId);
    this.clearHeartbeatTimer(userId);

    // Remove connection
    this.connections.delete(userId);
    
    console.log('✅ Disconnected real-time notifications for user:', userId);
  }

  /**
   * Check if user is connected
   */
  isConnected(userId: string): boolean {
    const connection = this.connections.get(userId);
    return connection?.status === 'connected' || false;
  }

  /**
   * Get connection status for a user
   */
  getConnectionStatus(userId: string): ConnectionStatus {
    const connection = this.connections.get(userId);
    
    if (!connection) {
      return {
        connected: false,
        reconnectAttempts: 0
      };
    }

    return {
      connected: connection.status === 'connected',
      lastConnected: connection.lastConnected,
      reconnectAttempts: connection.reconnectAttempts,
      error: connection.status === 'error' ? 'Connection error' : undefined
    };
  }

  /**
   * Force reconnection for a user
   */
  async reconnect(userId: string): Promise<void> {
    console.log('🔄 Force reconnecting for user:', userId);
    
    const connection = this.connections.get(userId);
    if (!connection) {
      console.warn('No connection found for user:', userId);
      return;
    }

    // Disconnect first
    this.disconnect(userId);
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reconnect
    this.connect(userId, connection.callback);
  }

  /**
   * Handle notification events from real-time subscription
   */
  private handleNotificationEvent(userId: string, notification: any): void {
    const connection = this.connections.get(userId);
    if (!connection) {
      console.warn('No connection found for notification event:', userId);
      return;
    }

    try {
      // Call the callback with the notification
      connection.callback(notification);
    } catch (error) {
      console.error('Error handling notification event:', error);
    }
  }

  /**
   * Handle connection errors and implement reconnection logic
   */
  private handleConnectionError(userId: string, error?: any): void {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.error('🔌 Connection error for user:', userId, error);

    // Don't reconnect if we've exceeded max attempts
    if (connection.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('❌ Max reconnection attempts reached for user:', userId);
      connection.status = 'error';
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, connection.reconnectAttempts),
      this.MAX_RECONNECT_DELAY
    );

    console.log(`🔄 Scheduling reconnection for user ${userId} in ${delay}ms (attempt ${connection.reconnectAttempts + 1})`);

    // Clear existing timer
    this.clearReconnectTimer(userId);

    // Schedule reconnection
    const timer = setTimeout(() => {
      this.attemptReconnection(userId);
    }, delay);

    this.reconnectTimers.set(userId, timer);
  }

  /**
   * Attempt to reconnect a user
   */
  private async attemptReconnection(userId: string): Promise<void> {
    const connection = this.connections.get(userId);
    if (!connection) return;

    console.log(`🔄 Attempting reconnection for user: ${userId} (attempt ${connection.reconnectAttempts + 1})`);

    connection.reconnectAttempts++;
    
    try {
      // Disconnect existing channel
      connection.channel.unsubscribe();
      
      // Create new connection
      const newConnection = this.connect(userId, connection.callback);
      
      // Update reconnect attempts
      newConnection.reconnectAttempts = connection.reconnectAttempts;
      
    } catch (error) {
      console.error('Error during reconnection attempt:', error);
      this.handleConnectionError(userId, error);
    }
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(userId: string): void {
    this.clearHeartbeatTimer(userId);

    const timer = setInterval(() => {
      this.checkConnectionHealth(userId);
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(userId, timer);
  }

  /**
   * Check connection health via heartbeat
   */
  private checkConnectionHealth(userId: string): void {
    const connection = this.connections.get(userId);
    if (!connection) return;

    // Simple health check - if connection exists and status is connected, we're good
    if (connection.status === 'connected') {
      console.log('💓 Heartbeat OK for user:', userId);
    } else {
      console.warn('💓 Heartbeat failed for user:', userId, 'Status:', connection.status);
      this.handleConnectionError(userId, new Error('Heartbeat failed'));
    }
  }

  /**
   * Clear reconnection timer for a user
   */
  private clearReconnectTimer(userId: string): void {
    const timer = this.reconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(userId);
    }
  }

  /**
   * Clear heartbeat timer for a user
   */
  private clearHeartbeatTimer(userId: string): void {
    const timer = this.heartbeatTimers.get(userId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(userId);
    }
  }

  /**
   * Get all active connections (for debugging)
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection details (for debugging)
   */
  getConnectionDetails(userId: string): RealtimeConnection | null {
    return this.connections.get(userId) || null;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up RealtimeConnectionManager...');

    // Disconnect all connections
    for (const userId of this.connections.keys()) {
      this.disconnect(userId);
    }

    // Clear all timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    console.log('✅ RealtimeConnectionManager cleanup complete');
  }
}