import { supabase } from '@/lib/supabase';

export interface TabMessage {
  type: string;
  payload: any;
  timestamp: number;
  tabId: string;
  sessionId?: string;
}

export interface SessionState {
  isAuthenticated: boolean;
  user: any;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  lastActivity: number;
}

export interface TabInfo {
  id: string;
  isActive: boolean;
  lastHeartbeat: number;
  isMaster: boolean;
  sessionState?: SessionState;
}

export type MessageHandler = (message: TabMessage) => void;

export class CrossTabCommunicationService {
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId: string;
  private sessionId: string;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private activeTabs: Map<string, TabInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isMasterTab = false;
  private isInitialized = false;

  private readonly CHANNEL_NAME = 'analy-ticket-session';
  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly TAB_TIMEOUT = 15000; // 15 seconds
  private readonly CLEANUP_INTERVAL = 10000; // 10 seconds

  constructor() {
    this.tabId = this.generateTabId();
    this.sessionId = this.generateSessionId();
  }

  /**
   * Initialize the cross-tab communication system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize BroadcastChannel
      this.broadcastChannel = new BroadcastChannel(this.CHANNEL_NAME);
      this.setupMessageListener();

      // Register this tab
      this.activeTabs.set(this.tabId, {
        id: this.tabId,
        isActive: true,
        lastHeartbeat: Date.now(),
        isMaster: false
      });

      // Start heartbeat and cleanup intervals
      this.startHeartbeat();
      this.startCleanup();

      // Announce this tab's presence
      await this.broadcastMessage('TAB_REGISTERED', {
        tabId: this.tabId,
        timestamp: Date.now()
      });

      // Request current session state from other tabs
      await this.broadcastMessage('SESSION_STATE_REQUEST', {
        requestingTabId: this.tabId
      });

      // Wait a moment for responses, then elect master if needed
      setTimeout(() => {
        this.electMasterTab();
      }, 1000);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize cross-tab communication:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when tab is closing
   */
  async cleanup(): Promise<void> {
    try {
      // Announce tab closure if channel is available
      if (this.broadcastChannel) {
        await this.broadcastMessage('TAB_CLOSING', {
          tabId: this.tabId,
          isMaster: this.isMasterTab
        });
      }

      // Clear intervals
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Close broadcast channel
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }

      this.isInitialized = false;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Broadcast a message to all tabs
   */
  async broadcastMessage(type: string, payload: any): Promise<void> {
    if (!this.broadcastChannel) {
      throw new Error('BroadcastChannel not initialized');
    }

    const message: TabMessage = {
      type,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId,
      sessionId: this.sessionId
    };

    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
      throw error;
    }
  }

  /**
   * Subscribe to specific message types
   */
  subscribe(messageType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }

    const handlers = this.messageHandlers.get(messageType)!;
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
   * Synchronize session state across tabs
   */
  async syncSessionState(sessionState: SessionState): Promise<void> {
    // Update local tab info
    const tabInfo = this.activeTabs.get(this.tabId);
    if (tabInfo) {
      tabInfo.sessionState = sessionState;
      this.activeTabs.set(this.tabId, tabInfo);
    }

    // Broadcast to other tabs
    await this.broadcastMessage('SESSION_STATE_SYNC', {
      sessionState,
      fromTabId: this.tabId
    });
  }

  /**
   * Get current session state from any active tab
   */
  getCurrentSessionState(): SessionState | null {
    for (const [, tabInfo] of this.activeTabs) {
      if (tabInfo.sessionState && tabInfo.isActive) {
        return tabInfo.sessionState;
      }
    }
    return null;
  }

  /**
   * Check if this tab is the master tab
   */
  isMaster(): boolean {
    return this.isMasterTab;
  }

  /**
   * Get list of active tabs
   */
  getActiveTabs(): TabInfo[] {
    return Array.from(this.activeTabs.values()).filter(tab => tab.isActive);
  }

  /**
   * Get current tab ID
   */
  getTabId(): string {
    return this.tabId;
  }

  private setupMessageListener(): void {
    if (!this.broadcastChannel) {
      return;
    }

    this.broadcastChannel.addEventListener('message', (event) => {
      const message = event.data as TabMessage;

      // Ignore messages from this tab
      if (message.tabId === this.tabId) {
        return;
      }

      this.handleIncomingMessage(message);
    });
  }

