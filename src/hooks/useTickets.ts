import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { DatabaseService } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationDebug } from './useNavigationDebug';

interface UseTicketsOptions {
  statusFilter?: string;
  showAll?: boolean;
  includeClosedTickets?: boolean;
  enabled?: boolean;
}

/**
 * React Query hook for tickets data
 * Replaces manual ticket loading with proper caching and refetching
 */
export function useTickets(options: UseTicketsOptions = {}) {
  const { userProfile, loading: authLoading, isInitialized } = useAuth();
  const queryClient = useQueryClient();
  const { authReady } = useNavigationDebug('useTickets');
  const {
    statusFilter = 'my_tickets',
    showAll = false,
    includeClosedTickets = false,
    enabled = true
  } = options;

  // Derive userRole safely
  const userRole = userProfile?.role as 'user' | 'agent' | 'admin' || 'user';

  const queryKey = [
    'tickets', 
    userProfile?.id, 
    userRole, 
    statusFilter, 
    showAll, 
    includeClosedTickets
  ];

  const queryFn = useCallback(async () => {
    if (!userProfile?.id) {
      throw new Error('User profile not available');
    }

    console.log('🔄 Fetching tickets with options:', {
      userId: userProfile.id,
      userRole,
      statusFilter,
      showAll,
      includeClosedTickets
    });

    const queryOptions = {
      userId: userProfile.id,
      userRole,
      statusFilter,
      showAll: userRole !== "user" ? showAll : false,
      includeClosedTickets: userRole === "user" ? includeClosedTickets : undefined,
    };

    const tickets = await DatabaseService.getTickets(queryOptions);
    
    if (!Array.isArray(tickets)) {
      throw new Error('Invalid ticket data received from server');
    }

    console.log('✅ Tickets fetched successfully', { count: tickets.length });
    return tickets;
  }, [
    userProfile?.id,
    userRole,
    statusFilter,
    showAll,
    includeClosedTickets
  ]);

  const queryEnabled = enabled && authReady;

  // Debug logging for query state
  useEffect(() => {
    console.log('🎯 useTickets query state:', {
      enabled,
      authReady,
      queryEnabled,
      userProfileId: userProfile?.id,
      statusFilter,
      queryKey: JSON.stringify(queryKey)
    });
  }, [enabled, authReady, queryEnabled, userProfile?.id, statusFilter, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: queryEnabled,
    staleTime: 1 * 60 * 1000, // 1 minute - fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000)
  });

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing tickets...');
    await queryClient.cancelQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey });
    return query.refetch();
  }, [queryClient, queryKey, query]);

  const handleStuckLoading = useCallback(() => {
    console.log('🚨 Handling stuck loading for tickets...');
    queryClient.cancelQueries({ queryKey });
    return forceRefresh();
  }, [queryClient, queryKey, forceRefresh]);

  return {
    tickets: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
    refetch: forceRefresh,
    handleStuckLoading
  };
}
