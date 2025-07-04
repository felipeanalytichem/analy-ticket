import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

// Use the same hardcoded values as in integrations/supabase/client.ts
const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U"

// Create the Supabase client with proper authentication configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
})

/**
 * Get detailed session information for debugging
 */
export const getSessionInfo = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return {
        hasSession: false,
        error: error?.message || 'No session found'
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
  } catch (error) {
    return {
      hasSession: false,
      error: (error as Error).message
    };
  }
};

/**
 * Check if the current session is ready for real-time connections
 * Since Supabase handles automatic token refresh, we only need to check if we have a valid session
 */
export const isSessionReadyForRealtime = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('No valid session found for realtime');
      return false;
    }
    
    // Check if the access token is valid and not expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    
    if (expiresAt <= now) {
      console.log('Session expired, not ready for realtime');
      return false;
    }
    
    // Since autoRefreshToken is enabled, we can be more lenient
    // Only reject if the token expires in less than 1 minute (instead of 5 minutes)
    const timeLeft = expiresAt - now;
    if (timeLeft < 60) { // Less than 1 minute
      console.log('Session expires very soon, waiting for refresh');
      return false;
    }
    
    console.log(`Session ready for realtime (expires in ${Math.floor(timeLeft / 60)} minutes)`);
    return true;
  } catch (error) {
    console.error('Error checking session readiness:', error);
    return false;
  }
} 