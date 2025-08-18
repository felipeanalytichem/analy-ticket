import { supabase } from '@/lib/supabase';
import { crossTabCommunication, TabMessage, SessionState } from './CrossTabCommunicationService';

export interface SessionEvent {
  type: 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED' | 'TOKEN_REFRESHED' | 'SESSION_EXTENDED';
  timestamp: number;
  sessionData?: any;
  userId?: string;
  reason?: string;
}

export interface TokenRefreshEvent {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export type SessionEventHandler = (event: SessionEvent) => void;

export class SessionEventSynchronizer {
  private eventHandlers: Map<string, SessionEventHandler[]> = new Map();
  private isInitialized = false;
  private unsubscribeFunctions: (() => void)[] = [];

  /**
   * Initialize the session event synchronizer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize cross-tab communication if not already done
      await crossTabCommunication.initialize();

      // Subscribe to session-related messages
      this.setupMessageHandlers();

      // Listen to Supabase auth state changes
      this.setupSupabaseAuthListener();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize session event synchronizer:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Unsubscribe from all message handlers
      this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      this.unsubscribeFunctions = [];

      // Clear event handlers
      this.eventHandlers.clear();

      this.isInitialized = false;
    } catch (error) {
      console.error('Error during session event synchronizer cleanup:', error);
    }
  }

  /**
   * Subscribe to session events
   */
  onSessionEvent(eventType: SessionEvent['type'], handler: SessionEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    const handlers = this.eventHandlers.get(eventType)!;
    handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Broadcast login event to all tabs
   */
  async broadcastLogin(sessionData: any): Promise<void> {
    const event: SessionEvent = {
      type: 'LOGIN',
      timestamp: Date.now(),
      sessionData,
      userId: sessionData.user?.id
    };

    await this.broadcastSessionEvent(event);
    this.handleLocalSessionEvent(event);
  }

  /**
   * Broadcast logout event to all tabs
   */
  async broadcastLogout(reason?: string): Promise<void> {
    const event: SessionEvent = {
      type: 'LOGOUT',
      timestamp: Date.now(),
      reason
    };

    await this.broadcastSessionEvent(event);
    this.handleLocalSessionEvent(event);
  }

  /**
   * Broadcast session expiration to all tabs
   */
  async broadcastSessionExpired(reason?: string): Promise<void> {
    const event: SessionEvent = {
      type: 'SESSION_EXPIRED',
      timestamp: Date.now(),
      reason
    };

    await this.broadcastSessionEvent(event);
    this.handleLocalSessionEvent(event);
  }

  /**
   * Broadcast token refresh to all tabs
   */
  async broadcastTokenRefresh(tokenData: TokenRefreshEvent): Promise<void> {
    const event: SessionEvent = {
      type: 'TOKEN_REFRESHED',
      timestamp: Date.now(),
      sessionData: tokenData,
      userId: tokenData.userId
    };

    await this.broadcastSessionEvent(event);
    this.handleLocalSessionEvent(event);
  }

  /**
   * Broadcast session extension to all tabs
   */
  async broadcastSessionExtended(sessionData: any): Promise<void> {
    const event: SessionEvent = {
      type: 'SESSION_EXTENDED',
      timestamp: Date.now(),
      sessionData,
      userId: sessionData.user?.id
    };

    await this.broadcastSessionEvent(event);
    this.handleLocalSessionEvent(event);
  }

  /**
   * Get current session state from any tab
   */
  getCurrentSessionState(): SessionState | null {
    return crossTabCommunication.getCurrentSessionState();
  }

  /**
   * Check if this tab is the master tab
   */
  isMasterTab(): boolean {
    return crossTabCommunication.isMaster();
  }

  private setupMessageHandlers(): void {
    // Subscribe to session event messages
    const unsubscribeSessionEvents = crossTabCommunication.subscribe(
      'SESSION_EVENT',
      this.handleSessionEventMessage.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeSessionEvents);

    // Subscribe to login events
    const unsubscribeLogin = crossTabCommunication.subscribe(
      'USER_LOGIN',
      this.handleLoginMessage.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeLogin);

    // Subscribe to logout events
    const unsubscribeLogout = crossTabCommunication.subscribe(
      'USER_LOGOUT',
      this.handleLogoutMessage.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeLogout);

    // Subscribe to session expiration events
    const unsubscribeExpired = crossTabCommunication.subscribe(
      'SESSION_EXPIRED_EVENT',
      this.handleSessionExpiredMessage.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeExpired);

    // Subscribe to token refresh events
    const unsubscribeTokenRefresh = crossTabCommunication.subscribe(
      'TOKEN_REFRESH_EVENT',
      this.handleTokenRefreshMessage.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeTokenRefresh);
  }

  private setupSupabaseAuthListener(): void {
    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          switch (event) {
            case 'SIGNED_IN':
              if (session) {
                await this.handleSupabaseSignIn(session);
              }
              break;

            case 'SIGNED_OUT':
              await this.handleSupabaseSignOut();
              break;

            case 'TOKEN_REFRESHED':
              if (session) {
                await this.handleSupabaseTokenRefresh(session);
              }
              break;

            case 'USER_UPDATED':
              if (session) {
                await this.handleSupabaseUserUpdate(session);
              }
              break;

            default:
              // Handle other events if needed
              break;
          }
        } catch (error) {
          console.error('Error handling Supabase auth state change:', error);
        }
      }
    );

