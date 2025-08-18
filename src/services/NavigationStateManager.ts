import { stateManager } from './StateManager';

export interface NavigationState {
  currentPath: string;
  searchParams: URLSearchParams;
  state: any;
  timestamp: number;
}

export interface QueuedNavigation {
  id: string;
  type: 'push' | 'replace' | 'back' | 'forward';
  path?: string;
  state?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface INavigationStateManager {
  // Navigation state preservation
  saveNavigationState(path: string, searchParams?: URLSearchParams, state?: any): Promise<void>;
  restoreNavigationState(): Promise<NavigationState | null>;
  clearNavigationState(): Promise<void>;
  
  // Navigation queue management
  queueNavigation(navigation: Omit<QueuedNavigation, 'id' | 'timestamp' | 'retryCount'>): void;
  processNavigationQueue(): Promise<void>;
  clearNavigationQueue(): Promise<void>;
  
  // Connection state handling
  setConnectionStatus(isOnline: boolean): void;
  isOnline(): boolean;
  
  // Event handling
  onNavigationQueued(callback: (navigation: QueuedNavigation) => void): void;
  onNavigationProcessed(callback: (navigation: QueuedNavigation) => void): void;
  onNavigationFailed(callback: (navigation: QueuedNavigation, error: any) => void): void;
}

export class NavigationStateManager implements INavigationStateManager {
  private readonly NAVIGATION_STATE_KEY = 'navigation-state';
  private readonly NAVIGATION_QUEUE_KEY = 'navigation-queue';
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly QUEUE_PROCESS_INTERVAL = 5000; // 5 seconds
  
  private isOnlineStatus = true;
  private navigationQueue: QueuedNavigation[] = [];
  private queueProcessingInterval: NodeJS.Timeout | null = null;
  
  // Event callbacks
  private onNavigationQueuedCallbacks: ((navigation: QueuedNavigation) => void)[] = [];
  private onNavigationProcessedCallbacks: ((navigation: QueuedNavigation) => void)[] = [];
  private onNavigationFailedCallbacks: ((navigation: QueuedNavigation, error: any) => void)[] = [];

  constructor() {
    this.initializeQueue();
    this.startQueueProcessing();
  }

  async saveNavigationState(path: string, searchParams?: URLSearchParams, state?: any): Promise<void> {
    try {
      const navigationState: NavigationState = {
        currentPath: path,
        searchParams: searchParams || new URLSearchParams(),
        state: state || null,
        timestamp: Date.now()
      };

      await stateManager.saveState(this.NAVIGATION_STATE_KEY, navigationState);
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }
  }

  async restoreNavigationState(): Promise<NavigationState | null> {
    try {
      const savedState = await stateManager.restoreState(this.NAVIGATION_STATE_KEY);
      
      if (!savedState) return null;

      // Check if state is not too old (older than 1 hour)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - savedState.timestamp > oneHour) {
        await this.clearNavigationState();
        return null;
      }

      return {
        ...savedState,
        searchParams: new URLSearchParams(savedState.searchParams)
      };
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
      return null;
    }
  }

