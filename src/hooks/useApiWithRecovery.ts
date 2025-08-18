import { useCallback, useState } from 'react';
import { useErrorNotifications } from '@/components/error/ErrorNotificationSystem';
import { supabase } from '@/lib/supabase';

interface ApiCallOptions {
  showSuccessNotification?: boolean;
  showErrorNotification?: boolean;
  retryOnFailure?: boolean;
  maxRetries?: number;
  cacheKey?: string;
}

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
}

export function useApiWithRecovery<T = any>() {
  const { showError, showSuccess, showNetworkError } = useErrorNotifications();
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    retryCount: 0
  });

  const executeWithRecovery = useCallback(async (
    apiCall: () => Promise<T>,
    options: ApiCallOptions = {}
  ): Promise<T | null> => {
    const {
      showSuccessNotification = false,
      showErrorNotification = true,
      retryOnFailure = true,
      maxRetries = 3,
      cacheKey
    } = options;

    setState(prev => ({ ...prev, loading: true, error: null }));

    const attemptCall = async (attempt: number): Promise<T | null> => {
      try {
        const result = await apiCall();
        
        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
          retryCount: 0
        }));

        if (showSuccessNotification) {
          showSuccess('Success', 'Operation completed successfully');
        }

        return result;
      } catch (error: any) {
        console.error(`API call failed (attempt ${attempt}):`, error);

        // Check if it's an authentication error
        if (error.status === 401 || error.code === 'PGRST301') {
          console.log('Authentication error detected, attempting token refresh...');
          
          try {
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && attempt < maxRetries) {
              console.log('Token refreshed, retrying API call...');
              return attemptCall(attempt + 1);
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }
        }

        // Check if we should retry
        if (retryOnFailure && attempt < maxRetries) {
          setState(prev => ({ ...prev, retryCount: attempt }));
          
          // Exponential backoff delay
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return attemptCall(attempt + 1);
        }

        // Final failure
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error,
          retryCount: attempt
        }));

        if (showErrorNotification) {
          if (error.status === 401) {
            showError(
              'Authentication Error',
              'Your session has expired. Please log in again.',
              {
                actions: [{
                  label: 'Refresh Page',
                  action: () => window.location.reload()
                }]
              }
            );
          } else if (!navigator.onLine) {
            showNetworkError(
              'You are offline. Please check your internet connection.',
              () => executeWithRecovery(apiCall, options)
            );
          } else {
            showError(
              'Operation Failed',
              error.message || 'An unexpected error occurred',
              {
                actions: [{
                  label: 'Retry',
                  action: () => executeWithRecovery(apiCall, options)
                }]
              }
            );
          }
        }

        return null;
      }
    };

    return attemptCall(1);
  }, [showError, showSuccess, showNetworkError]);

  const retry = useCallback(() => {
    if (state.error) {
      setState(prev => ({ ...prev, error: null, retryCount: 0 }));
    }
  }, [state.error]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      retryCount: 0
    });
  }, []);

  return {
    ...state,
    executeWithRecovery,
    retry,
    reset
  };
}

// Convenience hook for common Supabase operations
export function useSupabaseWithRecovery() {
  const api = useApiWithRecovery();

  const query = useCallback(async (
    table: string,
    queryBuilder: (query: any) => any,
    options?: ApiCallOptions
  ) => {
    return api.executeWithRecovery(async () => {
      const query = supabase.from(table);
      const { data, error } = await queryBuilder(query);
      
      if (error) throw error;
      return data;
    }, options);
  }, [api]);

  const insert = useCallback(async (
    table: string,
    data: any,
    options?: ApiCallOptions
  ) => {
    return api.executeWithRecovery(async () => {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select();
      
      if (error) throw error;
      return result;
    }, { showSuccessNotification: true, ...options });
  }, [api]);

  const update = useCallback(async (
    table: string,
    data: any,
    filter: (query: any) => any,
    options?: ApiCallOptions
  ) => {
    return api.executeWithRecovery(async () => {
      const query = supabase.from(table).update(data);
      const { data: result, error } = await filter(query).select();
      
      if (error) throw error;
      return result;
    }, { showSuccessNotification: true, ...options });
  }, [api]);

  const remove = useCallback(async (
    table: string,
    filter: (query: any) => any,
    options?: ApiCallOptions
  ) => {
    return api.executeWithRecovery(async () => {
      const query = supabase.from(table);
      const { error } = await filter(query).delete();
      
      if (error) throw error;
      return true;
    }, { showSuccessNotification: true, ...options });
  }, [api]);

  return {
    ...api,
    query,
    insert,
    update,
    remove
  };
}