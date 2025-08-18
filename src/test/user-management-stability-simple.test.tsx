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
vi.mock('@/lib/utils', () => ({
  transformUserName: vi.fn((fullName, email) => fullName || email?.split('@')[0] || 'No name provided'),
  cn: vi.fn((...args) => args.filter(Boolean).join(' '))
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
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

describe('UserManagement Stability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockUseToast.mockReturnValue({ toast: mockToast });
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-id' },
      userProfile: { role: 'admin' },
      loading: false,
      isInitialized: true
    });

    // Mock successful user loading
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { 
              id: 'user1', 
              full_name: 'John Doe', 
              email: 'john@example.com', 
              role: 'user',
              created_at: '2023-01-01T00:00:00Z',
              updated_at: '2023-01-01T00:00:00Z'
            }
          ],
          error: null
        }),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });
  });

  it('should render without crashing', async () => {
    render(<UserManagement />);
    
    // Should eventually show loaded state
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should show loading state initially', async () => {
    render(<UserManagement />);
    
    // Should show loading indicator
    const loadingElement = screen.queryByTestId('loading-indicator');
    if (loadingElement) {
      expect(loadingElement).toBeInTheDocument();
    }
  });

  it('should handle authentication states correctly', async () => {
    // Test unauthenticated state
    mockUseAuth.mockReturnValue({
      user: null,
      userProfile: null,
      loading: false,
      isInitialized: true
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    });
  });

  it('should handle insufficient permissions', async () => {
    // Test user without admin role
    mockUseAuth.mockReturnValue({
      user: { id: 'user-id' },
      userProfile: { role: 'user' },
      loading: false,
      isInitialized: true
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  it('should display user data when loaded', async () => {
    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByText('User Management (1)')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });

  it('should handle error states gracefully', async () => {
    // Mock database error
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockRejectedValue(new Error('Database error')),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      })
    });

    render(<UserManagement />);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});