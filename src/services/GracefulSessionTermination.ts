import { supabase } from '@/lib/supabase';
import { StateManager } from './StateManager';

export interface TerminationContext {
  currentRoute: string;
  formData?: Record<string, any>;
  userPreferences?: any;
  reason: 'expired' | 'manual' | 'error' | 'inactivity';
  timestamp: Date;
}

export interface GracefulTerminationConfig {
  saveDataBeforeTermination?: boolean;
  preserveContext?: boolean;
  redirectToLogin?: boolean;
  showTerminationMessage?: boolean;
  autoSaveTimeout?: number; // milliseconds to wait for auto-save
}

export type TerminationEventType = 'before-termination' | 'after-termination' | 'data-saved' | 'context-preserved';

export interface TerminationEventCallback {
  (data: any): void;
}

/**
 * GracefulSessionTermination handles the graceful termination of user sessions
 * including data saving, context preservation, and proper cleanup.
 */
export class GracefulSessionTermination {
  private stateManager: StateManager;
  private eventListeners: Map<TerminationEventType, TerminationEventCallback[]> = new Map();
  private config: Required<GracefulTerminationConfig>;
  private isTerminating = false;

  constructor(
    stateManager: StateManager,
    config: GracefulTerminationConfig = {}
  ) {
    this.stateManager = stateManager;
    this.config = {
      saveDataBeforeTermination: config.saveDataBeforeTermination !== false,
      preserveContext: config.preserveContext !== false,
      redirectToLogin: config.redirectToLogin !== false,
      showTerminationMessage: config.showTerminationMessage !== false,
      autoSaveTimeout: config.autoSaveTimeout || 5000
    };

    // Initialize event listener maps
    this.eventListeners.set('before-termination', []);
    this.eventListeners.set('after-termination', []);
    this.eventListeners.set('data-saved', []);
    this.eventListeners.set('context-preserved', []);
  }

  /**
   * Gracefully terminate the session with data saving and context preservation
   */
  async terminateSession(context: Partial<TerminationContext> = {}): Promise<void> {
    if (this.isTerminating) {
      console.log('🔄 GracefulSessionTermination: Termination already in progress');
      return;
    }

    this.isTerminating = true;

    try {
      console.log('🚪 GracefulSessionTermination: Starting graceful session termination...');

      const terminationContext: TerminationContext = {
        currentRoute: window.location.pathname,
        reason: 'manual',
        timestamp: new Date(),
        ...context
      };

      // Emit before-termination event
      this.emit('before-termination', { context: terminationContext });

      // Step 1: Save critical data
      if (this.config.saveDataBeforeTermination) {
        await this.saveDataBeforeTermination(terminationContext);
      }

      // Step 2: Preserve context for next session
      if (this.config.preserveContext) {
        await this.preserveSessionContext(terminationContext);
      }

      // Step 3: Perform actual logout
      await this.performLogout();

      // Step 4: Show termination message if configured
      if (this.config.showTerminationMessage) {
        this.showTerminationMessage(terminationContext);
      }

      // Step 5: Redirect to login if configured
      if (this.config.redirectToLogin) {
        this.redirectToLogin(terminationContext);
      }

      // Emit after-termination event
      this.emit('after-termination', { context: terminationContext });

      console.log('✅ GracefulSessionTermination: Session terminated gracefully');

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error during termination:', error);
      
      // Fallback: Force logout even if graceful termination fails
      try {
        await this.performLogout();
        if (this.config.redirectToLogin) {
          this.redirectToLogin({ reason: 'error', timestamp: new Date(), currentRoute: window.location.pathname });
        }
      } catch (fallbackError) {
        console.error('❌ GracefulSessionTermination: Fallback logout failed:', fallbackError);
        // Last resort: redirect to login page
        window.location.href = '/login';
      }
    } finally {
      this.isTerminating = false;
    }
  }

  /**
   * Save critical data before termination
   */
  private async saveDataBeforeTermination(context: TerminationContext): Promise<void> {
    try {
      console.log('💾 GracefulSessionTermination: Saving data before termination...');

      const savePromises: Promise<void>[] = [];

      // Save form data from all forms on the page
      const forms = document.querySelectorAll('form[data-auto-save]');
      forms.forEach((form) => {
        const formId = form.id || `form-${Date.now()}`;
        const formData = new FormData(form as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());
        
        if (Object.keys(data).length > 0) {
          savePromises.push(
            this.stateManager.saveState(`termination-form-${formId}`, {
              data,
              timestamp: new Date(),
              route: context.currentRoute
            })
          );
        }
      });

      // Save current application state
      savePromises.push(
        this.stateManager.saveState('termination-app-state', {
          route: context.currentRoute,
          timestamp: context.timestamp,
          reason: context.reason,
          userPreferences: context.userPreferences
        })
      );

      // Wait for all saves to complete with timeout
      await Promise.race([
        Promise.all(savePromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout')), this.config.autoSaveTimeout)
        )
      ]);

      this.emit('data-saved', { context, savedItems: savePromises.length });
      console.log('✅ GracefulSessionTermination: Data saved successfully');

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error saving data:', error);
      // Don't throw - continue with termination even if save fails
    }
  }

