import { toast } from 'sonner';

export interface NetworkErrorInfo {
  type: 'insufficient_resources' | 'failed_fetch' | 'network_error' | 'timeout' | 'unknown';
  originalError: Error;
  retryable: boolean;
  suggestedDelay: number;
}

export interface NetworkRetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBackoff?: boolean;
  jitter?: boolean;
}

/**
 * Analyzes network errors and provides structured information about them
 */
export function analyzeNetworkError(error: any): NetworkErrorInfo {
  const errorMessage = error?.message || '';
  const errorDetails = error?.details || '';
  
  // Check for specific network error types
  if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') || 
      errorDetails.includes('ERR_INSUFFICIENT_RESOURCES')) {
    return {
      type: 'insufficient_resources',
      originalError: error,
      retryable: true,
      suggestedDelay: 5000, // 5 seconds for resource issues - longer delay to prevent cascading
    };
  }
  
  if (errorMessage.includes('Failed to fetch') || 
      errorDetails.includes('Failed to fetch')) {
    return {
      type: 'failed_fetch',
      originalError: error,
      retryable: true,
      suggestedDelay: 1500, // 1.5 seconds for fetch failures
    };
  }
  
  if (errorMessage.includes('NetworkError') || 
      errorMessage.includes('network') ||
      errorMessage.includes('NETWORK_ERROR')) {
    return {
      type: 'network_error',
      originalError: error,
      retryable: true,
      suggestedDelay: 3000, // 3 seconds for general network errors
    };
  }
  
  if (errorMessage.includes('timeout') || 
      errorMessage.includes('TIMEOUT')) {
    return {
      type: 'timeout',
      originalError: error,
      retryable: true,
      suggestedDelay: 5000, // 5 seconds for timeouts
    };
  }
  
  return {
    type: 'unknown',
    originalError: error,
    retryable: false,
    suggestedDelay: 1000,
  };
}

/**
 * Creates a retry function with exponential backoff for network errors
 */
