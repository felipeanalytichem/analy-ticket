import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number; // 0-100 for progress bars
  canCancel?: boolean;
  onCancel?: () => void;
}

export interface ErrorState {
  error: Error | null;
  errorId: string;
  retryCount: number;
  canRetry: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}

interface LoadingContextType {
  // Global loading state
  globalLoading: LoadingState;
  setGlobalLoading: (loading: Partial<LoadingState>) => void;
  clearGlobalLoading: () => void;
  
  // Page-specific loading states
  pageLoading: Record<string, LoadingState>;
  setPageLoading: (pageId: string, loading: Partial<LoadingState>) => void;
  clearPageLoading: (pageId: string) => void;
  
  // Component-specific loading states
  componentLoading: Record<string, LoadingState>;
  setComponentLoading: (componentId: string, loading: Partial<LoadingState>) => void;
  clearComponentLoading: (componentId: string) => void;
  
  // Error states
  errors: Record<string, ErrorState>;
  setError: (errorId: string, error: Error, options?: Partial<ErrorState>) => void;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  
  // Utility functions
  isAnyLoading: () => boolean;
  hasErrors: () => boolean;
  getLoadingMessage: () => string | undefined;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const defaultLoadingState: LoadingState = {
  isLoading: false,
  message: undefined,
  progress: undefined,
  canCancel: false,
  onCancel: undefined,
};

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [globalLoading, setGlobalLoadingState] = useState<LoadingState>(defaultLoadingState);
  const [pageLoading, setPageLoadingState] = useState<Record<string, LoadingState>>({});
  const [componentLoading, setComponentLoadingState] = useState<Record<string, LoadingState>>({});
  const [errors, setErrorsState] = useState<Record<string, ErrorState>>({});
  
  // Refs to track retry attempts and prevent infinite loops
  const retryAttempts = useRef<Record<string, number>>({});
  const maxRetries = 3;

  const setGlobalLoading = useCallback((loading: Partial<LoadingState>) => {
    setGlobalLoadingState(prev => ({ ...prev, ...loading }));
  }, []);

  const clearGlobalLoading = useCallback(() => {
    setGlobalLoadingState(defaultLoadingState);
  }, []);

  const setPageLoading = useCallback((pageId: string, loading: Partial<LoadingState>) => {
    setPageLoadingState(prev => ({
      ...prev,
      [pageId]: { ...defaultLoadingState, ...prev[pageId], ...loading }
    }));
  }, []);

