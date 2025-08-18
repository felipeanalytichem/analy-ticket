import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DiagnosticPanel } from '../DiagnosticPanel';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('@/lib/supabase');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  }
}));

const mockUseAuth = vi.mocked(useAuth);
const mockSupabase = vi.mocked(supabase);

describe('DiagnosticPanel', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  };

  const mockSession = {
    access_token: 'test-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    user: mockUser
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      session: mockSession,
      loading: false,
      isInitialized: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      fixUserEmail: vi.fn(),
      cleanupAuthConflicts: vi.fn(),
      userProfile: null
    });

    // Mock Supabase auth methods
    mockSupabase.auth = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null
      })
    } as any;

    // Mock Supabase from method
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-id' },
            error: null
          })
        })
      })
    });

    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
        jsHeapSizeLimit: 200 * 1024 * 1024 // 200MB
      },
      configurable: true
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true
    });

    // Mock fetch for network connectivity test
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders diagnostic panel with initial state', () => {
    render(<DiagnosticPanel />);
    
    expect(screen.getByText('System Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Comprehensive system health and loading loop detection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run diagnostics/i })).toBeInTheDocument();
  });

  it('displays system overview cards', () => {
    render(<DiagnosticPanel />);
    
    expect(screen.getByText('Auth Status')).toBeInTheDocument();
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('shows authenticated user status', () => {
    render(<DiagnosticPanel />);
    
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
    expect(screen.getByText(`User: ${mockUser.email}`)).toBeInTheDocument();
  });

  it('shows not authenticated when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: false,
      isInitialized: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateProfile: vi.fn(),
      fixUserEmail: vi.fn(),
      cleanupAuthConflicts: vi.fn(),
      userProfile: null
    });

    render(<DiagnosticPanel />);
    
    expect(screen.getByText('Not Authenticated')).toBeInTheDocument();
    expect(screen.getByText('No active session')).toBeInTheDocument();
  });

  it('runs diagnostics when button is clicked', async () => {
    render(<DiagnosticPanel />);
    
    const runButton = screen.getByRole('button', { name: /run diagnostics/i });
    fireEvent.click(runButton);
    
    // Should show running state
    expect(screen.getByText('Running...')).toBeInTheDocument();
    
    // Wait for diagnostics to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run diagnostics/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays diagnostic results in tabs', async () => {
    render(<DiagnosticPanel />);
    
    // Wait for initial diagnostics to run
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    });
    
    expect(screen.getByRole('tab', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    render(<DiagnosticPanel />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /diagnostics/i })).toBeInTheDocument();
    });
    
    // Click diagnostics tab
    fireEvent.click(screen.getByRole('tab', { name: /diagnostics/i }));
    
    // Should show diagnostics content
    await waitFor(() => {
      expect(screen.getByText(/Authentication Status|Session Validity|Database Connection/)).toBeInTheDocument();
    });
  });

  it('handles auto-refresh toggle', () => {
    render(<DiagnosticPanel />);
    
    const autoRefreshButton = screen.getByRole('button', { name: /start auto-refresh/i });
    fireEvent.click(autoRefreshButton);
    
    expect(screen.getByRole('button', { name: /stop auto-refresh/i })).toBeInTheDocument();
  });

  it('displays memory usage information', () => {
    render(<DiagnosticPanel />);
    
    expect(screen.getByText('50MB')).toBeInTheDocument();
    expect(screen.getByText('JavaScript heap usage')).toBeInTheDocument();
  });

  it('handles diagnostic errors gracefully', async () => {
    // Mock a failing auth check
    mockSupabase.auth.getSession = vi.fn().mockRejectedValue(new Error('Auth error'));
    
    render(<DiagnosticPanel />);
    
    const runButton = screen.getByRole('button', { name: /run diagnostics/i });
    fireEvent.click(runButton);
    
    // Should handle error and continue
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run diagnostics/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows connection status correctly', () => {
    render(<DiagnosticPanel />);
    
    // Should show online status
    expect(screen.getByText(/\d+ms/)).toBeInTheDocument(); // Connection latency
    expect(screen.getByText('Database latency')).toBeInTheDocument();
  });

  it('displays diagnostic logs', async () => {
    render(<DiagnosticPanel />);
    
    // Wait for initial diagnostics
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /logs/i })).toBeInTheDocument();
    });
    
    // Click logs tab
    fireEvent.click(screen.getByRole('tab', { name: /logs/i }));
    
    expect(screen.getByText('Diagnostic Logs')).toBeInTheDocument();
    expect(screen.getByText('Real-time diagnostic activity log')).toBeInTheDocument();
  });

  it('shows metrics when available', async () => {
    render(<DiagnosticPanel />);
    
    // Wait for initial diagnostics
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /metrics/i })).toBeInTheDocument();
    });
    
    // Click metrics tab
    fireEvent.click(screen.getByRole('tab', { name: /metrics/i }));
    
    expect(screen.getByText('System Metrics')).toBeInTheDocument();
    expect(screen.getByText('Real-time system performance data')).toBeInTheDocument();
  });
});