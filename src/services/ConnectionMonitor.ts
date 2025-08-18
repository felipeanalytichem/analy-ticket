import { supabase } from '@/lib/supabase';

export interface ConnectionStatus {
  isOnline: boolean;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  latency: number;
  lastConnected: Date;
  reconnectAttempts: number;
  supabaseConnected: boolean;
  networkConnected: boolean;
}

export interface ConnectionQuality {
  score: number; // 0-100
  rating: 'excellent' | 'good' | 'poor' | 'offline';
  factors: {
    latency: number;
    successRate: number;
    stability: number;
  };
}

export interface IConnectionMonitor {
  startMonitoring(): void;
  stopMonitoring(): void;
  isOnline(): boolean;
  getConnectionQuality(): ConnectionQuality;
  getConnectionStatus(): ConnectionStatus;
  onConnectionChange(callback: (status: ConnectionStatus) => void): void;
  onReconnected(callback: () => void): void;
  onConnectionLost(callback: () => void): void;
  performHealthCheck(): Promise<boolean>;
}

/**
 * ConnectionMonitor service provides comprehensive connection monitoring
 * including network connectivity, Supabase connection, and health checks
 */
export class ConnectionMonitor implements IConnectionMonitor {
  private static instance: ConnectionMonitor;
  private isMonitoring = false;
  private connectionStatus: ConnectionStatus;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
  
  // Event callbacks
  private connectionChangeCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private reconnectedCallbacks: (() => void)[] = [];
  private connectionLostCallbacks: (() => void)[] = [];
  
  // Performance tracking
  private latencyHistory: number[] = [];
  private successHistory: boolean[] = [];
  private readonly HISTORY_SIZE = 10;

  private constructor() {
    this.connectionStatus = {
      isOnline: false, // Initially offline until health check passes
      quality: 'offline',
      latency: -1,
      lastConnected: new Date(),
      reconnectAttempts: 0,
      supabaseConnected: false,
      networkConnected: navigator.onLine
    };

    // Bind methods to preserve context
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  // For testing purposes - allows creating fresh instances
  static createInstance(): ConnectionMonitor {
    return new ConnectionMonitor();
  }

  // For testing purposes - resets the singleton
  static resetInstance(): void {
    if (ConnectionMonitor.instance) {
      ConnectionMonitor.instance.cleanup();
      ConnectionMonitor.instance = null as any;
    }
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('🔍 [ConnectionMonitor] Already monitoring');
      return;
    }

    console.log('🔍 [ConnectionMonitor] Starting connection monitoring');
    this.isMonitoring = true;
    
    this.setupEventListeners();
    this.startHeartbeat();
    this.startHealthChecks();
    this.checkInitialConnection();
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('🔍 [ConnectionMonitor] Stopping connection monitoring');
    this.isMonitoring = false;
    
    this.removeEventListeners();
    this.stopHeartbeat();
    this.stopHealthChecks();
  }

  isOnline(): boolean {
    return this.connectionStatus.isOnline;
  }

  getConnectionQuality(): ConnectionQuality {
    const avgLatency = this.getAverageLatency();
    const successRate = this.getSuccessRate();
    const stability = this.getStabilityScore();

    let score = 0;
    let rating: 'excellent' | 'good' | 'poor' | 'offline' = 'offline';

    if (!this.connectionStatus.isOnline) {
      score = 0;
      rating = 'offline';
    } else {
      // Calculate score based on latency, success rate, and stability
      const latencyScore = Math.max(0, 100 - (avgLatency / 10)); // 1000ms = 0 points
      const successScore = successRate * 100;
      const stabilityScore = stability * 100;
      
      score = Math.round((latencyScore * 0.4 + successScore * 0.4 + stabilityScore * 0.2));
      
      if (score >= 80) rating = 'excellent';
      else if (score >= 60) rating = 'good';
      else rating = 'poor';
    }

    return {
      score,
      rating,
      factors: {
        latency: avgLatency,
        successRate,
        stability
      }
    };
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): void {
    this.connectionChangeCallbacks.push(callback);
  }

  onReconnected(callback: () => void): void {
    this.reconnectedCallbacks.push(callback);
  }

  onConnectionLost(callback: () => void): void {
    this.connectionLostCallbacks.push(callback);
  }

  async performHealthCheck(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test network connectivity first
      if (!navigator.onLine) {
        this.recordHealthCheck(false, -1);
        return false;
      }

      // Test Supabase connection with a simple query
      const { error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
        .single();

      const latency = Date.now() - startTime;
      
      // PGRST116 means "no rows returned" which is fine for health check
      const isHealthy = !error || error.code === 'PGRST116';
      
      this.recordHealthCheck(isHealthy, latency);
      
      if (isHealthy) {
        this.handleConnectionRestored(latency);
      } else {
        this.handleConnectionError(error);
      }
      
      return isHealthy;
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.recordHealthCheck(false, latency);
      this.handleConnectionError(error);
      return false;
    }
  }

  // Private methods

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Monitor Supabase auth state changes as a proxy for connection status
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔍 [ConnectionMonitor] Auth state changed:', event);
      
