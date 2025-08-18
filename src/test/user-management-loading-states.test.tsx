import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/contexts/AuthContext');
vi.mock('@/components/ui/use-toast');
vi.mock('@/lib/adminService');
vi.mock('@/lib/emailService');
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    transformUserName: vi.fn((fullName, email) => fullName || email?.split('@')[0] || 'No name provided')
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const mockToast = vi.fn();
const mockSupabase = supabase as any;
const mockUseAuth = useAuth as any;
const mockUseToast = useToast as any;

describe('UserManagement Loading State Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Setup default mocks
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false,
      isInitialized: true
    });

    // Mock successful temp password column check
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        }),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should transition from initial loading to loaded state without flickering', async () => {
    // Mock successful database query with delay
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              data: [
                { 
                  id: 'user1', 
                  full_name: 'John Doe', 
                  email: 'john@example.com', 
                  role: 'user',
                  created_at: '2023-01-01T00:00:00Z'
                }
              ],
              error: null
            }), 100)
          )
        )
      })
    });

    render(<UserManagement />);

    // Should show initial loading state
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();

    // Fast-forward time to complete loading
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // Should transition to loaded state
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should handle loading state transitions during retry operations', async () => {
    let callCount = 0;
    
    // Mock database query to fail first, then succeed
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Network timeout'));
          }
          return new Promise(resolve => 
            setTimeout(() => resolve({
              data: [
                { 
                  id: 'user1', 
                  full_name: 'John Doe', 
                  email: 'john@example.com', 
                  role: 'user',
                  created_at: '2023-01-01T00:00:00Z'
                }
              ],
              error: null
            }), 50)
          );
        })
      })
    });

    render(<UserManagement />);

    // Should show initial loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });

    // Should show retry loading state
    const retryButton = screen.getByTestId('retry-button');
    
    act(() => {
      retryButton.click();
    });

    // Should show loading during retry
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Fast-forward retry delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should transition to success state
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should prevent multiple simultaneous loading states from overlapping', async () => {
    // Mock slow database query
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              data: [],
              error: null
            }), 200)
          )
        )
      })
    });

    render(<UserManagement />);

    // Should show only one loading indicator
    const loadingIndicators = screen.getAllByTestId('loading-indicator');
    expect(loadingIndicators).toHaveLength(1);

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Should transition to loaded state with no overlapping loaders
    await waitFor(() => {
      expect(screen.getByText('User Management (0)')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should maintain stable loading state during authentication changes', async () => {
    // Start with loading authentication
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true
    });

    const { rerender } = render(<UserManagement />);

    // Should show authentication loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Simulate authentication completion
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false
    });

    // Mock successful data query
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { 
              id: 'user1', 
              full_name: 'John Doe', 
              email: 'john@example.com', 
              role: 'user',
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    rerender(<UserManagement />);

    // Should transition smoothly to data loading
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Should eventually show loaded data
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should handle form submission loading states without affecting main loading', async () => {
    // Mock successful initial load
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { 
              id: 'user1', 
              full_name: 'John Doe', 
              email: 'john@example.com', 
              role: 'user',
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    render(<UserManagement />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    });

    // Open create user form
    const createButton = screen.getByRole('button', { name: /new user/i });
    act(() => {
      createButton.click();
    });

    // Form should be open without affecting main component loading state
    await waitFor(() => {
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });

    // Main component should still show loaded state
    expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show consistent loading indicator that does not change states rapidly', async () => {
    let resolvePromise: (value: any) => void;
    const loadingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    // Mock database query with controlled promise
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue(loadingPromise)
      })
    });

    render(<UserManagement />);

    // Should show consistent loading state
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Advance time multiple times - loading state should remain stable
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Resolve the promise
    act(() => {
      resolvePromise!({
        data: [],
        error: null
      });
    });

    // Should transition to loaded state
    await waitFor(() => {
      expect(screen.getByText('User Management (0)')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  it('should provide smooth visual transition between loading and loaded states', async () => {
    // Mock successful database query
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { 
              id: 'user1', 
              full_name: 'John Doe', 
              email: 'john@example.com', 
              role: 'user',
              created_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    render(<UserManagement />);

    // Should start with loading state
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Should transition smoothly to loaded state
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    });

    // Loading state should be completely gone
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    
    // Content should be fully rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });
});