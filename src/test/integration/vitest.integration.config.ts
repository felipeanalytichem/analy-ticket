/**
 * Vitest configuration for integration tests
 * Optimized for session persistence critical flows testing
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'jsdom',
    
    // Global setup and teardown
    globalSetup: ['./src/test/integration/setup/global-setup.ts'],
    setupFiles: ['./src/test/integration/setup/test-setup.ts'],
    
    // Test file patterns
    include: [
      'src/test/integration/**/*.integration.test.ts'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'src/test/integration/setup/**',
      'src/test/integration/utils/**'
    ],
    
    // Timeout configuration
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Concurrency settings
    threads: false, // Disable threads for integration tests to avoid conflicts
    maxConcurrency: 1, // Run integration tests sequentially
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './src/test/reports/coverage',
      include: [
        'src/services/**/*.ts',
        'src/hooks/**/*.ts',
        'src/contexts/**/*.ts',
        'src/components/session/**/*.tsx',
        'src/components/offline/**/*.tsx',
        'src/lib/apiWithRecovery.ts'
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        '**/index.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      'html'
    ],
    
    // Output configuration
    outputFile: {
      json: './src/test/reports/integration-results.json',
      html: './src/test/reports/integration-results.html'
    },
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Performance monitoring
    logHeapUsage: true,
    
    // Custom test metadata
    meta: {
      task: '10.2 Build integration tests for critical flows',
      requirements: ['1.1', '2.2', '9.1', '10.3'],
      testTypes: [
        'session-lifecycle',
        'connection-recovery', 
        'cross-tab-sync',
        'performance'
      ]
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../'),
      '@/test': resolve(__dirname, '../')
    }
  },
  
  // Define configuration for different test environments
  define: {
    __TEST_ENV__: '"integration"',
    __VITEST__: true
  }
});