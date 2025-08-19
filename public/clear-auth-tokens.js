// Emergency token clearing script
// Run this in the browser console if you're experiencing auth issues

function clearAllAuthTokens() {
  console.log('🧹 Starting emergency token cleanup...');
  
  try {
    // Clear all localStorage items that might contain auth tokens
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('supabase') || 
        key.includes('auth-token') || 
        key.includes('session') ||
        key.includes('sb-')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('✅ Removed:', key);
    });
    
    // Clear session storage
    sessionStorage.clear();
    console.log('✅ Session storage cleared');
    
    // Clear any cookies (if any)
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    console.log('✅ Cookies cleared');
    
    console.log('🎉 Token cleanup complete! Please refresh the page.');
    
    // Auto-refresh after 3 seconds
    setTimeout(() => {
      console.log('🔄 Auto-refreshing page...');
      window.location.reload();
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error during token cleanup:', error);
  }
}

// Run immediately if called directly
if (typeof window !== 'undefined') {
  console.log('🔧 Auth token clearing script loaded. Run clearAllAuthTokens() to clean up authentication issues.');
}
