import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { NavigationStateManager, NavigationState, QueuedNavigation } from '../NavigationStateManager';
import { stateManager } from '../StateManager';

// Mock StateManager
vi.mock('../StateManager', () => ({
  stateManager: {
    saveState: vi.fn(),
    restoreState: vi.fn(),
    clearState: vi.fn()
  }
}));

// Mock window.history
const mockHistory = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
  back: vi.fn(),
  forward: vi.fn()
};

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true
});

// Mock window.dispatchEvent
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true
});

describe('NavigationStateManager', () => {
  let navigationManager: NavigationStateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    (stateManager.saveState as Mock).mockResolvedValue(undefined);
    (stateManager.restoreState as Mock).mockResolvedValue(null);
    (stateManager.clearState as Mock).mockResolvedValue(undefined);

    navigationManager = new NavigationStateManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    navigationManager.destroy();
  });

  describe('navigation state persistence', () => {
    it('should save navigation state', async () => {
      const path = '/dashboard';
      const searchParams = new URLSearchParams('?tab=overview');
      const state = { from: 'home' };

      await navigationManager.saveNavigationState(path, searchParams, state);

      expect(stateManager.saveState).toHaveBeenCalledWith('navigation-state', {
        currentPath: path,
        searchParams: searchParams,
        state: state,
        timestamp: expect.any(Number)
      });
    });

    it('should save navigation state with default values', async () => {
      const path = '/dashboard';

      await navigationManager.saveNavigationState(path);

      expect(stateManager.saveState).toHaveBeenCalledWith('navigation-state', {
        currentPath: path,
        searchParams: expect.any(URLSearchParams),
        state: null,
        timestamp: expect.any(Number)
      });
    });

    it('should restore navigation state', async () => {
      const mockSavedState = {
        currentPath: '/dashboard',
        searchParams: new URLSearchParams('?tab=overview'),
        state: { from: 'home' },
        timestamp: Date.now()
      };

      (stateManager.restoreState as Mock).mockResolvedValue(mockSavedState);

      const result = await navigationManager.restoreNavigationState();

      expect(result).toEqual({
        ...mockSavedState,
        searchParams: expect.any(URLSearchParams)
      });
      expect(result?.searchParams.get('tab')).toBe('overview');
    });

    it('should return null when no saved state exists', async () => {
      (stateManager.restoreState as Mock).mockResolvedValue(null);

      const result = await navigationManager.restoreNavigationState();

      expect(result).toBeNull();
    });

    it('should return null and clear expired state', async () => {
      const expiredState = {
        currentPath: '/dashboard',
        searchParams: new URLSearchParams(),
        state: null,
        timestamp: Date.now() - (2 * 60 * 60 * 1000) // 2 hours ago
      };

      (stateManager.restoreState as Mock).mockResolvedValue(expiredState);

      const result = await navigationManager.restoreNavigationState();

      expect(result).toBeNull();
      expect(stateManager.clearState).toHaveBeenCalledWith('navigation-state');
    });

    it('should clear navigation state', async () => {
      await navigationManager.clearNavigationState();

      expect(stateManager.clearState).toHaveBeenCalledWith('navigation-state');
    });

    it('should handle save errors gracefully', async () => {
      (stateManager.saveState as Mock).mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await navigationManager.saveNavigationState('/test');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save navigation state:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle restore errors gracefully', async () => {
      (stateManager.restoreState as Mock).mockRejectedValue(new Error('Restore failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await navigationManager.restoreNavigationState();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to restore navigation state:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('navigation queue management', () => {
    it('should queue navigation when offline', () => {
      navigationManager.setConnectionStatus(false);

      const onNavigationQueued = vi.fn();
      navigationManager.onNavigationQueued(onNavigationQueued);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/dashboard',
        state: { from: 'home' },
        maxRetries: 3
      });

      expect(onNavigationQueued).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'push',
          path: '/dashboard',
          state: { from: 'home' },
          maxRetries: 3,
          id: expect.any(String),
          timestamp: expect.any(Number),
          retryCount: 0
        })
      );
    });

    it('should process navigation queue when online', async () => {
      navigationManager.setConnectionStatus(true);

      const onNavigationProcessed = vi.fn();
      navigationManager.onNavigationProcessed(onNavigationProcessed);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/dashboard',
        maxRetries: 3
      });

      await navigationManager.processNavigationQueue();

      expect(mockHistory.pushState).toHaveBeenCalledWith(undefined, '', '/dashboard');
      expect(mockDispatchEvent).toHaveBeenCalledWith(expect.any(PopStateEvent));
      expect(onNavigationProcessed).toHaveBeenCalled();
    });

    it('should handle different navigation types', async () => {
      navigationManager.setConnectionStatus(true);

      // Test push navigation
      navigationManager.queueNavigation({
        type: 'push',
        path: '/page1',
        state: { test: 'data' },
        maxRetries: 3
      });

      // Test replace navigation
      navigationManager.queueNavigation({
        type: 'replace',
        path: '/page2',
        maxRetries: 3
      });

      // Test back navigation
      navigationManager.queueNavigation({
        type: 'back',
        maxRetries: 3
      });

      // Test forward navigation
      navigationManager.queueNavigation({
        type: 'forward',
        maxRetries: 3
      });

      await navigationManager.processNavigationQueue();

      expect(mockHistory.pushState).toHaveBeenCalledWith({ test: 'data' }, '', '/page1');
      expect(mockHistory.replaceState).toHaveBeenCalledWith(undefined, '', '/page2');
      expect(mockHistory.back).toHaveBeenCalled();
      expect(mockHistory.forward).toHaveBeenCalled();
    });

    it('should retry failed navigations', async () => {
      navigationManager.setConnectionStatus(true);
      mockHistory.pushState.mockImplementationOnce(() => {
        throw new Error('Navigation failed');
      });

      const onNavigationFailed = vi.fn();
      navigationManager.onNavigationFailed(onNavigationFailed);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/dashboard',
        maxRetries: 1
      });

      await navigationManager.processNavigationQueue();

      expect(onNavigationFailed).toHaveBeenCalled();
    });

    it('should clear navigation queue', async () => {
      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      await navigationManager.clearNavigationQueue();

      expect(stateManager.saveState).toHaveBeenCalledWith('navigation-queue', []);
    });

    it('should save and restore navigation queue', async () => {
      const mockQueue = [
        {
          id: 'nav-1',
          type: 'push' as const,
          path: '/test',
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      (stateManager.restoreState as Mock).mockResolvedValue(mockQueue);

      const newManager = new NavigationStateManager();

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(stateManager.restoreState).toHaveBeenCalledWith('navigation-queue');

      newManager.destroy();
    });

    it('should handle queue initialization errors gracefully', async () => {
      (stateManager.restoreState as Mock).mockRejectedValue(new Error('Restore failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const newManager = new NavigationStateManager();

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize navigation queue:', expect.any(Error));

      consoleSpy.mockRestore();
      newManager.destroy();
    });
  });

  describe('connection status management', () => {
    it('should update connection status', () => {
      expect(navigationManager.isOnline()).toBe(true);

      navigationManager.setConnectionStatus(false);
      expect(navigationManager.isOnline()).toBe(false);

      navigationManager.setConnectionStatus(true);
      expect(navigationManager.isOnline()).toBe(true);
    });

    it('should process queue when coming back online', async () => {
      navigationManager.setConnectionStatus(false);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/dashboard',
        maxRetries: 3
      });

      const processQueueSpy = vi.spyOn(navigationManager, 'processNavigationQueue');

      navigationManager.setConnectionStatus(true);

      expect(processQueueSpy).toHaveBeenCalled();
    });

    it('should not process queue when going offline', () => {
      const processQueueSpy = vi.spyOn(navigationManager, 'processNavigationQueue');

      navigationManager.setConnectionStatus(false);

      expect(processQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('should handle navigation queued events', () => {
      const callback = vi.fn();
      navigationManager.onNavigationQueued(callback);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should handle navigation processed events', async () => {
      const callback = vi.fn();
      navigationManager.onNavigationProcessed(callback);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      await navigationManager.processNavigationQueue();

      expect(callback).toHaveBeenCalled();
    });

    it('should handle navigation failed events', async () => {
      const callback = vi.fn();
      navigationManager.onNavigationFailed(callback);

      mockHistory.pushState.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 1
      });

      await navigationManager.processNavigationQueue();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'push',
          path: '/test'
        }),
        expect.any(Error)
      );
    });

    it('should handle callback errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const faultyCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      navigationManager.onNavigationQueued(faultyCallback);

      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      expect(consoleSpy).toHaveBeenCalledWith('Error in navigation queued callback:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('queue processing interval', () => {
    it('should process queue periodically when online', async () => {
      navigationManager.setConnectionStatus(true);
      
      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      const processQueueSpy = vi.spyOn(navigationManager, 'processNavigationQueue');

      // Fast-forward time to trigger interval
      vi.advanceTimersByTime(5000);

      expect(processQueueSpy).toHaveBeenCalled();
    });

    it('should not process queue when offline during interval', () => {
      navigationManager.setConnectionStatus(false);
      
      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      const processQueueSpy = vi.spyOn(navigationManager, 'processNavigationQueue');

      // Fast-forward time to trigger interval
      vi.advanceTimersByTime(5000);

      expect(processQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const manager = new NavigationStateManager();
      
      manager.onNavigationQueued(() => {});
      manager.onNavigationProcessed(() => {});
      manager.onNavigationFailed(() => {});

      manager.destroy();

      // Verify callbacks are cleared
      expect(manager['onNavigationQueuedCallbacks']).toHaveLength(0);
      expect(manager['onNavigationProcessedCallbacks']).toHaveLength(0);
      expect(manager['onNavigationFailedCallbacks']).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle unknown navigation type', async () => {
      navigationManager.setConnectionStatus(true);

      navigationManager.queueNavigation({
        type: 'unknown' as any,
        path: '/test',
        maxRetries: 1
      });

      const onNavigationFailed = vi.fn();
      navigationManager.onNavigationFailed(onNavigationFailed);

      await navigationManager.processNavigationQueue();

      expect(onNavigationFailed).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: 'Unknown navigation type: unknown'
        })
      );
    });

    it('should handle queue save errors gracefully', async () => {
      (stateManager.saveState as Mock).mockRejectedValue(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      navigationManager.queueNavigation({
        type: 'push',
        path: '/test',
        maxRetries: 3
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save navigation queue:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});