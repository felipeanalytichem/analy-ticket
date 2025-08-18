import { offlineManager, OfflineAction, SyncResult, ConflictResolution } from './OfflineManager';
import { connectionMonitor } from './ConnectionMonitor';
import { supabase } from '@/lib/supabase';

// Types and interfaces
export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  percentage: number;
  currentAction?: string;
  estimatedTimeRemaining?: number;
}

export interface SyncConfiguration {
  batchSize: number;
  maxConcurrentSyncs: number;
  retryDelay: number;
  maxRetryAttempts: number;
  priorityWeights: {
    high: number;
    medium: number;
    low: number;
  };
  conflictResolutionStrategy: 'server_wins' | 'client_wins' | 'manual' | 'merge';
  enableProgressTracking: boolean;
  enableSelectiveSync: boolean;
}

export interface SyncFilter {
  tables?: string[];
  priorities?: ('high' | 'medium' | 'low')[];
  actionTypes?: ('CREATE' | 'UPDATE' | 'DELETE' | 'QUERY')[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  maxActions?: number;
}

export interface ConflictResolutionRule {
  table: string;
  field: string;
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  mergeFunction?: (serverValue: any, clientValue: any) => any;
}

export interface BackgroundSyncStatus {
  isRunning: boolean;
  lastSync: Date | null;
  nextScheduledSync: Date | null;
  totalActionsSynced: number;
  totalConflictsResolved: number;
  averageSyncTime: number;
  syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  timestamp: Date;
  duration: number;
  actionsSynced: number;
  actionsFailed: number;
  conflicts: number;
  success: boolean;
  error?: string;
}

export interface IBackgroundSyncManager {
  // Configuration
  configure(config: Partial<SyncConfiguration>): void;
  getConfiguration(): SyncConfiguration;
  
  // Sync operations
  startBackgroundSync(): Promise<void>;
  stopBackgroundSync(): void;
  syncWithFilter(filter: SyncFilter): Promise<SyncResult>;
  forceSyncNow(): Promise<SyncResult>;
  
  // Progress tracking
  getSyncProgress(): SyncProgress | null;
  getSyncStatus(): BackgroundSyncStatus;
  
  // Conflict resolution
  addConflictResolutionRule(rule: ConflictResolutionRule): void;
  removeConflictResolutionRule(table: string, field: string): void;
  resolveConflictManually(conflictId: string, resolution: any): Promise<void>;
  
  // Event handling
  onSyncProgress(callback: (progress: SyncProgress) => void): void;
  onSyncComplete(callback: (result: SyncResult) => void): void;
  onConflictDetected(callback: (conflict: ConflictResolution) => void): void;
  onSyncError(callback: (error: Error) => void): void;
}

/**
 * BackgroundSyncManager provides advanced synchronization capabilities
 * including conflict resolution, progress tracking, and selective sync
 */
export class BackgroundSyncManager implements IBackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private currentSyncProgress: SyncProgress | null = null;
  private syncHistory: SyncHistoryEntry[] = [];
  private conflictResolutionRules: Map<string, ConflictResolutionRule> = new Map();
  private pendingConflicts: Map<string, ConflictResolution> = new Map();
  
  // Configuration
  private config: SyncConfiguration = {
    batchSize: 10,
    maxConcurrentSyncs: 3,
    retryDelay: 5000,
    maxRetryAttempts: 3,
    priorityWeights: {
      high: 3,
      medium: 2,
      low: 1
    },
    conflictResolutionStrategy: 'manual',
    enableProgressTracking: true,
    enableSelectiveSync: true
  };
  
  // Statistics
  private totalActionsSynced = 0;
  private totalConflictsResolved = 0;
  private syncTimes: number[] = [];
  private lastSync: Date | null = null;
  private nextScheduledSync: Date | null = null;
  