  const clearPageLoading = useCallback((pageId: string) => {
    setPageLoadingState(prev => {
      const { [pageId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const setComponentLoading = useCallback((componentId: string, loading: Partial<LoadingState>) => {
    setComponentLoadingState(prev => ({
      ...prev,
      [componentId]: { ...defaultLoadingState, ...prev[componentId], ...loading }
    }));
  }, []);

  const clearComponentLoading = useCallback((componentId: string) => {
    setComponentLoadingState(prev => {
      const { [componentId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const setError = useCallback((errorId: string, error: Error, options: Partial<ErrorState> = {}) => {
    const currentRetries = retryAttempts.current[errorId] || 0;
    const canRetry = currentRetries < maxRetries && options.canRetry !== false;
    
    const errorState: ErrorState = {
      error,
      errorId,
      retryCount: currentRetries,
      canRetry,
      onRetry: options.onRetry,
      onDismiss: options.onDismiss,
      ...options,
    };

    setErrorsState(prev => ({
      ...prev,
      [errorId]: errorState
    }));

    console.error(`🚨 Error set for ${errorId}:`, error);
  }, []);

  const clearError = useCallback((errorId: string) => {
    setErrorsState(prev => {
      const { [errorId]: removed, ...rest } = prev;
      return rest;
    });
    
    // Reset retry count when error is cleared
    if (retryAttempts.current[errorId]) {
      delete retryAttempts.current[errorId];
    }
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrorsState({});
    retryAttempts.current = {};
  }, []);

  const isAnyLoading = useCallback(() => {
    if (globalLoading.isLoading) return true;
    
    const pageLoadingValues = Object.values(pageLoading);
    if (pageLoadingValues.some(loading => loading.isLoading)) return true;
    
    const componentLoadingValues = Object.values(componentLoading);
    return componentLoadingValues.some(loading => loading.isLoading);
  }, [globalLoading.isLoading, pageLoading, componentLoading]);

  const hasErrors = useCallback(() => {
    return Object.keys(errors).length > 0;
  }, [errors]);

  const getLoadingMessage = useCallback(() => {
    if (globalLoading.isLoading && globalLoading.message) {
      return globalLoading.message;
    }
    
    const pageLoadingValues = Object.values(pageLoading);
    const pageMessage = pageLoadingValues.find(loading => loading.isLoading && loading.message)?.message;
    if (pageMessage) return pageMessage;
    
    const componentLoadingValues = Object.values(componentLoading);
    const componentMessage = componentLoadingValues.find(loading => loading.isLoading && loading.message)?.message;
    return componentMessage;
  }, [globalLoading, pageLoading, componentLoading]);

  // Enhanced retry function that tracks attempts
  const createRetryFunction = useCallback((errorId: string, originalRetry?: () => void) => {
    return () => {
      const currentRetries = retryAttempts.current[errorId] || 0;
      
      if (currentRetries >= maxRetries) {
        console.warn(`🚨 Max retries (${maxRetries}) reached for ${errorId}`);
        return;
      }
      
      retryAttempts.current[errorId] = currentRetries + 1;
      console.log(`🔄 Retry attempt ${currentRetries + 1} for ${errorId}`);
      
      // Update error state to reflect new retry count
      setErrorsState(prev => {
        const currentError = prev[errorId];
        if (currentError) {
          return {
            ...prev,
            [errorId]: {
              ...currentError,
              retryCount: currentRetries + 1,
              canRetry: currentRetries + 1 < maxRetries,
            }
          };
        }
        return prev;
      });
      
      if (originalRetry) {
        originalRetry();
      }
    };
  }, []);

  // Update error states to use enhanced retry function
  const enhancedSetError = useCallback((errorId: string, error: Error, options: Partial<ErrorState> = {}) => {
    const enhancedRetry = options.onRetry ? createRetryFunction(errorId, options.onRetry) : undefined;
    setError(errorId, error, { ...options, onRetry: enhancedRetry });
  }, [setError, createRetryFunction]);

  const value: LoadingContextType = {
    globalLoading,
    setGlobalLoading,
    clearGlobalLoading,
    pageLoading,
    setPageLoading,
    clearPageLoading,
    componentLoading,
    setComponentLoading,
    clearComponentLoading,
    errors,
    setError: enhancedSetError,
    clearError,
    clearAllErrors,
    isAnyLoading,
    hasErrors,
    getLoadingMessage,
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

// Specialized hooks for different loading scenarios
export function usePageLoading(pageId: string) {
  const { pageLoading, setPageLoading, clearPageLoading } = useLoading();
  
  return {
    loading: pageLoading[pageId] || defaultLoadingState,
    setLoading: (loading: Partial<LoadingState>) => setPageLoading(pageId, loading),
    clearLoading: () => clearPageLoading(pageId),
  };
}

export function useComponentLoading(componentId: string) {
  const { componentLoading, setComponentLoading, clearComponentLoading } = useLoading();
  
  return {
    loading: componentLoading[componentId] || defaultLoadingState,
    setLoading: (loading: Partial<LoadingState>) => setComponentLoading(componentId, loading),
    clearLoading: () => clearComponentLoading(componentId),
  };
}

export function useErrorHandler(errorId: string) {
  const { errors, setError, clearError } = useLoading();
  
  return {
    error: errors[errorId] || null,
    setError: (error: Error, options?: Partial<ErrorState>) => setError(errorId, error, options),
    clearError: () => clearError(errorId),
  };
}