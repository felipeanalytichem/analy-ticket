export interface TabSyncMessage {
  type: 'notification-received' | 'notification-read' | 'notification-deleted' | 'tab-focus' | 'tab-blur' | 'heartbeat';
  payload: any;
  timestamp: number;
  tabId: string;
}

export interface TabInfo {
  id: string;
  isActive: boolean;
  lastSeen: Date;
  userId?: string;
}

export interface CrossTabSyncOptions {
  channelName?: string;
  heartbeatInterval?: number;
  tabTimeoutMs?: number;
  enableFocusDetection?: boolean;
}

/**
 * CrossTabSyncManager handles notification synchronization across browser tabs
 * using BroadcastChannel API and tab focus detection
 */
export class CrossTabSyncManager {
  private static instance: CrossTabSyncManager;
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId: string;
  private activeTabs: Map<string, TabInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isCurrentTabActive: boolean = true;
  private userId: string | null = null;
  
  private defaultOptions: Required<CrossTabSyncOptions> = {
    channelName: 'notifications-sync',
    heartbeatInterval: 5000, // 5 seconds
    tabTimeoutMs: 15000, // 15 seconds
    enableFocusDetection: true
  };

  private messageHandlers: Map<string, (payload: any, tabId: string) => void> = new Map();

  private constructor() {
    this.tabId = this.generateTabId();
    
    // Bind methods to preserve context
    this.handleMessage = this.handleMessage.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    
    console.log('🔄 [CrossTabSync] Initialized with tab ID:', this.tabId);
  }

  static getInstance(): CrossTabSyncManager {
    if (!CrossTabSyncManager.instance) {
      CrossTabSyncManager.instance = new CrossTabSyncManager();
    }
    return CrossTabSyncManager.instance;
  }

  /**
   * Initialize cross-tab synchronization for a user
   */
  initialize(userId: string, options: CrossTabSyncOptions = {}): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    this.userId = userId;
    
    console.log('🔄 [CrossTabSync] Initializing for user:', userId);

    // Create broadcast channel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(mergedOptions.channelName);
      this.broadcastChannel.addEventListener('message', this.handleMessage);
      
