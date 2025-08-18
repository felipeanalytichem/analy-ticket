import { supabase } from '@/lib/supabase';
import { ErrorRecoveryManager, QueuedAction, ErrorContext } from './ErrorRecoveryManager';

export interface ApiRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries?: number;
    baseDelay?: number;
    enableCache?: boolean;
  };
  cacheKey?: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  error: any;
  status: number;
  headers: Record<string, string>;
}

export interface InterceptorConfig {
  enableRetry: boolean;
  enableCache: boolean;
  enableAuth: boolean;
  defaultTimeout: number;
  maxRetries: number;
  baseDelay: number;
}

export class ApiInterceptor {
  private errorRecoveryManager: ErrorRecoveryManager;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private config: InterceptorConfig;

  constructor(
    errorRecoveryManager: ErrorRecoveryManager,
    config: Partial<InterceptorConfig> = {}
  ) {
    this.errorRecoveryManager = errorRecoveryManager;
    this.config = {
      enableRetry: true,
      enableCache: true,
      enableAuth: true,
      defaultTimeout: 30000,
      maxRetries: 3,
      baseDelay: 1000,
      ...config
    };

    this.setupSupabaseInterceptors();
  }

  /**
   * Setup Supabase client interceptors
   */
  private setupSupabaseInterceptors(): void {
    // Store original methods
    const originalFrom = supabase.from.bind(supabase);
    const originalRpc = supabase.rpc.bind(supabase);
    const originalStorage = supabase.storage;

    // Intercept table operations
    supabase.from = (table: string) => {
      const builder = originalFrom(table);
      return this.wrapQueryBuilder(builder, table);
    };

    // Intercept RPC calls
    supabase.rpc = (fn: string, args?: any, options?: any) => {
      const rpcCall = originalRpc(fn, args, options);
      return this.wrapPromise(rpcCall, {
        url: `/rpc/${fn}`,
        method: 'POST',
        data: args,
        cacheKey: `rpc-${fn}-${JSON.stringify(args)}`
      });
    };

    // Intercept storage operations
    if (originalStorage) {
      const originalStorageFrom = originalStorage.from.bind(originalStorage);
      supabase.storage.from = (bucketId: string) => {
        const bucket = originalStorageFrom(bucketId);
        return this.wrapStorageBucket(bucket, bucketId);
      };
    }
  }

  /**
   * Wrap Supabase query builder with error handling
   */
  private wrapQueryBuilder(builder: any, table: string): any {
    const interceptor = this;

    // Wrap common query methods
    const methodsToWrap = ['select', 'insert', 'update', 'delete', 'upsert'];
    
    methodsToWrap.forEach(method => {
      if (builder[method]) {
        const originalMethod = builder[method].bind(builder);
        builder[method] = function(...args: any[]) {
          const result = originalMethod(...args);
          
          // If this returns a promise-like object, wrap it
          if (result && typeof result.then === 'function') {
            return interceptor.wrapPromise(result, {
              url: `/rest/v1/${table}`,
              method: method.toUpperCase() as any,
              data: args,
              cacheKey: interceptor.generateCacheKey(table, method, args)
            });
          }
          
          return result;
        };
      }
    });

    return builder;
  }

  /**
   * Wrap storage bucket operations
   */
  private wrapStorageBucket(bucket: any, bucketId: string): any {
    const interceptor = this;

    // Wrap storage methods
    const methodsToWrap = ['upload', 'download', 'list', 'remove', 'copy', 'move'];
    
    methodsToWrap.forEach(method => {
      if (bucket[method]) {
        const originalMethod = bucket[method].bind(bucket);
        bucket[method] = function(...args: any[]) {
          const result = originalMethod(...args);
          
          if (result && typeof result.then === 'function') {
            return interceptor.wrapPromise(result, {
              url: `/storage/v1/object/${bucketId}`,
              method: method === 'upload' ? 'POST' : 'GET',
              data: args,
              cacheKey: `storage-${bucketId}-${method}-${JSON.stringify(args)}`
            });
          }
          
          return result;
        };
      }
    });

    return bucket;
  }

