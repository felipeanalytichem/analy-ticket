import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryErrorHandler } from '@/hooks/useQueryErrorHandler';
import { useCallback, useEffect } from 'react';

export interface SessionAwareQueryOptions<TData, TError = Error> extends Omit<UseQueryOptions<TData, TError>, 'queryFn'> {
  queryFn: () => Promise<TData>;
  requiresAuth?: boolean;
  onSessionError?: () => void;
}

export function useSessionAwareQuery<TData, TError = Error>(
  options: SessionAwareQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  const { user, session, sessionHealth, validateSession, refreshSession } = useAuth();
  const { handleError } = useQueryErrorHandler();
  
  const {
    queryFn,
    requiresAuth = true,
    onSessionError,
    ...queryOptions
  } = options;

  // Enhanced query function that checks session health
  const enhancedQueryFn = useCallback(async (): Promise<TData> => {
    // Check if authentication is required
    if (requiresAuth && !user) {
      throw new Error('Authentication required');
    }

    // Validate session health before making the request
    if (requiresAuth && sessionHealth) {
      if (sessionHealth.isExpired) {
        console.log('🔐 Session expired, attempting refresh before query...');
        const refreshed = await refreshSession();
        if (!refreshed) {
          if (onSessionError) {
            onSessionError();
          }
          throw new Error('Session expired and refresh failed');
        }
      } else if (sessionHealth.needsRefresh) {
        console.log('🔐 Session needs refresh, refreshing before query...');
        await refreshSession();
      }
    }

    try {
      return await queryFn();
    } catch (error: any) {
      // Handle authentication errors specifically
      if (error?.status === 401 || error?.message?.includes('JWT')) {
        console.log('🔐 Authentication error in query, handling...');
        await handleError(error, options.queryKey as string[]);
        
        if (onSessionError) {
          onSessionError();
        }
      }
      
      throw error;
    }
  }, [queryFn, requiresAuth, user, sessionHealth, refreshSession, onSessionError, handleError, options.queryKey]);

  // Use the enhanced query function
  const query = useQuery({
    ...queryOptions,
    queryFn: enhancedQueryFn,
    enabled: requiresAuth ? !!user && !!session && (options.enabled !== false) : (options.enabled !== false),
  });

  // Monitor session health and refetch if session becomes healthy again
  useEffect(() => {
    if (requiresAuth && sessionHealth && query.isError) {
      // If query failed due to session issues and session is now healthy, retry
      if (sessionHealth.isValid && !sessionHealth.needsRefresh) {
        const error = query.error as any;
        if (error?.status === 401 || error?.message?.includes('JWT')) {
          console.log('🔐 Session is healthy again, retrying failed query...');
          query.refetch();
        }
      }
    }
  }, [sessionHealth?.isValid, sessionHealth?.needsRefresh, query, requiresAuth]);

  return query;
}

// Specialized hook for real-time data that needs frequent updates
export function useRealtimeQuery<TData, TError = Error>(
  options: SessionAwareQueryOptions<TData, TError> & {
    refetchInterval?: number;
  }
): UseQueryResult<TData, TError> {
  const { refetchInterval = 30000, ...queryOptions } = options; // Default 30 seconds

  return useSessionAwareQuery({
    ...queryOptions,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 0, // Always consider real-time data stale
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
  });
}

// Hook for static data that doesn't change often
export function useStaticQuery<TData, TError = Error>(
  options: SessionAwareQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  return useSessionAwareQuery({
    ...options,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}