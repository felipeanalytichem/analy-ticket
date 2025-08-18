import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  postMessage(data: any): void {
    // Simulate async message delivery
    setTimeout(() => {
      const event = new MessageEvent('message', { data });
      const listeners = this.listeners.get('message') || [];
      listeners.forEach(listener => listener(event));
    }, 0);
  }

  close(): void {
    this.listeners.clear();
  }
}

// Mock DOM APIs
Object.defineProperty(global, 'BroadcastChannel', {
  writable: true,
  value: MockBroadcastChannel
});

Object.defineProperty(document, 'visibilityState', {
  writable: true,
  value: 'visible'
});

Object.defineProperty(document, 'addEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(document, 'removeEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(window, 'addEventListener', {
  writable: true,
  value: vi.fn()
});

Object.defineProperty(window, 'removeEventListener', {
  writable: true,
  value: vi.fn()
});

// Import after mocking
import { CrossTabSyncManager, TabSyncMessage } from '../CrossTabSyncManager';

describe('CrossTabSyncManager', () => {
  let crossTabSyncManager: CrossTabSyncManager;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    crossTabSyncManager = CrossTabSyncManager.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    crossTabSyncManager.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CrossTabSyncManager.getInstance();
      const instance2 = CrossTabSyncManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      crossTabSyncManager.initialize(testUserId);
      
      expect(crossTabSyncManager.getTabId()).toBeTruthy();
      expect(crossTabSyncManager.isTabActive()).toBe(true);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        channelName: 'custom-channel',
        heartbeatInterval: 10000,
        tabTimeoutMs: 30000
      };

      crossTabSyncManager.initialize(testUserId, customOptions);
      
      expect(crossTabSyncManager.getTabId()).toBeTruthy();
    });

    it('should handle BroadcastChannel not supported', () => {
      // Temporarily remove BroadcastChannel
      const originalBroadcastChannel = global.BroadcastChannel;
      delete (global as any).BroadcastChannel;

      // Should not throw error
      expect(() => {
        crossTabSyncManager.initialize(testUserId);
      }).not.toThrow();

      // Restore BroadcastChannel
      global.BroadcastChannel = originalBroadcastChannel;
    });
  });

  describe('Tab Management', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should generate unique tab IDs', () => {
      const tabId1 = crossTabSyncManager.getTabId();
      
      // Create new instance to get different tab ID
      const newManager = new (CrossTabSyncManager as any)();
      const tabId2 = newManager.getTabId();
      
      expect(tabId1).not.toBe(tabId2);
      expect(tabId1).toMatch(/^tab-\d+-[a-z0-9]+$/);
    });

    it('should track active tabs', () => {
      const activeTabs = crossTabSyncManager.getActiveTabs();
      expect(activeTabs).toHaveLength(1);
      expect(activeTabs[0].id).toBe(crossTabSyncManager.getTabId());
      expect(activeTabs[0].userId).toBe(testUserId);
    });

    it('should identify primary tab correctly', () => {
      expect(crossTabSyncManager.isPrimaryTab()).toBe(true);
    });

    it('should track tab activity state', () => {
      expect(crossTabSyncManager.isTabActive()).toBe(true);
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should broadcast notification received', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('notification-received', mockHandler);

      const notification = { id: '123', message: 'Test notification' };
      
      // Should not throw error
      expect(() => {
        crossTabSyncManager.broadcastNotificationReceived(notification);
      }).not.toThrow();
    });

    it('should broadcast notification read', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('notification-read', mockHandler);

      // Should not throw error
      expect(() => {
        crossTabSyncManager.broadcastNotificationRead('notification-123');
      }).not.toThrow();
    });

    it('should broadcast notification deleted', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('notification-deleted', mockHandler);

      // Should not throw error
      expect(() => {
        crossTabSyncManager.broadcastNotificationDeleted('notification-123');
      }).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should register and call message handlers', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('test-message', mockHandler);

      // Simulate message from another tab
      const message: TabSyncMessage = {
        type: 'test-message' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      // Manually trigger message handler
      (crossTabSyncManager as any).handleMessage({ data: message });

      expect(mockHandler).toHaveBeenCalledWith({ data: 'test' }, 'other-tab-123');
    });

    it('should remove message handlers', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('test-message', mockHandler);
      crossTabSyncManager.offMessage('test-message');

      // Simulate message from another tab
      const message: TabSyncMessage = {
        type: 'test-message' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      (crossTabSyncManager as any).handleMessage({ data: message });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should ignore messages from same tab', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('test-message', mockHandler);

      // Simulate message from same tab
      const message: TabSyncMessage = {
        type: 'test-message' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        tabId: crossTabSyncManager.getTabId()
      };

      (crossTabSyncManager as any).handleMessage({ data: message });

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle heartbeat messages', () => {
      const message: TabSyncMessage = {
        type: 'heartbeat',
        payload: { isActive: true, userId: 'other-user' },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      (crossTabSyncManager as any).handleMessage({ data: message });

      const activeTabs = crossTabSyncManager.getActiveTabs();
      expect(activeTabs).toHaveLength(2); // Current tab + other tab
      
      const otherTab = activeTabs.find(tab => tab.id === 'other-tab-123');
      expect(otherTab).toBeTruthy();
      expect(otherTab?.userId).toBe('other-user');
    });

    it('should handle tab focus/blur messages', () => {
      const focusMessage: TabSyncMessage = {
        type: 'tab-focus',
        payload: { timestamp: Date.now() },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      // First register the tab with heartbeat
      const heartbeatMessage: TabSyncMessage = {
        type: 'heartbeat',
        payload: { isActive: false, userId: testUserId },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      (crossTabSyncManager as any).handleMessage({ data: heartbeatMessage });
      (crossTabSyncManager as any).handleMessage({ data: focusMessage });

      const activeTabs = crossTabSyncManager.getActiveTabs();
      const otherTab = activeTabs.find(tab => tab.id === 'other-tab-123');
      expect(otherTab?.isActive).toBe(true);
    });
  });

  describe('Heartbeat System', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId, { heartbeatInterval: 1000 });
    });

    it('should send heartbeat messages at regular intervals', () => {
      const mockHandler = vi.fn();
      crossTabSyncManager.onMessage('heartbeat', mockHandler);

      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(1000);

      // Should have sent heartbeat (but won't receive own message)
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should clean up inactive tabs', () => {
      // Add a fake inactive tab
      const inactiveTab = {
        id: 'inactive-tab',
        isActive: false,
        lastSeen: new Date(Date.now() - 20000), // 20 seconds ago
        userId: testUserId
      };

      (crossTabSyncManager as any).activeTabs.set('inactive-tab', inactiveTab);

      // Trigger cleanup
      (crossTabSyncManager as any).cleanupInactiveTabs();

      const activeTabs = crossTabSyncManager.getActiveTabs();
      expect(activeTabs.find(tab => tab.id === 'inactive-tab')).toBeUndefined();
    });
  });

  describe('Focus Detection', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId, { enableFocusDetection: true });
    });

    it('should set up focus detection event listeners', () => {
      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('focus', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('blur', expect.any(Function));
    });

    it('should handle visibility change', () => {
      const handleVisibilityChange = (crossTabSyncManager as any).handleVisibilityChange;
      
      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
      handleVisibilityChange();
      
      expect(crossTabSyncManager.isTabActive()).toBe(false);

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible' });
      handleVisibilityChange();
      
      expect(crossTabSyncManager.isTabActive()).toBe(true);
    });

    it('should handle tab focus', () => {
      (crossTabSyncManager as any).handleTabFocus();
      expect(crossTabSyncManager.isTabActive()).toBe(true);
    });

    it('should handle tab blur', () => {
      (crossTabSyncManager as any).handleTabBlur();
      expect(crossTabSyncManager.isTabActive()).toBe(false);
    });
  });

  describe('Primary Tab Detection', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should identify single tab as primary', () => {
      expect(crossTabSyncManager.isPrimaryTab()).toBe(true);
    });

    it('should identify most recent tab as primary', () => {
      // Add another tab that's more recent
      const newerTab = {
        id: 'newer-tab',
        isActive: true,
        lastSeen: new Date(Date.now() + 1000), // 1 second in future
        userId: testUserId
      };

      (crossTabSyncManager as any).activeTabs.set('newer-tab', newerTab);

      expect(crossTabSyncManager.isPrimaryTab()).toBe(false);
    });

    it('should handle tabs with different users', () => {
      // Add tab for different user
      const otherUserTab = {
        id: 'other-user-tab',
        isActive: true,
        lastSeen: new Date(Date.now() + 1000),
        userId: 'other-user'
      };

      (crossTabSyncManager as any).activeTabs.set('other-user-tab', otherUserTab);

      // Should still be primary for current user
      expect(crossTabSyncManager.isPrimaryTab()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should clean up all resources', () => {
      crossTabSyncManager.cleanup();

      expect(crossTabSyncManager.getActiveTabs()).toHaveLength(0);
      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('should stop heartbeat on cleanup', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      crossTabSyncManager.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      crossTabSyncManager.initialize(testUserId);
    });

    it('should handle message handler errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      crossTabSyncManager.onMessage('error-test', errorHandler);

      const message: TabSyncMessage = {
        type: 'error-test' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        tabId: 'other-tab-123'
      };

      // Should not throw error
      expect(() => {
        (crossTabSyncManager as any).handleMessage({ data: message });
      }).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle postMessage errors gracefully', () => {
      // Mock postMessage to throw error
      const mockChannel = (crossTabSyncManager as any).broadcastChannel;
      if (mockChannel) {
        mockChannel.postMessage = vi.fn(() => {
          throw new Error('PostMessage error');
        });
      }

      // Should not throw error
      expect(() => {
        crossTabSyncManager.broadcastNotificationReceived({ id: '123' });
      }).not.toThrow();
    });
  });
});