  // Event callbacks
  private progressCallbacks: ((progress: SyncProgress) => void)[] = [];
  private completeCallbacks: ((result: SyncResult) => void)[] = [];
  private conflictCallbacks: ((conflict: ConflictResolution) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  
  // Sync control
  private readonly SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MAX_HISTORY_ENTRIES = 50;

  private constructor() {
    this.setupDefaultConflictRules();
    this.handleConnectionChange = this.handleConnectionChange.bind(this);
  }

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  // For testing purposes
  static createInstance(): BackgroundSyncManager {
    return new BackgroundSyncManager();
  }

  static resetInstance(): void {
    if (BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance.cleanup();
      BackgroundSyncManager.instance = null as any;
    }
  }

  configure(config: Partial<SyncConfiguration>): void {
    this.config = { ...this.config, ...config };
    console.log('🔄 [BackgroundSyncManager] Configuration updated:', this.config);
  }

  getConfiguration(): SyncConfiguration {
    return { ...this.config };
  }

  async startBackgroundSync(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 [BackgroundSyncManager] Background sync already running');
      return;
    }

    console.log('🔄 [BackgroundSyncManager] Starting background sync');
    this.isRunning = true;
    
    // Setup connection monitoring
    connectionMonitor.onConnectionChange(this.handleConnectionChange);
    
    // Start periodic sync
    this.scheduleNextSync();
    
    // Perform initial sync if online
    if (!offlineManager.isOffline()) {
      setTimeout(() => {
        this.performBackgroundSync().catch(error => {
          console.error('Initial background sync failed:', error);
          this.notifyError(error);
        });
      }, 1000);
    }
  }

  stopBackgroundSync(): void {
    if (!this.isRunning) {
      console.log('🔄 [BackgroundSyncManager] Background sync not running');
      return;
    }

    console.log('🔄 [BackgroundSyncManager] Stopping background sync');
    this.isRunning = false;
    
    if (this.syncInterval) {
      clearTimeout(this.syncInterval);
      this.syncInterval = null;
    }
    
    this.nextScheduledSync = null;
  }

  async syncWithFilter(filter: SyncFilter): Promise<SyncResult> {
    console.log('🔄 [BackgroundSyncManager] Starting filtered sync:', filter);
    
    if (offlineManager.isOffline()) {
      throw new Error('Cannot sync while offline');
    }

    const startTime = Date.now();
    const actions = await this.getFilteredActions(filter);
    
    if (actions.length === 0) {
      console.log('🔄 [BackgroundSyncManager] No actions to sync with current filter');
      return {
        success: true,
        syncedActions: 0,
        failedActions: 0,
        conflicts: [],
        errors: []
      };
    }

    const result = await this.syncActions(actions);
    const duration = Date.now() - startTime;
    
    // Record sync history
    this.recordSyncHistory({
      timestamp: new Date(),
      duration,
      actionsSynced: result.syncedActions,
      actionsFailed: result.failedActions,
      conflicts: result.conflicts.length,
      success: result.success,
      error: result.errors.length > 0 ? result.errors[0] : undefined
    });
    
    return result;
  }

  async forceSyncNow(): Promise<SyncResult> {
    console.log('🔄 [BackgroundSyncManager] Force sync requested');
    
    if (offlineManager.isOffline()) {
      throw new Error('Cannot sync while offline');
    }

    return this.performBackgroundSync();
  }

  getSyncProgress(): SyncProgress | null {
    return this.currentSyncProgress ? { ...this.currentSyncProgress } : null;
  }