  /**
   * Wrap promise with error handling and retry logic
   */
  private async wrapPromise<T>(
    promise: Promise<T>, 
    requestConfig: ApiRequestConfig
  ): Promise<T> {
    const requestId = this.generateRequestId(requestConfig);
    
    // Check if this request is already in progress
    if (this.requestQueue.has(requestId)) {
      return this.requestQueue.get(requestId);
    }

    const wrappedPromise = this.executeWithRetry(promise, requestConfig);
    this.requestQueue.set(requestId, wrappedPromise);

    try {
      const result = await wrappedPromise;
      this.requestQueue.delete(requestId);
      return result;
    } catch (error) {
      this.requestQueue.delete(requestId);
      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    promise: Promise<T>,
    requestConfig: ApiRequestConfig,
    retryCount: number = 0
  ): Promise<T> {
    const maxRetries = requestConfig.retryConfig?.maxRetries ?? this.config.maxRetries;
    
    try {
      // Add timeout if specified
      const timeoutPromise = requestConfig.timeout 
        ? this.withTimeout(promise, requestConfig.timeout)
        : promise;

      const result = await timeoutPromise;
      
      // Cache successful responses if enabled
      if (this.config.enableCache && requestConfig.cacheKey && this.isReadOperation(requestConfig)) {
        this.errorRecoveryManager.setCachedData(requestConfig.cacheKey, result);
      }

      return result;

    } catch (error) {
      // Create action for error recovery
      const action: QueuedAction = {
        id: this.generateRequestId(requestConfig),
        type: `${requestConfig.method}_${requestConfig.url}`,
        payload: requestConfig.data,
        timestamp: new Date(),
        retryCount,
        maxRetries,
        originalRequest: () => this.executeWithRetry(promise, requestConfig, retryCount + 1)
      };

      const context: ErrorContext = {
        action,
        cacheKey: requestConfig.cacheKey,
        userMessage: this.generateUserMessage(requestConfig, error)
      };

      try {
        // Let error recovery manager handle the error
        const recoveredResult = await this.errorRecoveryManager.handleError(error, context);
        
        if (recoveredResult !== null) {
          return recoveredResult;
        }

        // If no recovery result and we can retry
        if (retryCount < maxRetries) {
          const delay = this.calculateRetryDelay(retryCount, requestConfig.retryConfig?.baseDelay);
          await this.delay(delay);
          return this.executeWithRetry(promise, requestConfig, retryCount + 1);
        }

        throw error;

      } catch (recoveryError) {
        // If recovery failed and we can still retry
        if (retryCount < maxRetries) {
          const delay = this.calculateRetryDelay(retryCount, requestConfig.retryConfig?.baseDelay);
          await this.delay(delay);
          return this.executeWithRetry(promise, requestConfig, retryCount + 1);
        }

        throw recoveryError;
      }
    }
  }

  /**
   * Add timeout to promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number, baseDelay?: number): number {
    const base = baseDelay ?? this.config.baseDelay;
    const delay = Math.min(base * Math.pow(2, retryCount), 30000);
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Create delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(config: ApiRequestConfig): string {
    const { url, method, data } = config;
    const dataHash = data ? JSON.stringify(data) : '';
    return `${method}-${url}-${btoa(dataHash).slice(0, 8)}`;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(table: string, method: string, args: any[]): string {
    const argsHash = btoa(JSON.stringify(args)).slice(0, 8);
    return `${table}-${method}-${argsHash}`;
  }

  /**
   * Check if operation is read-only
   */
  private isReadOperation(config: ApiRequestConfig): boolean {
    return config.method === 'GET' || 
           config.url.includes('select') || 
           config.url.includes('rpc') && !config.data;
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(config: ApiRequestConfig, error: any): string {
    const operation = this.getOperationName(config);
    
    if (error.status === 401) {
      return 'Your session has expired. Please log in again.';
    }
    
    if (error.status === 403) {
      return `You don't have permission to ${operation}.`;
    }
    
    if (error.status === 404) {
      return `The requested ${operation} could not be found.`;
    }
    
    if (error.status >= 500) {
      return `Server error occurred while ${operation}. Please try again.`;
    }
    
    if (error.name === 'NetworkError' || !navigator.onLine) {
      return `Network error occurred while ${operation}. Please check your connection.`;
    }
    
    return `An error occurred while ${operation}. Please try again.`;
  }

  /**
   * Get human-readable operation name
   */
  private getOperationName(config: ApiRequestConfig): string {
    const { method, url } = config;
    
    if (url.includes('/rpc/')) {
      return 'executing function';
    }
    
    if (url.includes('/storage/')) {
      return 'accessing file';
    }
    
    switch (method) {
      case 'GET':
        return 'loading data';
      case 'POST':
        return 'creating record';
      case 'PUT':
      case 'PATCH':
        return 'updating record';
      case 'DELETE':
        return 'deleting record';
      default:
        return 'processing request';
    }
  }

  /**
   * Manual API request with full error handling
   */
  async request<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    const { url, method, data, headers = {} } = config;

    // Add authentication headers if enabled
    if (this.config.enableAuth) {
      const session = await supabase.auth.getSession();
      if (session.data.session?.access_token) {
        headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
      }
    }

    // Create fetch promise
    const fetchPromise = fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: data ? JSON.stringify(data) : undefined
    }).then(async response => {
      const responseData = await response.json().catch(() => null);
      
      return {
        data: responseData,
        error: response.ok ? null : responseData,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    });

    return this.wrapPromise(fetchPromise, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): InterceptorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InterceptorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear request queue
   */
  clearQueue(): void {
    this.requestQueue.clear();
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; requests: string[] } {
    return {
      size: this.requestQueue.size,
      requests: Array.from(this.requestQueue.keys())
    };
  }
}

// Create and export singleton instance
export const apiInterceptor = new ApiInterceptor(
  new ErrorRecoveryManager({
    enableCache: true,
    enableQueue: true,
    userNotification: true
  })
);