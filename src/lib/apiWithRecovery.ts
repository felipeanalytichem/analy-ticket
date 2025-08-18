import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ApiCallOptions {
  showErrorToast?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Wraps an API call with automatic session recovery
 * This helps prevent the blank page issue by handling auth errors gracefully
 */
export async function apiWithRecovery<T>(
  apiCall: () => Promise<T>,
  options: ApiCallOptions = {}
): Promise<T> {
  const {
    showErrorToast = true,
    maxRetries = 2,
    retryDelay = 1000
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      console.warn(`API call failed (attempt ${attempt + 1}):`, error);

      // Check if it's an authentication error
      if (error.status === 401 || error.code === 'PGRST301' || error.message?.includes('JWT')) {
        console.log('🔄 Auth error detected, attempting token refresh...');
        
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (!refreshError) {
            console.log('✅ Token refreshed, retrying API call...');
            
            // Add a small delay before retry
            if (retryDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            continue; // Retry the API call
          } else {
            console.error('❌ Token refresh failed:', refreshError);
          }
        } catch (refreshError) {
          console.error('❌ Token refresh error:', refreshError);
        }
      }

      // If it's the last attempt or not an auth error, break
      if (attempt === maxRetries || (error.status !== 401 && error.code !== 'PGRST301')) {
        break;
      }

      // Add delay before next retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  // All retries failed
  if (showErrorToast) {
    if (lastError.status === 401) {
      toast.error('Session Expired', {
        description: 'Your session has expired. Please refresh the page or log in again.',
        action: {
          label: 'Refresh Page',
          onClick: () => window.location.reload()
        }
      });
    } else {
      toast.error('Request Failed', {
        description: lastError.message || 'An error occurred while processing your request.',
        action: {
          label: 'Retry',
          onClick: () => apiWithRecovery(apiCall, options)
        }
      });
    }
  }

  throw lastError;
}

/**
 * Wraps Supabase queries with automatic recovery
 */
export function supabaseWithRecovery() {
  return {
    from: (table: string) => ({
      select: (columns?: string) => ({
        execute: () => apiWithRecovery(() => supabase.from(table).select(columns)),
        eq: (column: string, value: any) => ({
          execute: () => apiWithRecovery(() => supabase.from(table).select(columns).eq(column, value)),
          single: () => ({
            execute: () => apiWithRecovery(() => supabase.from(table).select(columns).eq(column, value).single())
          })
        }),
        single: () => ({
          execute: () => apiWithRecovery(() => supabase.from(table).select(columns).single())
        })
      }),
      insert: (data: any) => ({
        execute: () => apiWithRecovery(() => supabase.from(table).insert(data)),
        select: () => ({
          execute: () => apiWithRecovery(() => supabase.from(table).insert(data).select())
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          execute: () => apiWithRecovery(() => supabase.from(table).update(data).eq(column, value)),
          select: () => ({
            execute: () => apiWithRecovery(() => supabase.from(table).update(data).eq(column, value).select())
          })
        })
      }),
      delete: () => ({
        eq: (column: string, value: any) => ({
          execute: () => apiWithRecovery(() => supabase.from(table).delete().eq(column, value))
        })
      })
    })
  };
}

/**
 * Simple wrapper for the most common Supabase operations
 */
export const api = {
  // Get data with automatic recovery
  get: async (table: string, columns = '*', filters?: Record<string, any>) => {
    return apiWithRecovery(async () => {
      let query = supabase.from(table).select(columns);
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    });
  },

  // Get single record with automatic recovery
  getOne: async (table: string, filters: Record<string, any>, columns = '*') => {
    return apiWithRecovery(async () => {
      let query = supabase.from(table).select(columns);
      
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    });
  },

  // Create record with automatic recovery
  create: async (table: string, data: any) => {
    return apiWithRecovery(async () => {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) throw error;
      return result;
    });
  },

  // Update record with automatic recovery
  update: async (table: string, filters: Record<string, any>, data: any) => {
    return apiWithRecovery(async () => {
      let query = supabase.from(table).update(data);
      
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      const { data: result, error } = await query.select();
      if (error) throw error;
      return result;
    });
  },

  // Delete record with automatic recovery
  delete: async (table: string, filters: Record<string, any>) => {
    return apiWithRecovery(async () => {
      let query = supabase.from(table).delete();
      
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
      
      const { error } = await query;
      if (error) throw error;
      return true;
    });
  }
};