  private async handleIncomingMessage(message: TabMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'TAB_REGISTERED':
          await this.handleTabRegistered(message);
          break;

        case 'TAB_CLOSING':
          this.handleTabClosing(message);
          break;

        case 'HEARTBEAT':
          this.handleHeartbeat(message);
          break;

        case 'SESSION_STATE_REQUEST':
          await this.handleSessionStateRequest(message);
          break;

        case 'SESSION_STATE_SYNC':
          this.handleSessionStateSync(message);
          break;

        case 'MASTER_ELECTION':
          this.handleMasterElection(message);
          break;

        default:
          // Forward to registered handlers
          const handlers = this.messageHandlers.get(message.type);
          if (handlers) {
            handlers.forEach(handler => {
              try {
                handler(message);
              } catch (error) {
                console.error(`Error in message handler for ${message.type}:`, error);
              }
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private async handleTabRegistered(message: TabMessage): Promise<void> {
    const { tabId } = message.payload;

    // Add the new tab to our list
    this.activeTabs.set(tabId, {
      id: tabId,
      isActive: true,
      lastHeartbeat: message.timestamp,
      isMaster: false
    });

    // Send our heartbeat to the new tab if channel is available
    if (this.broadcastChannel) {
      try {
        await this.broadcastMessage('HEARTBEAT', {
          tabId: this.tabId,
          isMaster: this.isMasterTab
        });
      } catch (error) {
        console.error('Failed to send heartbeat to new tab:', error);
      }
    }
  }

  private handleTabClosing(message: TabMessage): void {
    const { tabId, isMaster } = message.payload;

    // Remove the tab from our list
    this.activeTabs.delete(tabId);

    // If the master tab is closing, elect a new master
    if (isMaster) {
      setTimeout(() => {
        this.electMasterTab();
      }, 100);
    }
  }

  private handleHeartbeat(message: TabMessage): void {
    const { tabId, isMaster } = message.payload;

    // Update tab info
    const existingTab = this.activeTabs.get(tabId);
    this.activeTabs.set(tabId, {
      id: tabId,
      isActive: true,
      lastHeartbeat: message.timestamp,
      isMaster: isMaster || false,
      sessionState: existingTab?.sessionState
    });
  }

  private async handleSessionStateRequest(message: TabMessage): Promise<void> {
    const { requestingTabId } = message.payload;
    const currentState = this.getCurrentSessionState();

    if (currentState) {
      await this.broadcastMessage('SESSION_STATE_RESPONSE', {
        sessionState: currentState,
        requestingTabId,
        respondingTabId: this.tabId
      });
    }
  }

  private handleSessionStateSync(message: TabMessage): void {
    const { sessionState, fromTabId } = message.payload;

    // Update the tab's session state
    const tabInfo = this.activeTabs.get(fromTabId);
    if (tabInfo) {
      tabInfo.sessionState = sessionState;
      this.activeTabs.set(fromTabId, tabInfo);
    }
  }

  private handleMasterElection(message: TabMessage): void {
    const { candidateTabId, timestamp } = message.payload;

    // If the candidate has an earlier timestamp (older tab), they become master
    if (timestamp < Date.now() - 1000) { // Allow 1 second tolerance
      this.isMasterTab = candidateTabId === this.tabId;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.broadcastMessage('HEARTBEAT', {
          tabId: this.tabId,
          isMaster: this.isMasterTab
        });
      } catch (error) {
        console.error('Error sending heartbeat:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveTabs();
    }, this.CLEANUP_INTERVAL);
  }

  private cleanupInactiveTabs(): void {
    const now = Date.now();
    const inactiveTabs: string[] = [];

    for (const [tabId, tabInfo] of this.activeTabs) {
      if (now - tabInfo.lastHeartbeat > this.TAB_TIMEOUT) {
        inactiveTabs.push(tabId);
      }
    }

    // Remove inactive tabs
    let masterTabRemoved = false;
    inactiveTabs.forEach(tabId => {
      const tabInfo = this.activeTabs.get(tabId);
      if (tabInfo?.isMaster) {
        masterTabRemoved = true;
      }
      this.activeTabs.delete(tabId);
    });

    // Elect new master if needed
    if (masterTabRemoved) {
      this.electMasterTab();
    }
  }

  private electMasterTab(): void {
    const activeTabs = this.getActiveTabs();

    if (activeTabs.length === 0) {
      this.isMasterTab = true;
      return;
    }

    // Check if there's already a master
    const existingMaster = activeTabs.find(tab => tab.isMaster);
    if (existingMaster) {
      this.isMasterTab = existingMaster.id === this.tabId;
      return;
    }

    // Elect the tab with the earliest timestamp (oldest tab)
    const sortedTabs = [...activeTabs, {
      id: this.tabId,
      isActive: true,
      lastHeartbeat: Date.now(),
      isMaster: false
    }].sort((a, b) => a.lastHeartbeat - b.lastHeartbeat);

    const masterTab = sortedTabs[0];
    this.isMasterTab = masterTab.id === this.tabId;

    // Announce master election if channel is available
    if (this.broadcastChannel) {
      this.broadcastMessage('MASTER_ELECTION', {
        candidateTabId: masterTab.id,
        timestamp: masterTab.lastHeartbeat
      }).catch(error => {
        console.error('Failed to announce master election:', error);
      });
    }
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const crossTabCommunication = new CrossTabCommunicationService();