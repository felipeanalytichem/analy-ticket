import { useState, useCallback, useRef, useEffect } from 'react';
import { useErrorRecovery } from './useErrorRecovery';
import { gracefulDegradationService, PartialLoadResult } from '@/services/gracefulDegradationService';

export type LoadingType = 'initial' | 'refresh' | 'action' | 'form' | null;
export type LoadingPhase = 'initializing' | 'loading' | 'ready' | 'error' | 'partial';

interface LoadingStateManager {
  isLoading: boolean;
  loadingType: LoadingType;
  loadingPhase: LoadingPhase;
  error: string | null;
  retryCount: number;
  canRetry: boolean;
  operation: string | null;
  progress?: number;
  message?: string;
  isPartialData?: boolean;
  missingFeatures?: string[];
  cacheSource?: string;
}

interface ConsolidatedLoadingOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableGracefulDegradation?: boolean;
  cacheKey?: string;
  onError?: (error: Error, retryCount: number) => void;
  onSuccess?: () => void;
  onPartialLoad?: (result: PartialLoadResult<any>) => void;
  onStateChange?: (state: LoadingStateManager) => void;
}

interface LoadingOperation {
  id: string;
  type: LoadingType;
  operation: string;
  promise: Promise<any>;
  startTime: number;
}

/**
 * Enhanced consolidated loading state manager hook that prevents flickering by managing
 * all loading states in a single, predictable interface with proper transitions,
 * error recovery, and graceful degradation support.
 */
