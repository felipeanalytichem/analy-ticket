import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgents, useAllActiveAgents } from '../useAgents';
import React from 'react';

// Mock the agent service
vi.mock('@/services/agentService', () => ({
  agentService: {
    getAllActiveAgents: vi.fn(() => Promise.resolve([
      {
        id: '1',
        email: 'agent1@test.com',
        full_name: 'Agent One',
        role: 'agent',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        email: 'admin@test.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ])),
    getAgentsByRole: vi.fn(() => Promise.resolve([
      {
        id: '1',
        email: 'agent1@test.com',
        full_name: 'Agent One',
        role: 'agent',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ])),
    subscribeToAgentUpdates: vi.fn(() => () => {}),
    refreshAgentCache: vi.fn(() => Promise.resolve())
  }
}));

describe('useAgents', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should fetch all active agents', async () => {
    const { result } = renderHook(() => useAllActiveAgents(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.agents).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.agents.length).toBeGreaterThan(0);
    expect(result.current.agents[0].full_name).toBe('Agent One');
    expect(result.current.isError).toBe(false);
  });

  it('should fetch agents by specific roles', async () => {
    const { result } = renderHook(() => useAgents({ roles: ['agent'] }), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].role).toBe('agent');
    expect(result.current.isError).toBe(false);
  });

  it('should handle disabled state', () => {
    const { result } = renderHook(() => useAgents({ enabled: false }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.agents).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  it('should provide refetch functionality', async () => {
    const { result } = renderHook(() => useAllActiveAgents(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
    
    // Test that refetch is callable
    const refetchPromise = result.current.refetch();
    expect(refetchPromise).toBeInstanceOf(Promise);
  });
});