    // Add cleanup function
    this.unsubscribeFunctions.push(() => {
      subscription.unsubscribe();
    });
  }

  private async handleSupabaseSignIn(session: any): Promise<void> {
    // Only broadcast if this is the master tab to avoid duplicate events
    if (this.isMasterTab()) {
      const sessionState: SessionState = {
        isAuthenticated: true,
        user: session.user,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at * 1000).getTime(),
        lastActivity: Date.now()
      };

      // Sync session state across tabs
      await crossTabCommunication.syncSessionState(sessionState);

      // Broadcast login event
      await this.broadcastLogin(session);
    }
  }

  private async handleSupabaseSignOut(): Promise<void> {
    // Only broadcast if this is the master tab to avoid duplicate events
    if (this.isMasterTab()) {
      await this.broadcastLogout('user_initiated');
    }
  }

  private async handleSupabaseTokenRefresh(session: any): Promise<void> {
    // Only broadcast if this is the master tab to avoid duplicate events
    if (this.isMasterTab()) {
      const tokenData: TokenRefreshEvent = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at * 1000).getTime(),
        userId: session.user.id
      };

      // Update session state across tabs
      const sessionState: SessionState = {
        isAuthenticated: true,
        user: session.user,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: tokenData.expiresAt,
        lastActivity: Date.now()
      };

      await crossTabCommunication.syncSessionState(sessionState);

      // Broadcast token refresh event
      await this.broadcastTokenRefresh(tokenData);
    }
  }

  private async handleSupabaseUserUpdate(session: any): Promise<void> {
    // Update session state with new user data
    const currentState = this.getCurrentSessionState();
    if (currentState) {
      const updatedState: SessionState = {
        ...currentState,
        user: session.user,
        lastActivity: Date.now()
      };

      await crossTabCommunication.syncSessionState(updatedState);
    }
  }

  private async broadcastSessionEvent(event: SessionEvent): Promise<void> {
    try {
      await crossTabCommunication.broadcastMessage('SESSION_EVENT', {
        event,
        fromTabId: crossTabCommunication.getTabId()
      });
    } catch (error) {
      console.error('Failed to broadcast session event:', error);
      throw error;
    }
  }

  private handleSessionEventMessage(message: TabMessage): void {
    const { event } = message.payload;
    this.handleLocalSessionEvent(event);
  }

  private handleLoginMessage(message: TabMessage): void {
    const event: SessionEvent = {
      type: 'LOGIN',
      timestamp: message.timestamp,
      sessionData: message.payload.sessionData,
      userId: message.payload.userId
    };
    this.handleLocalSessionEvent(event);
  }

  private handleLogoutMessage(message: TabMessage): void {
    const event: SessionEvent = {
      type: 'LOGOUT',
      timestamp: message.timestamp,
      reason: message.payload.reason
    };
    this.handleLocalSessionEvent(event);
  }

  private handleSessionExpiredMessage(message: TabMessage): void {
    const event: SessionEvent = {
      type: 'SESSION_EXPIRED',
      timestamp: message.timestamp,
      reason: message.payload.reason
    };
    this.handleLocalSessionEvent(event);
  }

  private handleTokenRefreshMessage(message: TabMessage): void {
    const event: SessionEvent = {
      type: 'TOKEN_REFRESHED',
      timestamp: message.timestamp,
      sessionData: message.payload.tokenData,
      userId: message.payload.userId
    };
    this.handleLocalSessionEvent(event);
  }

  private handleLocalSessionEvent(event: SessionEvent): void {
    try {
      // Notify registered handlers
      const handlers = this.eventHandlers.get(event.type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`Error in session event handler for ${event.type}:`, error);
          }
        });
      }

      // Perform default actions based on event type
      this.performDefaultEventActions(event);
    } catch (error) {
      console.error('Error handling local session event:', error);
    }
  }

  private performDefaultEventActions(event: SessionEvent): void {
    switch (event.type) {
      case 'LOGOUT':
      case 'SESSION_EXPIRED':
        // Clear any local storage or cached data
        this.clearLocalSessionData();
        
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        break;

      case 'LOGIN':
        // Redirect to dashboard if on login page
        if (window.location.pathname === '/login') {
          window.location.href = '/';
        }
        break;

      case 'TOKEN_REFRESHED':
        // Update any cached token data
        this.updateLocalTokenData(event.sessionData);
        break;

      default:
        // No default action for other events
        break;
    }
  }

  private clearLocalSessionData(): void {
    try {
      // Clear session-related localStorage items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('session') || key.includes('auth') || key.includes('token'))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Clear session storage
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing local session data:', error);
    }
  }

  private updateLocalTokenData(tokenData: any): void {
    try {
      // Update any locally cached token data
      if (tokenData && typeof tokenData === 'object') {
        const tokenInfo = {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: tokenData.expiresAt,
          updatedAt: Date.now()
        };

        localStorage.setItem('analy-ticket-token-info', JSON.stringify(tokenInfo));
      }
    } catch (error) {
      console.error('Error updating local token data:', error);
    }
  }
}

// Singleton instance
export const sessionEventSynchronizer = new SessionEventSynchronizer();