export function createNetworkRetryHandler<T>(
  operation: () => Promise<T>,
  options: NetworkRetryOptions = {}
): (error: any) => Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    exponentialBackoff = true,
    jitter = true,
  } = options;

  return async function retryHandler(initialError: any): Promise<T> {
    const errorInfo = analyzeNetworkError(initialError);
    
    if (!errorInfo.retryable) {
      throw initialError;
    }

    let lastError = initialError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Calculate delay with exponential backoff and jitter
        let delay = exponentialBackoff 
          ? Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
          : baseDelay;
        
        // Add jitter to prevent thundering herd
        if (jitter) {
          delay = delay + (Math.random() * delay * 0.1);
        }
        
        // Use suggested delay from error analysis if it's the first retry
        if (attempt === 1) {
          delay = Math.max(delay, errorInfo.suggestedDelay);
        }
        
        console.log(`🔄 Network retry attempt ${attempt}/${maxRetries} after ${Math.round(delay)}ms delay`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Attempt the operation again
        const result = await operation();
        
        console.log(`✅ Network retry succeeded on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        lastError = error;
        const retryErrorInfo = analyzeNetworkError(error);
        
        console.log(`❌ Network retry attempt ${attempt} failed:`, retryErrorInfo.type);
        
        // If this error type is not retryable, stop trying
        if (!retryErrorInfo.retryable) {
          console.log(`🚫 Error type ${retryErrorInfo.type} is not retryable, stopping`);
          break;
        }
        
        // If this is the last attempt, we'll throw the error
        if (attempt === maxRetries) {
          console.log(`🚨 All ${maxRetries} retry attempts exhausted`);
        }
      }
    }
    
    // All retries failed, throw the last error
    throw lastError;
  };
}

/**
 * Wraps a Supabase operation with network error handling and retries
 */
export function withNetworkErrorHandling<T>(
  operation: () => Promise<T>,
  options: NetworkRetryOptions & { 
    showToast?: boolean;
    operationName?: string;
  } = {}
): Promise<T> {
  const { showToast = true, operationName = 'operation', ...retryOptions } = options;
  
  // For insufficient resources errors, use more conservative retry settings
  const defaultRetryOptions = {
    maxRetries: 2, // Reduced from 3 to prevent cascading
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBackoff: true,
    jitter: true,
    ...retryOptions
  };
  
  return operation().catch(async (error) => {
    const errorInfo = analyzeNetworkError(error);
    
    console.error(`🚨 Network error in ${operationName}:`, errorInfo);
    
    if (errorInfo.retryable) {
      if (showToast) {
        toast.loading(`Network issue detected, retrying ${operationName}...`, {
          id: `network-retry-${operationName}`,
        });
      }
      
      try {
        const retryHandler = createNetworkRetryHandler(operation, defaultRetryOptions);
        const result = await retryHandler(error);
        
        if (showToast) {
          toast.dismiss(`network-retry-${operationName}`);
          toast.success(`${operationName} completed successfully`);
        }
        
        return result;
      } catch (finalError) {
        if (showToast) {
          toast.dismiss(`network-retry-${operationName}`);
          
          const finalErrorInfo = analyzeNetworkError(finalError);
          let errorMessage = `${operationName} failed`;
          let description = 'Please try again later';
          
          switch (finalErrorInfo.type) {
            case 'insufficient_resources':
              description = 'Server resources are temporarily unavailable. Please wait a moment and try again.';
              break;
            case 'failed_fetch':
              description = 'Network connection failed. Please check your internet connection.';
              break;
            case 'network_error':
              description = 'Network error occurred. Please check your connection and try again.';
              break;
            case 'timeout':
              description = 'Request timed out. Please try again.';
              break;
          }
          
          toast.error(errorMessage, {
            description,
            action: {
              label: 'Retry',
              onClick: () => {
                // Trigger a manual retry
                withNetworkErrorHandling(operation, options);
              },
            },
          });
        }
        
        throw finalError;
      }
    } else {
      // Non-retryable error, show appropriate message
      if (showToast) {
        toast.error(`${operationName} failed`, {
          description: errorInfo.originalError.message || 'An unexpected error occurred',
        });
      }
      
      throw error;
    }
  });
}

/**
 * Enhanced Supabase client wrapper that automatically handles network errors
 */
export function createNetworkAwareSupabaseWrapper(supabaseClient: any) {
  return {
    from: (table: string) => {
      const query = supabaseClient.from(table);
      
      // Wrap common query methods with network error handling
      const originalSelect = query.select.bind(query);
      const originalInsert = query.insert.bind(query);
      const originalUpdate = query.update.bind(query);
      const originalDelete = query.delete.bind(query);
      const originalUpsert = query.upsert.bind(query);
      
      return {
        ...query,
        select: (...args: any[]) => {
          const selectQuery = originalSelect(...args);
          const originalExecute = selectQuery.then?.bind(selectQuery) || (() => selectQuery);
          
          return {
            ...selectQuery,
            then: (onFulfilled?: any, onRejected?: any) => {
              return withNetworkErrorHandling(
                () => originalExecute(),
                { operationName: `select from ${table}` }
              ).then(onFulfilled, onRejected);
            },
          };
        },
        
        insert: (...args: any[]) => {
          const insertQuery = originalInsert(...args);
          const originalExecute = insertQuery.then?.bind(insertQuery) || (() => insertQuery);
          
          return {
            ...insertQuery,
            then: (onFulfilled?: any, onRejected?: any) => {
              return withNetworkErrorHandling(
                () => originalExecute(),
                { operationName: `insert into ${table}` }
              ).then(onFulfilled, onRejected);
            },
          };
        },
        
        update: (...args: any[]) => {
          const updateQuery = originalUpdate(...args);
          const originalExecute = updateQuery.then?.bind(updateQuery) || (() => updateQuery);
          
          return {
            ...updateQuery,
            then: (onFulfilled?: any, onRejected?: any) => {
              return withNetworkErrorHandling(
                () => originalExecute(),
                { operationName: `update ${table}` }
              ).then(onFulfilled, onRejected);
            },
          };
        },
        
        delete: (...args: any[]) => {
          const deleteQuery = originalDelete(...args);
          const originalExecute = deleteQuery.then?.bind(deleteQuery) || (() => deleteQuery);
          
          return {
            ...deleteQuery,
            then: (onFulfilled?: any, onRejected?: any) => {
              return withNetworkErrorHandling(
                () => originalExecute(),
                { operationName: `delete from ${table}` }
              ).then(onFulfilled, onRejected);
            },
          };
        },
        
        upsert: (...args: any[]) => {
          const upsertQuery = originalUpsert(...args);
          const originalExecute = upsertQuery.then?.bind(upsertQuery) || (() => upsertQuery);
          
          return {
            ...upsertQuery,
            then: (onFulfilled?: any, onRejected?: any) => {
              return withNetworkErrorHandling(
                () => originalExecute(),
                { operationName: `upsert into ${table}` }
              ).then(onFulfilled, onRejected);
            },
          };
        },
      };
    },
    
    auth: {
      ...supabaseClient.auth,
      getSession: () => withNetworkErrorHandling(
        () => supabaseClient.auth.getSession(),
        { operationName: 'get session', showToast: false }
      ),
      refreshSession: () => withNetworkErrorHandling(
        () => supabaseClient.auth.refreshSession(),
        { operationName: 'refresh session', showToast: false }
      ),
      signInWithPassword: (credentials: any) => withNetworkErrorHandling(
        () => supabaseClient.auth.signInWithPassword(credentials),
        { operationName: 'sign in' }
      ),
      signUp: (credentials: any) => withNetworkErrorHandling(
        () => supabaseClient.auth.signUp(credentials),
        { operationName: 'sign up' }
      ),
      signOut: () => withNetworkErrorHandling(
        () => supabaseClient.auth.signOut(),
        { operationName: 'sign out', showToast: false }
      ),
    },
  };
}