export function useConsolidatedLoading(options: ConsolidatedLoadingOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    enableGracefulDegradation = false,
    cacheKey,
    onError,
    onSuccess,
    onPartialLoad,
    onStateChange
  } = options;

  const [state, setState] = useState<LoadingStateManager>({
    isLoading: false,
    loadingType: null,
    loadingPhase: 'initializing',
    error: null,
    retryCount: 0,
    canRetry: true,
    operation: null,
    progress: undefined,
    message: undefined,
    isPartialData: false,
    missingFeatures: [],
    cacheSource: undefined
  });

  // Initialize error recovery system
  const errorRecovery = useErrorRecovery({
    maxRetries,
    baseRetryDelay: retryDelay,
    onError: (error, errorState) => {
      updateState({
        error: error.message,
        retryCount: errorState.retryCount,
        canRetry: errorState.canRetry,
        loadingPhase: 'error'
      });
      
      if (onError) {
        onError(error, errorState.retryCount);
      }
    },
    onRecovery: (retryCount) => {
      console.log(`[ConsolidatedLoading] Recovery successful after ${retryCount} retries`);
    }
  });

  // Track active operations to prevent conflicts
  const activeOperations = useRef<Map<string, LoadingOperation>>(new Map());
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Minimum loading time to prevent flickering (in ms)
  const MIN_LOADING_TIME = 300;

  const updateState = useCallback((updates: Partial<LoadingStateManager>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      if (onStateChange) {
        onStateChange(newState);
      }
      return newState;
    });
  }, [onStateChange]);

  /**
   * Start a loading operation with proper state transitions
   */
  const startLoading = useCallback((
    type: LoadingType,
    operation: string,
    message?: string
  ): string => {
    const operationId = `${type}-${operation}-${Date.now()}`;
    const startTime = Date.now();

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Add to active operations
    const loadingOperation: LoadingOperation = {
      id: operationId,
      type,
      operation,
      promise: Promise.resolve(), // Will be updated when actual promise is provided
      startTime
    };
    activeOperations.current.set(operationId, loadingOperation);

    // Update state immediately for responsive UI
    updateState({
      isLoading: true,
      loadingType: type,
      loadingPhase: 'loading',
      operation,
      message,
      error: null
    });

    return operationId;
  }, [updateState]);

  /**
   * Complete a loading operation with smooth transitions
   */
  const completeLoading = useCallback((
    operationId: string,
    result?: { error?: string; data?: any }
  ) => {
    const operation = activeOperations.current.get(operationId);
    if (!operation) return;

    const elapsedTime = Date.now() - operation.startTime;
    const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

    const finishTransition = () => {
      activeOperations.current.delete(operationId);

      // Check if there are other active operations
      const hasActiveOperations = activeOperations.current.size > 0;

      if (!hasActiveOperations) {
        if (result?.error) {
          updateState({
            isLoading: false,
            loadingPhase: 'error',
            error: result.error,
            canRetry: state.retryCount < maxRetries,
            operation: null,
            message: undefined
          });

          if (onError) {
            onError(new Error(result.error), state.retryCount);
          }
        } else {
          updateState({
            isLoading: false,
            loadingType: null,
            loadingPhase: 'ready',
            error: null,
            operation: null,
            message: undefined
          });

          if (onSuccess) {
            onSuccess();
          }
        }
      }
    };

    // Ensure minimum loading time to prevent flickering
    if (remainingTime > 0) {
      transitionTimeoutRef.current = setTimeout(finishTransition, remainingTime);
    } else {
      finishTransition();
    }
  }, [updateState, state.retryCount, maxRetries, onError, onSuccess]);

  /**
   * Execute an async operation with consolidated loading state and graceful degradation
   */
  const executeWithLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    type: LoadingType,
    operationName: string,
    message?: string
  ): Promise<T> => {
    const operationId = startLoading(type, operationName, message);

    try {
      let result: T;

      // If graceful degradation is enabled and we have a cache key, use the service
      if (enableGracefulDegradation && cacheKey && Array.isArray) {
        const gracefulResult = await gracefulDegradationService.loadWithGracefulDegradation(
          cacheKey,
          operation as () => Promise<any[]>,
          {
            enablePartialLoad: true,
            fallbackFeatures: ['real-time-updates', 'create-operations'],
            maxPartialItems: 100
          }
        );

        if (gracefulResult.isPartial) {
          // Handle partial data load
          updateState({
            isPartialData: true,
            missingFeatures: gracefulResult.missingFeatures,
            cacheSource: gracefulResult.cacheSource,
            loadingPhase: 'partial'
          });

          if (onPartialLoad) {
            onPartialLoad(gracefulResult);
          }
        }

        result = gracefulResult.data as T;
      } else {
        // Standard operation execution
        result = await operation();
      }

      completeLoading(operationId, { data: result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      // Use error recovery system
      errorRecovery.handleError(error as Error);
      
      completeLoading(operationId, { error: errorMessage });
      throw error;
    }
  }, [startLoading, completeLoading, enableGracefulDegradation, cacheKey, onPartialLoad, errorRecovery]);

  /**
   * Retry the last failed operation using error recovery system
   */
  const retry = useCallback(async () => {
    if (!errorRecovery.canRetryNow) {
      console.warn('[ConsolidatedLoading] Retry blocked by error recovery system');
      return false;
    }

    updateState({
      isLoading: true,
      loadingPhase: 'loading',
      error: null
    });

    return await errorRecovery.retry();
  }, [errorRecovery, updateState]);

  /**
   * Reset the loading state to initial state
   */
  const reset = useCallback(() => {
    // Clear all active operations
    activeOperations.current.clear();
    
    // Clear any pending transitions
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    // Reset error recovery system
    errorRecovery.reset();

    // Clear cache if enabled
    if (enableGracefulDegradation && cacheKey) {
      gracefulDegradationService.clearCache(cacheKey);
    }

    updateState({
      isLoading: false,
      loadingType: null,
      loadingPhase: 'initializing',
      error: null,
      retryCount: 0,
      canRetry: true,
      operation: null,
      progress: undefined,
      message: undefined,
      isPartialData: false,
      missingFeatures: [],
      cacheSource: undefined
    });
  }, [updateState, errorRecovery, enableGracefulDegradation, cacheKey]);

  /**
   * Update progress for long-running operations
   */
  const updateProgress = useCallback((progress: number, message?: string) => {
    updateState({
      progress: Math.max(0, Math.min(100, progress)),
      message
    });
  }, [updateState]);

  /**
   * Set the loading phase directly (for external state management)
   */
  const setPhase = useCallback((phase: LoadingPhase) => {
    updateState({ loadingPhase: phase });
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      activeOperations.current.clear();
    };
  }, []);

  return {
    // State
    ...state,
    
    // Error recovery state
    errorRecovery: {
      canRetryNow: errorRecovery.canRetryNow,
      timeUntilRetry: errorRecovery.timeUntilRetry,
      recoveryActions: errorRecovery.recoveryActions,
      errorType: errorRecovery.errorType
    },
    
    // Actions
    startLoading,
    completeLoading,
    executeWithLoading,
    retry,
    reset,
    updateProgress,
    setPhase,
    
    // Computed properties
    hasActiveOperations: activeOperations.current.size > 0,
    isInitialLoad: state.loadingPhase === 'initializing' || (state.loadingType === 'initial' && state.isLoading),
    isRefreshing: state.loadingType === 'refresh' && state.isLoading,
    isSubmitting: state.loadingType === 'form' && state.isLoading,
    isPerformingAction: state.loadingType === 'action' && state.isLoading,
    hasPartialData: state.isPartialData === true,
    isInErrorState: state.loadingPhase === 'error',
    isInPartialState: state.loadingPhase === 'partial',
  };
}