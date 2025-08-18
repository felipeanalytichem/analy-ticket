// Debug script to test UserManagement component loading
console.log('🔍 Debugging UserManagement component...');

// Test if we can access the page
async function testUserManagementPage() {
  try {
    console.log('Testing UserManagement page access...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('❌ Not in browser environment');
      return;
    }
    
    // Check current URL
    console.log('Current URL:', window.location.href);
    
    // Check if we're on the user management page
    const isUserManagementPage = window.location.pathname.includes('/admin/users');
    console.log('Is on user management page:', isUserManagementPage);
    
    // Check for React components in DOM
    const userManagementContainer = document.querySelector('[data-testid="user-management-container"]');
    console.log('UserManagement container found:', !!userManagementContainer);
    
    // Check for loading indicators
    const loadingIndicator = document.querySelector('[data-testid="loading-indicator"]');
    console.log('Loading indicator found:', !!loadingIndicator);
    
    // Check for error states
    const errorState = document.querySelector('[data-testid="error-state"]');
    console.log('Error state found:', !!errorState);
    
    // Check console for errors
    console.log('Checking for console errors...');
    
    // If we have access to React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('✅ React DevTools available');
    } else {
      console.log('❌ React DevTools not available');
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Run the test
testUserManagementPage();

// Also check for common issues
console.log('🔍 Checking for common issues...');

// Check if Supabase client is available
if (typeof window !== 'undefined' && window.supabase) {
  console.log('✅ Supabase client available');
} else {
  console.log('❌ Supabase client not available');
}

// Check authentication state
if (typeof window !== 'undefined' && window.localStorage) {
  const authToken = window.localStorage.getItem('sb-' + 'your-project-ref' + '-auth-token');
  console.log('Auth token exists:', !!authToken);
}