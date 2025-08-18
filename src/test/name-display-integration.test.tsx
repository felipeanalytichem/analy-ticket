import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserManagement } from '@/components/admin/UserManagement';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies with proper utils mock
vi.mock('@/integrations/supabase/client');
vi.mock('@/contexts/AuthContext');
vi.mock('@/components/ui/use-toast');
vi.mock('@/lib/adminService');
vi.mock('@/lib/emailService');

const mockToast = vi.fn();
const mockSupabase = supabase as any;
const mockUseAuth = useAuth as any;
const mockUseToast = useToast as any;

describe('Name Display Integration Tests', () => {
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

  describe('User data loading with name transformation', () => {
    it('should display users with proper name transformation', async () => {
      const mockUsers = [
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
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('User Management (3)')).toBeInTheDocument();
        
        // User with full name should display full name
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        
        // User without full name should show email username
        expect(screen.getByText('jane')).toBeInTheDocument();
        
        // User with empty full name should show email username
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });

    it('should handle complex email patterns in name fallback', async () => {
      const mockUsers = [
        { 
          id: 'user1', 
          full_name: null, 
          email: 'first.last+tag@company.com', 
          role: 'user',
          created_at: '2023-01-01T00:00:00Z'
        },
        { 
          id: 'user2', 
          full_name: '', 
          email: 'user_123@domain.org', 
          role: 'agent',
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('first.last+tag')).toBeInTheDocument();
        expect(screen.getByText('user_123')).toBeInTheDocument();
      });
    });

    it('should handle invalid email formats gracefully', async () => {
      const mockUsers = [
        { 
          id: 'user1', 
          full_name: null, 
          email: 'invalid-email', 
          role: 'user',
          created_at: '2023-01-01T00:00:00Z'
        },
        { 
          id: 'user2', 
          full_name: '', 
          email: '@example.com', 
          role: 'agent',
          created_at: '2023-01-02T00:00:00Z'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        // Should show fallback for invalid emails
        expect(screen.getByText('No name provided')).toBeInTheDocument();
      });
    });
  });

  describe('Error handling scenarios', () => {
    it('should display error state when database query fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });
    });

    it('should handle empty user list gracefully', async () => {
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

    it('should recover from network errors with retry', async () => {
      let callCount = 0;
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
                  full_name: 'Recovered User', 
                  email: 'recovered@example.com', 
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

      // Should eventually show user data with proper name transformation
      await waitFor(() => {
        expect(screen.getByText('Recovered User')).toBeInTheDocument();
      });
    });
  });
});