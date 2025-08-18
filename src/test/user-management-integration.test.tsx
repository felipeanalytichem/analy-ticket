import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const mockToast = vi.fn();
const mockSupabase = supabase as any;
const mockUseAuth = useAuth as any;
const mockUseToast = useToast as any;

describe('UserManagement Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false
    });
  });

  it('should display error state when database query fails', async () => {
    // Mock failed database query
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      })
    });

    render(<UserManagement />);

    // Should show loading initially
    expect(screen.getByText('Loading users...')).toBeInTheDocument();

    // Should show error state after failed query
    await waitFor(() => {
      expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
    });

    // Should show retry options
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset & retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('should successfully load users after initial failure', async () => {
    let callCount = 0;
    
    // Mock database query to fail first, then succeed
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Network timeout'));
          }
          return Promise.resolve({
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
          });
        })
      })
    });

    render(<UserManagement />);

    // Should initially show error
    await waitFor(() => {
      expect(screen.getByText('Request Timeout')).toBeInTheDocument();
    });

    // Should show success toast when retry succeeds
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'User data loaded successfully after retry.'
        })
      );
    });

    // Should eventually show user data
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  it('should handle authentication errors gracefully', async () => {
    // Mock no authenticated user
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false
    });

    render(<UserManagement />);

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please log in to access user management.')).toBeInTheDocument();
  });

  it('should handle insufficient permissions gracefully', async () => {
    // Mock user without admin role
    mockUseAuth.mockReturnValue({
      user: { id: 'user-id' },
      userProfile: { role: 'user' },
      loading: false
    });

    render(<UserManagement />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('Administrator privileges required to access user management.')).toBeInTheDocument();
    expect(screen.getByText('Current role: user')).toBeInTheDocument();
  });

  it('should show loading state while authentication is being checked', async () => {
    // Mock loading authentication state
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: true
    });

    render(<UserManagement />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle empty user list gracefully', async () => {
    // Mock successful query with no users
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (0)')).toBeInTheDocument();
      expect(screen.getByText('No users registered.')).toBeInTheDocument();
    });
  });

  it('should display users with proper name transformation', async () => {
    // Mock successful query with various user name scenarios
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
            },
            { 
              id: 'user2', 
              full_name: null, 
              email: 'jane@example.com', 
              role: 'agent',
              created_at: '2023-01-02T00:00:00Z'
            },
            { 
              id: 'user3', 
              full_name: '', 
              email: 'admin@example.com', 
              role: 'admin',
              created_at: '2023-01-03T00:00:00Z'
            }
          ],
          error: null
        })
      })
    });

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.getByText('User Management (3)')).toBeInTheDocument();
      
      // User with full name
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      
      // User without full name should show email username
      expect(screen.getByText('jane')).toBeInTheDocument();
      
      // User with empty full name should show email username
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
  });
});