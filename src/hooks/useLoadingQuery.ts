import { useEffect } from 'react';
import { UseQueryResult } from '@tanstack/react-query';
import { useLoading, usePageLoading, useComponentLoading, useErrorHandler } from '@/contexts/LoadingContext';

export interface LoadingQueryOptions {
  loadingId: string;
  loadingType?: 'global' | 'page' | 'component';
  loadingMessage?: string;
  errorMessage?: string;
  showProgress?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useLoadingQuery<TData, TError = Error>(
  query: UseQueryResult<TData, TError>,
  options: LoadingQueryOptions
) {
  const { 
    loadingId, 
    loadingType = 'component', 
    loadingMessage = 'Loading...', 
    errorMessage,
    showProgress = false,
    onSuccess,
    onError 
  } = options;

  const globalLoading = useLoading();
  const pageLoading = usePageLoading(loadingId);
  const componentLoading = useComponentLoading(loadingId);
  const errorHandler = useErrorHandler(loadingId);

  // Select the appropriate loading handler based on type
  const loadingHandler = loadingType === 'global' 
    ? globalLoading 
    : loadingType === 'page' 
    ? pageLoading 
    : componentLoading;

  // Update loading state based on query state
  useEffect(() => {
    if (query.isLoading || query.isFetching) {
      const loadingState = {
        isLoading: true,
        message: loadingMessage,
        progress: showProgress ? (query.isFetching ? 50 : undefined) : undefined,
      };

      if (loadingType === 'global') {
        globalLoading.setGlobalLoading(loadingState);
      } else {
        loadingHandler.setLoading(loadingState);
      }
    } else {
      if (loadingType === 'global') {
        globalLoading.clearGlobalLoading();
      } else {
        loadingHandler.clearLoading();
      }
    }
  }, [
    query.isLoading, 
    query.isFetching, 
    loadingMessage, 
    showProgress, 
    loadingType, 
    globalLoading, 
    loadingHandler
  ]);

  // Handle errors
  useEffect(() => {
    if (query.error) {
      const error = query.error as Error;
      errorHandler.setError(error, {
        canRetry: true,
        onRetry: () => {
          console.log(`🔄 Retrying query: ${loadingId}`);
          query.refetch();
        },
        onDismiss: () => {
          console.log(`🗑️ Dismissing error for: ${loadingId}`);
          errorHandler.clearError();
        },
      });

      if (onError) {
        onError(error);
      }
    } else {
      errorHandler.clearError();
    }
  }, [query.error, errorHandler, loadingId, query.refetch, onError]);

  // Handle success
  useEffect(() => {
    if (query.isSuccess && query.data && onSuccess) {
      onSuccess();
    }
  }, [query.isSuccess, query.data, onSuccess]);

  return {
    ...query,
    loading: loadingType === 'global' 
      ? globalLoading.globalLoading 
      : loadingHandler.loading,
    error: errorHandler.error,
    clearError: errorHandler.clearError,
  };
}

// Specialized hook for page-level queries
export function usePageQuery<TData, TError = Error>(
  query: UseQueryResult<TData, TError>,
  pageId: string,
  options: Omit<LoadingQueryOptions, 'loadingId' | 'loadingType'> = {}
) {
  return useLoadingQuery(query, {
    ...options,
    loadingId: pageId,
    loadingType: 'page',
  });
}

// Specialized hook for component-level queries
export function useComponentQuery<TData, TError = Error>(
  query: UseQueryResult<TData, TError>,
  componentId: string,
  options: Omit<LoadingQueryOptions, 'loadingId' | 'loadingType'> = {}
) {
  return useLoadingQuery(query, {
    ...options,
    loadingId: componentId,
    loadingType: 'component',
  });
}

// Hook for handling multiple queries with coordinated loading states
export function useMultipleLoadingQueries(
  queries: Array<{
    query: UseQueryResult<any, any>;
    id: string;
    message?: string;
  }>,
  globalLoadingId: string
) {
  const { setGlobalLoading, clearGlobalLoading } = useLoading();

  useEffect(() => {
    const isAnyLoading = queries.some(({ query }) => query.isLoading || query.isFetching);
    const hasErrors = queries.some(({ query }) => query.error);
    const loadingQueries = queries.filter(({ query }) => query.isLoading || query.isFetching);

    if (isAnyLoading) {
      const message = loadingQueries.length === 1 
        ? loadingQueries[0].message || 'Loading...'
        : `Loading ${loadingQueries.length} items...`;

      setGlobalLoading({
        isLoading: true,
        message,
        progress: undefined,
      });
    } else {
      clearGlobalLoading();
    }
  }, [queries, setGlobalLoading, clearGlobalLoading]);

  const allLoaded = queries.every(({ query }) => query.isSuccess);
  const hasAnyError = queries.some(({ query }) => query.error);
  const isAnyLoading = queries.some(({ query }) => query.isLoading || query.isFetching);

  return {
    allLoaded,
    hasAnyError,
    isAnyLoading,
    errors: queries.filter(({ query }) => query.error).map(({ query, id }) => ({ id, error: query.error })),
    retryAll: () => {
      queries.forEach(({ query }) => {
        if (query.error) {
          query.refetch();
        }
      });
    },
  };
}