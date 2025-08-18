import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { analyzeNetworkError } from '@/lib/networkErrorHandler';

export interface QueryErrorHandlerOptions {
  showToast?: boolean;
  invalidateOnError?: string[];
  onError?: (error: any) => void;
}

export function useQueryErrorHandler(options: QueryErrorHandlerOptions = {}) {
  const queryClient = useQueryClient();
  const { validateSession, refreshSession } = useAuth();
  
  const handleError = useCallback(async (error: any, queryKey?: string[]) => {
    const errorInfo = analyzeNetworkError(error);
    
    console.error('🚨 Query error handled:', {
      type: errorInfo.type,
      retryable: errorInfo.retryable,
      message: error?.message || error,
      status: error?.status
    });
    
    // Handle authentication errors
    if (error?.status === 401 || error?.message?.includes('JWT')) {
      console.log('🔐 Authentication error detected, attempting session refresh...');
      
      const isValid = await validateSession();
      if (!isValid) {
        const refreshed = await refreshSession();
        if (refreshed) {
          console.log('🔐 Session refreshed, invalidating queries...');
          queryClient.invalidateQueries();
          return;
        }
      }
    }
    
    // Handle specific network error types
    if (errorInfo.retryable && options.showToast !== false) {
      let title = 'Network Error';
      let description = 'Please try again.';
      
      switch (errorInfo.type) {
        case 'insufficient_resources':
          title = 'Server Busy';
          description = 'Server resources are temporarily unavailable. Please wait a moment and try again.';
          break;
        case 'failed_fetch':
          title = 'Connection Failed';
          description = 'Unable to connect to the server. Please check your internet connection.';
          break;
        case 'network_error':
          title = 'Network Error';
          description = 'A network error occurred. Please check your connection and try again.';
          break;
        case 'timeout':
          title = 'Request Timeout';
          description = 'The request took too long to complete. Please try again.';
          break;
        default:
          if (error?.message?.includes('NetworkError') || error?.message?.includes('fetch')) {
            description = 'Please check your internet connection and try again.';
          }
      }
      
      toast.error(title, {
        description,
        action: {
          label: 'Retry',
          onClick: () => {
            if (queryKey) {
              queryClient.invalidateQueries({ queryKey });
            } else {
              queryClient.invalidateQueries();
            }
          },
        },
      });
      return;
    }
    
    // Handle server errors
    if (error?.status >= 500) {
      if (options.showToast !== false) {
        toast.error('Server Error', {
          description: 'The server is experiencing issues. Please try again later.',
          action: {
            label: 'Retry',
            onClick: () => {
              if (queryKey) {
                queryClient.invalidateQueries({ queryKey });
              } else {
                queryClient.invalidateQueries();
              }
            },
          },
        });
      }
      return;
    }
    
    // Invalidate specific queries if requested
    if (options.invalidateOnError) {
      options.invalidateOnError.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    }
    
    // Call custom error handler
    if (options.onError) {
      options.onError(error);
    }
    
    // Show generic error toast if enabled
    if (options.showToast !== false) {
      toast.error('Error', {
        description: error?.message || 'An unexpected error occurred.',
      });
    }
  }, [queryClient, validateSession, refreshSession, options]);
  
  const retryQuery = useCallback((queryKey: string[]) => {
    console.log('🔄 Retrying query:', queryKey);
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);
  
  const clearErrorQueries = useCallback(() => {
    console.log('🧹 Clearing all error queries');
    queryClient.clear();
  }, [queryClient]);
  
  return {
    handleError,
    retryQuery,
    clearErrorQueries,
  };
}