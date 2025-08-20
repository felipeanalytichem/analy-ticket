import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ReopenService } from '@/lib/reopen-service';
import { useAuth } from '@/contexts/AuthContext';

/**
 * React Query hook for reopen requests data
 * Replaces manual loading with proper caching and refetching
 */
export function useReopenRequests() {
  const { isInitialized, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['reopen-requests'];

  const queryFn = useCallback(async () => {
    console.log('🔄 Fetching reopen requests...');
    const data = await ReopenService.getReopenRequests({});
    console.log('✅ Reopen requests fetched successfully', { count: data.length });
    return data;
  }, []);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: isInitialized && !authLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes - reopen requests don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
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
    console.log('🔄 Force refreshing reopen requests...');
    await queryClient.cancelQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey });
    return query.refetch();
  }, [queryClient, queryKey, query]);

  const handleStuckLoading = useCallback(() => {
    console.log('🚨 Handling stuck loading for reopen requests...');
    queryClient.cancelQueries({ queryKey });
    return forceRefresh();
  }, [queryClient, queryKey, forceRefresh]);

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
    refetch: forceRefresh,
    handleStuckLoading
  };
}
