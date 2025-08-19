/**
 * Utility function to clear problematic Supabase state that causes _acquireLock errors
 */

export function clearSupabaseState(): void {
  console.log('🧹 Clearing Supabase state to fix _acquireLock errors...');
  
  try {
    // Clear all Supabase-related localStorage keys
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('sb-') || 
        key.includes('supabase') ||
        key.includes('auth-token') ||
        key.includes('lock')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('✅ Removed localStorage key:', key);
    });
    
    // Clear session storage
    sessionStorage.clear();
    console.log('✅ Session storage cleared');
    
    // Clear any problematic cookies
    if (typeof document !== 'undefined') {
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      console.log('✅ Cookies cleared');
    }
    
    console.log('🎉 Supabase state cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing Supabase state:', error);
  }
}

/**
 * Auto-clear on specific errors (throttled to prevent infinite loops)
 */
export function autoFixAcquireLockError(): void {
  let lastAutoFixTime = 0;
  const AUTO_FIX_COOLDOWN = 30000; // 30 seconds between auto-fixes
  
  const originalConsoleError = console.error;
  
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    const now = Date.now();
    
    // Check for _acquireLock error with throttling
    if (message.includes('_acquireLock is not a function') && 
        (now - lastAutoFixTime) > AUTO_FIX_COOLDOWN) {
      
      lastAutoFixTime = now;
      console.log('🚨 Detected _acquireLock error - auto-clearing state (throttled)...');
      clearSupabaseState();
      
      // Show user notification
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          const shouldReload = confirm(
            'Authentication state has been cleared to fix a connection issue. ' +
            'Click OK to refresh the page, or Cancel to continue.'
          );
          
          if (shouldReload) {
            window.location.reload();
          }
        }
      }, 1000);
    }
    
    // Call original console.error
    originalConsoleError.apply(console, args);
  };
}

// Auto-enable the fix
if (typeof window !== 'undefined') {
  autoFixAcquireLockError();
}
