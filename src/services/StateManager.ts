import { openDB, IDBPDatabase } from 'idb';

// Types and interfaces
export interface ApplicationState {
  currentRoute: string;
  formData: Record<string, any>;
  userPreferences: any;
  cachedData: Record<string, any>;
  pendingActions: QueuedAction[];
}

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export interface StoredState {
  data: any;
  timestamp: number;
  version: string;
}

export interface IStateManager {
  // State persistence
  saveState(key: string, state: any): Promise<void>;
  restoreState(key: string): Promise<any>;
  clearState(key: string): Promise<void>;
  
  // Form auto-save
  enableAutoSave(formId: string, interval?: number): void;
  disableAutoSave(formId: string): void;
  restoreFormData(formId: string): Promise<any>;
  
  // State cleanup and migration
  cleanupExpiredStates(): Promise<void>;
  migrateState(key: string, fromVersion: string, toVersion: string): Promise<void>;
  
  // Utility methods
  getStorageSize(): Promise<number>;
  clearAllStates(): Promise<void>;
}

export class StateManager implements IStateManager {
  private autoSaveIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly STORAGE_PREFIX = 'analy-ticket-state';
  private readonly DB_NAME = 'analy-ticket-db';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'state-store';
  private readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly STATE_EXPIRY_HOURS = 24;
  private readonly LARGE_DATA_THRESHOLD = 1024 * 1024; // 1MB
  
  private db: IDBPDatabase | null = null;

