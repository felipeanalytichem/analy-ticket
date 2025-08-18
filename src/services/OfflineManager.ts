import { openDB, IDBPDatabase } from 'idb';
import { supabase } from '@/lib/supabase';
import { connectionMonitor, ConnectionStatus } from './ConnectionMonitor';
import { stateManager } from './StateManager';

// Types and interfaces
export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'QUERY';
  table: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
}

export interface CachedData {
  id: string;
  table: string;
  data: any;
  timestamp: Date;
  expiresAt: Date;
  version: number;
  isStale?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedActions: number;
  failedActions: number;
  conflicts: ConflictResolution[];
  errors: string[];
}

export interface ConflictResolution {
  actionId: string;
  type: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  serverData: any;
  clientData: any;
  resolvedData?: any;
}

export interface OfflineStatus {
  isOffline: boolean;
  lastSync: Date | null;
  pendingActions: number;
  cachedDataSize: number;
  syncInProgress: boolean;
}

export interface IOfflineManager {
  // Core offline functionality
  initialize(): Promise<void>;
  isOffline(): boolean;
  getOfflineStatus(): OfflineStatus;
  
  // Data caching
  cacheData(table: string, data: any, ttl?: number): Promise<void>;
  getCachedData(table: string, id?: string): Promise<CachedData[]>;
  invalidateCache(table: string, id?: string): Promise<void>;
  
  // Action queuing
  queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string>;
  getQueuedActions(): Promise<OfflineAction[]>;
  removeQueuedAction(actionId: string): Promise<void>;
  
  // Synchronization
  syncData(): Promise<SyncResult>;
  syncTable(table: string): Promise<SyncResult>;
  
  // Event handling
  onOfflineStatusChange(callback: (status: OfflineStatus) => void): void;
  onSyncProgress(callback: (progress: { completed: number; total: number }) => void): void;
  onConflictDetected(callback: (conflict: ConflictResolution) => void): void;
}

/**
 * OfflineManager service provides comprehensive offline capability
 * including data caching, action queuing, and synchronization
 */
export class OfflineManager implements IOfflineManager {
  private static instance: OfflineManager;
  private db: IDBPDatabase | null = null;
  private isInitialized = false;
  private syncInProgress = false;
  private lastSync: Date | null = null;
  
  // Database configuration
  private readonly DB_NAME = 'analy-ticket-offline';
  private readonly DB_VERSION = 1;
  private readonly CACHE_STORE = 'cached-data';
  private readonly ACTIONS_STORE = 'queued-actions';
  
  // Cache configuration
  private readonly DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly CACHE_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  // Sync configuration
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly SYNC_BATCH_SIZE = 10;
  private readonly SYNC_TIMEOUT = 30000; // 30 seconds
  
