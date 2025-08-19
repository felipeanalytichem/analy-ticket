import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

// Use the same hardcoded values as in integrations/supabase/client.ts
const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U"

// Enhanced configuration interface
interface EnhancedSupabaseConfig {
  url: string;
  anonKey: string;
  auth: {
    autoRefreshToken: boolean;
    persistSession: boolean;
    detectSessionInUrl: boolean;
    flowType: 'pkce' | 'implicit';
    storage?: Storage;
    storageKey?: string;
    debug?: boolean;
  };
  global?: {
    headers?: Record<string, string>;
  };
}

// Client health status interface
interface ClientHealthStatus {
  isHealthy: boolean;
  isCorrupted: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  lastError?: Error;
  canRecover: boolean;
}

// Debug logging utility
const debugLog = (message: string, data?: any) => {
  if (typeof window !== 'undefined' && window.localStorage?.getItem('supabase-debug') === 'true') {
    console.log(`[Supabase Debug] ${message}`, data || '');
  }
};

// Error tracking
let clientErrorCount = 0;
let lastClientError: Error | null = null;
let clientHealthStatus: ClientHealthStatus = {
  isHealthy: true,
  isCorrupted: false,
  lastHealthCheck: new Date(),
  errorCount: 0,
  canRecover: true
};

// Enhanced Supabase configuration with error handling
const enhancedConfig: EnhancedSupabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: process.env.NODE_ENV === 'development',
    storageKey: 'sb-auth-token'
  },
  global: {
    headers: {
      'X-Client-Info': 'analy-ticket-enhanced'
    }
  }
};

// Create the enhanced Supabase client with error handling
let supabaseClient: SupabaseClient<Database> | null = null;

const createEnhancedSupabaseClient = (): SupabaseClient<Database> => {
  try {
    debugLog('Creating enhanced Supabase client', { config: enhancedConfig });
    
    // Clear any problematic localStorage keys that might cause _acquireLock errors
    try {
      const problematicKeys = Object.keys(localStorage).filter(key => 
        key.includes('sb-') && (key.includes('lock') || key.includes('session'))
      );
      problematicKeys.forEach(key => {
        localStorage.removeItem(key);
        debugLog('Removed problematic localStorage key', { key });
      });
    } catch (storageError) {
      debugLog('Could not clear localStorage', { error: storageError });
    }
    
    const client = createClient<Database>(
      enhancedConfig.url,
      enhancedConfig.anonKey,
      {
        auth: enhancedConfig.auth,
        global: enhancedConfig.global,
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
          timeout: 60000, // 60 seconds
          heartbeatIntervalMs: 30000, // 30 seconds  
          reconnectAfterMs: 5000, // 5 seconds
        }
      }
    );

    // Add error event listeners to detect client issues
    if (client.auth) {
      client.auth.onAuthStateChange((event, session) => {
        debugLog('Auth state change', { event, hasSession: !!session });
        
        if (event === 'SIGNED_OUT' && session === null) {
          // Reset error count on successful sign out
          clientErrorCount = 0;
          lastClientError = null;
          updateClientHealth(true, false);
        }
      });
    }

    updateClientHealth(true, false);
    debugLog('Enhanced Supabase client created successfully');
    return client;
  } catch (error) {
    const err = error as Error;
    debugLog('Failed to create Supabase client', { error: err.message });
    
    clientErrorCount++;
    lastClientError = err;
    updateClientHealth(false, true);
    
    throw new Error(`Failed to initialize Supabase client: ${err.message}`);
  }
};

// Update client health status
const updateClientHealth = (isHealthy: boolean, isCorrupted: boolean) => {
  clientHealthStatus = {
    isHealthy,
    isCorrupted,
    lastHealthCheck: new Date(),
    errorCount: clientErrorCount,
    lastError: lastClientError,
    canRecover: clientErrorCount < 5 // Allow recovery if error count is manageable
  };
};

// Initialize the client
const initializeClient = (): SupabaseClient<Database> => {
  if (!supabaseClient || !validateClientHealth()) {
    debugLog('Initializing new Supabase client');
    supabaseClient = createEnhancedSupabaseClient();
  }
  return supabaseClient;
};

// Client health validation
const validateClientHealth = (): boolean => {
  if (!supabaseClient) {
    debugLog('Client health check: No client instance');
    return false;
  }

  try {
    // Check if essential methods exist (detect _acquireLock issue)
    if (!supabaseClient.auth) {
      debugLog('Client health check: Missing auth object');
      updateClientHealth(false, true);
      return false;
    }

    // Check for the specific _acquireLock method that's causing issues
    const authClient = supabaseClient.auth as any;
    if (authClient._acquireLock && typeof authClient._acquireLock !== 'function') {
      debugLog('Client health check: _acquireLock method corrupted');
      updateClientHealth(false, true);
      return false;
    }

    // Validate client configuration (check if client has basic properties)
    if (!supabaseClient.from || !supabaseClient.auth) {
      debugLog('Client health check: Missing essential client methods');
      updateClientHealth(false, true);
      return false;
    }

    debugLog('Client health check: Passed');
    updateClientHealth(true, false);
    return true;
  } catch (error) {
    const err = error as Error;
    debugLog('Client health check failed', { error: err.message });
    
    clientErrorCount++;
    lastClientError = err;
    updateClientHealth(false, true);
    return false;
  }
};

