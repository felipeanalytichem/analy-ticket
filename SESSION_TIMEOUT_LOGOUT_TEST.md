# Session Timeout Logout Testing Guide

## Quick Test Instructions

The session timeout logout functionality has been enhanced to properly clear the user session and force logout. Here's how to test it:

### 1. Navigate to Test Page
Go to: `http://localhost:5173/session-timeout-test`

### 2. Test Immediate Logout
1. Click the **"Test Logout"** button
2. Watch the console for logout logs:
   ```
   🧪 Testing manual logout...
   🚪 Starting sign out process...
   🧹 Cleared all local storage auth data
   ✅ Sign out completed successfully
   🔄 Redirecting to login page...
   ```
3. You should be redirected to the login page immediately
4. **CRITICAL TEST**: Refresh the page or navigate back - you should still be on the login page, NOT logged in

### 3. Test Automatic Timeout
1. Log back in and return to the test page
2. Click **"Start"** to begin monitoring  
3. Click **"Force Timeout"** to simulate expired session
4. Watch the console for timeout logs:
   ```
   🧪 Forcing session timeout for testing...
   ⏰ Session timeout - automatically logging out user
   🔐 Calling signOut function...
   ✅ SignOut completed
   🔄 Redirecting to login page...
   ```
5. You should see a red toast notification about session expiration
6. You should be redirected to the login page
7. **CRITICAL TEST**: Refresh the page - you should remain on the login page

### 4. Test Warning Dialog
1. Log back in and return to the test page
2. Click **"Start"** to begin monitoring
3. Click **"Force Warning"** to trigger the warning
4. You should see a yellow toast notification about session expiring soon
5. The warning should have a "Stay Logged In" button that extends the session

### 5. Test Real Timeout (Optional Long Test)
1. Start the 2-minute timer
2. Don't move your mouse or keyboard for 2 minutes
3. At 1.5 minutes (30 seconds remaining), you should see the warning
4. If you don't interact, after 2 minutes you should be automatically logged out

## Expected Behavior

✅ **Success Indicators:**
- Console shows detailed logout process
- localStorage/sessionStorage is cleared
- Immediate redirect to `/login`
- After refresh, you remain on login page (not dashboard)
- Toast notifications appear for timeout events

❌ **Failure Indicators:**
- No redirect after logout
- After refresh, you're back on the dashboard
- Console shows errors during logout
- No toast notifications

## Debugging

If logout isn't working:

1. **Check Console Logs**: Look for errors in the logout process
2. **Check Network Tab**: Verify Supabase signOut call is made
3. **Check Application Tab**: Verify localStorage is cleared
4. **Check URL**: Ensure redirect to `/login` happens

## Technical Details

The enhanced logout process:
1. Calls `supabase.auth.signOut()`
2. Clears all React state (user, session, profile)
3. Removes all auth-related localStorage/sessionStorage keys
4. Forces navigation to `/login` page
5. Has fallback redirect even if errors occur

This ensures complete session termination and prevents any persistence issues. 