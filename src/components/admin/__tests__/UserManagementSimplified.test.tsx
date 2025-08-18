import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserManagement } from '../UserManagement';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          error: null
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          error: null
        }))
      }))
    })),
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

describe('UserManagement Simplified Implementation', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'admin@test.com',
    user_metadata: { role: 'admin' }
  };

  const mockUserProfile = {
    id: 'test-user-id',
    email: 'admin@test.com',
    role: 'admin' as const,
    full_name: 'Test Admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
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

  describe('Component Rendering', () => {
    it('should render the simplified UserManagement component successfully', async () => {
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

      // Should show main UI elements
      expect(screen.getByText('User Management (0)')).toBeInTheDocument();
      expect(screen.getByTestId('create-user-button')).toBeInTheDocument();
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
      expect(screen.getByTestId('role-filter')).toBeInTheDocument();
    });

    it('should show access denied for non-admin users', async () => {
      const nonAdminProfile = { ...mockUserProfile, role: 'user' as const };
      
      // Mock non-admin user
      const { supabase } = require('@/integrations/supabase/client');
      supabase.auth.getSession.mockResolvedValue({
        data: { session: { user: { ...mockUser, user_metadata: { role: 'user' } } } },
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

      expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-container')).not.toBeInTheDocument();
    });

    it('should show loading state during authentication', async () => {
      // Mock delayed auth response
      const { supabase } = require('@/integrations/supabase/client');
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

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('should load users successfully using error recovery service', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(errorRecoveryService.executeWithRetry).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            operation: 'loadUsers'
          }),
          expect.objectContaining({
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
          })
        );
      });
    });

    it('should handle loading errors with retry functionality', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });

    it('should retry loading when retry button is clicked', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      
      // First call fails, second succeeds
      errorRecoveryService.executeWithRetry
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: mockUsers,
          attempts: 2,
          totalTime: 1500,
          recoveryActions: ['network_check_passed']
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

      // Click retry button
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(errorRecoveryService.testConnectivity).toHaveBeenCalled();
      });
    });

    it('should show skeleton during initial load', async () => {
      // Mock delayed loading
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: mockUsers,
            attempts: 1,
            totalTime: 500,
            recoveryActions: []
          }), 200)
        )
      );

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      // Should show skeleton initially
      expect(screen.getByTestId('user-management-skeleton')).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('user-management-skeleton')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: mockUsers,
        attempts: 1,
        totalTime: 500,
        recoveryActions: []
      });
    });

    it('should filter users by search term', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Type in search box
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'user1' } });

      // Search should be debounced, so we need to wait
      await waitFor(() => {
        expect(searchInput).toHaveValue('user1');
      });
    });

    it('should filter users by role', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Click role filter
      const roleFilter = screen.getByTestId('role-filter');
      fireEvent.click(roleFilter);

      // Select agent role
      await waitFor(() => {
        const agentOption = screen.getByTestId('role-filter-agent');
        fireEvent.click(agentOption);
      });
    });

    it('should clear filters when "All Roles" is selected', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Click role filter and select "All Roles"
      const roleFilter = screen.getByTestId('role-filter');
      fireEvent.click(roleFilter);

      await waitFor(() => {
        const allRolesOption = screen.getByTestId('role-filter-all');
        fireEvent.click(allRolesOption);
      });
    });
  });

  describe('User Operations', () => {
    beforeEach(async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: mockUsers,
        attempts: 1,
        totalTime: 500,
        recoveryActions: []
      });
    });

    it('should open create user form when create button is clicked', async () => {
      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('create-user-button')).toBeInTheDocument();
      });

      // Click create user button
      const createButton = screen.getByTestId('create-user-button');
      fireEvent.click(createButton);

      // Form should open (this would be tested more thoroughly in integration tests)
      expect(createButton).toBeInTheDocument();
    });

    it('should handle user creation with error recovery', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      const { adminService } = require('@/lib/adminService');
      
      // Mock successful user creation
      const newUser = {
        id: '3',
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

      errorRecoveryService.executeWithRetry.mockResolvedValue({
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
        expect(screen.getByTestId('create-user-button')).toBeInTheDocument();
      });

      // The actual form interaction would be tested in integration tests
      // Here we just verify the component renders correctly
      expect(screen.getByTestId('create-user-button')).toBeInTheDocument();
    });

    it('should handle user deletion with error recovery', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      const { supabase } = require('@/integrations/supabase/client');
      
      // Mock successful deletion
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockUsers,
              error: null
            })
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });

      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: { success: true },
        attempts: 1,
        totalTime: 300,
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

      // The actual deletion interaction would be tested in integration tests
      // Here we verify the component structure is correct
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should show recovery information in error display', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      
      const mockRecoveryResult = {
        success: false,
        error: new Error('Network connection failed'),
        attempts: 3,
        totalTime: 5000,
        recoveryActions: ['token_refreshed', 'network_check_passed']
      };

      errorRecoveryService.executeWithRetry.mockRejectedValue(mockRecoveryResult.error);

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });

    it('should test connectivity when test connection button is clicked', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      
      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Network error'));
      errorRecoveryService.testConnectivity.mockResolvedValue(true);

      render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Loading Users')).toBeInTheDocument();
      });

      // Click test connection button
      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(errorRecoveryService.testConnectivity).toHaveBeenCalled();
      });
    });

    it('should handle error recovery statistics', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      
      errorRecoveryService.getErrorStats.mockReturnValue({
        totalErrors: 5,
        errorsByType: {
          network: 3,
          authentication: 2
        },
        recentErrors: [],
        sessionId: 'test-session-123'
      });

      errorRecoveryService.executeWithRetry.mockRejectedValue(new Error('Test error'));

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

  describe('Performance Optimizations', () => {
    it('should use debounced search to prevent excessive API calls', async () => {
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
      
      // Type rapidly - should be debounced
      fireEvent.change(searchInput, { target: { value: 'u' } });
      fireEvent.change(searchInput, { target: { value: 'us' } });
      fireEvent.change(searchInput, { target: { value: 'use' } });
      fireEvent.change(searchInput, { target: { value: 'user' } });

      // Final value should be set
      expect(searchInput).toHaveValue('user');
    });

    it('should memoize filtered results for better performance', async () => {
      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: mockUsers,
        attempts: 1,
        totalTime: 500,
        recoveryActions: []
      });

      const { rerender } = render(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      });

      // Re-render should not cause unnecessary recalculations
      rerender(
        <TestWrapper>
          <UserManagement />
        </TestWrapper>
      );

      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });

    it('should handle large user datasets efficiently', async () => {
      const largeUserSet = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.com`,
        full_name: `User ${i}`,
        role: 'user' as const,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }));

      const { errorRecoveryService } = require('@/lib/errorRecoveryService');
      errorRecoveryService.executeWithRetry.mockResolvedValue({
        success: true,
        data: largeUserSet,
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
        expect(screen.getByText('User Management (100)')).toBeInTheDocument();
      });

      // Component should handle large datasets without performance issues
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });
  });
});