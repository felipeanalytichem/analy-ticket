import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface SessionStatus {
  isActive: boolean;
  expiresAt: Date | null;
  timeUntilExpiry: number;
  lastActivity: Date;
  refreshToken: string | null;
  accessToken: string | null;
}

export interface SessionManagerConfig {
  checkInterval?: number;
  warningThreshold?: number;
  autoRefresh?: boolean;
}

export type SessionEventType = 'expiring' | 'expired' | 'refreshed' | 'validated' | 'terminated';

export interface SessionEventCallback {
  (data: any): void;
}

export class SessionManager {
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private warningShown = false;
  private readonly WARNING_THRESHOLD: number;
  private readonly CHECK_INTERVAL: number;
  private readonly AUTO_REFRESH: boolean;
  private eventListeners: Map<SessionEventType, SessionEventCallback[]> = new Map();
  private currentSession: Session | null = null;
  private lastActivity: Date = new Date();

  constructor(config: SessionManagerConfig = {}) {
    this.WARNING_THRESHOLD = config.warningThreshold || 5 * 60 * 1000; // 5 minutes
    this.CHECK_INTERVAL = config.checkInterval || 30 * 1000; // 30 seconds
    this.AUTO_REFRESH = config.autoRefresh !== false; // default true
    
    // Initialize event listener maps
    this.eventListeners.set('expiring', []);
    this.eventListeners.set('expired', []);
    this.eventListeners.set('refreshed', []);
    this.eventListeners.set('validated', []);
    this.eventListeners.set('terminated', []);
    
    // Track user activity
    this.setupActivityTracking();
  }

