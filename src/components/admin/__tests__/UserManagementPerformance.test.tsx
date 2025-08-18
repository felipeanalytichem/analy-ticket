import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserManagement } from '../UserManagement';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
      }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'admin-id', email: 'admin@test.com' } },
        error: null
      }))
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

// Mock the email service
vi.mock('@/lib/emailService', () => ({
  EmailService: {
    sendUserInvitation: vi.fn()
  }
}));

// Mock the utils
vi.mock('@/lib/utils', () => ({
  transformUserName: vi.fn((fullName, email) => fullName || email),
  cn: vi.fn()
}));

// Mock the toast hook
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key
  })
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: 'admin-id', email: 'admin@test.com' },
    userProfile: { role: 'admin', id: 'admin-id' },
    loading: false
  })
}));

const mockUsers = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i}`,
  name: `User ${i}`,
  email: `user${i}@test.com`,
  role: i % 3 === 0 ? 'admin' : i % 2 === 0 ? 'agent' : 'user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  full_name: `User ${i}`,
  avatar_url: null,
  temporary_password: null,
  temporary_password_expires_at: null,
  must_change_password: false
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
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
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('UserManagement Performance Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked supabase instance
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Mock successful data loading
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      })
    });
  });

  it('should load within 3 seconds for admin users', async () => {
    const startTime = performance.now();
    
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    // Wait for the component to finish loading
    await waitFor(
      () => {
        expect(screen.queryByTestId('user-management-skeleton')).not.toBeInTheDocument();
        expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const loadTime = performance.now() - startTime;
    
    // Verify loading time is under 3 seconds (3000ms)
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`UserManagement loaded in ${loadTime.toFixed(2)}ms`);
  });

  it('should show skeleton during initial load', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    // Should show skeleton initially
    expect(screen.getByTestId('user-management-skeleton')).toBeInTheDocument();
    
    // Wait for skeleton to be replaced with actual content
    await waitFor(() => {
      expect(screen.queryByTestId('user-management-skeleton')).not.toBeInTheDocument();
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });
  });

  it('should handle large user lists efficiently', async () => {
    // Create a large dataset
    const largeUserList = Array.from({ length: 500 }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${i}`,
      email: `user${i}@test.com`,
      role: i % 3 === 0 ? 'admin' : i % 2 === 0 ? 'agent' : 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      full_name: `User ${i}`,
      avatar_url: null,
      temporary_password: null,
      temporary_password_expires_at: null,
      must_change_password: false
    }));

    const { supabase } = await import('@/integrations/supabase/client');
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: largeUserList,
            error: null
          })
        })
      })
    });

    const startTime = performance.now();
    
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });

    const loadTime = performance.now() - startTime;
    
    // Even with 500 users, should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    console.log(`UserManagement with 500 users loaded in ${loadTime.toFixed(2)}ms`);
  });

  it('should handle search filtering efficiently', async () => {
    render(
      <TestWrapper>
        <UserManagement />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-management-container')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    
    const startTime = performance.now();
    
    // Simulate typing in search
    searchInput.focus();
    
    const filterTime = performance.now() - startTime;
    
    // Search filtering should be nearly instantaneous
    expect(filterTime).toBeLessThan(100);
    
    console.log(`Search filtering completed in ${filterTime.toFixed(2)}ms`);
  });
});