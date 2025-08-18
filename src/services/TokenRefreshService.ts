import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface TokenRefreshConfig {
  refreshBufferTime?: number; // Time in seconds before expiry to refresh
  maxRetryAttempts?: number;
  retryDelay?: number;
  enableCrossTabSync?: boolean;
}

export type TokenEventType = 'refreshed' | 'failed' | 'synced';

export interface TokenEventCallback {
  (data: any): void;
}

export class TokenRefreshService {
  private refreshTimeout: NodeJS.Timeout | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<TokenPair> | null = null;
  private retryCount = 0;
  private readonly REFRESH_BUFFER_TIME: number;
  private readonly MAX_RETRY_ATTEMPTS: number;
  private readonly RETRY_DELAY: number;
  private readonly ENABLE_CROSS_TAB_SYNC: boolean;
  private eventListeners: Map<TokenEventType, TokenEventCallback[]> = new Map();

  constructor(config: TokenRefreshConfig = {}) {
    this.REFRESH_BUFFER_TIME = config.refreshBufferTime || 300; // 5 minutes default
    this.MAX_RETRY_ATTEMPTS = config.maxRetryAttempts || 3;
    this.RETRY_DELAY = config.retryDelay || 1000; // 1 second default
    this.ENABLE_CROSS_TAB_SYNC = config.enableCrossTabSync !== false; // default true

    // Initialize event listener maps
    this.eventListeners.set('refreshed', []);
    this.eventListeners.set('failed', []);
    this.eventListeners.set('synced', []);

    if (this.ENABLE_CROSS_TAB_SYNC && typeof BroadcastChannel !== 'undefined') {
      this.setupCrossTabSync();
    }
  }

  /**
   * Refresh tokens with retry logic and cross-tab synchronization
   */
  async refreshTokens(): Promise<TokenPair> {
    // If already refreshing, wait for the existing refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      console.log('🔄 TokenRefreshService: Waiting for ongoing refresh...');
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performRefresh();

    try {
      const tokenPair = await this.refreshPromise;
      this.retryCount = 0; // Reset retry count on success
      return tokenPair;
    } catch (error) {
      throw error;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Schedule automatic token refresh
   */
  scheduleRefresh(expiresIn: number): void {
    this.cancelScheduledRefresh();

    // Calculate refresh time (buffer time before expiry)
    const refreshIn = Math.max(0, (expiresIn - this.REFRESH_BUFFER_TIME) * 1000);

    if (refreshIn > 0) {
      console.log(`🕐 TokenRefreshService: Scheduling refresh in ${Math.floor(refreshIn / 1000)} seconds`);
      this.refreshTimeout = setTimeout(async () => {
        try {
          await this.refreshTokens();
        } catch (error) {
          console.error('TokenRefreshService: Scheduled refresh failed:', error);
          this.handleRefreshFailure(error);
        }
      }, refreshIn);
    } else {
      console.log('⚠️ TokenRefreshService: Token expires too soon, refreshing immediately');
      // Token expires very soon, refresh immediately
      setTimeout(() => {
        this.refreshTokens().catch(error => {
          console.error('TokenRefreshService: Immediate refresh failed:', error);
          this.handleRefreshFailure(error);
        });
      }, 0);
    }
  }

  /**
   * Cancel scheduled refresh
   */
  cancelScheduledRefresh(): void {
    if (this.refreshTimeout) {
      console.log('⏹️ TokenRefreshService: Cancelling scheduled refresh');
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }

  /**
   * Validate token expiration
   */
  isTokenExpired(expiresAt: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= expiresAt;
  }

  /**
   * Check if token needs refresh (within buffer time)
   */
  needsRefresh(expiresAt: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (expiresAt - now) <= this.REFRESH_BUFFER_TIME;
  }

  /**
   * Sync tokens across tabs
   */
  syncTokensAcrossTabs(tokens: TokenPair): void {
    if (this.broadcastChannel) {
      console.log('📡 TokenRefreshService: Broadcasting token update to other tabs');
      this.broadcastChannel.postMessage({
        type: 'TOKEN_UPDATED',
        tokens,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Add event listener
   */
  on(event: TokenEventType, callback: TokenEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Remove event listener
   */
  off(event: TokenEventType, callback: TokenEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Convenience method for token refresh events
   */
  onTokensUpdated(callback: (tokens: TokenPair) => void): void {
    this.on('refreshed', callback);
    this.on('synced', callback);
  }

  /**
   * Get current refresh status
   */
  getRefreshStatus(): {
    isRefreshing: boolean;
    retryCount: number;
    hasScheduledRefresh: boolean;
  } {
    return {
      isRefreshing: this.isRefreshing,
      retryCount: this.retryCount,
      hasScheduledRefresh: this.refreshTimeout !== null
    };
  }

  /**
   * Private methods
   */
  private async performRefresh(): Promise<TokenPair> {
    try {
      console.log('🔄 TokenRefreshService: Refreshing tokens...');

      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        throw new Error(`Token refresh failed: ${error?.message || 'No session returned'}`);
      }

      const tokenPair: TokenPair = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token!,
        expiresIn: data.session.expires_in!,
        tokenType: data.session.token_type!
      };

      // Schedule next refresh
      this.scheduleRefresh(tokenPair.expiresIn);

      // Sync across tabs
      this.syncTokensAcrossTabs(tokenPair);

      // Emit success event
      this.emit('refreshed', { tokens: tokenPair });

      console.log('✅ TokenRefreshService: Tokens refreshed successfully');
      return tokenPair;

    } catch (error) {
      console.error('❌ TokenRefreshService: Token refresh failed:', error);
      throw error;
    }
  }

  private handleRefreshFailure(error: any): void {
    this.retryCount++;

    if (this.retryCount < this.MAX_RETRY_ATTEMPTS) {
      const delay = this.RETRY_DELAY * Math.pow(2, this.retryCount - 1); // Exponential backoff
      console.log(`🔄 TokenRefreshService: Retrying refresh in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRY_ATTEMPTS})`);

      setTimeout(() => {
        this.refreshTokens().catch(retryError => {
          console.error('TokenRefreshService: Retry failed:', retryError);
          this.handleRefreshFailure(retryError);
        });
      }, delay);
    } else {
      console.error('❌ TokenRefreshService: Max retry attempts reached');
      this.emit('failed', { error, retryCount: this.retryCount });
      this.retryCount = 0; // Reset for future attempts
    }
  }

  private setupCrossTabSync(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('token-refresh-sync');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        if (event.data.type === 'TOKEN_UPDATED') {
          console.log('📡 TokenRefreshService: Received token update from another tab');
          this.handleTokensUpdated(event.data.tokens);
        }
      });

      console.log('📡 TokenRefreshService: Cross-tab synchronization enabled');
    } catch (error) {
      console.warn('TokenRefreshService: Failed to setup cross-tab sync:', error);
      this.broadcastChannel = null;
    }
  }

  private handleTokensUpdated(tokens: TokenPair): void {
    // Cancel any scheduled refresh since we got fresh tokens from another tab
    this.cancelScheduledRefresh();
    
    // Schedule refresh for the new tokens
    this.scheduleRefresh(tokens.expiresIn);
    
    // Emit sync event
    this.emit('synced', { tokens });
  }

  private emit(event: TokenEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`TokenRefreshService: Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    console.log('🧹 TokenRefreshService: Cleaning up...');
    
    this.cancelScheduledRefresh();
    
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    this.eventListeners.clear();
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.retryCount = 0;
  }
}

// Export singleton instance
export const tokenRefreshService = new TokenRefreshService();