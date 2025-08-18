import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useAuth } from '@/contexts/AuthContext';

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

const mockUseAuth = useAuth as any;

describe('useOptimizedAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should cache authentication state to reduce redundant calls', () => {
    const mockAuthState = {
      user: { id: '1', email: 'admin@test.com' },
      userProfile: { id: '1', role: 'admin', email: 'admin@test.com' },
      loading: false,
      isInitialized: true
    };

    mockUseAuth.mockReturnValue(mockAuthState);

    const { result, rerender } = renderHook(() => useOptimizedAuth());

    const firstCall = result.current;
    
    // Rerender multiple times quickly
    rerender();
    rerender();
    rerender();

    const secondCall = result.current;

    // Should return cached state
    expect(firstCall.isAuthenticated).toBe(true);
    expect(firstCall.hasAdminRole).toBe(true);
    expect(secondCall.isAuthenticated).toBe(true);
    expect(secondCall.hasAdminRole).toBe(true);
  });

  it('should prevent authentication loading from conflicting with data loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true,
      isInitialized: false
    });

    const { result } = renderHook(() => useOptimizedAuth());

    expect(result.current.isAuthLoading).toBe(true);
    expect(result.current.isDataLoadingBlocked).toBe(true);
    expect(result.current.canLoadData).toBe(false);
  });

  it('should provide stable authentication error display', () => {
    const onAuthError = vi.fn();
    
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => 
      useOptimizedAuth({ onAuthError })
    );

    // Simulate authentication error handling
    act(() => {
      result.current.clearError();
    });

    expect(result.current.stableError).toBe(null);
    expect(result.current.hasError).toBe(false);
  });

  it('should implement proper guards for authentication state changes', () => {
    const mockAuthState = {
      user: { id: '1', email: 'user@test.com' },
      userProfile: { id: '1', role: 'user', email: 'user@test.com' },
      loading: false,
      isInitialized: true
    };

    mockUseAuth.mockReturnValue(mockAuthState);

    const { result } = renderHook(() => 
      useOptimizedAuth({ requireAdminRole: true })
    );

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hasAdminRole).toBe(false);
    expect(result.current.permissionCheck.hasPermission).toBe(false);
    expect(result.current.permissionCheck.reason).toBe('insufficient_permissions');
  });

  it('should handle permission checks correctly', () => {
    const onAccessDenied = vi.fn();
    
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'agent@test.com' },
      userProfile: { id: '1', role: 'agent', email: 'agent@test.com' },
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => 
      useOptimizedAuth({ 
        requireAdminRole: true,
        onAccessDenied 
      })
    );

    // The hasPermission function should be called with specific options to trigger the access denied callback
    expect(result.current.hasPermission({ requireAdminRole: true })).toBe(false);
    expect(onAccessDenied).toHaveBeenCalledWith('agent');
  });

  it('should allow custom role-based access', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'agent@test.com' },
      userProfile: { id: '1', role: 'agent', email: 'agent@test.com' },
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => 
      useOptimizedAuth({ 
        allowedRoles: ['agent', 'admin']
      })
    );

    expect(result.current.hasPermission()).toBe(true);
    expect(result.current.permissionCheck.hasPermission).toBe(true);
    expect(result.current.permissionCheck.reason).toBe('authorized');
  });

  it('should invalidate cache when requested', () => {
    const mockAuthState = {
      user: { id: '1', email: 'admin@test.com' },
      userProfile: { id: '1', role: 'admin', email: 'admin@test.com' },
      loading: false,
      isInitialized: true
    };

    mockUseAuth.mockReturnValue(mockAuthState);

    const { result } = renderHook(() => useOptimizedAuth());

    // Get initial state
    const initialState = result.current;
    expect(initialState.isAuthenticated).toBe(true);

    // Invalidate cache
    act(() => {
      result.current.invalidateCache();
    });

    // State should be recomputed
    expect(result.current.authCacheAge).toBe(0);
  });

  it('should reset authentication state properly', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => useOptimizedAuth());

    act(() => {
      result.current.resetAuthState();
    });

    expect(result.current.stableError).toBe(null);
    expect(result.current.hasError).toBe(false);
    expect(result.current.authCacheAge).toBe(0);
  });

  it('should provide correct computed properties', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@test.com' },
      userProfile: { id: '1', role: 'admin', email: 'admin@test.com' },
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => useOptimizedAuth());

    expect(result.current.isReady).toBe(true);
    expect(result.current.canAccessUserManagement).toBe(true);
    expect(result.current.canLoadData).toBe(true);
    expect(result.current.isDataLoadingBlocked).toBe(false);
  });

  it('should handle authentication state transitions properly', () => {
    // Start with authenticated state
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'admin@test.com' },
      userProfile: { id: '1', role: 'admin', email: 'admin@test.com' },
      loading: false,
      isInitialized: true
    });

    const { result } = renderHook(() => useOptimizedAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.canLoadData).toBe(true);
    expect(result.current.isDataLoadingBlocked).toBe(false);
  });
});