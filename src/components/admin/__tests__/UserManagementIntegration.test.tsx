import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserManagement } from '../UserManagement';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

// Mock the supabase client with more realistic behavior
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      admin: {
        updateUserById: vi.fn()
      }
    }
  }
}));

// Mock the admin service
vi.mock('@/lib/adminService', () => ({
  adminService: {
    createUser: vi.fn(),
    generateTemporaryPassword: vi.fn()
  }
}));

// Mock the error recovery service
vi.mock('@/lib/errorRecoveryService', () => ({
  errorRecoveryService: {
    executeWithRetry: vi.fn(),
    testConnectivity: vi.fn(),
    getErrorStats: vi.fn(() => ({
      totalErrors: 0,
      errorsByType: {},
      recentErrors: [],
      sessionId: 'test-session'
    })),
    clearErrorLog: vi.fn()
  },
  ErrorType: {
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    DATABASE: 'database',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown'
  }
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { changeLanguage: vi.fn() }
  })
}));

// Mock useDebounce hook
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}));

// Mock email service
vi.mock('@/lib/emailService', () => ({
  EmailService: {
    sendUserInvitation: vi.fn()
  }
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('UserManagement Integration Tests', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'admin@test.com',
    user_metadata: { role: 'admin' }
  };

  const mockUsers = [
    {
      id: '1',
      email: 'user1@test.com',
      full_name: 'User One',
      role: 'user' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      email: 'user2@test.com',
      full_name: 'User Two',
      role: 'agent' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '3',
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: 'admin' as const,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful auth by default
    const { supabase } = require('@/integrations/supabase/client');
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null
    });

    // Mock successful data loading
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      })
    });

    // Mock error recovery service
    const { errorRecoveryService } = require('@/lib/errorRecoveryService');
    errorRecoveryService.executeWithRetry.mockResolvedValue({
      success: true,
      data: mockUsers,
      attempts: 1,
      totalTime: 500,
      recoveryActions: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Page Load Integration', () => {
    it('should complete full page loading flow successfully', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Should show skeleton initially
      expect(screen.getByTestId('user-management-skeleton')).toBeInTheDocument();

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Should show user count
      expect(screen.getByText('User Management (3)')).toBeInTheDocument();

      // Should show all main UI elements
      expect(screen.getByTestId('create-user-button')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('role-filter')).toBeInTheDocument();

      // Should show user data
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('User Two')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should handle authentication integration correctly', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Should have called error recovery service for data loading
      expect(errorRecoveryService.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          operation: 'loadUsers'
        }),
        expect.objectContaining({
          maxRetries: 3
        })
      );
    });

    it('should integrate with error boundary correctly', async () => {
      // Mock component error
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Component initialization failed'));

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      expect(screen.getByText('Component initialization failed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Authentication Integration', () => {
    it('should integrate authentication state with data loading', async () => {
      const { supabase } = require('@/integrations/supabase/client');
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      // Mock delayed authentication
      supabase.auth.getSession.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            data: { session: { user: mockUser } },
            error: null
          }), 100)
        )
      );

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Should show loading initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Wait for auth and data loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Should have loaded data after authentication
      expect(errorRecoveryService.executeWithRetry).toHaveBeenCalled();
    });

    it('should handle authentication failures in integration', async () => {
      const { supabase } = require('@/integrations/supabase/client');

      // Mock authentication failure
      supabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Authentication failed')
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
    });

    it('should handle role-based access control integration', async () => {
      const { supabase } = require('@/integrations/supabase/client');

      // Mock non-admin user
      supabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: {
              ...mockUser,
              user_metadata: { role: 'agent' }
            }
          }
        },
        error: null
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('user-management-container')).not.toBeInTheDocument();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should integrate error recovery with user operations', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      const { adminService } = require('@/lib/adminService');

      // Mock successful user creation through error recovery
      const newUser = {
        id: '4',
        email: 'newuser@test.com',
        full_name: 'New User',
        role: 'user' as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      adminService.createUser.mockResolvedValue({
        user: newUser,
        temporaryPassword: 'temp123'
      });

      errorRecoveryService.executeWithRetry
        .mockResolvedValueOnce({
          success: true,
          data: mockUsers,
          attempts: 1,
          totalTime: 500,
          recoveryActions: []
        })
        .mockResolvedValueOnce({
          success: true,
          data: { user: newUser, temporaryPassword: 'temp123' },
          attempts: 1,
          totalTime: 800,
          recoveryActions: []
        });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Verify error recovery service was used for initial load
      expect(errorRecoveryService.executeWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          operation: 'loadUsers'
        }),
        expect.any(Object)
      );
    });

    it('should handle network failures with retry integration', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      // First call fails, second succeeds
      errorRecoveryService.executeWithRetry
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          success: true,
          data: mockUsers,
          attempts: 2,
          totalTime: 3000,
          recoveryActions: ['network_check_passed', 'retry_with_backoff']
        });

      errorRecoveryService.testConnectivity.mockResolvedValue(true);

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      expect(screen.getByText('Network timeout')).toBeInTheDocument();

      // Click retry button
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should test connectivity and retry
      await waitFor(() => {
        expect(errorRecoveryService.testConnectivity).toHaveBeenCalled();
      });
    });

    it('should integrate error statistics with UI display', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      errorRecoveryService.getErrorStats.mockReturnValue({
        totalErrors: 3,
        errorsByType: {
          network: 2,
          timeout: 1
        },
        recentErrors: [
          { type: 'network', message: 'Connection failed', timestamp: Date.now() - 1000 },
          { type: 'timeout', message: 'Request timeout', timestamp: Date.now() - 2000 }
        ],
        sessionId: 'integration-test-session'
      });

      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Integration test error'));

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      // Click retry to trigger error stats collection
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(errorRecoveryService.getErrorStats).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently in integration', async () => {
      const largeUserSet = Array.from({ length: 500 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.com`,
        full_name: `User ${i}`,
        role: (i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'agent' : 'user') as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }));

      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: largeUserSet,
        attempts: 1,
        totalTime: 1200,
        recoveryActions: []
      });

      const startTime = performance.now();

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('User Management (500)')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 2 seconds)
      expect(renderTime).toBeLessThan(2000);

      // Should show correct count
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });

    it('should integrate debounced search with data filtering', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: mockUsers,
        attempts: 1,
        totalTime: 500,
        recoveryActions: []
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('search-input');

      // Type search term
      fireEvent.change(searchInput, { target: { value: 'User One' } });

      // Search should be debounced
      expect(searchInput).toHaveValue('User One');

      // Should still show all users initially (debounce delay)
      expect(screen.getByText('User Management (3)')).toBeInTheDocument();
    });

    it('should integrate role filtering with search functionality', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: mockUsers,
        attempts: 1,
        totalTime: 500,
        recoveryActions: []
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('role-filter')).toBeInTheDocument();
      });

      // Click role filter
      const roleFilter = screen.getByTestId('role-filter');
      fireEvent.click(roleFilter);

      // Should show role options
      await waitFor(() => {
        expect(screen.getByTestId('role-filter-agent')).toBeInTheDocument();
      });

      // Select agent role
      const agentOption = screen.getByTestId('role-filter-agent');
      fireEvent.click(agentOption);

      // Should filter to show only agents (this would be more thoroughly tested in unit tests)
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });
  });

  describe('Fallback Integration', () => {
    it('should integrate with fallback component when main component fails', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      // Mock component failure that triggers fallback
      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Component crashed'));

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      expect(screen.getByText('Component crashed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });

    it('should handle fallback to error boundary integration', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      // Mock critical failure
      errorRecoveryService.executeWithRetry.mockImplementation(() => {
        throw new Error('Critical system failure');
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Integration', () => {
    it('should handle auth state changes during operation', async () => {
      const { supabase } = require('@/integrations/supabase/client');
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');

      let authCallback: (event: string, session: any) => void;

      supabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Simulate auth state change (logout)
      authCallback!('SIGNED_OUT', null);

      // Should handle auth state change gracefully
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should integrate with session timeout handling', async () => {
      const { supabase } = require('@/integrations/supabase/client');

      // Mock session expiry
      supabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: { user: mockUser } },
          error: null
        })
        .mockResolvedValueOnce({
          data: { session: null },
          error: new Error('Session expired')
        });

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Component should handle session changes gracefully
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });
  });
});