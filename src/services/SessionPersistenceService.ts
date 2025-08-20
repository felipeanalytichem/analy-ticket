import { supabase } from '@/lib/supabase';
import { QueryClient } from '@tanstack/react-query';

/**
 * Service to ensure sessions remain persistent and never expire
 * unless user explicitly logs out
 */
export class SessionPersistenceService {
  private static instance: SessionPersistenceService | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private lastRefresh: Date | null = null;
  private queryClient: QueryClient | null = null;

  private constructor() {}

  static getInstance(): SessionPersistenceService {
    if (!SessionPersistenceService.instance) {
      SessionPersistenceService.instance = new SessionPersistenceService();
    }
    return SessionPersistenceService.instance;
  }

  /**
   * Set the query client for data refetching
   */
  setQueryClient(queryClient: QueryClient): void {
    this.queryClient = queryClient;
  }

  /**
   * Start the session persistence service
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('📋 Session persistence already active');
      return;
    }

    console.log('🚀 Starting session persistence service...');
    this.isActive = true;

    // Set up periodic session refresh
    this.keepAliveInterval = setInterval(async () => {
      await this.refreshSession();
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    // Do an initial refresh
    await this.refreshSession();

    // Set up auth state monitoring
    this.setupAuthStateMonitoring();

    console.log('✅ Session persistence service started');
  }

  /**
   * Stop the session persistence service
   */
  stop(): void {
    console.log('🛑 Stopping session persistence service');
    
    this.isActive = false;
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Refresh the current session to keep it alive
   */
  async refreshSession(): Promise<boolean> {
    try {
      const { data: currentSession } = await supabase.auth.getSession();
      
      if (!currentSession.session) {
        console.log('⚠️ No session to refresh');
        return false;
      }

      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('⚠️ Session refresh warning:', error.message);
        
        // If refresh fails, try to test database connection
        try {
          const { error: dbError } = await supabase
            .from('tickets_new')
            .select('id')
            .limit(1);
          
          if (dbError) {
            console.warn('⚠️ Database also unreachable during session refresh');
          } else {
            console.log('✅ Database is accessible despite session refresh failure');
          }
        } catch (dbTestError) {
          console.warn('⚠️ Could not test database during session refresh failure');
        }
        
        return false;
      }

      if (data.session) {
        this.lastRefresh = new Date();
        console.log('✅ Session refreshed at', this.lastRefresh.toLocaleTimeString());
        
        // Test database connection after successful refresh
        try {
          const { error: dbError } = await supabase
            .from('tickets_new')
            .select('id')
            .limit(1);
          
          if (dbError) {
            console.warn('⚠️ Session refreshed but database connection failed:', dbError.message);
          } else {
            console.log('✅ Session and database both working properly');
          }
        } catch (dbTestError) {
          console.warn('⚠️ Could not verify database after session refresh');
        }
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Session refresh error:', error);
      return false;
    }
  }

  /**
   * Setup auth state monitoring to detect and prevent logouts
   */
  private setupAuthStateMonitoring(): void {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔐 Auth state change: ${event}`);

      switch (event) {
        case 'SIGNED_IN':
          console.log('✅ User signed in - session persistence active');
          break;

        case 'TOKEN_REFRESHED':
          this.lastRefresh = new Date();
          console.log('🔄 Token refreshed automatically');
          break;

        case 'SIGNED_OUT':
          console.log('👋 User signed out - stopping persistence');
          this.stop();
          break;

        case 'USER_UPDATED':
          console.log('👤 User updated');
          break;

        default:
          console.log(`🔍 Auth event: ${event}`);
      }
    });
  }

  /**
   * Force session refresh (can be called manually)
   */
  async forceRefresh(): Promise<boolean> {
    console.log('🔄 Forcing session refresh...');
    return await this.refreshSession();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      lastRefresh: this.lastRefresh,
      hasKeepAlive: !!this.keepAliveInterval
    };
  }

  /**
   * Setup enhanced session persistence
   * This method configures additional persistence features
   */
  async setupEnhancedPersistence(): Promise<void> {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && this.isActive) {
        console.log('👁️ Page visible - refreshing session and data');
        await this.refreshSession();
        
        // Invalidate all queries to refetch fresh data after idle
        if (this.queryClient) {
          console.log('🔄 Invalidating queries after idle period');
          await this.queryClient.invalidateQueries();
        }
      }
    });

    // Handle page focus
    window.addEventListener('focus', async () => {
      if (this.isActive) {
        console.log('🎯 Page focused - ensuring session is alive and data is fresh');
        await this.refreshSession();
        
        // Refetch stale data when user returns focus
        if (this.queryClient) {
          console.log('🔄 Refetching stale data after focus');
          await this.queryClient.refetchQueries({ 
            stale: true,
            type: 'active'
          });
        }
      }
    });

    // Handle before page unload (save session state)
    window.addEventListener('beforeunload', () => {
      if (this.isActive) {
        // Mark that session should be preserved
        localStorage.setItem('session-should-persist', 'true');
      }
    });

    // Handle page load (restore session state)
    window.addEventListener('load', async () => {
      const shouldPersist = localStorage.getItem('session-should-persist');
      if (shouldPersist === 'true' && this.isActive) {
        console.log('🔄 Page loaded - restoring persistent session');
        await this.refreshSession();
        localStorage.removeItem('session-should-persist');
      }
    });
  }
}

// Export singleton instance
export const sessionPersistence = SessionPersistenceService.getInstance();
