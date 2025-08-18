import { supabase } from '@/lib/supabase';
import { crossTabCommunication, TabMessage, SessionState, TabInfo } from './CrossTabCommunicationService';
import { sessionEventSynchronizer, SessionEvent } from './SessionEventSynchronizer';

export interface TabSessionInfo {
  tabId: string;
  sessionId: string;
  isActive: boolean;
  isMaster: boolean;
  lastActivity: number;
  sessionData?: any;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  heartbeatCount: number;
}

export interface MasterTabElectionResult {
  newMasterTabId: string;
  previousMasterTabId?: string;
  electionReason: 'initialization' | 'master_tab_closed' | 'master_tab_inactive' | 'manual_election';
}

export type TabSessionEventHandler = (event: TabSessionEvent) => void;

export interface TabSessionEvent {
  type: 'TAB_ACTIVATED' | 'TAB_DEACTIVATED' | 'MASTER_ELECTED' | 'SESSION_SYNCHRONIZED' | 'CONNECTION_STATUS_CHANGED';
  tabId: string;
  timestamp: number;
  data?: any;
}

export class TabSpecificSessionManager {
  private tabSessionInfo: TabSessionInfo;
  private activeTabs: Map<string, TabSessionInfo> = new Map();
  private eventHandlers: Map<string, TabSessionEventHandler[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private masterElectionTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private unsubscribeFunctions: (() => void)[] = [];

  private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
  private readonly ACTIVITY_CHECK_INTERVAL = 10000; // 10 seconds
  private readonly TAB_INACTIVE_THRESHOLD = 30000; // 30 seconds
  private readonly MASTER_ELECTION_DELAY = 1000; // 1 second

  constructor() {
    this.tabSessionInfo = {
      tabId: this.generateTabId(),
      sessionId: this.generateSessionId(),
      isActive: true,
      isMaster: false,
      lastActivity: Date.now(),
      connectionStatus: 'disconnected',
      heartbeatCount: 0
    };
  }

  /**
   * Initialize the tab-specific session manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize dependencies
      await crossTabCommunication.initialize();
      await sessionEventSynchronizer.initialize();

      // Setup message handlers
      this.setupMessageHandlers();

      // Setup activity monitoring
      this.setupActivityMonitoring();

      // Start heartbeat
      this.startHeartbeat();

      // Register this tab
      await this.registerTab();

      // Start master election process
      this.scheduleMasterElection('initialization');

      this.tabSessionInfo.connectionStatus = 'connected';
      this.isInitialized = true;

      // Emit tab activated event
      this.emitTabEvent('TAB_ACTIVATED', { tabInfo: this.tabSessionInfo });

    } catch (error) {
      console.error('Failed to initialize tab-specific session manager:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when tab is closing
   */
  async cleanup(): Promise<void> {
    try {
      // Emit tab deactivation event
      this.emitTabEvent('TAB_DEACTIVATED', { tabInfo: this.tabSessionInfo });

      // Announce tab closure
      await this.announceTabClosure();

      // Clear intervals
      this.clearIntervals();

      // Unsubscribe from all handlers
      this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      this.unsubscribeFunctions = [];

      // Clear event handlers
      this.eventHandlers.clear();

      this.tabSessionInfo.isActive = false;
      this.tabSessionInfo.connectionStatus = 'disconnected';
      this.isInitialized = false;

    } catch (error) {
      console.error('Error during tab-specific session manager cleanup:', error);
    }
  }

  /**
   * Subscribe to tab session events
   */
  onTabSessionEvent(eventType: TabSessionEvent['type'], handler: TabSessionEventHandler): () => void {
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
   * Get current tab session information
   */
  getTabSessionInfo(): TabSessionInfo {
    return { ...this.tabSessionInfo };
  }

  /**
   * Get all active tabs
   */
  getActiveTabs(): TabSessionInfo[] {
    return Array.from(this.activeTabs.values()).filter(tab => tab.isActive);
  }

  /**
   * Get master tab information
   */
  getMasterTab(): TabSessionInfo | null {
    const masterTab = Array.from(this.activeTabs.values()).find(tab => tab.isMaster && tab.isActive);
    return masterTab || (this.tabSessionInfo.isMaster ? this.tabSessionInfo : null);
  }

  /**
   * Check if this tab is the master tab
   */
  isMasterTab(): boolean {
    return this.tabSessionInfo.isMaster;
  }

  /**
   * Force master tab election
   */
  async forceMasterElection(): Promise<MasterTabElectionResult> {
    return this.electMasterTab('manual_election');
  }

  /**
   * Update tab activity
   */
  updateActivity(): void {
    this.tabSessionInfo.lastActivity = Date.now();
    
    // Broadcast activity update if this is the master tab
    if (this.tabSessionInfo.isMaster) {
      this.broadcastTabUpdate();
    }
  }

  /**
   * Synchronize session data across tabs
   */
  async synchronizeSession(sessionData: any): Promise<void> {
    try {
      this.tabSessionInfo.sessionData = sessionData;

      // Update session state in cross-tab communication
      const sessionState: SessionState = {
        isAuthenticated: !!sessionData,
        user: sessionData?.user,
        accessToken: sessionData?.access_token || sessionData?.accessToken,
        refreshToken: sessionData?.refresh_token || sessionData?.refreshToken,
        expiresAt: sessionData?.expires_at ? new Date(sessionData.expires_at * 1000).getTime() : Date.now() + 3600000,
        lastActivity: Date.now()
      };

      await crossTabCommunication.syncSessionState(sessionState);

      // Emit synchronization event
      this.emitTabEvent('SESSION_SYNCHRONIZED', { sessionData });

    } catch (error) {
      console.error('Failed to synchronize session:', error);
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    // Subscribe to tab registration messages
    const unsubscribeTabRegistered = crossTabCommunication.subscribe(
      'TAB_REGISTERED',
      this.handleTabRegistered.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeTabRegistered);

    // Subscribe to tab closure messages
    const unsubscribeTabClosing = crossTabCommunication.subscribe(
      'TAB_CLOSING',
      this.handleTabClosing.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeTabClosing);

    // Subscribe to heartbeat messages
    const unsubscribeHeartbeat = crossTabCommunication.subscribe(
      'HEARTBEAT',
      this.handleHeartbeat.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeHeartbeat);

    // Subscribe to master election messages
    const unsubscribeMasterElection = crossTabCommunication.subscribe(
      'MASTER_ELECTION',
      this.handleMasterElection.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeMasterElection);

    // Subscribe to tab update messages
    const unsubscribeTabUpdate = crossTabCommunication.subscribe(
      'TAB_UPDATE',
      this.handleTabUpdate.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeTabUpdate);

    // Subscribe to session events
    const unsubscribeSessionEvents = sessionEventSynchronizer.onSessionEvent(
      'LOGIN',
      this.handleSessionLogin.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeSessionEvents);

    const unsubscribeLogout = sessionEventSynchronizer.onSessionEvent(
      'LOGOUT',
      this.handleSessionLogout.bind(this)
    );
    this.unsubscribeFunctions.push(unsubscribeLogout);
  }

  private setupActivityMonitoring(): void {
    // Monitor user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const activityHandler = () => {
      this.updateActivity();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    // Add cleanup for activity listeners
    this.unsubscribeFunctions.push(() => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, activityHandler);
      });
    });

