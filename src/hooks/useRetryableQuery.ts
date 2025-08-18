import { useState, useCallback } from 'react';

interface RetryableQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retryCount: number;
}

interface RetryableQueryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error, retryCount: number) => void;
  onSuccess?: () => void;
}

export function useRetryableQuery<T>(
  queryFn: () => Promise<T>,
  options: RetryableQueryOptions = {}
) {
  const { 
    maxRetries = 3, 
    retryDelay = 1000,
    onError,
    onSuccess 
  } = options;

  const [state, setState] = useState<RetryableQueryState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0,
  });

  const execute = useCallback(async (isRetry = false) => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      retryCount: isRetry ? prev.retryCount + 1 : 0,
    }));

    try {
      const result = await queryFn();
      setState(prev => ({
        ...prev,
        data: result,
        loading: false,
        error: null,
      }));
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));

      if (onError) {
        onError(error as Error, state.retryCount);
      }

      throw error;
    }
  }, [queryFn, onError, onSuccess, state.retryCount]);

  const retry = useCallback(async () => {
    if (state.retryCount >= maxRetries) {
      setState(prev => ({
        ...prev,
        error: `Maximum retry attempts (${maxRetries}) exceeded. Please try again later.`,
      }));
      return;
    }

    // Add delay before retry
    if (retryDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay * (state.retryCount + 1)));
    }

    return execute(true);
  }, [execute, maxRetries, retryDelay, state.retryCount]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0,
    });
  }, []);

  return {
    ...state,
    execute,
    retry,
    reset,
    canRetry: state.retryCount < maxRetries,
  };
}