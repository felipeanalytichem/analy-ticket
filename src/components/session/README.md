# Enhanced Session Management

This enhanced session management system addresses the issue where the application shows a blank page after being idle for some time. It provides automatic session recovery, connection monitoring, and user-friendly error handling.

## The Problem

The current application experiences issues where:
1. After periods of inactivity, users see a blank page
2. Session tokens expire without proper refresh attempts
3. API calls fail silently when tokens are invalid
4. No graceful recovery from connection issues

## The Solution

The enhanced session management system provides:

### 1. Automatic Session Refresh
- Monitors session expiration and refreshes tokens before they expire
- Retries failed refresh attempts with exponential backoff
- Shows user-friendly notifications during refresh process

### 2. Connection Monitoring
- Detects network connectivity issues
- Performs health checks to ensure API connectivity
- Handles offline/online transitions gracefully

### 3. Error Recovery
- Catches and categorizes different types of errors
- Provides fallback mechanisms (cached data, retry options)
- Shows appropriate user notifications with recovery actions

### 4. User-Friendly UI
- Error boundaries to prevent app crashes
- Notification system for session status updates
- Offline mode indicators
- Connection quality indicators

## Quick Integration

To integrate the enhanced session management into your app, replace the current SessionTimeoutManager with the EnhancedSessionManager:

```tsx
// In App.tsx, replace:
import { SessionTimeoutManager } from '@/components/auth/SessionTimeoutManager';

// With:
import { EnhancedSessionManager } from '@/components/session/EnhancedSessionManager';

// Then wrap your app:
function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <EnhancedSessionManager>
          <TicketCountProvider>
            {/* Your existing app content */}
          </TicketCountProvider>
        </EnhancedSessionManager>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

## Advanced Usage

### Using the Enhanced Session Hook

```tsx
import { useEnhancedSession } from '@/hooks/useEnhancedSession';

function MyComponent() {
  const { 
    sessionState, 
    extendSession, 
    forceRefresh,
    performHealthCheck 
  } = useEnhancedSession();

  // Check session status
  if (!sessionState.isValid) {
    return <div>Session invalid, attempting recovery...</div>;
  }

  // Manual session extension
  const handleExtendSession = async () => {
    await extendSession();
  };

  return (
    <div>
      <p>Session Status: {sessionState.isValid ? 'Valid' : 'Invalid'}</p>
      <p>Connection: {sessionState.connectionStatus}</p>
      <button onClick={handleExtendSession}>Extend Session</button>
    </div>
  );
}
```

### Error Notifications

```tsx
import { useErrorNotifications } from '@/components/error/ErrorNotificationSystem';

function MyComponent() {
  const { showError, showWarning, showSuccess } = useErrorNotifications();

  const handleApiCall = async () => {
    try {
      // Your API call
      const result = await api.getData();
      showSuccess('Success', 'Data loaded successfully');
    } catch (error) {
      showError('Error', 'Failed to load data', {
        actions: [{
          label: 'Retry',
          action: () => handleApiCall()
        }]
      });
    }
  };

  return <button onClick={handleApiCall}>Load Data</button>;
}
```

### Error Boundaries

```tsx
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

function MyPage() {
  return (
    <ErrorBoundary level="page" showDetails={true}>
      <MyPageContent />
    </ErrorBoundary>
  );
}
```

## Components Included

### 1. EnhancedSessionManager
- Main wrapper component that provides session management
- Integrates all session-related services
- Provides error boundaries and notifications

### 2. ErrorBoundary
- Catches React errors and provides recovery options
- Different levels: component, page, critical
- Retry functionality with attempt limits

### 3. ErrorNotificationSystem
- Toast-style notifications for errors and status updates
- Auto-dismiss and manual dismiss options
- Action buttons for recovery

### 4. OfflineModeIndicator
- Shows connection status
- Displays pending actions count
- Manual sync and retry options

## Services Included

### 1. SessionManager
- Handles session lifecycle management
- Automatic token refresh
- Cross-tab synchronization

### 2. ConnectionMonitor
- Network connectivity monitoring
- Health checks and quality assessment
- Reconnection with exponential backoff

### 3. ErrorRecoveryManager
- Error categorization and handling
- Retry queues with intelligent backoff
- Caching for fallback data

### 4. ApiInterceptor
- Wraps Supabase client with error handling
- Automatic retry for failed requests
- Request deduplication

## Configuration

The system uses sensible defaults but can be configured:

```tsx
<EnhancedSessionManager
  sessionTimeout={60} // minutes
  warningThreshold={5} // minutes before expiry
  maxRetries={3}
  healthCheckInterval={30} // seconds
>
  {children}
</EnhancedSessionManager>
```

## Benefits

1. **No More Blank Pages**: Automatic session recovery prevents the blank page issue
2. **Better User Experience**: Clear notifications and recovery options
3. **Improved Reliability**: Handles network issues and API failures gracefully
4. **Reduced Support Tickets**: Users can recover from issues without contacting support
5. **Better Debugging**: Comprehensive error logging and monitoring

## Testing

The system includes comprehensive tests for all components and services. Run tests with:

```bash
npm run test -- src/components/error/__tests__/
npm run test -- src/services/__tests__/
```

## Monitoring

In development mode, the system provides detailed logging and debug information. In production, it integrates with your error reporting service for monitoring session issues.