import { useState, useCallback, useRef, useEffect } from 'react';

export interface ErrorRecoveryState {
  error: string | null;
  isRecovering: boolean;
  retryCount: number;
  canRetry: boolean;
  lastErrorTime: number;
  errorType: 'network' | 'database' | 'permission' | 'timeout' | 'unknown';
}

interface ErrorRecoveryOptions {
  maxRetries?: number;
  baseRetryDelay?: number;
  maxRetryDelay?: number;
  retryMultiplier?: number;
  cooldownPeriod?: number;
  onError?: (error: Error, state: ErrorRecoveryState) => void;
  onRecovery?: (retryCount: number) => void;
  onMaxRetriesReached?: () => void;
}

/**
 * Enhanced error recovery hook that prevents rapid state changes and provides
 * intelligent retry mechanisms with exponential backoff and cooldown periods.
 */
export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    baseRetryDelay = 1000,
    maxRetryDelay = 10000,
    retryMultiplier = 2,
    cooldownPeriod = 5000,
    onError,
    onRecovery,
    onMaxRetriesReached
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    error: null,
    isRecovering: false,
    retryCount: 0,
    canRetry: true,
    lastErrorTime: 0,
    errorType: 'unknown'
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryOperationRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Classify error type based on error message
   */
  const classifyError = useCallback((error: Error): ErrorRecoveryState['errorType'] => {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('database') || message.includes('query') || message.includes('sql')) {
      return 'database';
    }
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'permission';
    }
    
    return 'unknown';
  }, []);

  /**
   * Calculate retry delay with exponential backoff
   */
  const calculateRetryDelay = useCallback((retryCount: number): number => {
    const delay = baseRetryDelay * Math.pow(retryMultiplier, retryCount);
    return Math.min(delay, maxRetryDelay);
  }, [baseRetryDelay, retryMultiplier, maxRetryDelay]);

  /**
   * Check if retry is allowed based on cooldown and retry limits
   */
  const canRetryNow = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastError = now - state.lastErrorTime;
    
    return (
      state.canRetry &&
      state.retryCount < maxRetries &&
      timeSinceLastError >= cooldownPeriod
    );
  }, [state.canRetry, state.retryCount, state.lastErrorTime, maxRetries, cooldownPeriod]);

  /**
   * Handle error occurrence with classification and state updates
   */
  const handleError = useCallback((error: Error) => {
    const now = Date.now();
    const errorType = classifyError(error);
    
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const newState: ErrorRecoveryState = {
      error: error.message,
      isRecovering: false,
      retryCount: state.retryCount,
      canRetry: state.retryCount < maxRetries,
      lastErrorTime: now,
      errorType
    };

    setState(newState);

    if (onError) {
      onError(error, newState);
    }

    // If max retries reached, call the callback
    if (state.retryCount >= maxRetries && onMaxRetriesReached) {
      onMaxRetriesReached();
    }
  }, [state.retryCount, maxRetries, classifyError, onError, onMaxRetriesReached]);

  /**
   * Attempt recovery with exponential backoff
   */
  const attemptRecovery = useCallback(async (recoveryOperation: () => Promise<void>) => {
    if (!canRetryNow()) {
      console.warn('Recovery attempt blocked: cooldown period or max retries reached');
      return false;
    }

    // Store the recovery operation for potential future use
    recoveryOperationRef.current = recoveryOperation;

    const retryDelay = calculateRetryDelay(state.retryCount);
    
    setState(prevState => ({
      ...prevState,
      isRecovering: true,
      retryCount: prevState.retryCount + 1,
      lastErrorTime: Date.now()
    }));

    return new Promise<boolean>((resolve) => {
      retryTimeoutRef.current = setTimeout(async () => {
        try {
          await recoveryOperation();
          
          // Success - reset error state
          setState(prevState => ({
            error: null,
            isRecovering: false,
            retryCount: 0,
            canRetry: true,
            lastErrorTime: 0,
            errorType: 'unknown'
          }));

          if (onRecovery) {
            onRecovery(state.retryCount);
          }

          resolve(true);
        } catch (error) {
          // Recovery failed - update error state
          handleError(error as Error);
          resolve(false);
        }
      }, retryDelay);
    });
  }, [canRetryNow, calculateRetryDelay, state.retryCount, handleError, onRecovery]);

  /**
   * Manual retry trigger
   */
  const retry = useCallback(async () => {
    if (!recoveryOperationRef.current) {
      console.warn('No recovery operation available for retry');
      return false;
    }

    return attemptRecovery(recoveryOperationRef.current);
  }, [attemptRecovery]);

  /**
   * Reset error state completely
   */
  const reset = useCallback(() => {
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Clear recovery operation reference
    recoveryOperationRef.current = null;

    setState({
      error: null,
      isRecovering: false,
      retryCount: 0,
      canRetry: true,
      lastErrorTime: 0,
      errorType: 'unknown'
    });
  }, []);

  /**
   * Get time until next retry is allowed
   */
  const getTimeUntilRetry = useCallback((): number => {
    if (canRetryNow()) return 0;
    
    const now = Date.now();
    const nextRetryTime = state.lastErrorTime + cooldownPeriod;
    return Math.max(0, nextRetryTime - now);
  }, [canRetryNow, state.lastErrorTime, cooldownPeriod]);

  /**
   * Get suggested recovery actions based on error type
   */
  const getRecoveryActions = useCallback((): string[] => {
    switch (state.errorType) {
      case 'network':
        return [
          'Check your internet connection',
          'Verify server availability',
          'Try again in a few moments'
        ];
      case 'timeout':
        return [
          'Wait for server load to decrease',
          'Check network stability',
          'Try again with a longer timeout'
        ];
      case 'database':
        return [
          'This is usually temporary',
          'Wait a moment and retry',
          'Contact administrator if persistent'
        ];
      case 'permission':
        return [
          'Verify your access permissions',
          'Contact administrator for access',
          'Try logging out and back in'
        ];
      default:
        return [
          'Try refreshing the page',
          'Check your connection',
          'Contact support if persistent'
        ];
    }
  }, [state.errorType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Computed properties
    canRetryNow: canRetryNow(),
    timeUntilRetry: getTimeUntilRetry(),
    recoveryActions: getRecoveryActions(),
    hasRecoveryOperation: !!recoveryOperationRef.current,
    
    // Actions
    handleError,
    attemptRecovery,
    retry,
    reset
  };
}