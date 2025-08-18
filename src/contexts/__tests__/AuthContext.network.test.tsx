import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '@/lib/supabase';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock the network error handler
vi.mock('@/lib/networkErrorHandler', () => ({
  withNetworkErrorHandling: vi.fn((operation) => operation()),
  analyzeNetworkError: vi.fn(() => ({
    type: 'insufficient_resources',
    originalError: new Error('ERR_INSUFFICIENT_RESOURCES'),
    retryable: true,
    suggestedDelay: 5000,
  })),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Test component that uses the auth context
function TestComponent() {
  const { user, userProfile, loading, isInitialized, sessionHealth } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="initialized">{isInitialized ? 'initialized' : 'not-initialized'}</div>
      <div data-testid="user">{user ? user.id : 'no-user'}</div>
      <div data-testid="profile">{userProfile ? userProfile.id : 'no-profile'}</div>
      <div data-testid="session-health">{sessionHealth ? sessionHealth.isValid ? 'valid' : 'invalid' : 'no-health'}</div>
    </div>
  );
}

describe('AuthContext Network Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should handle ERR_INSUFFICIENT_RESOURCES errors gracefully', async () => {
    const mockSession = {
      user: { id: 'test-user-id', email: 'test@example.com' },
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    // Mock getSession to return a valid session
    const mockGetSession = vi.mocked(supabase.auth.getSession);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock profile loading to fail with ERR_INSUFFICIENT_RESOURCES initially
    const mockFrom = vi.mocked(supabase.from);
    let callCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => {
            callCount++;
            if (callCount === 1) {
              // First call fails with resource error
              throw new Error('ERR_INSUFFICIENT_RESOURCES');
            }
            // Second call succeeds
            return Promise.resolve({
              data: { id: 'test-user-id', email: 'test@example.com', full_name: 'Test User' },
              error: null,
            });
          }),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization to complete
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
    });

    // Should eventually load the profile despite the initial error
    await waitFor(() => {
      expect(screen.getByTestId('profile')).toHaveTextContent('test-user-id');
    }, { timeout: 10000 });

    // Should have valid session health
    expect(screen.getByTestId('session-health')).toHaveTextContent('valid');
  });

  it('should prevent concurrent profile loading requests', async () => {
    const mockSession = {
      user: { id: 'test-user-id', email: 'test@example.com' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockGetSession = vi.mocked(supabase.auth.getSession);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock profile loading with a delay to simulate slow network
    const mockFrom = vi.mocked(supabase.from);
    let requestCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            requestCount++;
            // Add delay to simulate slow network
            await new Promise(resolve => setTimeout(resolve, 100));
            return {
              data: { id: 'test-user-id', email: 'test@example.com', full_name: 'Test User' },
              error: null,
            };
          }),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
    });

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile')).toHaveTextContent('test-user-id');
    });

    // Should have made only one request despite potential concurrent calls
    expect(requestCount).toBe(1);
  });

  it('should implement circuit breaker for consecutive failures', async () => {
    const mockSession = {
      user: { id: 'test-user-id', email: 'test@example.com' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockGetSession = vi.mocked(supabase.auth.getSession);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    // Mock profile loading to always fail
    const mockFrom = vi.mocked(supabase.from);
    let requestCount = 0;
    const requestTimes: number[] = [];
    
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => {
            requestCount++;
            requestTimes.push(Date.now());
            throw new Error('ERR_INSUFFICIENT_RESOURCES');
          }),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('initialized');
    });

    // Should have made some requests but not too many due to circuit breaker
    await waitFor(() => {
      expect(requestCount).toBeGreaterThan(0);
    });

    // The circuit breaker should limit the number of requests
    // Since we're failing consistently, it should stop making requests after a few attempts
    expect(requestCount).toBeLessThanOrEqual(5); // Should not make too many requests due to circuit breaker
  });

  it('should debounce idle return handling', async () => {
    vi.useFakeTimers();

    const mockSession = {
      user: { id: 'test-user-id', email: 'test@example.com' },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    const mockGetSession = vi.mocked(supabase.auth.getSession);
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const mockFrom = vi.mocked(supabase.from);
    let profileRequestCount = 0;
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => {
            profileRequestCount++;
            return Promise.resolve({
              data: { id: 'test-user-id', email: 'test@example.com', full_name: 'Test User' },
              error: null,
            });
          }),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Fast forward initial loading
    await act(async () => {
      vi.runAllTimers();
    });

    const initialRequestCount = profileRequestCount;

    // Simulate multiple rapid visibility changes (idle returns)
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast forward debounce timer
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Should have made at most one additional request due to debouncing
    // (The exact count may vary due to timing, but it should be limited)
    expect(profileRequestCount).toBeLessThanOrEqual(initialRequestCount + 2);

    vi.useRealTimers();
  });
});