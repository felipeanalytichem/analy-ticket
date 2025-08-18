/**
 * Global setup for integration tests
 * Initializes test environment and shared resources
 */

import { beforeAll, afterAll } from 'vitest';

export async function setup() {
  console.log('🔧 Setting up integration test environment...');
  
  // Set up global test environment
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';
  
  // Mock browser APIs that might not be available in test environment
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  
  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  
  // Mock performance API
  if (!global.performance) {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => [],
      clearMarks: () => {},
      clearMeasures: () => {}
    } as any;
  }
  
  // Mock crypto API for UUID generation
  if (!global.crypto) {
    global.crypto = {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }
    } as any;
  }
  
  // Set up test database state
  await setupTestDatabase();
  
  console.log('✅ Integration test environment ready');
}

export async function teardown() {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Clean up test database
  await cleanupTestDatabase();
  
  // Clean up any global resources
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Integration test cleanup complete');
}

async function setupTestDatabase() {
  // Mock database setup - in a real scenario, this might set up a test database
  console.log('📊 Setting up test database state...');
  
  // Initialize any required test data
  const testData = {
    users: [
      { id: 'test-user-1', email: 'test1@example.com', role: 'user' },
      { id: 'test-user-2', email: 'test2@example.com', role: 'admin' }
    ],
    sessions: [
      { id: 'test-session-1', userId: 'test-user-1', expiresAt: Date.now() + 3600000 }
    ]
  };
  
  // Store test data in global scope for tests to access
  (global as any).__TEST_DATA__ = testData;
}

async function cleanupTestDatabase() {
  console.log('🗑️ Cleaning up test database...');
  
  // Clean up test data
  delete (global as any).__TEST_DATA__;
  
  // Clear any cached data
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
}