  // Event callbacks
  private offlineStatusCallbacks: ((status: OfflineStatus) => void)[] = [];
  private syncProgressCallbacks: ((progress: { completed: number; total: number }) => void)[] = [];
  private conflictCallbacks: ((conflict: ConflictResolution) => void)[] = [];
  
  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.handleConnectionChange = this.handleConnectionChange.bind(this);
  }

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  // For testing purposes
  static createInstance(): OfflineManager {
    return new OfflineManager();
  }

  static resetInstance(): void {
    if (OfflineManager.instance) {
      OfflineManager.instance.cleanup();
      OfflineManager.instance = null as any;
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📱 [OfflineManager] Already initialized');
      return;
    }

    console.log('📱 [OfflineManager] Initializing offline manager');

    try {
      await this.initializeDatabase();
      this.setupConnectionMonitoring();
      this.startCacheCleanup();
      
      // Perform initial sync if online
      if (!this.isOffline()) {
        setTimeout(() => {
          this.syncData().catch(error => {
            console.error('Initial sync failed:', error);
          });
        }, 1000);
      }
      
      this.isInitialized = true;
      console.log('📱 [OfflineManager] Initialization complete');
      
    } catch (error) {
      console.error('📱 [OfflineManager] Initialization failed:', error);
      throw error;
    }
  }

  isOffline(): boolean {
    return !connectionMonitor.isOnline();
  }

  getOfflineStatus(): OfflineStatus {
    return {
      isOffline: this.isOffline(),
      lastSync: this.lastSync,
      pendingActions: 0, // Will be updated by actual count
      cachedDataSize: 0, // Will be updated by actual size
      syncInProgress: this.syncInProgress
    };
  }

  async cacheData(table: string, data: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttl);
      
      const cachedData: CachedData = {
        id: data.id || this.generateId(),
        table,
        data,
        timestamp: now,
        expiresAt,
        version: 1
      };

      const tx = this.db.transaction(this.CACHE_STORE, 'readwrite');
      const store = tx.objectStore(this.CACHE_STORE);
      
      // Use composite key: table + id
      const key = `${table}:${cachedData.id}`;
      await store.put({ ...cachedData, key });
      
      console.log(`📱 [OfflineManager] Cached data for ${table}:${cachedData.id}`);
      
    } catch (error) {
      console.error('Failed to cache data:', error);
      throw error;
    }
  }

  async getCachedData(table: string, id?: string): Promise<CachedData[]> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const tx = this.db.transaction(this.CACHE_STORE, 'readonly');
      const store = tx.objectStore(this.CACHE_STORE);
      
      if (id) {
        // Get specific item
        const key = `${table}:${id}`;
        const result = await store.get(key);
        return result ? [result] : [];
      } else {
        // Get all items for table
        const allData = await store.getAll();
        return allData
          .filter(item => item.table === table)
          .filter(item => new Date() < new Date(item.expiresAt)); // Filter expired
      }
      
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return [];
    }
  }

  async invalidateCache(table: string, id?: string): Promise<void> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const tx = this.db.transaction(this.CACHE_STORE, 'readwrite');
      const store = tx.objectStore(this.CACHE_STORE);
      
      if (id) {
        // Invalidate specific item
        const key = `${table}:${id}`;
        await store.delete(key);
        console.log(`📱 [OfflineManager] Invalidated cache for ${table}:${id}`);
      } else {
        // Invalidate all items for table
        const allData = await store.getAll();
        const keysToDelete = allData
          .filter(item => item.table === table)
          .map(item => item.key);
        
        for (const key of keysToDelete) {
          await store.delete(key);
        }
        console.log(`📱 [OfflineManager] Invalidated all cache for ${table}`);
      }
      
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
      throw error;
    }
  }

  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const queuedAction: OfflineAction = {
        ...action,
        id: this.generateId(),
        timestamp: new Date(),
        retryCount: 0
      };

      const tx = this.db.transaction(this.ACTIONS_STORE, 'readwrite');
      await tx.objectStore(this.ACTIONS_STORE).put(queuedAction);
      
      console.log(`📱 [OfflineManager] Queued action: ${queuedAction.type} on ${queuedAction.table}`);
      
      // Notify status change
      this.notifyOfflineStatusChange();
      
      // Try to sync immediately if online
      if (!this.isOffline() && !this.syncInProgress) {
        setTimeout(() => {
          this.syncData().catch(error => {
            console.error('Auto-sync failed:', error);
          });
        }, 100);
      }
      
      return queuedAction.id;
      
    } catch (error) {
      console.error('Failed to queue action:', error);
      throw error;
    }
  }

  async getQueuedActions(): Promise<OfflineAction[]> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const tx = this.db.transaction(this.ACTIONS_STORE, 'readonly');
      const actions = await tx.objectStore(this.ACTIONS_STORE).getAll();
      
      // Sort by priority and timestamp
      return actions.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
    } catch (error) {
      console.error('Failed to get queued actions:', error);
      return [];
    }
  }

  async removeQueuedAction(actionId: string): Promise<void> {
    if (!this.db) {
      throw new Error('OfflineManager not initialized');
    }

    try {
      const tx = this.db.transaction(this.ACTIONS_STORE, 'readwrite');
      await tx.objectStore(this.ACTIONS_STORE).delete(actionId);
      
      console.log(`📱 [OfflineManager] Removed queued action: ${actionId}`);
      
      // Notify status change
      this.notifyOfflineStatusChange();
      
    } catch (error) {
      console.error('Failed to remove queued action:', error);
      throw error;
    }
  }

  async syncData(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('📱 [OfflineManager] Sync already in progress');
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: ['Sync already in progress']
      };
    }

    if (this.isOffline()) {
      console.log('📱 [OfflineManager] Cannot sync while offline');
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: ['Device is offline']
      };
    }

    console.log('📱 [OfflineManager] Starting data synchronization');
    this.syncInProgress = true;

    try {
      const actions = await this.getQueuedActions();
      const result: SyncResult = {
        success: true,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: []
      };

      // Process actions in batches
      for (let i = 0; i < actions.length; i += this.SYNC_BATCH_SIZE) {
        const batch = actions.slice(i, i + this.SYNC_BATCH_SIZE);
        
        for (const action of batch) {
          try {
            const syncResult = await this.syncAction(action);
            
            if (syncResult.success) {
              await this.removeQueuedAction(action.id);
              result.syncedActions++;
            } else {
              // Update retry count
              action.retryCount++;
              
              if (action.retryCount >= action.maxRetries) {
                await this.removeQueuedAction(action.id);
                result.failedActions++;
                result.errors.push(`Action ${action.id} exceeded max retries`);
              } else {
                // Update action in store
                const tx = this.db!.transaction(this.ACTIONS_STORE, 'readwrite');
                await tx.objectStore(this.ACTIONS_STORE).put(action);
                result.failedActions++;
              }
              
              if (syncResult.conflict) {
                result.conflicts.push(syncResult.conflict);
                this.notifyConflictDetected(syncResult.conflict);
              }
            }
            
          } catch (error) {
            console.error(`Failed to sync action ${action.id}:`, error);
            result.failedActions++;
            result.errors.push(`Action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // Notify progress
        this.notifySyncProgress({
          completed: Math.min(i + this.SYNC_BATCH_SIZE, actions.length),
          total: actions.length
        });
      }

      this.lastSync = new Date();
      result.success = result.failedActions === 0;
      
      console.log(`📱 [OfflineManager] Sync complete: ${result.syncedActions} synced, ${result.failedActions} failed`);
      
      return result;
      
    } catch (error) {
      console.error('📱 [OfflineManager] Sync failed:', error);
      return {
        success: false,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      };
    } finally {
      this.syncInProgress = false;
      this.notifyOfflineStatusChange();
    }
  }

  async syncTable(table: string): Promise<SyncResult> {
    const actions = await this.getQueuedActions();
    const tableActions = actions.filter(action => action.table === table);
    
    // Create a temporary offline manager instance for table-specific sync
    // This is a simplified implementation - in practice, you'd want to
    // modify the main sync logic to accept table filters
    console.log(`📱 [OfflineManager] Syncing table: ${table} (${tableActions.length} actions)`);
    
    // For now, delegate to main sync and filter results
    const fullResult = await this.syncData();
    
    return {
      ...fullResult,
      syncedActions: Math.min(fullResult.syncedActions, tableActions.length),
      failedActions: Math.min(fullResult.failedActions, tableActions.length)
    };
  }

  onOfflineStatusChange(callback: (status: OfflineStatus) => void): void {
    this.offlineStatusCallbacks.push(callback);
  }

  onSyncProgress(callback: (progress: { completed: number; total: number }) => void): void {
    this.syncProgressCallbacks.push(callback);
  }

  onConflictDetected(callback: (conflict: ConflictResolution) => void): void {
    this.conflictCallbacks.push(callback);
  }

  // Private methods

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create cached data store
          if (!db.objectStoreNames.contains('cached-data')) {
            const cacheStore = db.createObjectStore('cached-data', { keyPath: 'key' });
            cacheStore.createIndex('table', 'table');
            cacheStore.createIndex('timestamp', 'timestamp');
            cacheStore.createIndex('expiresAt', 'expiresAt');
          }
          
          // Create queued actions store
          if (!db.objectStoreNames.contains('queued-actions')) {
            const actionsStore = db.createObjectStore('queued-actions', { keyPath: 'id' });
            actionsStore.createIndex('table', 'table');
            actionsStore.createIndex('priority', 'priority');
            actionsStore.createIndex('timestamp', 'timestamp');
          }
        },
      });
      
      console.log('📱 [OfflineManager] Database initialized');
      
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
      throw error;
    }
  }

  private setupConnectionMonitoring(): void {
    connectionMonitor.onConnectionChange(this.handleConnectionChange);
  }

  private handleConnectionChange(status: ConnectionStatus): void {
    console.log('📱 [OfflineManager] Connection status changed:', status.isOnline ? 'online' : 'offline');
    
    this.notifyOfflineStatusChange();
    
    // Auto-sync when coming back online
    if (status.isOnline && !this.syncInProgress) {
      setTimeout(() => {
        this.syncData().catch(error => {
          console.error('Auto-sync on reconnection failed:', error);
        });
      }, 2000); // Wait 2 seconds for connection to stabilize
    }
  }

  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache().catch(error => {
        console.error('Cache cleanup failed:', error);
      });
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  private async cleanupExpiredCache(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(this.CACHE_STORE, 'readwrite');
      const store = tx.objectStore(this.CACHE_STORE);
      const now = new Date();
      
      const allData = await store.getAll();
      let cleanedCount = 0;
      
      for (const item of allData) {
        if (new Date(item.expiresAt) < now) {
          await store.delete(item.key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`📱 [OfflineManager] Cleaned up ${cleanedCount} expired cache entries`);
      }
      
    } catch (error) {
      console.error('Failed to cleanup expired cache:', error);
    }
  }

  private async syncAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      console.log(`📱 [OfflineManager] Syncing action: ${action.type} on ${action.table}`);
      
      switch (action.type) {
        case 'CREATE':
          return await this.syncCreateAction(action);
        case 'UPDATE':
          return await this.syncUpdateAction(action);
        case 'DELETE':
          return await this.syncDeleteAction(action);
        case 'QUERY':
          return await this.syncQueryAction(action);
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
    } catch (error) {
      console.error(`Failed to sync action ${action.id}:`, error);
      return { success: false };
    }
  }

  private async syncCreateAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      const { data, error } = await supabase
        .from(action.table)
        .insert(action.payload)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update cache with server data
      await this.cacheData(action.table, data);
      
      return { success: true };
      
    } catch (error: any) {
      // Handle conflicts (e.g., duplicate key)
      if (error.code === '23505') { // Unique constraint violation
        const conflict: ConflictResolution = {
          actionId: action.id,
          type: 'server_wins',
          serverData: null,
          clientData: action.payload
        };
        
        return { success: false, conflict };
      }
      
      throw error;
    }
  }

  private async syncUpdateAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      // First, get current server data to check for conflicts
      const { data: serverData, error: fetchError } = await supabase
        .from(action.table)
        .select('*')
        .eq('id', action.payload.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      
      // Check for conflicts based on version or timestamp
      if (serverData && this.hasConflict(serverData, action.payload)) {
        const conflict: ConflictResolution = {
          actionId: action.id,
          type: 'manual', // Let user decide
          serverData,
          clientData: action.payload
        };
        
        return { success: false, conflict };
      }
      
      // Perform update
      const { data, error } = await supabase
        .from(action.table)
        .update(action.payload)
        .eq('id', action.payload.id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update cache
      await this.cacheData(action.table, data);
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private async syncDeleteAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      const { error } = await supabase
        .from(action.table)
        .delete()
        .eq('id', action.payload.id);
      
      if (error) {
        throw error;
      }
      
      // Remove from cache
      await this.invalidateCache(action.table, action.payload.id);
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private async syncQueryAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      // This is for caching query results
      const { data, error } = await supabase
        .from(action.table)
        .select(action.payload.select || '*')
        .limit(action.payload.limit || 100);
      
      if (error) {
        throw error;
      }
      
      // Cache the results
      for (const item of data || []) {
        await this.cacheData(action.table, item);
      }
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private hasConflict(serverData: any, clientData: any): boolean {
    // Simple conflict detection based on updated_at timestamp
    if (serverData.updated_at && clientData.updated_at) {
      return new Date(serverData.updated_at) > new Date(clientData.updated_at);
    }
    
    // If no timestamp, assume no conflict
    return false;
  }

  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async notifyOfflineStatusChange(): Promise<void> {
    try {
      const status = await this.getOfflineStatusWithCounts();
      
      this.offlineStatusCallbacks.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in offline status callback:', error);
        }
      });
    } catch (error) {
      console.error('Error getting offline status:', error);
    }
  }

  private notifySyncProgress(progress: { completed: number; total: number }): void {
    this.syncProgressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in sync progress callback:', error);
      }
    });
  }

  private notifyConflictDetected(conflict: ConflictResolution): void {
    this.conflictCallbacks.forEach(callback => {
      try {
        callback(conflict);
      } catch (error) {
        console.error('Error in conflict callback:', error);
      }
    });
  }

  private async getOfflineStatusWithCounts(): Promise<OfflineStatus> {
    try {
      const actions = await this.getQueuedActions();
      const cachedData = await this.getCachedDataSize();
      
      return {
        isOffline: this.isOffline(),
        lastSync: this.lastSync,
        pendingActions: actions.length,
        cachedDataSize: cachedData,
        syncInProgress: this.syncInProgress
      };
    } catch (error) {
      // Return basic status if we can't get counts
      return {
        isOffline: this.isOffline(),
        lastSync: this.lastSync,
        pendingActions: 0,
        cachedDataSize: 0,
        syncInProgress: this.syncInProgress
      };
    }
  }

  private async getCachedDataSize(): Promise<number> {
    if (!this.db) return 0;
    
    try {
      const tx = this.db.transaction(this.CACHE_STORE, 'readonly');
      const allData = await tx.objectStore(this.CACHE_STORE).getAll();
      
      let totalSize = 0;
      for (const item of allData) {
        totalSize += new Blob([JSON.stringify(item)]).size;
      }
      
      return totalSize;
      
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }

  // Cleanup method
  cleanup(): void {
    console.log('🧹 [OfflineManager] Cleaning up');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.offlineStatusCallbacks = [];
    this.syncProgressCallbacks = [];
    this.conflictCallbacks = [];
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const offlineManager = OfflineManager.getInstance();