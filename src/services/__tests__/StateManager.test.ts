import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { StateManager, ApplicationState, QueuedAction } from '../StateManager';

// Mock IndexedDB
let mockDB: any;
let mockTransaction: any;
let mockStore: any;

// Mock idb
vi.mock('idb', () => ({
  openDB: vi.fn()
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock document methods for form testing
let mockFormElement: any;

Object.defineProperty(document, 'getElementById', {
  value: vi.fn()
});

// Mock FormData
const mockFormDataEntries = new Map();
global.FormData = vi.fn().mockImplementation(() => ({
  forEach: (callback: (value: any, key: string) => void) => {
    mockFormDataEntries.forEach((value, key) => callback(value, key));
  }
})) as any;

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Initialize IndexedDB mocks
    mockDB = {
      transaction: vi.fn(),
      close: vi.fn(),
      objectStoreNames: { contains: vi.fn(() => false) }
    };

    mockTransaction = {
      objectStore: vi.fn(),
      complete: Promise.resolve()
    };

    mockStore = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(),
      getAllKeys: vi.fn()
    };
    
    // Reset localStorage mock
    localStorageMock.length = 0;
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {}); // Reset to normal behavior
    localStorageMock.removeItem.mockImplementation(() => {}); // Reset to normal behavior
    
    // Reset IndexedDB mocks
    mockDB.transaction.mockReturnValue(mockTransaction);
    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockStore.put.mockResolvedValue(undefined);
    mockStore.get.mockResolvedValue(null);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.clear.mockResolvedValue(undefined);
    mockStore.getAll.mockResolvedValue([]);
    mockStore.getAllKeys.mockResolvedValue([]);

    // Mock openDB to return our mock
    const { openDB } = await import('idb');
    (openDB as Mock).mockResolvedValue(mockDB);

    stateManager = new StateManager();
  });

  afterEach(() => {
    stateManager.destroy();
  });

  describe('saveState', () => {
    it('should save small state to localStorage', async () => {
      const testState = { user: 'test', preferences: { theme: 'dark' } };
      
      await stateManager.saveState('user-prefs', testState);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-user-prefs',
        expect.stringContaining('"user":"test"')
      );
    });

    it('should save large state to IndexedDB', async () => {
      // Create a large state object (> 1MB)
      const largeData = 'x'.repeat(2 * 1024 * 1024); // 2MB string
      const testState = { largeData };
      
      await stateManager.saveState('large-state', testState);

      expect(mockStore.put).toHaveBeenCalledWith({
        key: 'large-state',
        data: testState,
        timestamp: expect.any(Number),
        version: '1.0'
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-large-state',
        expect.stringContaining('"isInIndexedDB":true')
      );
    });

    it('should handle save errors gracefully', async () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(stateManager.saveState('test', { data: 'test' }))
        .rejects.toThrow('State save failed for key: test');
    });

    it('should include version and timestamp in saved state', async () => {
      const testState = { data: 'test' };
      
      await stateManager.saveState('versioned-state', testState);

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData).toMatchObject({
        data: testState,
        timestamp: expect.any(Number),
        version: '1.0'
      });
    });
  });

  describe('restoreState', () => {
    it('should restore state from localStorage', async () => {
      const testState = { user: 'test', preferences: { theme: 'dark' } };
      const storedData = {
        data: testState,
        timestamp: Date.now(),
        version: '1.0'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));

      const result = await stateManager.restoreState('user-prefs');

      expect(result).toEqual(testState);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('analy-ticket-state-user-prefs');
    });

    it('should restore state from IndexedDB when marked as such', async () => {
      const testState = { largeData: 'test' };
      const localStorageData = {
        data: null,
        timestamp: Date.now(),
        version: '1.0',
        isInIndexedDB: true
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(localStorageData));
      mockStore.get.mockResolvedValue({
        key: 'large-state',
        data: testState,
        timestamp: Date.now(),
        version: '1.0'
      });

      const result = await stateManager.restoreState('large-state');

      expect(result).toEqual(testState);
      expect(mockStore.get).toHaveBeenCalledWith('large-state');
    });

    it('should return null for non-existent state', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await stateManager.restoreState('non-existent');

      expect(result).toBeNull();
    });

    it('should return null and clear expired state', async () => {
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const expiredData = {
        data: { test: 'data' },
        timestamp: expiredTimestamp,
        version: '1.0'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredData));

      const result = await stateManager.restoreState('expired-state');

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-expired-state');
    });

    it('should handle restore errors gracefully', async () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage access error');
      });

      const result = await stateManager.restoreState('error-state');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const result = await stateManager.restoreState('invalid-state');

      expect(result).toBeNull();
    });
  });

  describe('clearState', () => {
    it('should clear state from both localStorage and IndexedDB', async () => {
      await stateManager.clearState('test-state');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-test-state');
      expect(mockStore.delete).toHaveBeenCalledWith('test-state');
    });

    it('should handle clear errors gracefully', async () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Clear error');
      });

      // Should not throw
      await expect(stateManager.clearState('test-state')).resolves.toBeUndefined();
    });
  });

  describe('Form auto-save functionality', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      
      // Setup mock form element
      mockFormElement = {
        id: 'test-form',
        querySelectorAll: vi.fn(() => [
          { name: 'field1', value: 'value1', type: 'text' },
          { name: 'field2', value: 'value2', type: 'text' }
        ])
      };
      
      (document.getElementById as Mock).mockReturnValue(mockFormElement);
      
      // Setup mock FormData entries
      mockFormDataEntries.clear();
      mockFormDataEntries.set('field1', 'value1');
      mockFormDataEntries.set('field2', 'value2');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should enable auto-save with default interval', () => {
      const formId = 'test-form';
      
      stateManager.enableAutoSave(formId);

      // Fast-forward time to trigger auto-save
      vi.advanceTimersByTime(30000);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-form-test-form',
        expect.stringContaining('"formId":"test-form"')
      );
    });

    it('should enable auto-save with custom interval', () => {
      const formId = 'test-form';
      const customInterval = 10000; // 10 seconds
      
      stateManager.enableAutoSave(formId, customInterval);

      // Should not trigger before interval
      vi.advanceTimersByTime(5000);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Should trigger after interval
      vi.advanceTimersByTime(5000);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should disable auto-save and clear interval', () => {
      const formId = 'test-form';
      
      stateManager.enableAutoSave(formId);
      stateManager.disableAutoSave(formId);

      // Should not trigger after disabling
      vi.advanceTimersByTime(30000);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should handle missing form element gracefully', () => {
      const formId = 'non-existent-form';
      
      (document.getElementById as Mock).mockReturnValue(null);
      
      stateManager.enableAutoSave(formId);
      vi.advanceTimersByTime(30000);

      // Should not throw and should disable auto-save
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should restore form data', async () => {
      const formId = 'test-form';
      const formData = {
        data: { field1: 'value1', field2: 'value2' },
        timestamp: Date.now(),
        formId
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        data: formData,
        timestamp: Date.now(),
        version: '1.0'
      }));

      const result = await stateManager.restoreFormData(formId);

      expect(result).toEqual(formData);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('analy-ticket-state-form-test-form');
    });

    it('should capture form data including checkboxes and radio buttons', () => {
      const formId = 'complex-form';
      const mockComplexForm = {
        id: formId,
        querySelectorAll: vi.fn(() => [
          { name: 'text-field', value: 'text-value', type: 'text' },
          { name: 'checkbox-field', checked: true, type: 'checkbox' },
          { name: 'radio-field', checked: false, type: 'radio' },
          { name: 'textarea-field', value: 'textarea-value', type: 'textarea' }
        ])
      };

      (document.getElementById as Mock).mockReturnValue(mockComplexForm);
      
      // Clear previous FormData entries and set new ones
      mockFormDataEntries.clear();
      mockFormDataEntries.set('text-field', 'text-value');
      
      stateManager.enableAutoSave(formId);
      vi.advanceTimersByTime(30000);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.data.data).toMatchObject({
        'checkbox-field': true,
        'radio-field': false,
        'text-field': 'text-value',
        'textarea-field': 'textarea-value'
      });
    });
  });

  describe('State cleanup and expiration', () => {
    it('should cleanup expired states from localStorage', async () => {
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const validTimestamp = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

      // Mock localStorage with expired and valid states
      localStorageMock.length = 2;
      localStorageMock.key
        .mockReturnValueOnce('analy-ticket-state-expired')
        .mockReturnValueOnce('analy-ticket-state-valid');
      
      localStorageMock.getItem
        .mockReturnValueOnce(JSON.stringify({ timestamp: expiredTimestamp }))
        .mockReturnValueOnce(JSON.stringify({ timestamp: validTimestamp }));

      await stateManager.cleanupExpiredStates();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-expired');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('analy-ticket-state-valid');
    });

    it('should cleanup expired states from IndexedDB', async () => {
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      const validTimestamp = Date.now();

      mockStore.getAll.mockResolvedValue([
        { key: 'expired-state', timestamp: expiredTimestamp },
        { key: 'valid-state', timestamp: validTimestamp }
      ]);

      await stateManager.cleanupExpiredStates();

      expect(mockStore.delete).toHaveBeenCalledWith('expired-state');
      expect(mockStore.delete).not.toHaveBeenCalledWith('valid-state');
    });

    it('should handle cleanup errors gracefully', async () => {
      localStorageMock.key.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      await expect(stateManager.cleanupExpiredStates()).resolves.toBeUndefined();
    });

    it('should remove invalid JSON entries during cleanup', async () => {
      // Reset the error mock from previous test
      localStorageMock.key.mockReset();
      localStorageMock.getItem.mockReset();
      
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValue('analy-ticket-state-invalid');
      localStorageMock.getItem.mockReturnValue('invalid-json');

      await stateManager.cleanupExpiredStates();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-invalid');
    });
  });

  describe('State migration', () => {
    it('should migrate state from older version', async () => {
      const oldState = { oldFormat: 'data' };
      const oldStoredData = {
        data: oldState,
        timestamp: Date.now(),
        version: '0.9'
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(oldStoredData));

      // Mock the migration by having restoreState return the old state first
      const restoreStateSpy = vi.spyOn(stateManager, 'restoreState');
      restoreStateSpy.mockResolvedValueOnce(oldState);

      await stateManager.migrateState('old-state', '0.9', '1.0');

      expect(restoreStateSpy).toHaveBeenCalledWith('old-state');
    });

    it('should handle migration errors gracefully', async () => {
      const restoreStateSpy = vi.spyOn(stateManager, 'restoreState');
      restoreStateSpy.mockRejectedValue(new Error('Migration error'));

      // Should not throw
      await expect(stateManager.migrateState('error-state', '0.9', '1.0'))
        .resolves.toBeUndefined();
    });
  });

  describe('Storage size calculation', () => {
    it('should calculate total storage size', async () => {
      // Mock localStorage data
      localStorageMock.length = 2;
      localStorageMock.key
        .mockReturnValueOnce('analy-ticket-state-test1')
        .mockReturnValueOnce('analy-ticket-state-test2');
      localStorageMock.getItem
        .mockReturnValueOnce('{"data":"test1"}')
        .mockReturnValueOnce('{"data":"test2"}');

      // Mock IndexedDB data
      mockStore.getAllKeys.mockResolvedValue(['idb-key1', 'idb-key2']);
      mockStore.get
        .mockResolvedValueOnce({ data: 'idb-data1' })
        .mockResolvedValueOnce({ data: 'idb-data2' });

      const size = await stateManager.getStorageSize();

      expect(size).toBeGreaterThan(0);
      expect(mockStore.getAllKeys).toHaveBeenCalled();
    });

    it('should handle storage size calculation errors', async () => {
      localStorageMock.key.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const size = await stateManager.getStorageSize();

      expect(size).toBe(0);
    });
  });

  describe('Clear all states', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear all states and auto-save intervals', async () => {
      // Set up some auto-save intervals
      stateManager.enableAutoSave('form1');
      stateManager.enableAutoSave('form2');

      // Mock localStorage keys
      localStorageMock.length = 2;
      localStorageMock.key
        .mockReturnValueOnce('analy-ticket-state-test1')
        .mockReturnValueOnce('analy-ticket-state-test2');

      await stateManager.clearAllStates();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-test1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('analy-ticket-state-test2');
      expect(mockStore.clear).toHaveBeenCalled();

      // Verify auto-save intervals are cleared
      vi.advanceTimersByTime(30000);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should handle clear all errors gracefully', async () => {
      localStorageMock.key.mockImplementationOnce(() => {
        throw new Error('Clear error');
      });

      // Should not throw
      await expect(stateManager.clearAllStates()).resolves.toBeUndefined();
    });
  });

  describe('Destroy method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cleanup intervals and close database connection', () => {
      stateManager.enableAutoSave('form1');
      stateManager.enableAutoSave('form2');

      stateManager.destroy();

      expect(mockDB.close).toHaveBeenCalled();

      // Verify intervals are cleared
      vi.advanceTimersByTime(30000);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and error handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle FormData with multiple values for same key', () => {
      const formId = 'multi-value-form';
      const mockForm = {
        id: formId,
        querySelectorAll: vi.fn(() => [])
      };

      (document.getElementById as Mock).mockReturnValue(mockForm);

      // Setup FormData with multiple values for same key
      mockFormDataEntries.clear();
      mockFormDataEntries.set('field1', 'value1');
      mockFormDataEntries.set('field2', 'single-value');

      // Mock forEach to simulate multiple values for same key
      global.FormData = vi.fn().mockImplementation(() => ({
        forEach: (callback: (value: any, key: string) => void) => {
          callback('value1', 'field1');
          callback('value2', 'field1'); // Same key, different value
          callback('single-value', 'field2');
        }
      })) as any;

      stateManager.enableAutoSave(formId);
      vi.advanceTimersByTime(30000);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.data.data.field1).toEqual(['value1', 'value2']);
      expect(savedData.data.data.field2).toBe('single-value');
    });

    it('should handle IndexedDB initialization failure', async () => {
      const { openDB } = await import('idb');
      (openDB as Mock).mockRejectedValueOnce(new Error('IndexedDB not available'));

      const newStateManager = new StateManager();
      
      // Should still work with localStorage only
      await newStateManager.saveState('test', { data: 'test' });
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      newStateManager.destroy();
    });
  });
});