      console.log('✅ [CrossTabSync] BroadcastChannel created:', mergedOptions.channelName);
    } else {
      console.warn('⚠️ [CrossTabSync] BroadcastChannel not supported');
      return;
    }

    // Set up focus detection
    if (mergedOptions.enableFocusDetection && typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      window.addEventListener('focus', () => this.handleTabFocus());
      window.addEventListener('blur', () => this.handleTabBlur());
    }

    // Start heartbeat
    this.startHeartbeat(mergedOptions.heartbeatInterval);

    // Register this tab
    this.registerTab();

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  /**
   * Clean up cross-tab synchronization
   */
  cleanup(): void {
    console.log('🧹 [CrossTabSync] Cleaning up');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.removeEventListener('message', this.handleMessage);
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    // Clear state
    this.activeTabs.clear();
    this.messageHandlers.clear();
    this.userId = null;
  }

  /**
   * Register a message handler for a specific message type
   */
  onMessage(type: string, handler: (payload: any, tabId: string) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Remove a message handler
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Broadcast a notification received event
   */
  broadcastNotificationReceived(notification: any): void {
    this.sendMessage('notification-received', notification);
  }

  /**
   * Broadcast a notification read event
   */
  broadcastNotificationRead(notificationId: string): void {
    this.sendMessage('notification-read', { notificationId });
  }

  /**
   * Broadcast a notification deleted event
   */
  broadcastNotificationDeleted(notificationId: string): void {
    this.sendMessage('notification-deleted', { notificationId });
  }

  /**
   * Get information about active tabs
   */
  getActiveTabs(): TabInfo[] {
    this.cleanupInactiveTabs();
    return Array.from(this.activeTabs.values());
  }

  /**
   * Check if current tab is the primary tab (most recently active)
   */
  isPrimaryTab(): boolean {
    this.cleanupInactiveTabs();
    const activeTabs = this.getActiveTabs().filter(tab => tab.userId === this.userId);
    
    if (activeTabs.length === 0) return true;
    if (activeTabs.length === 1) return activeTabs[0].id === this.tabId;
    
    // Find the most recently active tab
    const mostRecentTab = activeTabs.reduce((latest, current) => 
      current.lastSeen > latest.lastSeen ? current : latest
    );
    
    return mostRecentTab.id === this.tabId;
  }

  /**
   * Check if current tab has focus
   */
  isTabActive(): boolean {
    return this.isCurrentTabActive;
  }

  /**
   * Get current tab ID
   */
  getTabId(): string {
    return this.tabId;
  }

  // Private methods

  private generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendMessage(type: string, payload: any): void {
    if (!this.broadcastChannel) return;

    const message: TabSyncMessage = {
      type: type as any,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId
    };

    try {
      this.broadcastChannel.postMessage(message);
      console.log('📡 [CrossTabSync] Sent message:', type, payload);
    } catch (error) {
      console.error('❌ [CrossTabSync] Error sending message:', error);
    }
  }

  private handleMessage(event: MessageEvent<TabSyncMessage>): void {
    const message = event.data;
    
    // Ignore messages from this tab
    if (message.tabId === this.tabId) return;

    console.log('📨 [CrossTabSync] Received message:', message.type, message.payload);

    // Handle heartbeat messages
    if (message.type === 'heartbeat') {
      this.updateTabInfo(message.tabId, message.payload);
      return;
    }

    // Handle tab focus/blur messages
    if (message.type === 'tab-focus' || message.type === 'tab-blur') {
      this.updateTabActivity(message.tabId, message.type === 'tab-focus');
      return;
    }

    // Call registered handler
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        handler(message.payload, message.tabId);
      } catch (error) {
        console.error('❌ [CrossTabSync] Error in message handler:', error);
      }
    }
  }

  private registerTab(): void {
    const tabInfo: TabInfo = {
      id: this.tabId,
      isActive: this.isCurrentTabActive,
      lastSeen: new Date(),
      userId: this.userId || undefined
    };

    this.activeTabs.set(this.tabId, tabInfo);
    console.log('📝 [CrossTabSync] Registered tab:', this.tabId);
  }

  private updateTabInfo(tabId: string, payload: any): void {
    const existingTab = this.activeTabs.get(tabId);
    const tabInfo: TabInfo = {
      id: tabId,
      isActive: payload.isActive || false,
      lastSeen: new Date(),
      userId: payload.userId
    };

    this.activeTabs.set(tabId, tabInfo);
  }

  private updateTabActivity(tabId: string, isActive: boolean): void {
    const tabInfo = this.activeTabs.get(tabId);
    if (tabInfo) {
      tabInfo.isActive = isActive;
      tabInfo.lastSeen = new Date();
      this.activeTabs.set(tabId, tabInfo);
    }
  }

  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(this.sendHeartbeat, interval);
  }

  private sendHeartbeat(): void {
    this.sendMessage('heartbeat', {
      isActive: this.isCurrentTabActive,
      userId: this.userId,
      timestamp: Date.now()
    });

    // Update own tab info
    this.registerTab();
  }

  private cleanupInactiveTabs(): void {
    const now = Date.now();
    const timeoutMs = this.defaultOptions.tabTimeoutMs;

    for (const [tabId, tabInfo] of this.activeTabs.entries()) {
      if (now - tabInfo.lastSeen.getTime() > timeoutMs) {
        this.activeTabs.delete(tabId);
        console.log('🗑️ [CrossTabSync] Removed inactive tab:', tabId);
      }
    }
  }

  private handleVisibilityChange(): void {
    const isVisible = document.visibilityState === 'visible';
    this.isCurrentTabActive = isVisible;
    
    if (isVisible) {
      this.handleTabFocus();
    } else {
      this.handleTabBlur();
    }
  }

  private handleTabFocus(): void {
    console.log('👁️ [CrossTabSync] Tab gained focus');
    this.isCurrentTabActive = true;
    this.sendMessage('tab-focus', { timestamp: Date.now() });
    this.registerTab();
  }

  private handleTabBlur(): void {
    console.log('👁️ [CrossTabSync] Tab lost focus');
    this.isCurrentTabActive = false;
    this.sendMessage('tab-blur', { timestamp: Date.now() });
    this.registerTab();
  }

  private handleBeforeUnload(): void {
    console.log('👋 [CrossTabSync] Tab closing');
    // Remove this tab from active tabs
    this.activeTabs.delete(this.tabId);
  }
}

// Export singleton instance
export const crossTabSyncManager = CrossTabSyncManager.getInstance();