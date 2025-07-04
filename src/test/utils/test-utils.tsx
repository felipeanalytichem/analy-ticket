import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { vi } from 'vitest';

// Create a fresh QueryClient for each test
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
      staleTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
  logger: {
    log: console.log,
    warn: console.warn,
    error: () => {},
  },
});

interface RenderOptions {
  route?: string;
  initialAuth?: {
    user: any;
    session: any;
    profile?: any;
  };
  queryClient?: QueryClient;
}

// Default mock user data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Default mock session data
export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_at: Date.now() + 3600000,
};

// Default mock profile data
export const mockProfile = {
  id: mockUser.id,
  email: mockUser.email,
  full_name: 'Test User',
  role: 'user',
  created_at: mockUser.created_at,
  updated_at: mockUser.updated_at,
};

function render(
  ui: React.ReactElement,
  {
    route = '/',
    initialAuth = null,
    queryClient = createTestQueryClient(),
  }: RenderOptions = {}
) {
  window.history.pushState({}, 'Test page', route);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );

  return {
    ...rtlRender(ui, { wrapper: Wrapper }),
    queryClient,
  };
}

// Enhanced Supabase mock with better type support and default implementations
export const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    refreshSession: vi.fn().mockResolvedValue({
      data: { session: mockSession },
      error: null,
    }),
  },
  from: vi.fn((table: string) => ({
    select: vi.fn().mockImplementation(function(this: any, query?: string) {
      // Store the query for later chaining
      this._query = query;
      return this;
    }),
    insert: vi.fn().mockImplementation(function(this: any, data: any) {
      // Store the data for later chaining
      this._data = data;
      return this;
    }),
    update: vi.fn().mockImplementation(function(this: any, data: any) {
      // Store the data for later chaining
      this._data = data;
      return this;
    }),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(function(this: any) {
      // Return mock data based on the table
      switch (table) {
        case 'users':
          return Promise.resolve({ data: mockProfile, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    }),
    maybeSingle: vi.fn().mockImplementation(function(this: any) {
      // Return mock data based on the table
      switch (table) {
        case 'users':
          return Promise.resolve({ data: mockProfile, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    }),
    throwOnError: vi.fn().mockImplementation(function(this: any) {
      return this;
    }),
  })),
};

// Helper to reset all mocks between tests
export const resetMocks = () => {
  Object.values(mockSupabase.auth).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
  mockSupabase.from.mockClear();
};

// Helper to simulate auth state
export const simulateAuthState = (authenticated: boolean = true) => {
  if (authenticated) {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    mockSupabase.from('users').select().maybeSingle.mockResolvedValue({ data: mockProfile, error: null });
  } else {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSupabase.from('users').select().maybeSingle.mockResolvedValue({ data: null, error: null });
  }
};

export * from '@testing-library/react';
export { render }; 