    // Start activity check interval
    this.activityCheckInterval = setInterval(() => {
      this.checkTabActivity();
    }, this.ACTIVITY_CHECK_INTERVAL);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        this.tabSessionInfo.heartbeatCount++;
        await this.sendHeartbeat();
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        this.tabSessionInfo.connectionStatus = 'reconnecting';
        this.emitTabEvent('CONNECTION_STATUS_CHANGED', { 
          status: 'reconnecting',
          error: error.message 
        });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private async registerTab(): Promise<void> {
    try {
      await crossTabCommunication.broadcastMessage('TAB_REGISTERED', {
        tabId: this.tabSessionInfo.tabId,
        sessionId: this.tabSessionInfo.sessionId,
        timestamp: Date.now(),
        tabInfo: this.tabSessionInfo
      });
    } catch (error) {
      console.error('Failed to register tab:', error);
      throw error;
    }
  }

  private async announceTabClosure(): Promise<void> {
    try {
      await crossTabCommunication.broadcastMessage('TAB_CLOSING', {
        tabId: this.tabSessionInfo.tabId,
        isMaster: this.tabSessionInfo.isMaster,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to announce tab closure:', error);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    await crossTabCommunication.broadcastMessage('HEARTBEAT', {
      tabId: this.tabSessionInfo.tabId,
      isMaster: this.tabSessionInfo.isMaster,
      lastActivity: this.tabSessionInfo.lastActivity,
      heartbeatCount: this.tabSessionInfo.heartbeatCount,
      connectionStatus: this.tabSessionInfo.connectionStatus
    });
  }

  private async broadcastTabUpdate(): Promise<void> {
    try {
      await crossTabCommunication.broadcastMessage('TAB_UPDATE', {
        tabId: this.tabSessionInfo.tabId,
        tabInfo: this.tabSessionInfo,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to broadcast tab update:', error);
    }
  }

  private handleTabRegistered(message: TabMessage): void {
    const { tabId, tabInfo } = message.payload;

    if (tabId === this.tabSessionInfo.tabId) {
      return; // Ignore own messages
    }

    // Add or update tab information
    const newTabInfo: TabSessionInfo = {
      tabId,
      sessionId: tabInfo?.sessionId || 'unknown',
      isActive: true,
      isMaster: false,
      lastActivity: message.timestamp,
      connectionStatus: 'connected',
      heartbeatCount: 0,
      ...tabInfo
    };

    this.activeTabs.set(tabId, newTabInfo);

    // Send our heartbeat to the new tab
    this.sendHeartbeat().catch(error => {
      console.error('Failed to send heartbeat to new tab:', error);
    });
  }

  private handleTabClosing(message: TabMessage): void {
    const { tabId, isMaster } = message.payload;

    // Remove the tab from active tabs
    this.activeTabs.delete(tabId);

    // If the master tab is closing, elect a new master
    if (isMaster) {
      this.scheduleMasterElection('master_tab_closed');
    }
  }

  private handleHeartbeat(message: TabMessage): void {
    const { tabId, isMaster, lastActivity, heartbeatCount, connectionStatus } = message.payload;

    if (tabId === this.tabSessionInfo.tabId) {
      return; // Ignore own messages
    }

    // Update tab information
    const existingTab = this.activeTabs.get(tabId);
    const updatedTab: TabSessionInfo = {
      tabId,
      sessionId: existingTab?.sessionId || 'unknown',
      isActive: true,
      isMaster: isMaster || false,
      lastActivity: lastActivity || message.timestamp,
      connectionStatus: connectionStatus || 'connected',
      heartbeatCount: heartbeatCount || 0,
      sessionData: existingTab?.sessionData
    };

    this.activeTabs.set(tabId, updatedTab);
  }

  private handleMasterElection(message: TabMessage): void {
    const { candidateTabId, electionReason } = message.payload;

    // Update master status
    if (candidateTabId === this.tabSessionInfo.tabId) {
      this.tabSessionInfo.isMaster = true;
      this.emitTabEvent('MASTER_ELECTED', { 
        newMasterTabId: candidateTabId,
        electionReason 
      });
    } else {
      this.tabSessionInfo.isMaster = false;
    }

    // Update other tabs' master status
    this.activeTabs.forEach((tab, tabId) => {
      tab.isMaster = tabId === candidateTabId;
    });
  }

  private handleTabUpdate(message: TabMessage): void {
    const { tabId, tabInfo } = message.payload;

    if (tabId === this.tabSessionInfo.tabId) {
      return; // Ignore own messages
    }

    // Update tab information
    if (this.activeTabs.has(tabId)) {
      const existingTab = this.activeTabs.get(tabId)!;
      const updatedTab = { ...existingTab, ...tabInfo };
      this.activeTabs.set(tabId, updatedTab);
    }
  }

  private handleSessionLogin(event: SessionEvent): void {
    // Update session data when user logs in
    if (event.sessionData) {
      this.tabSessionInfo.sessionData = event.sessionData;
    }
  }

  private handleSessionLogout(event: SessionEvent): void {
    // Clear session data when user logs out
    this.tabSessionInfo.sessionData = null;
  }

  private checkTabActivity(): void {
    const now = Date.now();
    const inactiveTabs: string[] = [];

    // Check for inactive tabs
    this.activeTabs.forEach((tab, tabId) => {
      if (now - tab.lastActivity > this.TAB_INACTIVE_THRESHOLD) {
        inactiveTabs.push(tabId);
      }
    });

    // Remove inactive tabs
    let masterTabRemoved = false;
    inactiveTabs.forEach(tabId => {
      const tab = this.activeTabs.get(tabId);
      if (tab?.isMaster) {
        masterTabRemoved = true;
      }
      this.activeTabs.delete(tabId);
    });

    // Elect new master if needed
    if (masterTabRemoved) {
      this.scheduleMasterElection('master_tab_inactive');
    }
  }

  private scheduleMasterElection(reason: MasterTabElectionResult['electionReason']): void {
    // Clear existing election timeout
    if (this.masterElectionTimeout) {
      clearTimeout(this.masterElectionTimeout);
    }

    // Schedule new election
    this.masterElectionTimeout = setTimeout(() => {
      this.electMasterTab(reason);
    }, this.MASTER_ELECTION_DELAY);
  }

  private async electMasterTab(reason: MasterTabElectionResult['electionReason']): Promise<MasterTabElectionResult> {
    try {
      const activeTabs = this.getActiveTabs();
      const allTabs = [...activeTabs, this.tabSessionInfo];

      // Check if there's already a master
      const existingMaster = allTabs.find(tab => tab.isMaster);
      if (existingMaster && reason !== 'manual_election') {
        return {
          newMasterTabId: existingMaster.tabId,
          electionReason: reason
        };
      }

      // Elect the tab with the earliest last activity (oldest active tab)
      const sortedTabs = allTabs
        .filter(tab => tab.isActive)
        .sort((a, b) => a.lastActivity - b.lastActivity);

      if (sortedTabs.length === 0) {
        throw new Error('No active tabs available for master election');
      }

      const newMasterTab = sortedTabs[0];
      const previousMasterTabId = existingMaster?.tabId;

      // Update master status
      this.tabSessionInfo.isMaster = newMasterTab.tabId === this.tabSessionInfo.tabId;

      // Announce master election
      await crossTabCommunication.broadcastMessage('MASTER_ELECTION', {
        candidateTabId: newMasterTab.tabId,
        electionReason: reason,
        previousMasterTabId,
        timestamp: Date.now()
      });

      const result: MasterTabElectionResult = {
        newMasterTabId: newMasterTab.tabId,
        previousMasterTabId,
        electionReason: reason
      };

      // Emit master elected event
      this.emitTabEvent('MASTER_ELECTED', result);

      return result;

    } catch (error) {
      console.error('Error during master tab election:', error);
      throw error;
    }
  }

  private emitTabEvent(type: TabSessionEvent['type'], data?: any): void {
    const event: TabSessionEvent = {
      type,
      tabId: this.tabSessionInfo.tabId,
      timestamp: Date.now(),
      data
    };

    try {
      const handlers = this.eventHandlers.get(type);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`Error in tab session event handler for ${type}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Error emitting tab event:', error);
    }
  }

  private clearIntervals(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }

    if (this.masterElectionTimeout) {
      clearTimeout(this.masterElectionTimeout);
      this.masterElectionTimeout = null;
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
export const tabSpecificSessionManager = new TabSpecificSessionManager();