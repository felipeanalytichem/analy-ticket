import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export interface ActivityTrackingConfig {
  enabled?: boolean;
  inactivityThreshold?: number; // milliseconds
  trackingEvents?: string[];
  debounceDelay?: number; // milliseconds
}

export interface ExtensionConfig {
  autoExtendOnActivity?: boolean;
  showConfirmationDialog?: boolean;
  maxExtensions?: number;
  extensionDuration?: number; // milliseconds
  warningBeforeExpiry?: number; // milliseconds
}

export interface UserActivity {
  lastActivity: Date;
  activityCount: number;
  inactivityDuration: number;
  isActive: boolean;
}

export interface ExtensionAttempt {
  timestamp: Date;
  success: boolean;
  reason: 'manual' | 'automatic' | 'activity';
  error?: string;
}

export type ExtensionEventType = 'extension-requested' | 'extension-success' | 'extension-failed' | 'activity-detected' | 'inactivity-detected';

export interface ExtensionEventCallback {
  (data: any): void;
}

/**
 * SessionExtensionService handles session extension, renewal, and user activity tracking
 */
export class SessionExtensionService {
  private config: Required<ActivityTrackingConfig> & Required<ExtensionConfig>;
  private eventListeners: Map<ExtensionEventType, ExtensionEventCallback[]> = new Map();
  private activityTracker: ActivityTracker;
  private extensionHistory: ExtensionAttempt[] = [];
  private isInitialized = false;

  constructor(
    activityConfig: ActivityTrackingConfig = {},
    extensionConfig: ExtensionConfig = {}
  ) {
    this.config = {
      // Activity tracking config
      enabled: activityConfig.enabled !== false,
      inactivityThreshold: activityConfig.inactivityThreshold || 15 * 60 * 1000, // 15 minutes
      trackingEvents: activityConfig.trackingEvents || [
        'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'
      ],
      debounceDelay: activityConfig.debounceDelay || 1000, // 1 second
      
      // Extension config
      autoExtendOnActivity: extensionConfig.autoExtendOnActivity !== false,
      showConfirmationDialog: extensionConfig.showConfirmationDialog !== false,
      maxExtensions: extensionConfig.maxExtensions || 5,
      extensionDuration: extensionConfig.extensionDuration || 30 * 60 * 1000, // 30 minutes
      warningBeforeExpiry: extensionConfig.warningBeforeExpiry || 5 * 60 * 1000 // 5 minutes
    };

    this.activityTracker = new ActivityTracker(this.config);
    this.initializeEventListeners();
  }

  /**
   * Initialize the session extension service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('SessionExtensionService: Already initialized');
      return;
    }

    try {
      console.log('🔧 SessionExtensionService: Initializing...');

      if (this.config.enabled) {
        this.activityTracker.start();
        this.setupActivityListeners();
      }

      this.isInitialized = true;
      console.log('✅ SessionExtensionService: Initialized successfully');

    } catch (error) {
      console.error('❌ SessionExtensionService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Extend the current session
   */
  async extendSession(reason: 'manual' | 'automatic' | 'activity' = 'manual'): Promise<boolean> {
    try {
      console.log(`🔄 SessionExtensionService: Extending session (${reason})...`);

      // Check if we've reached the maximum number of extensions
      const recentExtensions = this.getRecentExtensions();
      if (recentExtensions.length >= this.config.maxExtensions) {
        console.warn('⚠️ SessionExtensionService: Maximum extensions reached');
        this.emit('extension-failed', { 
          reason: 'max_extensions_reached',
          maxExtensions: this.config.maxExtensions 
        });
        return false;
      }

      // Emit extension requested event
      this.emit('extension-requested', { reason });

      // Show confirmation dialog if configured and manual
      if (reason === 'manual' && this.config.showConfirmationDialog) {
        const confirmed = await this.showExtensionConfirmation();
        if (!confirmed) {
          console.log('ℹ️ SessionExtensionService: Extension cancelled by user');
          return false;
        }
      }

      // Perform the actual session refresh
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        console.error('❌ SessionExtensionService: Extension failed:', error);
        this.recordExtensionAttempt(reason, false, error?.message);
        this.emit('extension-failed', { reason: 'refresh_failed', error });
        return false;
      }

      // Record successful extension
      this.recordExtensionAttempt(reason, true);
      
      console.log('✅ SessionExtensionService: Session extended successfully');
      this.emit('extension-success', { 
        reason, 
        session: data.session,
        extensionsUsed: recentExtensions.length + 1,
        maxExtensions: this.config.maxExtensions
      });

      return true;

    } catch (error) {
      console.error('❌ SessionExtensionService: Extension error:', error);
      this.recordExtensionAttempt(reason, false, error instanceof Error ? error.message : 'Unknown error');
      this.emit('extension-failed', { reason: 'unexpected_error', error });
      return false;
    }
  }

  /**
   * Get current user activity status
   */
  getUserActivity(): UserActivity {
    return this.activityTracker.getActivity();
  }

  /**
   * Get extension history
   */
  getExtensionHistory(): ExtensionAttempt[] {
    return [...this.extensionHistory];
  }

  /**
   * Get recent extensions (within the last hour)
   */
  getRecentExtensions(): ExtensionAttempt[] {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.extensionHistory.filter(attempt => 
      attempt.timestamp > oneHourAgo && attempt.success
    );
  }

  /**
   * Check if automatic extension should be triggered
   */
  shouldAutoExtend(): boolean {
    if (!this.config.autoExtendOnActivity) {
      return false;
    }

    const activity = this.getUserActivity();
    const recentExtensions = this.getRecentExtensions();

    return (
      activity.isActive &&
      recentExtensions.length < this.config.maxExtensions &&
      activity.inactivityDuration < this.config.inactivityThreshold
    );
  }

  /**
   * Reset extension history (useful for testing or admin purposes)
   */
  resetExtensionHistory(): void {
    console.log('🔄 SessionExtensionService: Resetting extension history');
    this.extensionHistory = [];
  }

  /**
   * Event listener management
   */
  on(event: ExtensionEventType, callback: ExtensionEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: ExtensionEventType, callback: ExtensionEventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Private methods
   */
  private initializeEventListeners(): void {
    this.eventListeners.set('extension-requested', []);
    this.eventListeners.set('extension-success', []);
    this.eventListeners.set('extension-failed', []);
    this.eventListeners.set('activity-detected', []);
    this.eventListeners.set('inactivity-detected', []);
  }

  private setupActivityListeners(): void {
    this.activityTracker.on('activity', (data) => {
      this.emit('activity-detected', data);
      
      // Check if we should auto-extend based on activity
      if (this.shouldAutoExtend()) {
        this.extendSession('activity');
      }
    });

    this.activityTracker.on('inactivity', (data) => {
      this.emit('inactivity-detected', data);
    });
  }

  private async showExtensionConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      // Create a simple confirmation dialog
      const confirmed = window.confirm(
        'Your session is about to expire. Would you like to extend it?'
      );
      resolve(confirmed);
    });
  }

  private recordExtensionAttempt(reason: 'manual' | 'automatic' | 'activity', success: boolean, error?: string): void {
    const attempt: ExtensionAttempt = {
      timestamp: new Date(),
      success,
      reason,
      error
    };

    this.extensionHistory.push(attempt);

    // Keep only the last 50 attempts to prevent memory issues
    if (this.extensionHistory.length > 50) {
      this.extensionHistory = this.extensionHistory.slice(-50);
    }
  }

  private emit(event: ExtensionEventType, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`SessionExtensionService: Error in ${event} event listener:`, error);
      }
    });
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    console.log('🧹 SessionExtensionService: Cleaning up...');
    
    if (this.activityTracker) {
      this.activityTracker.destroy();
    }
    
    this.eventListeners.clear();
    this.extensionHistory = [];
    this.isInitialized = false;
  }
}

