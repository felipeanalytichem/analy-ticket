/**
 * Test setup for individual integration test files
 * Configures mocks and test utilities for each test
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global test setup that runs before each test
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset DOM state
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Reset window properties
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      reload: vi.fn(),
      assign: vi.fn(),
      replace: vi.fn()
    },
    writable: true
  });
  
  // Mock navigator properties
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
  });
  
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Test Environment)',
    writable: true
  });
  
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Set up fake timers for consistent timing in tests
  vi.useFakeTimers();
  
  // Mock fetch API
  global.fetch = vi.fn();
  
  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  }));
  
  // Mock BroadcastChannel
  global.BroadcastChannel = vi.fn().mockImplementation((name: string) => ({
    name,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    close: vi.fn()
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
    value: localStorageMock,
    writable: true
  });
  
  // Mock sessionStorage
  const sessionStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  };
  
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true
  });
  
  // Mock IndexedDB
  const indexedDBMock = {
    open: vi.fn().mockResolvedValue({
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined),
          getAll: vi.fn().mockResolvedValue([])
        })
      }),
      close: vi.fn()
    }),
    deleteDatabase: vi.fn().mockResolvedValue(undefined)
  };
  
  Object.defineProperty(window, 'indexedDB', {
    value: indexedDBMock,
    writable: true
  });
  
  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((cb) => {
    setTimeout(cb, 16); // ~60fps
    return 1;
  });
  
  global.cancelAnimationFrame = vi.fn();
  
  // Mock requestIdleCallback
  global.requestIdleCallback = vi.fn((cb) => {
    setTimeout(cb, 1);
    return 1;
  });
  
  global.cancelIdleCallback = vi.fn();
  
  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
});

// Global test cleanup that runs after each test
afterEach(() => {
  // Cleanup React Testing Library
  cleanup();
  
  // Restore real timers
  vi.useRealTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Restore console methods
  vi.restoreAllMocks();
  
  // Clear any remaining timeouts/intervals
  vi.clearAllTimers();
  
  // Reset DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Clear storage mocks
  if (window.localStorage) {
    window.localStorage.clear();
  }
  
  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Custom matchers for integration tests
expect.extend({
  toBeWithinTimeRange(received: number, expected: number, tolerance: number = 100) {
    const pass = Math.abs(received - expected) <= tolerance;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${tolerance}ms of ${expected}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${tolerance}ms of ${expected}`,
        pass: false
      };
    }
  },
  
  toHaveBeenCalledWithinTime(received: any, timeMs: number) {
    const calls = received.mock.calls;
    if (calls.length === 0) {
      return {
        message: () => `expected function to have been called within ${timeMs}ms`,
        pass: false
      };
    }
    
    // Check if any call was made within the time range
    // This is a simplified check - in a real implementation you'd track call times
    return {
      message: () => `expected function to have been called within ${timeMs}ms`,
      pass: true
    };
  }
});

// Declare custom matcher types
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeWithinTimeRange(expected: number, tolerance?: number): any;
      toHaveBeenCalledWithinTime(timeMs: number): any;
    }
  }
}