  /**
   * Initialize session management
   */
  async initializeSession(): Promise<void> {
    try {
      console.log('🔐 SessionManager: Initializing session...');
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('SessionManager: Error getting session:', error);
        throw error;
      }
      
      if (session) {
        this.currentSession = session;
        this.startSessionMonitoring();
        this.scheduleTokenRefresh(session);
        console.log('🔐 SessionManager: Session initialized successfully');
      } else {
        console.log('🔐 SessionManager: No active session found');
      }
    } catch (error) {
      console.error('SessionManager: Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<boolean> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('SessionManager: Session validation failed - no session');
        this.emit('expired', { reason: 'no_session' });
        return false;
      }
      
      // Check if token is still valid
      const now = new Date().getTime();
      const expiresAt = new Date(session.expires_at! * 1000).getTime();
      
      if (now >= expiresAt) {
        console.log('SessionManager: Session validation failed - token expired');
        
        if (this.AUTO_REFRESH) {
          console.log('SessionManager: Attempting automatic refresh...');
          return await this.refreshSession();
        } else {
          this.emit('expired', { reason: 'token_expired' });
          return false;
        }
      }
      
      this.currentSession = session;
      this.emit('validated', { session });
      return true;
    } catch (error) {
      console.error('SessionManager: Session validation error:', error);
      this.emit('expired', { reason: 'validation_error', error });
      return false;
    }
  }

  /**
   * Refresh current session
   */
  async refreshSession(): Promise<boolean> {
    try {
      console.log('🔄 SessionManager: Refreshing session...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        console.error('SessionManager: Session refresh failed:', error);
        this.handleSessionExpired();
        return false;
      }
      
      this.currentSession = data.session;
      this.warningShown = false; // Reset warning flag
      this.scheduleTokenRefresh(data.session);
      
      console.log('✅ SessionManager: Session refreshed successfully');
      this.emit('refreshed', { session: data.session });
      
      return true;
    } catch (error) {
      console.error('SessionManager: Session refresh error:', error);
      this.handleSessionExpired();
      return false;
    }
  }

  /**
   * Terminate current session
   */
  async terminateSession(): Promise<void> {
    try {
      console.log('🚪 SessionManager: Terminating session...');
      
      this.stopSessionMonitoring();
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SessionManager: Error during sign out:', error);
      }
      
      this.currentSession = null;
      this.emit('terminated', { reason: 'manual' });
      
      console.log('✅ SessionManager: Session terminated successfully');
    } catch (error) {
      console.error('SessionManager: Error terminating session:', error);
      throw error;
    }
  }

  /**
   * Start session monitoring
   */
  startSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      console.log('SessionManager: Monitoring already active');
      return;
    }
    
    console.log('🔍 SessionManager: Starting session monitoring...');
    this.sessionCheckInterval = setInterval(() => {
      this.checkSessionStatus();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop session monitoring
   */
  stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      console.log('⏹️ SessionManager: Stopping session monitoring...');
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  /**
   * Get current session status
   */
  getSessionStatus(): SessionStatus {
    if (!this.currentSession) {
      return {
        isActive: false,
        expiresAt: null,
        timeUntilExpiry: 0,
        lastActivity: this.lastActivity,
        refreshToken: null,
        accessToken: null
      };
    }
    
    const now = new Date().getTime();
    const expiresAt = new Date(this.currentSession.expires_at! * 1000);
    const timeUntilExpiry = expiresAt.getTime() - now;
    
    return {
      isActive: timeUntilExpiry > 0,
      expiresAt,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      lastActivity: this.lastActivity,
      refreshToken: this.currentSession.refresh_token,
      accessToken: this.currentSession.access_token
    };
  }

  /**
   * Add event listener
   */
  on(event: SessionEventType, callback: SessionEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Remove event listener
   */
  off(event: SessionEventType, callback: SessionEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Convenience methods for specific events
   */
  onSessionExpiring(callback: (timeLeft: number) => void): void {
    this.on('expiring', callback);
  }

  onSessionExpired(callback: () => void): void {
    this.on('expired', callback);
  }

  onSessionRefreshed(callback: (session: Session) => void): void {
    this.on('refreshed', callback);
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Private methods
   */
  private async checkSessionStatus(): Promise<void> {
    try {
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        this.handleSessionExpired();
        return;
      }
      
      this.currentSession = session.data.session;
      
      const now = new Date().getTime();
      const expiresAt = new Date(session.data.session.expires_at! * 1000).getTime();
      const timeUntilExpiry = expiresAt - now;
      
      if (timeUntilExpiry <= 0) {
        console.log('SessionManager: Session expired, attempting refresh...');
        if (this.AUTO_REFRESH) {
          await this.refreshSession();
        } else {
          this.handleSessionExpired();
        }
      } else if (timeUntilExpiry <= this.WARNING_THRESHOLD && !this.warningShown) {
        console.log(`SessionManager: Session expiring in ${Math.floor(timeUntilExpiry / 1000)} seconds`);
        this.showExpirationWarning(timeUntilExpiry);
        this.warningShown = true;
      }
    } catch (error) {
      console.error('SessionManager: Error checking session status:', error);
    }
  }

  private showExpirationWarning(timeLeft: number): void {
    console.log('⚠️ SessionManager: Showing expiration warning');
    this.emit('expiring', { timeLeft });
  }

  private handleSessionExpired(): void {
    console.log('❌ SessionManager: Session expired');
    this.stopSessionMonitoring();
    this.currentSession = null;
    this.emit('expired', { reason: 'expired' });
  }

  private scheduleTokenRefresh(session: Session): void {
    if (!this.AUTO_REFRESH) return;
    
    const now = new Date().getTime();
    const expiresAt = new Date(session.expires_at! * 1000).getTime();
    const refreshIn = expiresAt - now - (5 * 60 * 1000); // Refresh 5 minutes before expiry
    
    if (refreshIn > 0) {
      console.log(`SessionManager: Scheduling token refresh in ${Math.floor(refreshIn / 1000)} seconds`);
      setTimeout(() => {
        this.refreshSession();
      }, refreshIn);
    }
  }

  private setupActivityTracking(): void {
    // Track various user activities
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const updateActivity = () => {
      this.updateActivity();
    };
    
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
  }

  private emit(event: SessionEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`SessionManager: Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    console.log('🧹 SessionManager: Cleaning up...');
    this.stopSessionMonitoring();
    this.eventListeners.clear();
    this.currentSession = null;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();