/**
 * Test utilities for session and connection simulation
 * Provides mock implementations and test helpers for session management testing
 */

import { vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';

// Mock session data
export const mockUser: User = {
  id: 'test-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  phone: '',
  confirmed_at: '2024-01-01T00:00:00.000Z',
  last_sign_in_at: '2024-01-01T00:00:00.000Z',
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

export const mockSession: Session = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: mockUser
};

export const mockExpiredSession: Session = {
  ...mockSession,
  expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
};

export const mockExpiringSession: Session = {
  ...mockSession,
  expires_at: Math.floor(Date.now() / 1000) + 300, // Expires in 5 minutes
};

// Mock Supabase client
export const createMockSupabaseClient = () => {
  return {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  };
};

// Mock BroadcastChannel
export class MockBroadcastChannel {
  private listeners: ((event: MessageEvent) => void)[] = [];
  
  constructor(public name: string) {}

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  postMessage(data: any) {
    const event = new MessageEvent('message', { data });
    this.listeners.forEach(listener => listener(event));
  }

  close() {
    this.listeners = [];
  }
}

// Mock localStorage
export const createMockLocalStorage = () => {
  const storage: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach(key => delete storage[key]);
    }),
    length: 0,
    key: vi.fn()
  };
};

// Mock IndexedDB
export const createMockIndexedDB = () => {
  const databases: Record<string, any> = {};
  
  return {
    open: vi.fn((name: string) => {
      return Promise.resolve({
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn()
          }))
        })),
        close: vi.fn()
      });
    }),
    deleteDatabase: vi.fn()
  };
};

// Connection simulation utilities
export class ConnectionSimulator {
  private isOnline = true;
  private listeners: ((event: Event) => void)[] = [];

  constructor() {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: this.isOnline
    });
  }

  setOnline(online: boolean) {
    this.isOnline = online;
    (navigator as any).onLine = online;
    
    const event = new Event(online ? 'online' : 'offline');
    this.listeners.forEach(listener => listener(event));
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    if (type === 'online' || type === 'offline') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  simulateNetworkError() {
    this.setOnline(false);
    setTimeout(() => this.setOnline(true), 1000);
  }

  simulateSlowConnection(delay: number = 2000) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Timer utilities for testing
export class TimerUtils {
  static advanceTimersByTime(ms: number) {
    vi.advanceTimersByTime(ms);
  }

  static runAllTimers() {
    vi.runAllTimers();
  }

  static clearAllTimers() {
    vi.clearAllTimers();
  }

  static useFakeTimers() {
    vi.useFakeTimers();
  }

  static useRealTimers() {
    vi.useRealTimers();
  }
}

// Test data generators
export const generateSessionData = (overrides: Partial<Session> = {}): Session => ({
  ...mockSession,
  ...overrides
});

export const generateUserData = (overrides: Partial<User> = {}): User => ({
  ...mockUser,
  ...overrides
});

// Error simulation
export class ErrorSimulator {
  static networkError() {
    return new Error('Network request failed');
  }

  static authError() {
    const error = new Error('Authentication failed');
    (error as any).code = 'AUTH_ERROR';
    return error;
  }

  static timeoutError() {
    const error = new Error('Request timeout');
    (error as any).code = 'TIMEOUT_ERROR';
    return error;
  }

  static genericError(message: string = 'Generic error') {
    return new Error(message);
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static measureExecutionTime<T>(fn: () => T): { result: T; time: number } {
    const start = performance.now();
    const result = fn();
    const time = performance.now() - start;
    return { result, time };
  }

  static async measureAsyncExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = performance.now();
    const result = await fn();
    const time = performance.now() - start;
    return { result, time };
  }
}

// Memory leak detection utilities
export class MemoryTestUtils {
  static trackEventListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
    const listeners = new Map<EventTarget, Set<string>>();

    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
      if (!listeners.has(this)) {
        listeners.set(this, new Set());
      }
      listeners.get(this)!.add(type);
      return originalAddEventListener.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function(type: string, listener: any, options?: any) {
      const targetListeners = listeners.get(this);
      if (targetListeners) {
        targetListeners.delete(type);
        if (targetListeners.size === 0) {
          listeners.delete(this);
        }
      }
      return originalRemoveEventListener.call(this, type, listener, options);
    };

    return {
      getActiveListeners: () => listeners,
      cleanup: () => {
        EventTarget.prototype.addEventListener = originalAddEventListener;
        EventTarget.prototype.removeEventListener = originalRemoveEventListener;
      }
    };
  }

  static trackTimers() {
    const timers = new Set<number>();
    const originalSetTimeout = global.setTimeout;
    const originalSetInterval = global.setInterval;
    const originalClearTimeout = global.clearTimeout;
    const originalClearInterval = global.clearInterval;

    global.setTimeout = ((fn: any, delay?: number) => {
      const id = originalSetTimeout(fn, delay);
      timers.add(id);
      return id;
    }) as any;

    global.setInterval = ((fn: any, delay?: number) => {
      const id = originalSetInterval(fn, delay);
      timers.add(id);
      return id;
    }) as any;

    global.clearTimeout = (id: number) => {
      timers.delete(id);
      return originalClearTimeout(id);
    };

    global.clearInterval = (id: number) => {
      timers.delete(id);
      return originalClearInterval(id);
    };

    return {
      getActiveTimers: () => timers,
      cleanup: () => {
        timers.forEach(id => {
          originalClearTimeout(id);
          originalClearInterval(id);
        });
        global.setTimeout = originalSetTimeout;
        global.setInterval = originalSetInterval;
        global.clearTimeout = originalClearTimeout;
        global.clearInterval = originalClearInterval;
      }
    };
  }
}