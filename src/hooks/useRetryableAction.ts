import { useState, useCallback, useRef } from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { toast } from 'sonner';

export interface RetryableActionOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  showToast?: boolean;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onMaxRetriesReached?: (error: Error) => void;
}

export function useRetryableAction<T = any>(
  action: () => Promise<T>,
  actionId: string,
  options: RetryableActionOptions = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    showToast = true,
    loadingMessage = 'Processing...',
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    onMaxRetriesReached,
  } = options;

  const { setComponentLoading, clearComponentLoading, setError, clearError } = useLoading();
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<T | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const retryCount = useRef(0);
  const abortController = useRef<AbortController | null>(null);

  const calculateDelay = useCallback((attempt: number) => {
    if (!exponentialBackoff) return retryDelay;
    return Math.min(retryDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, [retryDelay, exponentialBackoff]);

  const executeAction = useCallback(async (isRetry = false): Promise<T | null> => {
    if (isExecuting && !isRetry) {
      console.warn(`Action ${actionId} is already executing`);
      return null;
    }

    try {
      setIsExecuting(true);
      setLastError(null);
      clearError(actionId);

      // Create new abort controller for this execution
      abortController.current = new AbortController();

      // Set loading state
      setComponentLoading(actionId, {
        isLoading: true,
        message: isRetry ? `Retrying... (${retryCount.current + 1}/${maxRetries})` : loadingMessage,
        canCancel: true,
        onCancel: () => {
          console.log(`🚫 Cancelling action: ${actionId}`);
          abortController.current?.abort();
          clearComponentLoading(actionId);
          setIsExecuting(false);
        },
      });

      console.log(`🚀 Executing action: ${actionId}${isRetry ? ` (retry ${retryCount.current + 1})` : ''}`);

      const result = await action();

      // Success
      setLastResult(result);
      retryCount.current = 0; // Reset retry count on success
      clearComponentLoading(actionId);

      if (showToast && successMessage) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      console.log(`✅ Action completed successfully: ${actionId}`);
      return result;

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Action failed: ${actionId}`, err);

      setLastError(err);
      clearComponentLoading(actionId);

      // Check if we should retry
      if (retryCount.current < maxRetries && !abortController.current?.signal.aborted) {
        retryCount.current++;
        const delay = calculateDelay(retryCount.current - 1);

        console.log(`🔄 Scheduling retry ${retryCount.current}/${maxRetries} for ${actionId} in ${delay}ms`);

        // Set error with retry option
        setError(actionId, err, {
          canRetry: true,
          retryCount: retryCount.current,
          onRetry: () => {
            console.log(`🔄 Manual retry triggered for ${actionId}`);
            executeAction(true);
          },
          onDismiss: () => {
            console.log(`🗑️ Error dismissed for ${actionId}`);
            clearError(actionId);
            retryCount.current = 0;
          },
        });

        // Auto-retry after delay
        setTimeout(() => {
          if (!abortController.current?.signal.aborted) {
            executeAction(true);
          }
        }, delay);

      } else {
        // Max retries reached or aborted
        if (abortController.current?.signal.aborted) {
          console.log(`🚫 Action cancelled: ${actionId}`);
          if (showToast) {
            toast.info('Action cancelled');
          }
        } else {
          console.log(`🚨 Max retries reached for ${actionId}`);
          
          if (showToast && errorMessage) {
            toast.error(errorMessage);
          }

          if (onMaxRetriesReached) {
            onMaxRetriesReached(err);
          }

          // Set final error state
          setError(actionId, err, {
            canRetry: false,
            retryCount: retryCount.current,
            onDismiss: () => {
              clearError(actionId);
              retryCount.current = 0;
            },
          });
        }

        retryCount.current = 0;
      }

      if (onError) {
        onError(err);
      }

      return null;
    } finally {
      setIsExecuting(false);
    }
  }, [
    actionId,
    action,
    isExecuting,
    maxRetries,
    loadingMessage,
    successMessage,
    errorMessage,
    showToast,
    calculateDelay,
    setComponentLoading,
    clearComponentLoading,
    setError,
    clearError,
    onSuccess,
    onError,
    onMaxRetriesReached,
  ]);

  const cancel = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
    clearComponentLoading(actionId);
    clearError(actionId);
    setIsExecuting(false);
    retryCount.current = 0;
  }, [actionId, clearComponentLoading, clearError]);

  const reset = useCallback(() => {
    cancel();
    setLastResult(null);
    setLastError(null);
  }, [cancel]);

  return {
    execute: executeAction,
    cancel,
    reset,
    isExecuting,
    lastResult,
    lastError,
    retryCount: retryCount.current,
    canRetry: retryCount.current < maxRetries,
  };
}

// Specialized hook for form submissions
export function useRetryableFormSubmission<T = any>(
  submitAction: () => Promise<T>,
  formId: string,
  options: RetryableActionOptions = {}
) {
  return useRetryableAction(submitAction, `form-${formId}`, {
    maxRetries: 2, // Forms typically need fewer retries
    showToast: true,
    loadingMessage: 'Submitting...',
    successMessage: 'Submitted successfully',
    errorMessage: 'Submission failed',
    ...options,
  });
}

// Specialized hook for data fetching with retries
export function useRetryableDataFetch<T = any>(
  fetchAction: () => Promise<T>,
  dataId: string,
  options: RetryableActionOptions = {}
) {
  return useRetryableAction(fetchAction, `fetch-${dataId}`, {
    maxRetries: 3,
    exponentialBackoff: true,
    showToast: false, // Usually handled by query error boundaries
    loadingMessage: 'Loading data...',
    ...options,
  });
}