// Client corruption detection
export const detectClientCorruption = (): boolean => {
  try {
    if (!supabaseClient) return false;

    // Check for missing or corrupted methods
    const requiredMethods = ['auth', 'from', 'rpc', 'storage'];
    for (const method of requiredMethods) {
      if (!(method in supabaseClient)) {
        debugLog(`Client corruption detected: Missing ${method} method`);
        return true;
      }
    }

    // Check auth object integrity
    if (supabaseClient.auth) {
      const authMethods = ['signIn', 'signOut', 'getSession', 'getUser'];
      for (const method of authMethods) {
        if (typeof (supabaseClient.auth as any)[method] !== 'function') {
          debugLog(`Client corruption detected: Auth method ${method} is not a function`);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    debugLog('Error during corruption detection', { error: (error as Error).message });
    return true;
  }
};

// Client reinitialization for recovery scenarios
export const reinitializeClient = async (): Promise<SupabaseClient<Database>> => {
  try {
    debugLog('Reinitializing Supabase client');
    
    // Clear any corrupted session data
    await clearCorruptedSessionData();
    
    // Reset error tracking
    clientErrorCount = 0;
    lastClientError = null;
    
    // Force create new client
    supabaseClient = null;
    supabaseClient = createEnhancedSupabaseClient();
    
    debugLog('Client reinitialization completed');
    return supabaseClient;
  } catch (error) {
    const err = error as Error;
    debugLog('Client reinitialization failed', { error: err.message });
    throw new Error(`Failed to reinitialize client: ${err.message}`);
  }
};

// Clear corrupted session data
const clearCorruptedSessionData = async (): Promise<void> => {
  try {
    debugLog('Clearing potentially corrupted session data');
    
    // Clear localStorage items related to Supabase
    const keysToRemove = [
      'sb-auth-token',
      'supabase.auth.token',
      'sb-plbmgjqitlxedsmdqpld-auth-token'
    ];
    
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignore storage errors
      }
    });
    
    debugLog('Session data cleanup completed');
  } catch (error) {
    debugLog('Error during session cleanup', { error: (error as Error).message });
  }
};

// Get client health status
export const getClientHealthStatus = (): ClientHealthStatus => {
  return { ...clientHealthStatus };
};

// Safe client getter with automatic recovery
export const getSupabaseClient = (): SupabaseClient<Database> => {
  try {
    return initializeClient();
  } catch (error) {
    const err = error as Error;
    debugLog('Failed to get Supabase client', { error: err.message });
    
    // If we can't recover, throw the error
    if (!clientHealthStatus.canRecover) {
      throw new Error(`Supabase client is unrecoverable: ${err.message}`);
    }
    
    // Attempt one more recovery
    try {
      return createEnhancedSupabaseClient();
    } catch (recoveryError) {
      throw new Error(`Client recovery failed: ${(recoveryError as Error).message}`);
    }
  }
};

// Export the client instance directly - let the session recovery handle errors
export const supabase = getSupabaseClient();

/**
 * Get detailed session information for debugging
 */
export const getSessionInfo = async () => {
  try {
    debugLog('Getting session information');
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error || !session) {
      debugLog('No session found', { error: error?.message });
      return {
        hasSession: false,
        error: error?.message || 'No session found'
      };
    }
    
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    const timeLeft = expiresAt - now;
    
    const sessionInfo = {
      hasSession: true,
      userId: session.user.id,
      email: session.user.email,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      timeLeftSeconds: timeLeft,
      timeLeftMinutes: Math.floor(timeLeft / 60),
      isExpired: timeLeft <= 0,
      expiresWithin5Min: timeLeft < 300,
      expiresWithin1Min: timeLeft < 60
    };
    
    debugLog('Session information retrieved', sessionInfo);
    return sessionInfo;
  } catch (error) {
    const err = error as Error;
    debugLog('Error getting session info', { error: err.message });
    
    // Check for _acquireLock error specifically
    if (err.message.includes('_acquireLock is not a function')) {
      debugLog('Detected _acquireLock error in getSessionInfo, attempting recovery');
      try {
        await reinitializeClient();
        // Retry once after recovery
        const client = getSupabaseClient();
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error || !session) {
          return {
            hasSession: false,
            error: error?.message || 'No session found after recovery'
          };
        }
        
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at || 0;
        const timeLeft = expiresAt - now;
        
        return {
          hasSession: true,
          userId: session.user.id,
          email: session.user.email,
          expiresAt: new Date(expiresAt * 1000).toISOString(),
          timeLeftSeconds: timeLeft,
          timeLeftMinutes: Math.floor(timeLeft / 60),
          isExpired: timeLeft <= 0,
          expiresWithin5Min: timeLeft < 300,
          expiresWithin1Min: timeLeft < 60
        };
      } catch (recoveryError) {
        return {
          hasSession: false,
          error: `Recovery failed: ${(recoveryError as Error).message}`
        };
      }
    }
    
    return {
      hasSession: false,
      error: err.message
    };
  }
};

