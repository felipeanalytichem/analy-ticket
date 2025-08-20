import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to handle stuck loading states by implementing a timeout
 * that will refetch queries if they remain loading too long
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs: number = 30000) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadingStateRef = useRef<boolean>(false);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If we're loading and this is a new loading state
    if (isLoading && !lastLoadingStateRef.current) {
      console.log('⏱️ Starting loading timeout...');
      
      timeoutRef.current = setTimeout(() => {
        console.warn('🚨 Loading timeout reached - refetching all queries');
        
        // Force refetch all active queries to resolve stuck state
        queryClient.refetchQueries({
          type: 'active',
          stale: true
        });
        
        // Also invalidate queries to ensure fresh data
        queryClient.invalidateQueries();
        
      }, timeoutMs);
    }

    // Update the last loading state
    lastLoadingStateRef.current = isLoading;

    // Cleanup on unmount or when loading changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isLoading, timeoutMs, queryClient]);

  // Also cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

/**
 * Global loading state manager for handling stuck queries
 */
export function useGlobalLoadingManager() {
  const queryClient = useQueryClient();

  const handleStuckQueries = () => {
    console.log('🔄 Handling potentially stuck queries...');
    
    // Cancel all ongoing queries
    queryClient.cancelQueries();
    
    // Refetch all stale queries
    queryClient.refetchQueries({
      type: 'active',
      stale: true
    });
  };

  const forceRefreshAll = () => {
    console.log('🔄 Force refreshing all data...');
    
    // Invalidate all queries
    queryClient.invalidateQueries();
    
    // Refetch all active queries
    queryClient.refetchQueries({
      type: 'active'
    });
  };

  return {
    handleStuckQueries,
    forceRefreshAll
  };
}
