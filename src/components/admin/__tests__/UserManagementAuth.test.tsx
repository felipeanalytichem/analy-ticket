import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import UserManagementPage from '@/pages/UserManagementPage';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn()
        }))
      }))
    }))
  }
}));

// Mock the UserManagement component to avoid complex dependencies
vi.mock('@/components/admin/UserManagement', () => ({
  UserManagement: () => <div data-testid="user-management-component">User Management Content</div>
}));

// Mock the UserManagementErrorBoundary
vi.mock('@/components/admin/UserManagementErrorBoundary', () => ({
  UserManagementErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  )
}));

// Mock the category initializer hook
vi.mock('@/hooks/useCategoryInitializer', () => ({
  useCategoryInitializer: () => ({
    isInitializing: false,
    error: null
  })
}));

// Mock the TicketCountProvider
vi.mock('@/contexts/TicketCountContext', () => ({
  TicketCountProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock the AppLayout
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  )
}));

const { supabase } = await import('@/integrations/supabase/client');

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
);

// Protected User Management Route component for testing
const ProtectedUserManagementRoute = () => (
  <ProtectedRoute requiredRole="admin">
    <div data-testid="app-layout">
      <UserManagementPage />
    </div>
  </ProtectedRoute>
);

describe('User Management Authentication and Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin User Access', () => {
    it('should allow admin users to access the user management page', async () => {
      // Mock successful session with admin user
      const mockAdminSession = {
        user: {
          id: 'admin-user-id',
          email: 'admin@test.com'
        }
      };

      const mockAdminProfile = {
        id: 'admin-user-id',
        email: 'admin@test.com',
        full_name: 'Admin User',
        role: 'admin'
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockAdminSession },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockAdminProfile,
              error: null
            })
          })
        })
      } as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Wait for authentication to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show the user management page
      await waitFor(() => {
        expect(screen.getByTestId('user-management-component')).toBeInTheDocument();
      });

      expect(screen.getByText('User Management Content')).toBeInTheDocument();
    });

    it('should show loading state during authentication check for admin users', async () => {
      // Mock delayed session response
      vi.mocked(supabase.auth.getSession).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { 
              session: {
                user: { id: 'admin-id', email: 'admin@test.com' }
              }
            },
            error: null
          }), 100)
        )
      );

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    });
  });

  describe('Non-Admin User Blocking', () => {
    it('should block agent users from accessing the user management page', async () => {
      const mockAgentSession = {
        user: {
          id: 'agent-user-id',
          email: 'agent@test.com'
        }
      };

      const mockAgentProfile = {
        id: 'agent-user-id',
        email: 'agent@test.com',
        full_name: 'Agent User',
        role: 'agent'
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockAgentSession },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockAgentProfile,
              error: null
            })
          })
        })
      } as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Wait for authentication to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show access denied message
      await waitFor(() => {
        expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
      });

      expect(screen.getByText('Você não tem permissão para acessar esta página.')).toBeInTheDocument();
      expect(screen.getByText('Voltar')).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
    });

    it('should block regular users from accessing the user management page', async () => {
      const mockUserSession = {
        user: {
          id: 'regular-user-id',
          email: 'user@test.com'
        }
      };

      const mockUserProfile = {
        id: 'regular-user-id',
        email: 'user@test.com',
        full_name: 'Regular User',
        role: 'user'
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockUserSession },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockUserProfile,
              error: null
            })
          })
        })
      } as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Wait for authentication to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show access denied message
      await waitFor(() => {
        expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
      });

      expect(screen.getByText('Você não tem permissão para acessar esta página.')).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated User Redirection', () => {
    it('should redirect unauthenticated users to login page', async () => {
      // Mock no session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const mockNavigate = vi.fn();
      
      // Mock useNavigate hook
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          Navigate: ({ to }: { to: string }) => <div data-testid="navigate-to">{to}</div>
        };
      });

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Wait for authentication check to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByTestId('navigate-to')).toHaveTextContent('/login');
      });

      expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
    });

    it('should show loading state while checking authentication for unauthenticated users', async () => {
      // Mock delayed no session response
      vi.mocked(supabase.auth.getSession).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { session: null },
            error: null
          }), 100)
        )
      );

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    });
  });

  describe('Loading States During Authentication Checks', () => {
    it('should show proper loading indicator while authentication is being verified', async () => {
      // Mock delayed session response
      let resolveSession: (value: any) => void;
      const sessionPromise = new Promise(resolve => {
        resolveSession = resolve;
      });

      vi.mocked(supabase.auth.getSession).mockReturnValue(sessionPromise as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByText('Loading profile...')).toBeInTheDocument();

      // Resolve the session
      resolveSession!({
        data: { 
          session: {
            user: { id: 'admin-id', email: 'admin@test.com' }
          }
        },
        error: null
      });

      // Mock profile loading
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'admin-id',
                email: 'admin@test.com',
                role: 'admin'
              },
              error: null
            })
          })
        })
      } as any);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should show profile loading state when user exists but profile is loading', async () => {
      const mockSession = {
        user: {
          id: 'admin-user-id',
          email: 'admin@test.com'
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Mock delayed profile loading with a longer delay
      let resolveProfile: (value: any) => void;
      const profilePromise = new Promise(resolve => {
        resolveProfile = resolve;
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockReturnValue(profilePromise)
          })
        })
      } as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should show profile loading state
      await waitFor(() => {
        expect(screen.getByText('Loading profile...')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Resolve profile loading
      resolveProfile!({
        data: {
          id: 'admin-user-id',
          email: 'admin@test.com',
          role: 'admin'
        },
        error: null
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      // Mock session error
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: new Error('Authentication failed')
      });

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should still redirect to login even with auth error
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });

    it('should handle profile loading errors for authenticated users', async () => {
      const mockSession = {
        user: {
          id: 'admin-user-id',
          email: 'admin@test.com'
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Mock profile loading error
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Profile loading failed')
            })
          })
        })
      } as any);

      render(
        <TestWrapper>
          <ProtectedUserManagementRoute />
        </TestWrapper>
      );

      // Should show profile loading state and handle error
      await waitFor(() => {
        expect(screen.getByText('Carregando perfil...')).toBeInTheDocument();
      });
    });
  });
});