/**
 * ActivityTracker handles user activity monitoring
 */
class ActivityTracker {
  private config: Required<ActivityTrackingConfig>;
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  private lastActivity: Date = new Date();
  private activityCount = 0;
  private isTracking = false;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private boundActivityHandler: () => void;

  constructor(config: Required<ActivityTrackingConfig>) {
    this.config = config;
    this.boundActivityHandler = this.handleActivity.bind(this);
    this.initializeEventListeners();
  }

  start(): void {
    if (this.isTracking) {
      console.log('ActivityTracker: Already tracking');
      return;
    }

    console.log('🔍 ActivityTracker: Starting activity tracking...');
    
    this.isTracking = true;
    this.setupEventListeners();
    this.startInactivityTimer();
  }

  stop(): void {
    if (!this.isTracking) {
      return;
    }

    console.log('⏹️ ActivityTracker: Stopping activity tracking...');
    
    this.isTracking = false;
    this.removeEventListeners();
    this.clearTimers();
  }

  getActivity(): UserActivity {
    const now = new Date();
    const inactivityDuration = now.getTime() - this.lastActivity.getTime();
    
    return {
      lastActivity: this.lastActivity,
      activityCount: this.activityCount,
      inactivityDuration,
      isActive: inactivityDuration < this.config.inactivityThreshold
    };
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private initializeEventListeners(): void {
    this.eventListeners.set('activity', []);
    this.eventListeners.set('inactivity', []);
  }

  private setupEventListeners(): void {
    this.config.trackingEvents.forEach(eventType => {
      document.addEventListener(eventType, this.boundActivityHandler, { passive: true });
    });
  }

  private removeEventListeners(): void {
    this.config.trackingEvents.forEach(eventType => {
      document.removeEventListener(eventType, this.boundActivityHandler);
    });
  }

  private handleActivity(): void {
    // Debounce activity events
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.recordActivity();
    }, this.config.debounceDelay);
  }

  private recordActivity(): void {
    const wasInactive = !this.getActivity().isActive;
    
    this.lastActivity = new Date();
    this.activityCount++;

    // Restart inactivity timer
    this.startInactivityTimer();

    // Emit activity event
    this.emit('activity', {
      timestamp: this.lastActivity,
      activityCount: this.activityCount,
      wasInactive
    });
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();
    
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, this.config.inactivityThreshold);
  }

  private handleInactivity(): void {
    const activity = this.getActivity();
    
    this.emit('inactivity', {
      lastActivity: activity.lastActivity,
      inactivityDuration: activity.inactivityDuration,
      activityCount: activity.activityCount
    });
  }

  private clearTimers(): void {
    this.clearInactivityTimer();
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`ActivityTracker: Error in ${event} event listener:`, error);
      }
    });
  }

  destroy(): void {
    console.log('🧹 ActivityTracker: Cleaning up...');
    this.stop();
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const sessionExtensionService = new SessionExtensionService();