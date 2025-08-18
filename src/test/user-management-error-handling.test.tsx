import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagement } from '@/components/admin/UserManagement';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { UserDataErrorState } from '@/components/admin/UserDataErrorState';
import { useRetryableQuery } from '@/hooks/useRetryableQuery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

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

describe('User Management Error Handling', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ErrorBoundary Component', () => {
    it('should catch and display errors with retry option', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const onRetry = vi.fn();
      
      render(
        <ErrorBoundary onRetry={onRetry}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const onRetry = vi.fn();
      
      render(
        <ErrorBoundary onRetry={onRetry}>
          <ThrowError />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should display technical details when expanded', () => {
      const ThrowError = () => {
        throw new Error('Detailed test error message');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const detailsElement = screen.getByText('Technical Details');
      fireEvent.click(detailsElement);
      
      expect(screen.getByText('Detailed test error message')).toBeInTheDocument();
    });
  });

  describe('UserDataErrorState Component', () => {
    const defaultProps = {
      error: 'Network connection failed',
      retryCount: 1,
      maxRetries: 3,
      canRetry: true,
      onRetry: vi.fn(),
      onReset: vi.fn()
    };

    it('should display network error with appropriate icon and suggestions', () => {
      render(<UserDataErrorState {...defaultProps} />);

      expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
      expect(screen.getByText('Check your internet connection')).toBeInTheDocument();
      expect(screen.getByText('Retry attempt 1 of 3')).toBeInTheDocument();
    });

    it('should display database error with appropriate messaging', () => {
      const props = {
        ...defaultProps,
        error: 'Database query failed: connection timeout'
      };

      render(<UserDataErrorState {...props} />);

      expect(screen.getByText('Database Error')).toBeInTheDocument();
      expect(screen.getByText(/There was an issue accessing the user database/)).toBeInTheDocument();
      expect(screen.getByText('This is usually a temporary issue')).toBeInTheDocument();
    });

    it('should display timeout error with appropriate messaging', () => {
      const props = {
        ...defaultProps,
        error: 'Request timeout after 30 seconds'
      };

      render(<UserDataErrorState {...props} />);

      expect(screen.getByText('Request Timeout')).toBeInTheDocument();
      expect(screen.getByText(/The request took too long to complete/)).toBeInTheDocument();
      expect(screen.getByText('Wait a moment and try again')).toBeInTheDocument();
    });

    it('should disable retry button when max retries reached', () => {
      const props = {
        ...defaultProps,
        retryCount: 3,
        canRetry: false
      };

      render(<UserDataErrorState {...props} />);

      const retryButton = screen.getByRole('button', { name: /max retries reached/i });
      expect(retryButton).toBeDisabled();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      const props = { ...defaultProps, onRetry };

      render(<UserDataErrorState {...props} />);

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when reset button is clicked', () => {
      const onReset = vi.fn();
      const props = { ...defaultProps, onReset };

      render(<UserDataErrorState {...props} />);

      fireEvent.click(screen.getByRole('button', { name: /reset & retry/i }));
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should display technical details with error information', () => {
      render(<UserDataErrorState {...defaultProps} />);

      const detailsElement = screen.getByText('Technical Details');
      fireEvent.click(detailsElement);
      
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });
  });

  describe('useRetryableQuery Hook', () => {
    it('should handle successful query execution', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue(['user1', 'user2']);
      const onSuccess = vi.fn();

      const TestComponent = () => {
        const { data, loading, error, execute } = useRetryableQuery(mockQueryFn, { onSuccess });
        
        React.useEffect(() => {
          execute();
        }, [execute]);

        if (loading) return <div>Loading...</div>;
        if (error) return <div>Error: {error}</div>;
        return <div>Data: {JSON.stringify(data)}</div>;
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText('Data: ["user1","user2"]')).toBeInTheDocument();
      });

      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('should handle query failure and retry', async () => {
      const mockQueryFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(['user1', 'user2']);
      
      const onError = vi.fn();

      const TestComponent = () => {
        const { data, loading, error, execute, retry, retryCount } = useRetryableQuery(mockQueryFn, { 
          onError,
          maxRetries: 2,
          retryDelay: 100
        });
        
        React.useEffect(() => {
          execute();
        }, [execute]);

        if (loading) return <div>Loading...</div>;
        if (error) return (
          <div>
            <div>Error: {error}</div>
            <div>Retry count: {retryCount}</div>
            <button onClick={retry}>Retry</button>
          </div>
        );
        return <div>Data: {JSON.stringify(data)}</div>;
      };

      render(<TestComponent />);

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error), 0);

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      // Wait for successful retry
      await waitFor(() => {
        expect(screen.getByText('Data: ["user1","user2"]')).toBeInTheDocument();
      });

      expect(mockQueryFn).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max attempts', async () => {
      const mockQueryFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
      
      const TestComponent = () => {
        const { error, retry, retryCount, canRetry } = useRetryableQuery(mockQueryFn, { 
          maxRetries: 2,
          retryDelay: 10
        });
        
        React.useEffect(() => {
          // Simulate multiple retry attempts
          const attemptRetries = async () => {
            try {
              await retry();
              await retry();
              await retry(); // This should not work
            } catch (e) {
              // Expected to fail
            }
          };
          attemptRetries();
        }, [retry]);

        return (
          <div>
            <div>Error: {error || 'No error'}</div>
            <div>Retry count: {retryCount}</div>
            <div>Can retry: {canRetry.toString()}</div>
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText(/Can retry: false/)).toBeInTheDocument();
      });
    });
  });

  describe('UserManagement Error Integration', () => {
    it('should display error state when user loading fails', async () => {
      // Mock failed database query
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: vi.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Users')).toBeInTheDocument();
        expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
      });
    });

    it('should show retry options when data loading fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: vi.fn().mockRejectedValue(new Error('Network timeout'))
          })
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset & retry/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
      });
    });

    it('should handle user creation errors with retry', async () => {
      // Mock successful initial load
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      // Mock admin service to fail initially then succeed
      const mockAdminService = await import('@/lib/adminService');
      mockAdminService.adminService.createUser = vi.fn()
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValueOnce({
          user: { id: 'new-user', email: 'test@example.com', name: 'Test User', role: 'user' }
        });

      render(<UserManagement />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText('User Management (0)')).toBeInTheDocument();
      });

      // Click new user button
      fireEvent.click(screen.getByRole('button', { name: /new user/i }));

      // Fill in user details
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Test User' } });
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      // Should show retry message
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Retrying...',
            description: expect.stringContaining('Network error occurred')
          })
        );
      });

      // Should eventually succeed
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'User Created',
            description: 'User has been successfully created in the authentication system.'
          })
        );
      });
    });

    it('should handle user deletion errors with retry', async () => {
      const mockUsers = [
        { id: 'user1', name: 'Test User', email: 'test@example.com', role: 'user', created_at: '2023-01-01' }
      ];

      // Mock successful initial load
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        }),
        delete: vi.fn()
          .mockReturnValueOnce({
            eq: vi.fn().mockRejectedValue(new Error('Network timeout'))
          })
          .mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
      });

      render(<UserManagement />);

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButton = screen.getByTitle('Remove user');
      fireEvent.click(deleteButton);

      // Confirm deletion
      fireEvent.click(screen.getByRole('button', { name: /remove/i }));

      // Should show retry message
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Retrying Delete...',
            description: expect.stringContaining('Network error occurred')
          })
        );
      });

      // Should eventually succeed
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'User Removed',
            description: 'User has been removed successfully.'
          })
        );
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from temporary network issues', async () => {
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.reject(new Error('Network connection failed'));
            }
            return Promise.resolve({
              data: [{ id: 'user1', name: 'Test User', email: 'test@example.com', role: 'user' }],
              error: null
            });
          })
        })
      });

      render(<UserManagement />);

      // Should initially show error
      await waitFor(() => {
        expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
      });

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Should recover and show data
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success',
          description: 'User data loaded successfully after retry.'
        })
      );
    });

    it('should handle maximum retry attempts gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockRejectedValue(new Error('Persistent database error'))
        })
      });

      render(<UserManagement />);

      await waitFor(() => {
        expect(screen.getByText('Database Error')).toBeInTheDocument();
      });

      // Try to retry multiple times
      const retryButton = screen.getByRole('button', { name: /try again/i });
      
      // First retry
      fireEvent.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('Retry attempt 1 of 3')).toBeInTheDocument();
      });

      // Second retry
      fireEvent.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('Retry attempt 2 of 3')).toBeInTheDocument();
      });

      // Third retry
      fireEvent.click(retryButton);
      await waitFor(() => {
        expect(screen.getByText('Retry attempt 3 of 3')).toBeInTheDocument();
      });

      // Should now show max retries reached
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /max retries reached/i })).toBeDisabled();
      });
    });
  });
});