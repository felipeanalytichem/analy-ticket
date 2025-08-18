/**
 * Comprehensive unit tests for StateManager
 * Tests state persistence, form auto-save, and navigation state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../StateManager';
import {
  createMockLocalStorage,
  createMockIndexedDB,
  TimerUtils,
  ErrorSimulator,
  PerformanceTestUtils,
  MemoryTestUtils
} from '../../test/utils/sessionTestUtils';

// Mock localStorage and IndexedDB
const mockLocalStorage = createMockLocalStorage();
const mockIndexedDB = createMockIndexedDB();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('StateManager', () => {
  let stateManager: StateManager;
  let memoryTracker: ReturnType<typeof MemoryTestUtils.trackTimers>;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    memoryTracker = MemoryTestUtils.trackTimers();
    stateManager = new StateManager();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    stateManager.cleanup?.();
    memoryTracker.cleanup();
    TimerUtils.useRealTimers();
  });

  describe('State Persistence', () => {
    it('should save state to localStorage successfully', async () => {
      const testState = { user: 'test', data: [1, 2, 3] };
      
      await stateManager.saveState('test-key', testState);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-test-key',
        expect.stringContaining('"user":"test"')
      );
    });

    it('should restore state from localStorage successfully', async () => {
      const testState = { user: 'test', data: [1, 2, 3] };
      const serializedState = JSON.stringify({
        data: testState,
        timestamp: Date.now(),
        version: '1.0'
      });

      mockLocalStorage.getItem.mockReturnValue(serializedState);

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toEqual(testState);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('analy-ticket-state-test-key');
    });

    it('should return null for non-existent state', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const restoredState = await stateManager.restoreState('non-existent');

      expect(restoredState).toBeNull();
    });

    it('should clear state successfully', async () => {
      await stateManager.clearState('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('analy-ticket-state-test-key');
    });

    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(stateManager.saveState('test-key', { data: 'test' })).resolves.not.toThrow();
    });

    it('should handle malformed stored data', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toBeNull();
    });

    it('should clear expired state automatically', async () => {
      const expiredState = JSON.stringify({
        data: { test: 'data' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        version: '1.0'
      });

      mockLocalStorage.getItem.mockReturnValue(expiredState);

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('analy-ticket-state-test-key');
    });

    it('should use IndexedDB for large data', async () => {
      const largeState = { data: 'x'.repeat(100000) }; // Large data
      
      await stateManager.saveState('large-key', largeState);

      expect(mockIndexedDB.open).toHaveBeenCalled();
    });

    it('should handle IndexedDB errors gracefully', async () => {
      mockIndexedDB.open.mockRejectedValue(new Error('IndexedDB not available'));
      const largeState = { data: 'x'.repeat(100000) };

      await expect(stateManager.saveState('large-key', largeState)).resolves.not.toThrow();
    });
  });

  describe('Form Auto-Save', () => {
    let mockForm: HTMLFormElement;

    beforeEach(() => {
      // Create mock form element
      mockForm = {
        id: 'test-form',
        elements: [
          { name: 'field1', value: 'value1' },
          { name: 'field2', value: 'value2' }
        ]
      } as any;

      // Mock document.getElementById
      vi.spyOn(document, 'getElementById').mockReturnValue(mockForm);
    });

    it('should enable auto-save for form', () => {
      stateManager.enableAutoSave('test-form');

      expect(memoryTracker.getActiveTimers().size).toBe(1);
    });

    it('should disable auto-save for form', () => {
      stateManager.enableAutoSave('test-form');
      stateManager.disableAutoSave('test-form');

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should use custom interval for auto-save', () => {
      stateManager.enableAutoSave('test-form', 10000); // 10 seconds

      expect(memoryTracker.getActiveTimers().size).toBe(1);
    });

    it('should auto-save form data periodically', async () => {
      // Mock FormData
      global.FormData = vi.fn().mockImplementation(() => ({
        entries: vi.fn().mockReturnValue([
          ['field1', 'value1'],
          ['field2', 'value2']
        ])
      }));

      stateManager.enableAutoSave('test-form', 1000); // 1 second

      // Advance timer to trigger auto-save
      TimerUtils.advanceTimersByTime(1000);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-form-test-form',
        expect.stringContaining('"field1":"value1"')
      );
    });

    it('should handle form not found gracefully', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);

      stateManager.enableAutoSave('non-existent-form');

      // Should not create timer for non-existent form
      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should restore form data successfully', async () => {
      const formData = { field1: 'saved-value1', field2: 'saved-value2' };
      const serializedData = JSON.stringify({
        data: formData,
        timestamp: Date.now(),
        version: '1.0'
      });

      mockLocalStorage.getItem.mockReturnValue(serializedData);

      const restoredData = await stateManager.restoreFormData('test-form');

      expect(restoredData).toEqual(formData);
    });

    it('should clear auto-save interval when form is removed', () => {
      stateManager.enableAutoSave('test-form');
      
      // Simulate form removal
      vi.spyOn(document, 'getElementById').mockReturnValue(null);
      
      // Advance timer to trigger auto-save check
      TimerUtils.advanceTimersByTime(30000);

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle multiple forms with auto-save', () => {
      stateManager.enableAutoSave('form1');
      stateManager.enableAutoSave('form2');
      stateManager.enableAutoSave('form3');

      expect(memoryTracker.getActiveTimers().size).toBe(3);

      stateManager.disableAutoSave('form2');

      expect(memoryTracker.getActiveTimers().size).toBe(2);
    });

    it('should prevent duplicate auto-save intervals', () => {
      stateManager.enableAutoSave('test-form');
      stateManager.enableAutoSave('test-form'); // Second call

      expect(memoryTracker.getActiveTimers().size).toBe(1);
    });
  });

  describe('Navigation State Management', () => {
    it('should save navigation state', async () => {
      const navState = {
        currentRoute: '/tickets',
        params: { id: '123' },
        scrollPosition: 100
      };

      await stateManager.saveNavigationState(navState);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-navigation',
        expect.stringContaining('"/tickets"')
      );
    });

    it('should restore navigation state', async () => {
      const navState = {
        currentRoute: '/tickets',
        params: { id: '123' },
        scrollPosition: 100
      };
      const serializedState = JSON.stringify({
        data: navState,
        timestamp: Date.now(),
        version: '1.0'
      });

      mockLocalStorage.getItem.mockReturnValue(serializedState);

      const restoredState = await stateManager.restoreNavigationState();

      expect(restoredState).toEqual(navState);
    });

    it('should queue navigation actions when offline', async () => {
      const navAction = {
        type: 'navigate',
        route: '/tickets/123',
        timestamp: Date.now()
      };

      await stateManager.queueNavigationAction(navAction);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-navigation-queue',
        expect.stringContaining('"/tickets/123"')
      );
    });

    it('should process queued navigation actions', async () => {
      const queuedActions = [
        { type: 'navigate', route: '/tickets/123' },
        { type: 'navigate', route: '/profile' }
      ];
      const serializedQueue = JSON.stringify({
        data: queuedActions,
        timestamp: Date.now(),
        version: '1.0'
      });

      mockLocalStorage.getItem.mockReturnValue(serializedQueue);

      const processedActions = await stateManager.processNavigationQueue();

      expect(processedActions).toEqual(queuedActions);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('analy-ticket-state-navigation-queue');
    });
  });

  describe('State Versioning and Migration', () => {
    it('should handle version compatibility', async () => {
      const oldVersionState = JSON.stringify({
        data: { test: 'data' },
        timestamp: Date.now(),
        version: '0.9' // Old version
      });

      mockLocalStorage.getItem.mockReturnValue(oldVersionState);

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toEqual({ test: 'data' }); // Should still work
    });

    it('should migrate state format when needed', async () => {
      const legacyState = JSON.stringify({ test: 'data' }); // No version/timestamp
      mockLocalStorage.getItem.mockReturnValue(legacyState);

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toEqual({ test: 'data' });
    });

    it('should save state with current version', async () => {
      await stateManager.saveState('test-key', { test: 'data' });

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(savedData.version).toBe('1.0');
      expect(savedData.timestamp).toBeTypeOf('number');
    });
  });

  describe('Performance', () => {
    it('should save state within performance threshold', async () => {
      const testState = { data: 'test' };

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => stateManager.saveState('test-key', testState)
      );

      expect(time).toBeLessThan(50); // Should complete within 50ms
    });

    it('should restore state within performance threshold', async () => {
      const serializedState = JSON.stringify({
        data: { test: 'data' },
        timestamp: Date.now(),
        version: '1.0'
      });
      mockLocalStorage.getItem.mockReturnValue(serializedState);

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => stateManager.restoreState('test-key')
      );

      expect(time).toBeLessThan(20); // Should complete within 20ms
    });

    it('should handle concurrent state operations efficiently', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        stateManager.saveState(`key-${i}`, { data: i })
      );

      await Promise.all(promises);

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(10);
    });

    it('should optimize large data storage', async () => {
      const largeState = { data: 'x'.repeat(1000000) }; // 1MB of data

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => stateManager.saveState('large-key', largeState)
      );

      expect(time).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when enabling/disabling auto-save', () => {
      const initialTimers = memoryTracker.getActiveTimers().size;

      stateManager.enableAutoSave('test-form');
      stateManager.disableAutoSave('test-form');

      expect(memoryTracker.getActiveTimers().size).toBe(initialTimers);
    });

    it('should cleanup all auto-save intervals on cleanup', () => {
      stateManager.enableAutoSave('form1');
      stateManager.enableAutoSave('form2');
      stateManager.enableAutoSave('form3');

      stateManager.cleanup?.();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle cleanup when no intervals are active', () => {
      expect(() => stateManager.cleanup?.()).not.toThrow();
    });

    it('should prevent memory leaks from large cached data', async () => {
      // Save multiple large states
      for (let i = 0; i < 10; i++) {
        await stateManager.saveState(`large-key-${i}`, { data: 'x'.repeat(10000) });
      }

      // Should not accumulate in memory
      expect(Object.keys(stateManager['cache'] || {})).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle localStorage quota exceeded', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      await expect(stateManager.saveState('test-key', { data: 'test' })).resolves.not.toThrow();
    });

    it('should fallback to memory storage when localStorage fails', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      await stateManager.saveState('test-key', { data: 'test' });
      const restored = await stateManager.restoreState('test-key');

      expect(restored).toEqual({ data: 'test' });
    });

    it('should handle corrupted state data', async () => {
      mockLocalStorage.getItem.mockReturnValue('corrupted-data{invalid-json');

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toBeNull();
    });

    it('should recover from IndexedDB errors', async () => {
      mockIndexedDB.open.mockRejectedValue(new Error('IndexedDB error'));
      const largeState = { data: 'x'.repeat(100000) };

      await expect(stateManager.saveState('large-key', largeState)).resolves.not.toThrow();
      // Should fallback to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined state data', async () => {
      await stateManager.saveState('test-key', undefined);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'analy-ticket-state-test-key',
        expect.stringContaining('null')
      );
    });

    it('should handle circular references in state', async () => {
      const circularState: any = { data: 'test' };
      circularState.self = circularState;

      await expect(stateManager.saveState('circular-key', circularState)).resolves.not.toThrow();
    });

    it('should handle very long keys', async () => {
      const longKey = 'x'.repeat(1000);
      
      await stateManager.saveState(longKey, { data: 'test' });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        `analy-ticket-state-${longKey}`,
        expect.any(String)
      );
    });

    it('should handle rapid enable/disable auto-save calls', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          stateManager.enableAutoSave('test-form');
          stateManager.disableAutoSave('test-form');
        }
      }).not.toThrow();
    });

    it('should handle form data with special characters', async () => {
      global.FormData = vi.fn().mockImplementation(() => ({
        entries: vi.fn().mockReturnValue([
          ['field1', 'value with "quotes" and \n newlines'],
          ['field2', 'value with 中文 characters']
        ])
      }));

      const mockForm = { id: 'test-form' } as any;
      vi.spyOn(document, 'getElementById').mockReturnValue(mockForm);

      stateManager.enableAutoSave('test-form', 1000);
      TimerUtils.advanceTimersByTime(1000);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle state restoration with missing timestamp', async () => {
      const stateWithoutTimestamp = JSON.stringify({
        data: { test: 'data' },
        version: '1.0'
        // Missing timestamp
      });

      mockLocalStorage.getItem.mockReturnValue(stateWithoutTimestamp);

      const restoredState = await stateManager.restoreState('test-key');

      expect(restoredState).toEqual({ test: 'data' });
    });
  });
});