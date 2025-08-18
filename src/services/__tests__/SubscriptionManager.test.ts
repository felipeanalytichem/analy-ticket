import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase with factory function
vi.mock('@/lib/supabase', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    send: vi.fn(),
    unsubscribe: vi.fn()
  };

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn()
    }
  };
});

// Import after mocking
import { SubscriptionManager, ConnectionStatus } from '../SubscriptionManager';
import { supabase } from '@/lib/supabase';

// Mock DOM APIs
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

Object.defineProperty(window, 'dispatchEvent', {
  writable: true,
  value: vi.fn()
});

const mockSupabase = supabase as any;

describe('SubscriptionManager', () => {
  let subscriptionManager: SubscriptionManager;
  const mockCallback = vi.fn();
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionManager = SubscriptionManager.getInstance();
  });

  afterEach(() => {
    subscriptionManager.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SubscriptionManager.getInstance();
      const instance2 = SubscriptionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Subscription Creation', () => {
    it('should create a new subscription successfully', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);

      expect(subscription).toBeTruthy();
      expect(subscription?.userId).toBe(testUserId);
      expect(subscription?.isActive).toBe(true);
      expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications-${testUserId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: testUserId }
        }
      });
    });

    it('should handle subscription creation errors gracefully', () => {
      mockSupabase.channel.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      expect(subscription).toBeNull();
      
      const status = subscriptionManager.getConnectionStatus(testUserId);
      expect(status?.status).toBe('error');
      expect(status?.error).toBe('Connection failed');
    });
  });

  describe('Subscription Deduplication', () => {
    it('should prevent duplicate subscriptions by default', () => {
      const subscription1 = subscriptionManager.subscribe(testUserId, mockCallback);
      const subscription2 = subscriptionManager.subscribe(testUserId, mockCallback);

      expect(subscription1).toBe(subscription2);
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });

    it('should allow creating new subscription when deduplication is disabled', () => {
      subscriptionManager.subscribe(testUserId, mockCallback, {
        enableDeduplication: false
      });
      
      // Reset mock to track second call
      mockSupabase.channel.mockClear();
      
      subscriptionManager.subscribe(testUserId, mockCallback, {
        enableDeduplication: false
      });

      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection State Tracking', () => {
    it('should initialize connection state as connecting', () => {
      subscriptionManager.subscribe(testUserId, mockCallback);
      
      const status = subscriptionManager.getConnectionStatus(testUserId);
      expect(status?.status).toBe('connecting');
      expect(status?.isConnected).toBe(false);
      expect(status?.reconnectAttempts).toBe(0);
    });

    it('should return null for non-existent connection status', () => {
      const status = subscriptionManager.getConnectionStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('Subscription Management', () => {
    it('should check for active subscriptions', () => {
      expect(subscriptionManager.hasActiveSubscription(testUserId)).toBe(false);
      
      subscriptionManager.subscribe(testUserId, mockCallback);
      expect(subscriptionManager.hasActiveSubscription(testUserId)).toBe(true);
    });

    it('should get all active subscriptions', () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      
      subscriptionManager.subscribe(userId1, mockCallback);
      subscriptionManager.subscribe(userId2, mockCallback);
      
      const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
      expect(activeSubscriptions).toHaveLength(2);
      expect(activeSubscriptions.map(s => s.userId)).toContain(userId1);
      expect(activeSubscriptions.map(s => s.userId)).toContain(userId2);
    });
  });

  describe('Unsubscription', () => {
    it('should unsubscribe successfully', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      expect(subscription).toBeTruthy();
      
      const result = subscriptionManager.unsubscribe(subscription!.id);
      expect(result).toBe(true);
      expect(mockSupabase.removeChannel).toHaveBeenCalled();
      expect(subscriptionManager.hasActiveSubscription(testUserId)).toBe(false);
    });

    it('should handle unsubscribing non-existent subscription', () => {
      const result = subscriptionManager.unsubscribe('non-existent');
      expect(result).toBe(false);
    });

    it('should update connection state on unsubscribe', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      subscriptionManager.unsubscribe(subscription!.id);
      
      const status = subscriptionManager.getConnectionStatus(testUserId);
      expect(status).toBeNull();
    });
  });

  describe('Reconnection Logic', () => {
    it('should force reconnect for a user', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      expect(subscription).toBeTruthy();
      
      // Clear the mock to track reconnection calls
      mockSupabase.channel.mockClear();
      
      subscriptionManager.reconnect(testUserId);
      
      // Should create a new subscription
      expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    });

    it('should handle reconnect for non-existent subscription', () => {
      // Should not throw error
      expect(() => {
        subscriptionManager.reconnect('non-existent');
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should clean up all subscriptions and event listeners', () => {
      subscriptionManager.subscribe(testUserId, mockCallback);
      subscriptionManager.subscribe('user2', mockCallback);
      
      expect(subscriptionManager.getActiveSubscriptions()).toHaveLength(2);
      
      subscriptionManager.cleanup();
      
      expect(subscriptionManager.getActiveSubscriptions()).toHaveLength(0);
      expect(document.removeEventListener).toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Options Handling', () => {
    it('should use default options when none provided', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      expect(subscription).toBeTruthy();
    });

    it('should merge custom options with defaults', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback, {
        maxReconnectAttempts: 10,
        heartbeatInterval: 5000
      });
      expect(subscription).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle unsubscribe errors gracefully', () => {
      const subscription = subscriptionManager.subscribe(testUserId, mockCallback);
      
      // Mock removeChannel to throw error
      mockSupabase.removeChannel.mockImplementationOnce(() => {
        throw new Error('Unsubscribe failed');
      });
      
      const result = subscriptionManager.unsubscribe(subscription!.id);
      expect(result).toBe(false);
    });
  });
});