  async clearNavigationState(): Promise<void> {
    try {
      await stateManager.clearState(this.NAVIGATION_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear navigation state:', error);
    }
  }

  queueNavigation(navigation: Omit<QueuedNavigation, 'id' | 'timestamp' | 'retryCount'>): void {
    const queuedNavigation: QueuedNavigation = {
      ...navigation,
      id: this.generateNavigationId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: navigation.maxRetries || this.MAX_RETRY_ATTEMPTS
    };

    this.navigationQueue.push(queuedNavigation);
    this.saveNavigationQueue();
    
    // Notify listeners
    this.onNavigationQueuedCallbacks.forEach(callback => {
      try {
        callback(queuedNavigation);
      } catch (error) {
        console.error('Error in navigation queued callback:', error);
      }
    });

    // If online, try to process immediately
    if (this.isOnlineStatus) {
      this.processNavigationQueue();
    }
  }

  async processNavigationQueue(): Promise<void> {
    if (!this.isOnlineStatus || this.navigationQueue.length === 0) {
      return;
    }

    const navigationsToProcess = [...this.navigationQueue];
    
    for (const navigation of navigationsToProcess) {
      try {
        await this.executeNavigation(navigation);
        
        // Remove from queue on success
        this.removeFromQueue(navigation.id);
        
        // Notify listeners
        this.onNavigationProcessedCallbacks.forEach(callback => {
          try {
            callback(navigation);
          } catch (error) {
            console.error('Error in navigation processed callback:', error);
          }
        });
        
      } catch (error) {
        console.error('Failed to execute navigation:', error);
        
        navigation.retryCount++;
        
        if (navigation.retryCount >= navigation.maxRetries) {
          // Remove from queue after max retries
          this.removeFromQueue(navigation.id);
          
          // Notify listeners
          this.onNavigationFailedCallbacks.forEach(callback => {
            try {
              callback(navigation, error);
            } catch (callbackError) {
              console.error('Error in navigation failed callback:', callbackError);
            }
          });
        }
      }
    }

    await this.saveNavigationQueue();
  }

  async clearNavigationQueue(): Promise<void> {
    this.navigationQueue = [];
    await this.saveNavigationQueue();
  }

  setConnectionStatus(isOnline: boolean): void {
    const wasOffline = !this.isOnlineStatus;
    this.isOnlineStatus = isOnline;

    // If coming back online, process queued navigations
    if (wasOffline && isOnline) {
      this.processNavigationQueue();
    }
  }

  isOnline(): boolean {
    return this.isOnlineStatus;
  }

  onNavigationQueued(callback: (navigation: QueuedNavigation) => void): void {
    this.onNavigationQueuedCallbacks.push(callback);
  }

  onNavigationProcessed(callback: (navigation: QueuedNavigation) => void): void {
    this.onNavigationProcessedCallbacks.push(callback);
  }

  onNavigationFailed(callback: (navigation: QueuedNavigation, error: any) => void): void {
    this.onNavigationFailedCallbacks.push(callback);
  }

  // Private methods
  private async initializeQueue(): Promise<void> {
    try {
      const savedQueue = await stateManager.restoreState(this.NAVIGATION_QUEUE_KEY);
      if (savedQueue && Array.isArray(savedQueue)) {
        this.navigationQueue = savedQueue;
      }
    } catch (error) {
      console.error('Failed to initialize navigation queue:', error);
    }
  }

  private async saveNavigationQueue(): Promise<void> {
    try {
      await stateManager.saveState(this.NAVIGATION_QUEUE_KEY, this.navigationQueue);
    } catch (error) {
      console.error('Failed to save navigation queue:', error);
    }
  }

  private startQueueProcessing(): void {
    this.queueProcessingInterval = setInterval(() => {
      if (this.isOnlineStatus && this.navigationQueue.length > 0) {
        this.processNavigationQueue();
      }
    }, this.QUEUE_PROCESS_INTERVAL);
  }

  private stopQueueProcessing(): void {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
  }

  private removeFromQueue(navigationId: string): void {
    this.navigationQueue = this.navigationQueue.filter(nav => nav.id !== navigationId);
  }

  private generateNavigationId(): string {
    return `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async executeNavigation(navigation: QueuedNavigation): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        switch (navigation.type) {
          case 'push':
            if (navigation.path) {
              window.history.pushState(navigation.state, '', navigation.path);
              // Dispatch popstate event to notify React Router
              window.dispatchEvent(new PopStateEvent('popstate', { state: navigation.state }));
            }
            break;
            
          case 'replace':
            if (navigation.path) {
              window.history.replaceState(navigation.state, '', navigation.path);
              window.dispatchEvent(new PopStateEvent('popstate', { state: navigation.state }));
            }
            break;
            
          case 'back':
            window.history.back();
            break;
            
          case 'forward':
            window.history.forward();
            break;
            
          default:
            throw new Error(`Unknown navigation type: ${navigation.type}`);
        }
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Cleanup method
  destroy(): void {
    this.stopQueueProcessing();
    this.onNavigationQueuedCallbacks = [];
    this.onNavigationProcessedCallbacks = [];
    this.onNavigationFailedCallbacks = [];
  }
}

// Singleton instance
export const navigationStateManager = new NavigationStateManager();