  getSyncStatus(): BackgroundSyncStatus {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      nextScheduledSync: this.nextScheduledSync,
      totalActionsSynced: this.totalActionsSynced,
      totalConflictsResolved: this.totalConflictsResolved,
      averageSyncTime: this.getAverageSyncTime(),
      syncHistory: [...this.syncHistory]
    };
  }

  addConflictResolutionRule(rule: ConflictResolutionRule): void {
    const key = `${rule.table}:${rule.field}`;
    this.conflictResolutionRules.set(key, rule);
    console.log(`🔄 [BackgroundSyncManager] Added conflict resolution rule for ${key}`);
  }

  removeConflictResolutionRule(table: string, field: string): void {
    const key = `${table}:${field}`;
    this.conflictResolutionRules.delete(key);
    console.log(`🔄 [BackgroundSyncManager] Removed conflict resolution rule for ${key}`);
  }

  async resolveConflictManually(conflictId: string, resolution: any): Promise<void> {
    const conflict = this.pendingConflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    try {
      // Apply the manual resolution
      await this.applyConflictResolution(conflict, resolution);
      
      // Remove from pending conflicts
      this.pendingConflicts.delete(conflictId);
      this.totalConflictsResolved++;
      
      console.log(`🔄 [BackgroundSyncManager] Manually resolved conflict ${conflictId}`);
      
    } catch (error) {
      console.error(`Failed to resolve conflict ${conflictId}:`, error);
      throw error;
    }
  }

  onSyncProgress(callback: (progress: SyncProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  onSyncComplete(callback: (result: SyncResult) => void): void {
    this.completeCallbacks.push(callback);
  }

  onConflictDetected(callback: (conflict: ConflictResolution) => void): void {
    this.conflictCallbacks.push(callback);
  }

  onSyncError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  // Private methods

  private async performBackgroundSync(): Promise<SyncResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 [BackgroundSyncManager] Starting background sync');
      
      const actions = await offlineManager.getQueuedActions();
      
      if (actions.length === 0) {
        console.log('🔄 [BackgroundSyncManager] No actions to sync');
        return {
          success: true,
          syncedActions: 0,
          failedActions: 0,
          conflicts: [],
          errors: []
        };
      }

      // Sort actions by priority and dependencies
      const sortedActions = this.sortActionsByPriority(actions);
      
      const result = await this.syncActions(sortedActions);
      const duration = Date.now() - startTime;
      
      // Update statistics
      this.lastSync = new Date();
      this.totalActionsSynced += result.syncedActions;
      this.recordSyncTime(duration);
      
      // Record history
      this.recordSyncHistory({
        timestamp: new Date(),
        duration,
        actionsSynced: result.syncedActions,
        actionsFailed: result.failedActions,
        conflicts: result.conflicts.length,
        success: result.success
      });
      
      // Notify completion
      this.notifyComplete(result);
      
      console.log(`🔄 [BackgroundSyncManager] Background sync complete: ${result.syncedActions} synced, ${result.failedActions} failed`);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('🔄 [BackgroundSyncManager] Background sync failed:', error);
      
      // Record failed sync
      this.recordSyncHistory({
        timestamp: new Date(),
        duration,
        actionsSynced: 0,
        actionsFailed: 0,
        conflicts: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      this.notifyError(error instanceof Error ? error : new Error('Unknown sync error'));
      
      throw error;
    } finally {
      this.currentSyncProgress = null;
      this.scheduleNextSync();
    }
  }

  private async syncActions(actions: OfflineAction[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedActions: 0,
      failedActions: 0,
      conflicts: [],
      errors: []
    };

    if (this.config.enableProgressTracking) {
      this.currentSyncProgress = {
        total: actions.length,
        completed: 0,
        failed: 0,
        inProgress: 0,
        percentage: 0,
        currentAction: undefined,
        estimatedTimeRemaining: undefined
      };
    }

    // Process actions in batches
    for (let i = 0; i < actions.length; i += this.config.batchSize) {
      const batch = actions.slice(i, i + this.config.batchSize);
      
      // Process batch with concurrency control
      const batchPromises = batch.map(async (action, index) => {
        if (this.currentSyncProgress) {
          this.currentSyncProgress.currentAction = `${action.type} ${action.table}`;
          this.currentSyncProgress.inProgress++;
          this.notifyProgress();
        }

        try {
          const syncResult = await this.syncSingleAction(action);
          
          if (syncResult.success) {
            await offlineManager.removeQueuedAction(action.id);
            result.syncedActions++;
          } else {
            result.failedActions++;
            
            if (syncResult.conflict) {
              result.conflicts.push(syncResult.conflict);
              await this.handleConflict(syncResult.conflict);
            }
          }
          
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
          result.failedActions++;
          result.errors.push(`Action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          if (this.currentSyncProgress) {
            this.currentSyncProgress.completed++;
            this.currentSyncProgress.inProgress--;
            this.currentSyncProgress.percentage = Math.round((this.currentSyncProgress.completed / this.currentSyncProgress.total) * 100);
            this.notifyProgress();
          }
        }
      });

      // Wait for batch to complete with concurrency limit
      const concurrentBatches = Math.min(this.config.maxConcurrentSyncs, batchPromises.length);
      for (let j = 0; j < batchPromises.length; j += concurrentBatches) {
        const concurrentPromises = batchPromises.slice(j, j + concurrentBatches);
        await Promise.all(concurrentPromises);
      }
    }

    result.success = result.failedActions === 0;
    return result;
  }

  private async syncSingleAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
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
        // Handle conflicts
        if (error.code === '23505') { // Unique constraint violation
          const conflict = await this.createConflictResolution(action, error, null);
          return { success: false, conflict };
        }
        throw error;
      }
      
      // Cache the created data
      await offlineManager.cacheData(action.table, data);
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private async syncUpdateAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      // First, get current server data
      const { data: serverData, error: fetchError } = await supabase
        .from(action.table)
        .select('*')
        .eq('id', action.payload.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      
      // Check for conflicts
      if (serverData && this.hasConflict(serverData, action.payload)) {
        const conflict = await this.createConflictResolution(action, null, serverData);
        
        // Try to auto-resolve based on rules
        const resolved = await this.tryAutoResolveConflict(conflict);
        if (!resolved) {
          return { success: false, conflict };
        }
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
      
      // Cache updated data
      await offlineManager.cacheData(action.table, data);
      
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
      await offlineManager.invalidateCache(action.table, action.payload.id);
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private async syncQueryAction(action: OfflineAction): Promise<{ success: boolean; conflict?: ConflictResolution }> {
    try {
      const { data, error } = await supabase
        .from(action.table)
        .select(action.payload.select || '*')
        .limit(action.payload.limit || 100);
      
      if (error) {
        throw error;
      }
      
      // Cache query results
      for (const item of data || []) {
        await offlineManager.cacheData(action.table, item);
      }
      
      return { success: true };
      
    } catch (error) {
      throw error;
    }
  }

  private async getFilteredActions(filter: SyncFilter): Promise<OfflineAction[]> {
    const allActions = await offlineManager.getQueuedActions();
    
    return allActions.filter(action => {
      // Filter by tables
      if (filter.tables && !filter.tables.includes(action.table)) {
        return false;
      }
      
      // Filter by priorities
      if (filter.priorities && !filter.priorities.includes(action.priority)) {
        return false;
      }
      
      // Filter by action types
      if (filter.actionTypes && !filter.actionTypes.includes(action.type)) {
        return false;
      }
      
      // Filter by date range
      if (filter.dateRange) {
        const actionDate = new Date(action.timestamp);
        if (actionDate < filter.dateRange.from || actionDate > filter.dateRange.to) {
          return false;
        }
      }
      
      return true;
    }).slice(0, filter.maxActions);
  }

  private sortActionsByPriority(actions: OfflineAction[]): OfflineAction[] {
    return actions.sort((a, b) => {
      // Sort by priority weight
      const priorityDiff = this.config.priorityWeights[b.priority] - this.config.priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp (older first)
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  private hasConflict(serverData: any, clientData: any): boolean {
    // Simple conflict detection based on updated_at timestamp
    if (serverData.updated_at && clientData.updated_at) {
      return new Date(serverData.updated_at) > new Date(clientData.updated_at);
    }
    
    // Check for field-level conflicts
    for (const key in clientData) {
      if (key !== 'id' && key !== 'created_at' && serverData[key] !== clientData[key]) {
        return true;
      }
    }
    
    return false;
  }

  private async createConflictResolution(
    action: OfflineAction,
    error: any,
    serverData: any
  ): Promise<ConflictResolution> {
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conflict: ConflictResolution = {
      actionId: action.id,
      type: this.config.conflictResolutionStrategy,
      serverData,
      clientData: action.payload
    };
    
    // Store pending conflict
    this.pendingConflicts.set(conflictId, conflict);
    
    return conflict;
  }

  private async tryAutoResolveConflict(conflict: ConflictResolution): Promise<boolean> {
    if (conflict.type === 'manual') {
      return false; // Cannot auto-resolve manual conflicts
    }
    
    try {
      let resolvedData: any;
      
      switch (conflict.type) {
        case 'server_wins':
          resolvedData = conflict.serverData;
          break;
        case 'client_wins':
          resolvedData = conflict.clientData;
          break;
        case 'merge':
          resolvedData = this.mergeConflictData(conflict.serverData, conflict.clientData);
          break;
        default:
          return false;
      }
      
      await this.applyConflictResolution(conflict, resolvedData);
      this.totalConflictsResolved++;
      
      return true;
      
    } catch (error) {
      console.error('Failed to auto-resolve conflict:', error);
      return false;
    }
  }

  private mergeConflictData(serverData: any, clientData: any): any {
    // Simple merge strategy - prefer client data for most fields
    const merged = { ...serverData };
    
    for (const key in clientData) {
      if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        // Apply field-specific merge rules if available
        const rule = this.conflictResolutionRules.get(`${serverData.table}:${key}`);
        if (rule && rule.mergeFunction) {
          merged[key] = rule.mergeFunction(serverData[key], clientData[key]);
        } else {
          merged[key] = clientData[key]; // Default to client value
        }
      }
    }
    
    // Update timestamp
    merged.updated_at = new Date().toISOString();
    
    return merged;
  }

  private async applyConflictResolution(conflict: ConflictResolution, resolution: any): Promise<void> {
    // This would apply the resolved data to the server
    // Implementation depends on the specific conflict type and table
    console.log('🔄 [BackgroundSyncManager] Applying conflict resolution:', conflict.actionId);
    
    // For now, just log the resolution
    // In a real implementation, this would update the server with the resolved data
  }

  private async handleConflict(conflict: ConflictResolution): Promise<void> {
    console.log('🔄 [BackgroundSyncManager] Conflict detected:', conflict.actionId);
    
    // Try auto-resolution first
    const resolved = await this.tryAutoResolveConflict(conflict);
    
    if (!resolved) {
      // Notify about manual conflict
      this.notifyConflict(conflict);
    }
  }

  private handleConnectionChange(status: any): void {
    if (status.isOnline && this.isRunning) {
      console.log('🔄 [BackgroundSyncManager] Connection restored, triggering sync');
      
      // Trigger sync after a short delay
      setTimeout(() => {
        this.performBackgroundSync().catch(error => {
          console.error('Auto-sync on reconnection failed:', error);
          this.notifyError(error);
        });
      }, 2000);
    }
  }

  private scheduleNextSync(): void {
    if (!this.isRunning) return;
    
    this.syncInterval = setTimeout(() => {
      if (this.isRunning && !offlineManager.isOffline()) {
        this.performBackgroundSync().catch(error => {
          console.error('Scheduled background sync failed:', error);
          this.notifyError(error);
        });
      } else {
        this.scheduleNextSync(); // Reschedule if offline
      }
    }, this.SYNC_INTERVAL);
    
    this.nextScheduledSync = new Date(Date.now() + this.SYNC_INTERVAL);
  }

  private setupDefaultConflictRules(): void {
    // Add some default conflict resolution rules
    this.addConflictResolutionRule({
      table: 'tickets',
      field: 'status',
      strategy: 'server_wins' // Server status takes precedence
    });
    
    this.addConflictResolutionRule({
      table: 'tickets',
      field: 'description',
      strategy: 'merge',
      mergeFunction: (serverValue: string, clientValue: string) => {
        // Simple merge: append client changes if different
        if (serverValue !== clientValue && !serverValue.includes(clientValue)) {
          return `${serverValue}\n\n[Client Update]: ${clientValue}`;
        }
        return serverValue;
      }
    });
  }

  private recordSyncHistory(entry: SyncHistoryEntry): void {
    this.syncHistory.unshift(entry);
    
    // Keep only the last N entries
    if (this.syncHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.syncHistory = this.syncHistory.slice(0, this.MAX_HISTORY_ENTRIES);
    }
  }

  private recordSyncTime(duration: number): void {
    this.syncTimes.push(duration);
    
    // Keep only the last 20 sync times for average calculation
    if (this.syncTimes.length > 20) {
      this.syncTimes.shift();
    }
  }

  private getAverageSyncTime(): number {
    if (this.syncTimes.length === 0) return 0;
    
    const sum = this.syncTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.syncTimes.length);
  }

  // Notification methods
  private notifyProgress(): void {
    if (!this.currentSyncProgress) return;
    
    this.progressCallbacks.forEach(callback => {
      try {
        callback(this.currentSyncProgress!);
      } catch (error) {
        console.error('Error in sync progress callback:', error);
      }
    });
  }

  private notifyComplete(result: SyncResult): void {
    this.completeCallbacks.forEach(callback => {
      try {
        callback(result);
      } catch (error) {
        console.error('Error in sync complete callback:', error);
      }
    });
  }

  private notifyConflict(conflict: ConflictResolution): void {
    this.conflictCallbacks.forEach(callback => {
      try {
        callback(conflict);
      } catch (error) {
        console.error('Error in conflict callback:', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  // Cleanup method
  cleanup(): void {
    console.log('🧹 [BackgroundSyncManager] Cleaning up');
    
    this.stopBackgroundSync();
    
    this.progressCallbacks = [];
    this.completeCallbacks = [];
    this.conflictCallbacks = [];
    this.errorCallbacks = [];
    
    this.conflictResolutionRules.clear();
    this.pendingConflicts.clear();
    this.syncHistory = [];
    this.syncTimes = [];
  }
}

// Export singleton instance
export const backgroundSyncManager = BackgroundSyncManager.getInstance();