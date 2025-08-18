import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserManagementFallback } from '../UserManagementFallback';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    transformUserName: (fullName: string | null, email: string) => fullName || email.split('@')[0]
  };
});

const mockUsers = [
  {
    id: '1',
    email: 'admin@test.com',
    role: 'admin' as const,
    created_at: '2024-01-01T00:00:00Z',
    full_name: 'Admin User'
  },
  {
    id: '2',
    email: 'agent@test.com',
    role: 'agent' as const,
    created_at: '2024-01-02T00:00:00Z',
    full_name: 'Agent User'
  },
  {
    id: '3',
    email: 'user@test.com',
    role: 'user' as const,
    created_at: '2024-01-03T00:00:00Z',
    full_name: 'Regular User'
  }
];

describe('UserManagementFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fallback component with error message', () => {
    const errorMessage = 'Main component failed to load';
    render(<UserManagementFallback error={errorMessage} />);

    expect(screen.getByTestId('user-management-fallback')).toBeInTheDocument();
    expect(screen.getByText('User Management is running in fallback mode')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('displays basic user list when data loads successfully', async () => {
    // Mock successful data loading
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: mockUsers,
            error: null
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    expect(screen.getByText('Agent User')).toBeInTheDocument();
    expect(screen.getByText('Regular User')).toBeInTheDocument();
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('agent@test.com')).toBeInTheDocument();
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
  });

  it('shows loading state while fetching data', () => {
    // Mock pending promise
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => new Promise(() => {})) // Never resolves
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    expect(screen.getByText('Loading user data...')).toBeInTheDocument();
  });

  it('handles database errors gracefully', async () => {
    // Mock database error
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Database connection failed' }
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Load User Data')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load user data: Database connection failed')).toBeInTheDocument();
  });

  it('calls onRetry when main retry button is clicked', () => {
    const mockOnRetry = vi.fn();
    render(<UserManagementFallback onRetry={mockOnRetry} />);

    const retryButton = screen.getByTestId('main-retry-button');
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('refreshes fallback data when refresh button is clicked', async () => {
    // Mock successful initial load
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: mockUsers,
            error: null
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    const refreshButton = screen.getByTestId('fallback-retry-button');
    fireEvent.click(refreshButton);

    // Should call supabase again
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it('displays role icons and colors correctly', async () => {
    // Mock successful data loading
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: mockUsers,
            error: null
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Check that role badges are displayed
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('agent')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('shows empty state when no users are found', async () => {
    // Mock empty data
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('No Users Found')).toBeInTheDocument();
    });

    expect(screen.getByText('No user data could be loaded in fallback mode.')).toBeInTheDocument();
  });

  it('displays limitations notice when users are loaded', async () => {
    // Mock successful data loading
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: mockUsers,
            error: null
          }))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('Limited Functionality')).toBeInTheDocument();
    });

    expect(screen.getByText(/In fallback mode, you can only view basic user information/)).toBeInTheDocument();
  });

  it('handles network errors with appropriate error message', async () => {
    // Mock network error
    const mockSupabaseChain = {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.reject(new Error('Network connection failed')))
        }))
      }))
    };
    
    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    render(<UserManagementFallback />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Load User Data')).toBeInTheDocument();
    });

    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
  });

  it('reloads page when onRetry is not provided', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(<UserManagementFallback />);

    const retryButton = screen.getByTestId('main-retry-button');
    fireEvent.click(retryButton);

    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});