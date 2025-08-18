import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { agentService, type Agent } from '@/services/agentService';

export interface UseAgentsOptions {
  roles?: ('agent' | 'admin')[];
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export interface UseAgentsResult {
  agents: Agent[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
  isRefetching: boolean;
  isFetching: boolean;
}

/**
 * Custom hook for fetching and managing agent data
 * Implements requirements 3.1, 3.3, and 3.6 from the system stability spec
 */
export function useAgents(options: UseAgentsOptions = {}): UseAgentsResult {
  const {
    roles,
    enabled = true,
    refetchOnWindowFocus = false,
    refetchOnReconnect = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
  } = options;

  const queryClient = useQueryClient();

  // Create query key based on roles filter
  const queryKey = roles 
    ? ['agents', 'by-role', roles.sort().join(',')]
    : ['agents', 'all-active'];

  // Query function that uses the appropriate AgentService method
  const queryFn = useCallback(async (): Promise<Agent[]> => {
    try {
      if (roles && roles.length > 0) {
        return await agentService.getAgentsByRole(roles);
      } else {
        return await agentService.getAllActiveAgents();
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw error;
    }
  }, [roles]);

  // React Query configuration with retry logic and error handling
  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    gcTime: cacheTime, // Updated from cacheTime to gcTime for React Query v5
    refetchOnWindowFocus,
    refetchOnReconnect,
    retry: (failureCount, error) => {
      // Retry up to 3 times with exponential backoff
      if (failureCount >= 3) {
        return false;
      }
      
      // Don't retry on authentication errors
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      
      return true;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s
      return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
    },
    meta: {
      errorMessage: 'Failed to load agents'
    }
  });

  // Set up real-time subscription for agent updates
  useEffect(() => {
    if (!enabled) return;

    const cacheKey = roles 
      ? `agents_by_role_${roles.sort().join('_')}`
      : 'all_active_agents';

    const unsubscribe = agentService.subscribeToAgentUpdates(
      (updatedAgents: Agent[]) => {
        // Update React Query cache with fresh data
        queryClient.setQueryData(queryKey, updatedAgents);
      },
      cacheKey
    );

    return unsubscribe;
  }, [enabled, roles, queryKey, queryClient]);

  // Manual refresh function that clears cache and refetches
  const refreshAgents = useCallback(async () => {
    try {
      // Clear the agent service cache
      await agentService.refreshAgentCache();
      
      // Invalidate and refetch the query
      await queryClient.invalidateQueries({ queryKey });
      
      return query.refetch();
    } catch (error) {
      console.error('Error refreshing agents:', error);
      throw error;
    }
  }, [queryClient, queryKey, query]);

  return {
    agents: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: refreshAgents,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
  };
}

/**
 * Hook specifically for getting all active agents (both agents and admins)
 */
export function useAllActiveAgents(options: Omit<UseAgentsOptions, 'roles'> = {}): UseAgentsResult {
  return useAgents({ ...options, roles: ['agent', 'admin'] });
}

/**
 * Hook specifically for getting only agents (excluding admins)
 */
export function useAgentsOnly(options: Omit<UseAgentsOptions, 'roles'> = {}): UseAgentsResult {
  return useAgents({ ...options, roles: ['agent'] });
}

/**
 * Hook specifically for getting only admins
 */
export function useAdminsOnly(options: Omit<UseAgentsOptions, 'roles'> = {}): UseAgentsResult {
  return useAgents({ ...options, roles: ['admin'] });
}

/**
 * Hook for getting a specific agent by ID
 */
export function useAgent(agentId: string | undefined, options: Omit<UseAgentsOptions, 'roles'> = {}) {
  const {
    enabled = true,
    refetchOnWindowFocus = false,
    refetchOnReconnect = true,
    staleTime = 5 * 60 * 1000,
    cacheTime = 10 * 60 * 1000,
  } = options;

  const queryKey = ['agents', 'by-id', agentId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<Agent | null> => {
      if (!agentId) {
        return null;
      }
      return await agentService.getAgentById(agentId);
    },
    enabled: enabled && !!agentId,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    refetchOnReconnect,
    retry: (failureCount, error) => {
      if (failureCount >= 3) {
        return false;
      }
      
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      
      return true;
    },
    retryDelay: (attemptIndex) => {
      return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
    },
    meta: {
      errorMessage: 'Failed to load agent'
    }
  });

  return {
    agent: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
  };
}

/**
 * Utility hook for managing agent cache
 */
export function useAgentCache() {
  const queryClient = useQueryClient();

  const refreshCache = useCallback(async () => {
    await agentService.refreshAgentCache();
    await queryClient.invalidateQueries({ queryKey: ['agents'] });
  }, [queryClient]);

  const clearCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['agents'] });
  }, [queryClient]);

  const getCacheStats = useCallback(() => {
    return agentService.getCacheStats();
  }, []);

  return {
    refreshCache,
    clearCache,
    getCacheStats,
  };
}