  /**
   * Preserve session context for restoration after login
   */
  private async preserveSessionContext(context: TerminationContext): Promise<void> {
    try {
      console.log('🔄 GracefulSessionTermination: Preserving session context...');

      const contextData = {
        route: context.currentRoute,
        timestamp: context.timestamp,
        reason: context.reason,
        formData: context.formData,
        userPreferences: context.userPreferences,
        // Add query parameters and hash
        search: window.location.search,
        hash: window.location.hash,
        // Add scroll position
        scrollPosition: {
          x: window.scrollX,
          y: window.scrollY
        }
      };

      await this.stateManager.saveState('session-termination-context', contextData);

      this.emit('context-preserved', { context: contextData });
      console.log('✅ GracefulSessionTermination: Context preserved successfully');

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error preserving context:', error);
      // Don't throw - continue with termination even if context preservation fails
    }
  }

  /**
   * Perform the actual logout
   */
  private async performLogout(): Promise<void> {
    try {
      console.log('🔐 GracefulSessionTermination: Performing logout...');

      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('GracefulSessionTermination: Logout error:', error);
        throw error;
      }

      // Clear any remaining session data
      this.clearSessionData();

      console.log('✅ GracefulSessionTermination: Logout completed');

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Logout failed:', error);
      throw error;
    }
  }

  /**
   * Clear session-related data from storage
   */
  private clearSessionData(): void {
    try {
      // Clear session-specific data but preserve termination context
      const keysToPreserve = [
        'session-termination-context',
        'termination-app-state'
      ];

      // Get all localStorage keys
      const allKeys = Object.keys(localStorage);
      
      // Clear session-related keys except preserved ones
      allKeys.forEach(key => {
        if (key.startsWith('analy-ticket-session-') && 
            !keysToPreserve.some(preserved => key.includes(preserved))) {
          localStorage.removeItem(key);
        }
      });

      console.log('🧹 GracefulSessionTermination: Session data cleared');

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error clearing session data:', error);
    }
  }

  /**
   * Show termination message to user
   */
  private showTerminationMessage(context: TerminationContext): void {
    const messages = {
      expired: 'Your session has expired. You will be redirected to login.',
      manual: 'You have been logged out successfully.',
      error: 'An error occurred. You will be redirected to login.',
      inactivity: 'You have been logged out due to inactivity.'
    };

    const message = messages[context.reason] || messages.manual;

    // Create a simple notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Session Terminated', {
          body: message,
          icon: '/favicon.ico'
        });
      }
    }

    // Also show in console for debugging
    console.log(`🔔 GracefulSessionTermination: ${message}`);
  }

  /**
   * Redirect to login page with preserved context
   */
  private redirectToLogin(context: TerminationContext): void {
    try {
      console.log('🔄 GracefulSessionTermination: Redirecting to login...');

      // Build login URL with context information
      const loginUrl = new URL('/login', window.location.origin);
      
      // Add context as query parameters
      if (context.reason) {
        loginUrl.searchParams.set('reason', context.reason);
      }
      
      if (context.currentRoute && context.currentRoute !== '/login') {
        loginUrl.searchParams.set('redirect', context.currentRoute);
      }

      // Add timestamp for debugging
      loginUrl.searchParams.set('terminated_at', context.timestamp.toISOString());

      // Perform redirect
      window.location.href = loginUrl.toString();

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error redirecting to login:', error);
      // Fallback to simple redirect
      window.location.href = '/login';
    }
  }

  /**
   * Restore session context after login
   */
  async restoreSessionContext(): Promise<TerminationContext | null> {
    try {
      console.log('🔄 GracefulSessionTermination: Attempting to restore session context...');

      const contextData = await this.stateManager.restoreState('session-termination-context');
      
      if (!contextData) {
        console.log('ℹ️ GracefulSessionTermination: No session context to restore');
        return null;
      }

      // Clean up the stored context
      await this.stateManager.clearState('session-termination-context');

      console.log('✅ GracefulSessionTermination: Session context restored');
      return contextData as TerminationContext;

    } catch (error) {
      console.error('❌ GracefulSessionTermination: Error restoring session context:', error);
      return null;
    }
  }

  /**
   * Check if there's a pending context restoration
   */
  async hasPendingContextRestoration(): Promise<boolean> {
    try {
      const contextData = await this.stateManager.restoreState('session-termination-context');
      return contextData !== null;
    } catch {
      return false;
    }
  }

  /**
   * Event listener management
   */
  on(event: TerminationEventType, callback: TerminationEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  off(event: TerminationEventType, callback: TerminationEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  private emit(event: TerminationEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`GracefulSessionTermination: Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    console.log('🧹 GracefulSessionTermination: Cleaning up...');
    this.eventListeners.clear();
    this.isTerminating = false;
  }
}

// Export singleton instance
export const gracefulSessionTermination = new GracefulSessionTermination(
  new StateManager()
);