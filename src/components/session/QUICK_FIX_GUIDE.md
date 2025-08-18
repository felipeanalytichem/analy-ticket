# Quick Fix for Blank Page Issue

## Problem
After being idle for some time, the application shows a blank page instead of working properly. This happens because:
1. Session tokens expire
2. API calls fail with 401 errors
3. The app doesn't recover gracefully

## Solution Implemented

### 1. SimpleSessionManager
Replaced the problematic `EnhancedSessionManager` with `SimpleSessionManager` that provides:
- Error boundaries to prevent crashes
- Notification system for user feedback
- Session recovery without complex connection monitoring

### 2. Session Recovery Hook
Created `useSessionRecovery` that:
- Automatically detects authentication errors
- Attempts to refresh expired tokens
- Shows user-friendly notifications
- Handles recovery failures gracefully

### 3. API Wrapper with Recovery
Created `apiWithRecovery` utility that:
- Wraps API calls with automatic retry logic
- Refreshes tokens when auth errors occur
- Provides fallback error handling

## How to Use

### For New Components
Use the `api` utility for database operations:

```typescript
import { api } from '@/lib/apiWithRecovery';

// Instead of:
const { data, error } = await supabase.from('tickets').select('*');

// Use:
const data = await api.get('tickets');
```

### For Existing Components
Wrap existing API calls:

```typescript
import { apiWithRecovery } from '@/lib/apiWithRecovery';

// Wrap your existing API call
const data = await apiWithRecovery(async () => {
  const { data, error } = await supabase.from('tickets').select('*');
  if (error) throw error;
  return data;
});
```

### For Manual Session Recovery
Use the session recovery context:

```typescript
import { useSessionRecoveryContext } from '@/components/session/SessionRecoveryProvider';

function MyComponent() {
  const { attemptRecovery, recoveryState } = useSessionRecoveryContext();
  
  const handleRetry = async () => {
    const success = await attemptRecovery();
    if (success) {
      // Retry your operation
    }
  };
  
  return (
    <div>
      {recoveryState.isRecovering && <p>Recovering session...</p>}
      <button onClick={handleRetry}>Retry</button>
    </div>
  );
}
```

## What This Fixes

1. **Blank Page Issue**: Error boundaries prevent the app from crashing
2. **Session Expiration**: Automatic token refresh keeps users logged in
3. **API Failures**: Retry logic handles temporary failures
4. **User Experience**: Clear notifications instead of silent failures

## Testing

To test the fix:
1. Leave the app idle for 30+ minutes
2. Try to perform an action (create ticket, navigate, etc.)
3. The app should automatically recover instead of showing a blank page

## Migration

The fix is already integrated into `App.tsx`. No changes needed for existing components, but new components should use the `api` utility for better reliability.

## Rollback

If issues occur, you can quickly rollback by changing `App.tsx`:

```typescript
// Change this:
import { SimpleSessionManager } from '@/components/session/SimpleSessionManager';

// Back to this:
import { SessionTimeoutManager } from '@/components/auth/SessionTimeoutManager';

// And wrap with SessionTimeoutManager instead of SimpleSessionManager
```