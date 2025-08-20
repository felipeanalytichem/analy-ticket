/**
 * Debug utilities for React Query
 * Helps identify caching and query execution issues
 */

export function debugQueryState(queryClient: any, queryKey: any[]) {
  const queryCache = queryClient.getQueryCache();
  const query = queryCache.find({ queryKey });
  
  console.log('🔍 React Query Debug:', {
    queryKey: JSON.stringify(queryKey),
    query: {
      state: query?.state,
      isLoading: query?.state?.isLoading,
      isError: query?.state?.isError,
      error: query?.state?.error,
      data: query?.state?.data ? 'has data' : 'no data',
      dataUpdatedAt: query?.state?.dataUpdatedAt,
      lastFetched: query?.state?.dataUpdatedAt ? new Date(query.state.dataUpdatedAt).toISOString() : 'never'
    },
    queryOptions: {
      enabled: query?.options?.enabled,
      staleTime: query?.options?.staleTime,
      gcTime: query?.options?.gcTime
    }
  });
  
  return query;
}

export function clearQueryCache(queryClient: any, queryKey: any[]) {
  console.log('🗑️ Clearing query cache for:', JSON.stringify(queryKey));
  queryClient.removeQueries({ queryKey });
  queryClient.invalidateQueries({ queryKey });
}

export function forceRefetchQuery(queryClient: any, queryKey: any[]) {
  console.log('🔄 Force refetching query:', JSON.stringify(queryKey));
  return queryClient.refetchQueries({ queryKey, type: 'active' });
}
