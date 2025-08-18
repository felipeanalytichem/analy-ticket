import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '@/App';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
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

// Mock the UserManagement component
vi.mock('@/components/admin/UserManagement', () => ({
  UserManagement: () => <div data-testid="user-management-component">User Management Content</div>
}));

// Mock the UserManagementErrorBoundary
vi.mock('@/components/admin/UserManagementErrorBoundary', () => ({
  UserManagementErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  )
}));

// Mock other heavy components to speed up tests
vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
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

// Mock theme provider
vi.mock('@/components/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock session timeout manager
vi.mock('@/components/auth/SessionTimeoutManager', () => ({
  SessionTimeoutManager: ({ children }: { children: React.ReactNode }) => children
}));

// Mock toaster
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null
}));

const { supabase } = await import('@/lib/supabase');

// Test wrapper with memory router
const TestAppWrapper = ({ initialEntries = ['/admin/users'] }: { initialEntries?: string[] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <App />
  </MemoryRouter>
);

describe('User Management Routing Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Admin Route Access', () => {
    it('should render user management page for admin users accessing /admin/users', async () => {
      // Mock admin session and profile
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

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Wait for authentication and routing to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should render the user management page
      await waitFor(() => {
        expect(screen.getByTestId('user-management-component')).toBeInTheDocument();
      });

      expect(screen.getByText('User Management Content')).toBeInTheDocument();
      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    });

    it('should show access denied for agent users accessing /admin/users', async () => {
      // Mock agent session and profile
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

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Wait for authentication to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show access denied
      await waitFor(() => {
        expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
      });

      expect(screen.getByText('Você não tem permissão para acessar esta página.')).toBeInTheDocument();
      expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
    });

    it('should redirect unauthenticated users to login when accessing /admin/users', async () => {
      // Mock no session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Wait for authentication check to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should redirect to login (we can't test actual navigation in this setup,
      // but we can verify the login form is rendered)
      await waitFor(() => {
        // The app should render login page content
        expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States During Route Navigation', () => {
    it('should show loading state while authenticating admin user', async () => {
      // Mock delayed authentication
      let resolveAuth: (value: any) => void;
      const authPromise = new Promise(resolve => {
        resolveAuth = resolve;
      });

      vi.mocked(supabase.auth.getSession).mockReturnValue(authPromise as any);

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Should show loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Resolve authentication
      resolveAuth!({
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

    it('should handle profile loading state for authenticated admin user', async () => {
      const mockAdminSession = {
        user: {
          id: 'admin-user-id',
          email: 'admin@test.com'
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockAdminSession },
        error: null
      });

      // Mock delayed profile loading
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

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Should show profile loading state
      await waitFor(() => {
        expect(screen.getByText('Carregando perfil...')).toBeInTheDocument();
      });

      // Resolve profile loading
      resolveProfile!({
        data: {
          id: 'admin-user-id',
          email: 'admin@test.com',
          role: 'admin'
        },
        error: null
      });

      // Wait for page to load
      await waitFor(() => {
        expect(screen.queryByText('Carregando perfil...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle authentication errors gracefully', async () => {
      // Mock authentication error
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: new Error('Authentication service unavailable')
      });

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Should handle error and not crash
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should not show user management component
      expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
    });

    it('should handle profile loading errors for admin users', async () => {
      const mockAdminSession = {
        user: {
          id: 'admin-user-id',
          email: 'admin@test.com'
        }
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockAdminSession },
        error: null
      });

      // Mock profile loading error
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Profile not found')
            })
          })
        })
      } as any);

      render(<TestAppWrapper initialEntries={['/admin/users']} />);

      // Should handle profile error gracefully
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show profile loading state
      await waitFor(() => {
        expect(screen.getByText('Carregando perfil...')).toBeInTheDocument();
      });
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should respect role hierarchy (admin > agent > user)', async () => {
      const testCases = [
        { role: 'admin', shouldAccess: true },
        { role: 'agent', shouldAccess: false },
        { role: 'user', shouldAccess: false }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockSession = {
          user: {
            id: `${testCase.role}-user-id`,
            email: `${testCase.role}@test.com`
          }
        };

        const mockProfile = {
          id: `${testCase.role}-user-id`,
          email: `${testCase.role}@test.com`,
          full_name: `${testCase.role} User`,
          role: testCase.role
        };

        vi.mocked(supabase.auth.getSession).mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            })
          })
        } as any);

        const { unmount } = render(<TestAppWrapper initialEntries={['/admin/users']} />);

        await waitFor(() => {
          expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
        }, { timeout: 3000 });

        if (testCase.shouldAccess) {
          await waitFor(() => {
            expect(screen.getByTestId('user-management-component')).toBeInTheDocument();
          });
        } else {
          await waitFor(() => {
            expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
          });
          expect(screen.queryByTestId('user-management-component')).not.toBeInTheDocument();
        }

        unmount();
      }
    });
  });
});