      // Update Supabase connection status based on auth events
      const isConnected = session !== null && event !== 'SIGNED_OUT';
      this.updateConnectionStatus({ supabaseConnected: isConnected });
    });
  }

  private removeEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHealthChecks(): void {
    this.stopHealthChecks();
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async performHeartbeat(): Promise<void> {
    try {
      // Simple heartbeat using a lightweight query
      const startTime = Date.now();
      
      const response = await supabase.rpc('get_current_timestamp');
      const latency = Date.now() - startTime;
      
      if (response?.error) {
        throw new Error(`Heartbeat failed: ${response.error.message}`);
      }

      this.recordHeartbeat(true, latency);
      console.log('💓 [ConnectionMonitor] Heartbeat successful, latency:', latency + 'ms');

    } catch (error) {
      this.recordHeartbeat(false, -1);
      console.warn('💔 [ConnectionMonitor] Heartbeat failed:', error);
    }
  }

  private async checkInitialConnection(): Promise<void> {
    console.log('🔍 [ConnectionMonitor] Checking initial connection');
    
    const isHealthy = await this.performHealthCheck();
    
    // Check if we have a valid session as a proxy for Supabase connection
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseConnected = session !== null;
    
    this.updateConnectionStatus({
      isOnline: isHealthy && navigator.onLine,
      supabaseConnected,
      networkConnected: navigator.onLine,
      quality: this.getQualityFromLatency(this.getAverageLatency())
    });
  }

  private handleOnline(): void {
    console.log('🔍 [ConnectionMonitor] Network came online');
    
    this.updateConnectionStatus({
      networkConnected: true
    });
    
    // Perform immediate health check
    setTimeout(() => {
      this.performHealthCheck();
    }, 1000);
  }

  private handleOffline(): void {
    console.log('🔍 [ConnectionMonitor] Network went offline');
    
    this.updateConnectionStatus({
      isOnline: false,
      networkConnected: false,
      quality: 'offline'
    });
    
    this.notifyConnectionLost();
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      console.log('🔍 [ConnectionMonitor] Tab became visible, checking connection');
      
      // Perform health check when tab becomes visible
      setTimeout(() => {
        this.performHealthCheck();
      }, 500);
    }
  }

  private handleConnectionRestored(latency: number): void {
    const wasOffline = !this.connectionStatus.isOnline;
    
    this.updateConnectionStatus({
      isOnline: true,
      latency,
      lastConnected: new Date(),
      reconnectAttempts: 0,
      quality: this.getQualityFromLatency(latency)
    });
    
    if (wasOffline) {
      console.log('✅ [ConnectionMonitor] Connection restored');
      this.notifyReconnected();
    }
  }

  private handleConnectionError(error: any): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
    console.warn('🔍 [ConnectionMonitor] Connection error:', errorMessage);
    
    this.reconnectAttempts++;
    
    this.updateConnectionStatus({
      isOnline: false,
      reconnectAttempts: this.reconnectAttempts,
      quality: 'offline'
    });
    
    if (this.reconnectAttempts === 1) {
      // First failure, notify connection lost
      this.notifyConnectionLost();
    }
    
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`🔍 [ConnectionMonitor] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.performHealthCheck();
    }, delay);
  }

  private recordHealthCheck(success: boolean, latency: number): void {
    this.successHistory.push(success);
    if (this.successHistory.length > this.HISTORY_SIZE) {
      this.successHistory.shift();
    }
    
    if (latency > 0) {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.HISTORY_SIZE) {
        this.latencyHistory.shift();
      }
    }
  }

  private recordHeartbeat(success: boolean, latency: number): void {
    this.recordHealthCheck(success, latency);
  }

  private getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return -1;
    
    const sum = this.latencyHistory.reduce((acc, latency) => acc + latency, 0);
    return Math.round(sum / this.latencyHistory.length);
  }

  private getSuccessRate(): number {
    if (this.successHistory.length === 0) return 0;
    
    const successes = this.successHistory.filter(success => success).length;
    return successes / this.successHistory.length;
  }

  private getStabilityScore(): number {
    if (this.successHistory.length < 3) return 1;
    
    // Calculate stability based on consistency of success/failure
    let changes = 0;
    for (let i = 1; i < this.successHistory.length; i++) {
      if (this.successHistory[i] !== this.successHistory[i - 1]) {
        changes++;
      }
    }
    
    // Lower changes = higher stability
    return Math.max(0, 1 - (changes / this.successHistory.length));
  }

  private getQualityFromLatency(latency: number): 'excellent' | 'good' | 'poor' | 'offline' {
    if (latency < 0) return 'offline';
    if (latency < 200) return 'excellent';
    if (latency < 500) return 'good';
    return 'poor';
  }

  private updateConnectionStatus(updates: Partial<ConnectionStatus>): void {
    const previousStatus = { ...this.connectionStatus };
    this.connectionStatus = { ...this.connectionStatus, ...updates };
    
    // Notify callbacks if status changed
    if (JSON.stringify(previousStatus) !== JSON.stringify(this.connectionStatus)) {
      this.notifyConnectionChange();
    }
  }

  private notifyConnectionChange(): void {
    this.connectionChangeCallbacks.forEach(callback => {
      try {
        callback(this.connectionStatus);
      } catch (error) {
        console.error('Error in connection change callback:', error);
      }
    });
  }

  private notifyReconnected(): void {
    this.reconnectedCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in reconnected callback:', error);
      }
    });
  }

  private notifyConnectionLost(): void {
    this.connectionLostCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in connection lost callback:', error);
      }
    });
  }

  // Cleanup method
  cleanup(): void {
    console.log('🧹 [ConnectionMonitor] Cleaning up');
    
    this.stopMonitoring();
    this.connectionChangeCallbacks = [];
    this.reconnectedCallbacks = [];
    this.connectionLostCallbacks = [];
    this.latencyHistory = [];
    this.successHistory = [];
  }
}

// Export singleton instance
export const connectionMonitor = ConnectionMonitor.getInstance();