/**
 * Check if the current session is ready for real-time connections
 * Since Supabase handles automatic token refresh, we only need to check if we have a valid session
 */
export const isSessionReadyForRealtime = async (): Promise<boolean> => {
  try {
    debugLog('Checking session readiness for realtime');
    const client = getSupabaseClient();
    const { data: { session }, error } = await client.auth.getSession();
    
    if (error || !session) {
      debugLog('No valid session found for realtime', { error: error?.message });
      return false;
    }
    
    // Check if the access token is valid and not expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    
    if (expiresAt <= now) {
      debugLog('Session expired, not ready for realtime');
      return false;
    }
    
    // Since autoRefreshToken is enabled, we can be more lenient
    // Only reject if the token expires in less than 1 minute (instead of 5 minutes)
    const timeLeft = expiresAt - now;
    if (timeLeft < 60) { // Less than 1 minute
      debugLog('Session expires very soon, waiting for refresh', { timeLeft });
      return false;
    }
    
    debugLog(`Session ready for realtime (expires in ${Math.floor(timeLeft / 60)} minutes)`);
    return true;
  } catch (error) {
    const err = error as Error;
    debugLog('Error checking session readiness', { error: err.message });
    
    // Handle _acquireLock error specifically
    if (err.message.includes('_acquireLock is not a function')) {
      debugLog('Detected _acquireLock error in session readiness check, attempting recovery');
      try {
        await reinitializeClient();
        // Retry once after recovery
        const client = getSupabaseClient();
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error || !session) {
          return false;
        }
        
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = session.expires_at || 0;
        const timeLeft = expiresAt - now;
        
        return expiresAt > now && timeLeft >= 60;
      } catch (recoveryError) {
        debugLog('Recovery failed in session readiness check', { error: (recoveryError as Error).message });
        return false;
      }
    }
    
    return false;
  }
};

/**
 * Enable debug logging for Supabase operations
 */
export const enableDebugLogging = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('supabase-debug', 'true');
    debugLog('Debug logging enabled');
  }
};

/**
 * Disable debug logging for Supabase operations
 */
export const disableDebugLogging = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('supabase-debug');
    console.log('[Supabase Debug] Debug logging disabled');
  }
};

/**
 * Perform a comprehensive health check on the Supabase client
 */
export const performHealthCheck = async (): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  client: ClientHealthStatus;
  session: any;
  connectivity: boolean;
  recommendations: string[];
}> => {
  debugLog('Performing comprehensive health check');
  
  const recommendations: string[] = [];
  let connectivity = false;
  let sessionInfo = null;
  
  try {
    // Test basic connectivity
    const client = getSupabaseClient();
    connectivity = true;
    
    // Test session functionality
    sessionInfo = await getSessionInfo();
    
    // Test a simple query to verify database connectivity
    try {
      await client.from('users').select('count').limit(1);
      connectivity = true;
    } catch (queryError) {
      connectivity = false;
      recommendations.push('Database connectivity issues detected');
    }
    
    // Validate client health
    const isHealthy = validateClientHealth();
    const clientHealth = getClientHealthStatus();
    
    // Generate recommendations
    if (!isHealthy) {
      recommendations.push('Client health issues detected - consider reinitialization');
    }
    
    if (clientHealth.errorCount > 0) {
      recommendations.push(`${clientHealth.errorCount} errors detected - monitor for patterns`);
    }
    
    if (!sessionInfo.hasSession) {
      recommendations.push('No active session - user may need to re-authenticate');
    }
    
    if (sessionInfo.hasSession && sessionInfo.expiresWithin5Min) {
      recommendations.push('Session expires soon - token refresh may be needed');
    }
    
    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!connectivity || !isHealthy || clientHealth.isCorrupted) {
      overall = 'unhealthy';
    } else if (clientHealth.errorCount > 0 || !sessionInfo.hasSession) {
      overall = 'degraded';
    }
    
    const result = {
      overall,
      client: clientHealth,
      session: sessionInfo,
      connectivity,
      recommendations
    };
    
    debugLog('Health check completed', result);
    return result;
  } catch (error) {
    const err = error as Error;
    debugLog('Health check failed', { error: err.message });
    
    return {
      overall: 'unhealthy' as const,
      client: getClientHealthStatus(),
      session: { hasSession: false, error: err.message },
      connectivity: false,
      recommendations: ['Critical error during health check', 'Client reinitialization recommended']
    };
  }
}; 