  constructor() {
    this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('state-store')) {
            db.createObjectStore('state-store', { keyPath: 'key' });
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
    }
  }

  async saveState(key: string, state: any): Promise<void> {
    try {
      const storedState: StoredState = {
        data: state,
        timestamp: Date.now(),
        version: '1.0'
      };

      const serializedState = JSON.stringify(storedState);
      const storageKey = `${this.STORAGE_PREFIX}-${key}`;

      // Check if data is large and should go to IndexedDB
      if (this.isLargeData(serializedState)) {
        await this.saveToIndexedDB(key, storedState);
        
        // Store a reference in localStorage
        localStorage.setItem(storageKey, JSON.stringify({
          ...storedState,
          data: null,
          isInIndexedDB: true
        }));
      } else {
        // Store in localStorage for quick access
        localStorage.setItem(storageKey, serializedState);
      }

      // Cleanup expired states periodically
      if (Math.random() < 0.1) { // 10% chance to trigger cleanup
        this.cleanupExpiredStates();
      }

    } catch (error) {
      console.error('Failed to save state:', error);
      throw new Error(`State save failed for key: ${key}`);
    }
  }

  async restoreState(key: string): Promise<any> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}-${key}`;
      const stored = localStorage.getItem(storageKey);

      if (!stored) {
        return null;
      }

      const parsed: StoredState & { isInIndexedDB?: boolean } = JSON.parse(stored);

      // Check if data is expired
      if (this.isStateExpired(parsed.timestamp)) {
        await this.clearState(key);
        return null;
      }

      // If data is in IndexedDB, retrieve it
      if (parsed.isInIndexedDB) {
        const indexedData = await this.restoreFromIndexedDB(key);
        return indexedData?.data || null;
      }

      // Migrate state if version is different
      if (parsed.version !== '1.0') {
        await this.migrateState(key, parsed.version, '1.0');
        return this.restoreState(key); // Recursive call after migration
      }

      return parsed.data;

    } catch (error) {
      console.error('Failed to restore state:', error);
      return null;
    }
  }

  async clearState(key: string): Promise<void> {
    try {
      const storageKey = `${this.STORAGE_PREFIX}-${key}`;
      
      // Remove from localStorage
      localStorage.removeItem(storageKey);
      
      // Remove from IndexedDB if it exists
      await this.removeFromIndexedDB(key);

    } catch (error) {
      console.error('Failed to clear state:', error);
    }
  }

  enableAutoSave(formId: string, interval: number = 30000): void {
    // Clear existing interval if any
    this.disableAutoSave(formId);

    const saveInterval = setInterval(() => {
      this.autoSaveForm(formId);
    }, interval);

    this.autoSaveIntervals.set(formId, saveInterval);
  }

  disableAutoSave(formId: string): void {
    const interval = this.autoSaveIntervals.get(formId);
    if (interval) {
      clearInterval(interval);
      this.autoSaveIntervals.delete(formId);
    }
  }

  async restoreFormData(formId: string): Promise<any> {
    return this.restoreState(`form-${formId}`);
  }

  async cleanupExpiredStates(): Promise<void> {
    try {
      const keysToRemove: string[] = [];
      
      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            try {
              const parsed: StoredState = JSON.parse(stored);
              if (this.isStateExpired(parsed.timestamp)) {
                keysToRemove.push(key);
              }
            } catch (error) {
              // Invalid JSON, remove it
              keysToRemove.push(key);
            }
          }
        }
      }

      // Remove expired states
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        const stateKey = key.replace(`${this.STORAGE_PREFIX}-`, '');
        this.removeFromIndexedDB(stateKey);
      });

      // Cleanup IndexedDB
      await this.cleanupIndexedDB();

    } catch (error) {
      console.error('Failed to cleanup expired states:', error);
    }
  }

  async migrateState(key: string, fromVersion: string, toVersion: string): Promise<void> {
    try {
      const currentState = await this.restoreState(key);
      if (!currentState) return;

      // Version-specific migration logic
      let migratedState = currentState;

      if (fromVersion === '0.9' && toVersion === '1.0') {
        // Example migration: restructure data format
        migratedState = this.migrateFromV09ToV10(currentState);
      }

      // Save migrated state
      await this.saveState(key, migratedState);

    } catch (error) {
      console.error('Failed to migrate state:', error);
    }
  }

  async getStorageSize(): Promise<number> {
    try {
      let totalSize = 0;

      // Calculate localStorage size
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += new Blob([value]).size;
          }
        }
      }

      // Calculate IndexedDB size (approximate)
      if (this.db) {
        const tx = this.db.transaction(this.STORE_NAME, 'readonly');
        const store = tx.objectStore(this.STORE_NAME);
        const allKeys = await store.getAllKeys();
        
        for (const key of allKeys) {
          const value = await store.get(key);
          if (value) {
            totalSize += new Blob([JSON.stringify(value)]).size;
          }
        }
      }

      return totalSize;

    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  async clearAllStates(): Promise<void> {
    try {
      // Clear localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear IndexedDB
      if (this.db) {
        const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
        await tx.objectStore(this.STORE_NAME).clear();
      }

      // Clear auto-save intervals
      this.autoSaveIntervals.forEach(interval => clearInterval(interval));
      this.autoSaveIntervals.clear();

    } catch (error) {
      console.error('Failed to clear all states:', error);
    }
  }

  // Private helper methods
  private async autoSaveForm(formId: string): Promise<void> {
    try {
      const formElement = document.getElementById(formId) as HTMLFormElement;

      if (!formElement) {
        this.disableAutoSave(formId);
        return;
      }

      const formData = new FormData(formElement);
      const data: Record<string, any> = {};

      // Convert FormData to plain object
      formData.forEach((value, key) => {
        if (data[key]) {
          // Handle multiple values for same key
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });

      // Also capture input values that might not be in FormData
      const inputs = formElement.querySelectorAll('input, textarea, select');
      inputs.forEach((input: any) => {
        if (input.name && !data[input.name]) {
          if (input.type === 'checkbox' || input.type === 'radio') {
            data[input.name] = input.checked;
          } else {
            data[input.name] = input.value;
          }
        }
      });

      await this.saveState(`form-${formId}`, {
        data,
        timestamp: Date.now(),
        formId
      });

    } catch (error) {
      console.error('Failed to auto-save form:', error);
    }
  }

  private isLargeData(serializedData: string): boolean {
    return new Blob([serializedData]).size > this.LARGE_DATA_THRESHOLD;
  }

  private isStateExpired(timestamp: number): boolean {
    const expiryTime = this.STATE_EXPIRY_HOURS * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryTime;
  }

  private async saveToIndexedDB(key: string, state: StoredState): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    if (this.db) {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      await tx.objectStore(this.STORE_NAME).put({ key, ...state });
    }
  }

  private async restoreFromIndexedDB(key: string): Promise<StoredState | null> {
    if (!this.db) {
      await this.initializeDB();
    }

    if (this.db) {
      const tx = this.db.transaction(this.STORE_NAME, 'readonly');
      const result = await tx.objectStore(this.STORE_NAME).get(key);
      return result || null;
    }

    return null;
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    if (this.db) {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      await tx.objectStore(this.STORE_NAME).delete(key);
    }
  }

  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const allRecords = await store.getAll();

      for (const record of allRecords) {
        if (this.isStateExpired(record.timestamp)) {
          await store.delete(record.key);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup IndexedDB:', error);
    }
  }

  private migrateFromV09ToV10(state: any): any {
    // Example migration logic
    if (state && typeof state === 'object') {
      return {
        ...state,
        version: '1.0',
        migratedAt: Date.now()
      };
    }
    return state;
  }

  // Cleanup method to be called when the service is destroyed
  destroy(): void {
    this.autoSaveIntervals.forEach(interval => clearInterval(interval));
    this.autoSaveIntervals.clear();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const stateManager = new StateManager();