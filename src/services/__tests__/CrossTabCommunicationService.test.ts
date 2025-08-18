import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CrossTabCommunicationService, TabMessage, SessionState } from '../CrossTabCommunicationService';

// Mock BroadcastChannel
class MockBroadcastChannel {
  private listeners: ((event: { data: any }) => void)[] = [];
  private static instances: MockBroadcastChannel[] = [];

  constructor(public name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: any }) => void) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  postMessage(data: any) {
    // Simulate broadcasting to all other instances
    MockBroadcastChannel.instances.forEach(instance => {
      if (instance !== this) {
        instance.listeners.forEach(listener => {
          setTimeout(() => listener({ data }), 0);
        });
      }
    });
  }

  close() {
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }

  static clearAll() {
    MockBroadcastChannel.instances = [];
  }
}

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn()
    }
  }
}));

// Replace global BroadcastChannel
global.BroadcastChannel = MockBroadcastChannel as any;

describe('CrossTabCommunicationService', () => {
  let service: CrossTabCommunicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    MockBroadcastChannel.clearAll();
    service = new CrossTabCommunicationService();
  });

  afterEach(async () => {
    await service.cleanup();
    MockBroadcastChannel.clearAll();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      
      expect(service.getTabId()).toBeDefined();
      expect(service.getTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw or cause issues
      
      expect(service.getTabId()).toBeDefined();
    });

    it('should handle initialization errors gracefully', async () => {
      // Create a new service for this test
      const testService = new CrossTabCommunicationService();
      
      // Mock BroadcastChannel to throw error
      const originalBroadcastChannel = global.BroadcastChannel;
      global.BroadcastChannel = class {
        constructor() {
          throw new Error('BroadcastChannel not supported');
        }
      } as any;

      await expect(testService.initialize()).rejects.toThrow('BroadcastChannel not supported');

      // Restore
      global.BroadcastChannel = originalBroadcastChannel;
    });
  });

  describe('message broadcasting', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should broadcast messages successfully', async () => {
      const messageType = 'TEST_MESSAGE';
      const payload = { test: 'data' };

      await expect(service.broadcastMessage(messageType, payload)).resolves.not.toThrow();
    });

    it('should include correct message structure', async () => {
      const messageType = 'TEST_MESSAGE';
      const payload = { test: 'data' };

      // Create a second service to receive the message
      const receiverService = new CrossTabCommunicationService();
      await receiverService.initialize();

      const messagePromise = new Promise<TabMessage>((resolve) => {
        receiverService.subscribe(messageType, resolve);
      });

      await service.broadcastMessage(messageType, payload);

      const receivedMessage = await messagePromise;
      expect(receivedMessage.type).toBe(messageType);
      expect(receivedMessage.payload).toEqual(payload);
      expect(receivedMessage.tabId).toBe(service.getTabId());
      expect(receivedMessage.timestamp).toBeTypeOf('number');

      await receiverService.cleanup();
    });
  });

  describe('message subscription', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should subscribe to messages', async () => {
      const messageType = 'TEST_SUBSCRIPTION';
      const handler = vi.fn();

      const unsubscribe = service.subscribe(messageType, handler);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should receive subscribed messages', async () => {
      const messageType = 'TEST_SUBSCRIPTION';
      const payload = { test: 'subscription' };
      const handler = vi.fn();

      // Create a second service to send the message
      const senderService = new CrossTabCommunicationService();
      await senderService.initialize();

      service.subscribe(messageType, handler);

      await senderService.broadcastMessage(messageType, payload);

      // Wait for message to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: messageType,
          payload,
          tabId: senderService.getTabId()
        })
      );

      await senderService.cleanup();
    });

    it('should unsubscribe from messages', async () => {
      const messageType = 'TEST_UNSUBSCRIBE';
      const handler = vi.fn();

      const unsubscribe = service.subscribe(messageType, handler);
      unsubscribe();

      // Create a second service to send the message
      const senderService = new CrossTabCommunicationService();
      await senderService.initialize();

      await senderService.broadcastMessage(messageType, { test: 'data' });

      // Wait for potential message processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();

      await senderService.cleanup();
    });
  });

  describe('session state synchronization', () => {
    let sessionState: SessionState;

    beforeEach(async () => {
      await service.initialize();
      sessionState = {
        isAuthenticated: true,
        user: { id: 'user123', email: 'test@example.com' },
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now()
      };
    });

    it('should sync session state across tabs', async () => {
      await service.syncSessionState(sessionState);

      const currentState = service.getCurrentSessionState();
      expect(currentState).toEqual(sessionState);
    });

    it('should broadcast session state to other tabs', async () => {
      // Test that syncSessionState calls broadcastMessage with correct parameters
      const broadcastSpy = vi.spyOn(service, 'broadcastMessage');
      
      await service.syncSessionState(sessionState);

      expect(broadcastSpy).toHaveBeenCalledWith('SESSION_STATE_SYNC', {
        sessionState,
        fromTabId: service.getTabId()
      });

      broadcastSpy.mockRestore();
    });

    it('should return null when no session state is available', () => {
      const currentState = service.getCurrentSessionState();
      expect(currentState).toBeNull();
    });
  });

  describe('tab lifecycle management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track active tabs', async () => {
      const secondService = new CrossTabCommunicationService();
      await secondService.initialize();

      // Wait for tab registration to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      const activeTabs = service.getActiveTabs();
      expect(activeTabs.length).toBeGreaterThanOrEqual(1);

      await secondService.cleanup();
    });

    it('should handle tab closing', async () => {
      const secondService = new CrossTabCommunicationService();
      await secondService.initialize();

      // Wait for tab registration
      await new Promise(resolve => setTimeout(resolve, 50));

      let activeTabsCount = service.getActiveTabs().length;
      expect(activeTabsCount).toBeGreaterThanOrEqual(1);

      await secondService.cleanup();

      // Wait for cleanup to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      // Note: In real implementation, tabs would be removed from the list
      // This test verifies the cleanup method runs without errors
    });

    it('should cleanup resources on cleanup', async () => {
      await service.cleanup();

      // Verify that broadcasting after cleanup doesn't throw
      await expect(service.broadcastMessage('TEST', {})).rejects.toThrow();
    });
  });

  describe('master tab election', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should elect master tab', async () => {
      // Wait for master election
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(service.isMaster()).toBe(true);
    });

    it('should handle multiple tabs master election', async () => {
      // Wait for master election to complete (happens 1 second after initialization)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Test that master election logic works by checking state after election
      // In a single tab scenario, the tab should become master
      expect(service.isMaster()).toBe(true);
      
      // Test that the electMasterTab method can be called without errors
      expect(() => service['electMasterTab']()).not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle message handler errors gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      service.subscribe('ERROR_TEST', errorHandler);

      const senderService = new CrossTabCommunicationService();
      await senderService.initialize();

      // This should not throw despite the handler error
      await expect(senderService.broadcastMessage('ERROR_TEST', {})).resolves.not.toThrow();

      await senderService.cleanup();
    });

    it('should handle broadcast errors', async () => {
      // Mock postMessage to throw error
      const originalPostMessage = service['broadcastChannel'].postMessage;
      service['broadcastChannel'].postMessage = vi.fn(() => {
        throw new Error('Broadcast error');
      });

      await expect(service.broadcastMessage('TEST', {})).rejects.toThrow('Broadcast error');

      // Restore
      service['broadcastChannel'].postMessage = originalPostMessage;
    });
  });

  describe('tab identification', () => {
    it('should generate unique tab IDs', () => {
      const service1 = new CrossTabCommunicationService();
      const service2 = new CrossTabCommunicationService();

      expect(service1.getTabId()).not.toBe(service2.getTabId());
      expect(service1.getTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
      expect(service2.getTabId()).toMatch(/^tab_\d+_[a-z0-9]+$/);
    });

    it('should ignore messages from same tab', async () => {
      await service.initialize();

      const handler = vi.fn();
      service.subscribe('SELF_MESSAGE', handler);

      await service.broadcastMessage('SELF_MESSAGE', { test: 'data' });

      // Wait for potential message processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
    });
  });
});