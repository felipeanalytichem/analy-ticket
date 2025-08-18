import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DiagnosticManager } from '../DiagnosticManager';
import { supabase } from '@/lib/supabase';

// Mock dependencies
vi.mock('@/lib/supabase');

const mockSupabase = vi.mocked(supabase);

describe('DiagnosticManager', () => {
  let diagnosticManager: DiagnosticManager;

  const mockSession = {
    access_token: 'test-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    user: { id: 'test-user-id', email: 'test@example.com' }
  };

  beforeEach(() => {
    diagnosticManager = new DiagnosticManager();

    // Mock Supabase auth methods
    mockSupabase.auth = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    } as any;

    // Mock Supabase from method
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id' },
            error: null
          })
        }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id' },
            error: null
          })
        })
      })
    });

    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
      },
      configurable: true
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
  });

  afterEach(() => {
    diagnosticManager.destroy();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with default checks', () => {
      expect(diagnosticManager).toBeDefined();
    });

    it('starts monitoring on creation', () => {
      // Monitoring should be active by default
      expect(diagnosticManager).toBeDefined();
    });
  });

  describe('Diagnostic Checks', () => {
    it('runs all diagnostic checks', async () => {
      const results = await diagnosticManager.runAllChecks();
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that we have expected diagnostic types
      const checkIds = results.map(r => r.id);
      expect(checkIds).toContain('auth-session-validity');
      expect(checkIds).toContain('database-connection-health');
      expect(checkIds).toContain('memory-usage');
    });

    it('runs individual diagnostic check', async () => {
      const result = await diagnosticManager.runCheck('auth-session-validity');
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('auth-session-validity');
      expect(result?.name).toBe('Authentication Session Validity');
      expect(['pass', 'fail', 'warning']).toContain(result?.status);
    });

    it('returns null for non-existent check', async () => {
      const result = await diagnosticManager.runCheck('non-existent-check');
      expect(result).toBeNull();
    });
  });

  describe('Authentication Checks', () => {
    it('passes auth session validity check with valid session', async () => {
      const result = await diagnosticManager.runCheck('auth-session-validity');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Session valid');
    });

    it('fails auth session validity check with no session', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await diagnosticManager.runCheck('auth-session-validity');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('No active session');
    });

    it('warns about expiring session', async () => {
      const expiringSoon = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { 
          session: { ...mockSession, expires_at: expiringSoon }
        },
        error: null
      });

      const result = await diagnosticManager.runCheck('auth-session-validity');
      
      expect(result?.status).toBe('warning');
      expect(result?.message).toContain('expires in');
    });

    it('handles auth session errors', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' }
      });

      const result = await diagnosticManager.runCheck('auth-session-validity');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('Auth error');
    });
  });

  describe('Token Refresh Checks', () => {
    it('passes token refresh check with valid refresh token', async () => {
      const result = await diagnosticManager.runCheck('auth-token-refresh');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Token refresh successful');
    });

    it('fails token refresh check with no session', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await diagnosticManager.runCheck('auth-token-refresh');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('No session available');
    });

    it('fails token refresh check with no refresh token', async () => {
      mockSupabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { 
          session: { ...mockSession, refresh_token: null }
        },
        error: null
      });

      const result = await diagnosticManager.runCheck('auth-token-refresh');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('No refresh token available');
    });
  });

  describe('Database Checks', () => {
    it('passes database connection check', async () => {
      const result = await diagnosticManager.runCheck('database-connection-health');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Database connection healthy');
    });

    it('fails database connection check on error', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      const result = await diagnosticManager.runCheck('database-connection-health');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('Database error');
    });

    it('warns about slow database connection', async () => {
      // Mock slow response
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => 
            new Promise(resolve => 
              setTimeout(() => resolve({ data: [{ id: 'test' }], error: null }), 3000)
            )
          )
        })
      });

      const result = await diagnosticManager.runCheck('database-connection-health');
      
      expect(result?.status).toBe('warning');
      expect(result?.message).toContain('slow');
    });
  });

  describe('Memory Checks', () => {
    it('passes memory usage check with normal usage', async () => {
      const result = await diagnosticManager.runCheck('memory-usage');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Memory usage:');
    });

    it('warns about high memory usage', async () => {
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 160 * 1024 * 1024, // 160MB
          totalJSHeapSize: 180 * 1024 * 1024, // 180MB
          jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB (80% usage)
        },
        configurable: true
      });

      const result = await diagnosticManager.runCheck('memory-usage');
      
      expect(result?.status).toBe('warning');
      expect(result?.message).toContain('High memory usage');
    });

    it('fails on critical memory usage', async () => {
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 190 * 1024 * 1024, // 190MB
          totalJSHeapSize: 195 * 1024 * 1024, // 195MB
          jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB (95% usage)
        },
        configurable: true
      });

      const result = await diagnosticManager.runCheck('memory-usage');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('Critical memory usage');
    });
  });

  describe('Network Checks', () => {
    it('passes network connectivity check when online', async () => {
      const result = await diagnosticManager.runCheck('network-connectivity');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Network connection active');
    });

    it('fails network connectivity check when offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      });

      const result = await diagnosticManager.runCheck('network-connectivity');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('offline status');
    });
  });

  describe('Loading Loop Detection', () => {
    it('passes loading loop check with no indicators', async () => {
      const result = await diagnosticManager.runCheck('loading-loop-detection');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('No loading loop indicators');
    });

    it('gets loading loop indicators', () => {
      const indicators = diagnosticManager.getLoadingLoopIndicators();
      expect(indicators).toBeInstanceOf(Array);
    });
  });

  describe('Session Recovery Checks', () => {
    it('passes session recovery check with no recovery data', async () => {
      const result = await diagnosticManager.runCheck('session-recovery-state');
      
      expect(result?.status).toBe('pass');
      expect(result?.message).toContain('Session recovery system healthy');
    });

    it('warns about active recovery processes', async () => {
      // Mock localStorage with recovery data
      const mockGetItem = vi.fn().mockImplementation((key) => {
        if (key.includes('session-recovery')) {
          return JSON.stringify({ isRecovering: true, recoveryAttempts: 2 });
        }
        return null;
      });
      
      Object.defineProperty(window, 'localStorage', {
        value: { ...localStorage, getItem: mockGetItem },
        configurable: true
      });

      const result = await diagnosticManager.runCheck('session-recovery-state');
      
      expect(result?.status).toBe('warning');
      expect(result?.message).toContain('active recovery');
    });
  });

  describe('Error Handling', () => {
    it('handles check errors gracefully', async () => {
      // Register a check that throws an error
      diagnosticManager.registerCheck({
        id: 'error-check',
        name: 'Error Check',
        description: 'A check that throws an error',
        category: 'system',
        severity: 'low',
        check: async () => {
          throw new Error('Test error');
        }
      });

      const result = await diagnosticManager.runCheck('error-check');
      
      expect(result?.status).toBe('fail');
      expect(result?.message).toContain('Diagnostic check failed');
    });

    it('continues running other checks when one fails', async () => {
      // Register a failing check
      diagnosticManager.registerCheck({
        id: 'failing-check',
        name: 'Failing Check',
        description: 'A check that fails',
        category: 'system',
        severity: 'low',
        check: async () => {
          throw new Error('Test error');
        }
      });

      const results = await diagnosticManager.runAllChecks();
      
      // Should have results from other checks despite one failing
      expect(results.length).toBeGreaterThan(1);
      
      const failingResult = results.find(r => r.id === 'failing-check');
      expect(failingResult?.status).toBe('fail');
    });
  });

  describe('Cleanup', () => {
    it('cleans up resources on destroy', () => {
      diagnosticManager.destroy();
      
      // Should not throw errors after cleanup
      expect(() => diagnosticManager.destroy()).not.toThrow();
    });

    it('stops monitoring on destroy', () => {
      diagnosticManager.stopMonitoring();
      
      // Should be able to call multiple times without error
      expect(() => diagnosticManager.stopMonitoring()).not.toThrow();
    });
  });
});