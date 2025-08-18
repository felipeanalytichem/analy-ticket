# Consolidated Loading Hook Documentation

## Overview

The `useConsolidatedLoading` hook is designed to solve the flickering and loading state management issues in the UserManagement component and other parts of the application. It provides a single, predictable interface for managing all loading states, preventing visual conflicts and improving user experience.

## Problem Statement

The original UserManagement component suffered from:
- Multiple overlapping loading states (`authLoading`, `loading`, `isSubmitting`)
- Rapid state transitions causing flickering
- Inconsistent loading indicators
- Complex state management across different operations

## Solution

The consolidated loading hook provides:
- **Single Loading State**: One unified loading state that prevents conflicts
- **Proper State Transitions**: Enforced minimum loading times to prevent flickering
- **Operation Tracking**: Track multiple concurrent operations without conflicts
- **Retry Management**: Built-in retry logic with exponential backoff
- **Progress Support**: Optional progress tracking for long-running operations

## Key Features

### 1. Flicker Prevention
- Enforces minimum loading time (300ms) to prevent rapid state changes
- Smooth transitions between loading and loaded states
- Prevents overlapping loading indicators

### 2. Operation Management
- Track multiple concurrent operations
- Unique operation IDs prevent state conflicts
- Proper cleanup on component unmount

### 3. Error Handling
- Consolidated error state management
- Retry logic with exponential backoff
- Configurable retry limits and delays

### 4. Progress Tracking
- Optional progress updates for long operations
- Progress bounds enforcement (0-100%)
- Custom progress messages

## API Reference

### Hook Signature

```typescript
function useConsolidatedLoading(options?: ConsolidatedLoadingOptions)
```

### Options

```typescript
interface ConsolidatedLoadingOptions {
  maxRetries?: number;        // Default: 3
  retryDelay?: number;        // Default: 1000ms
  onError?: (error: Error, retryCount: number) => void;
  onSuccess?: () => void;
  onStateChange?: (state: LoadingStateManager) => void;
}
```

### Return Value

```typescript
interface LoadingStateManager {
  // State
  isLoading: boolean;
  loadingType: LoadingType;
  loadingPhase: LoadingPhase;
  error: string | null;
  retryCount: number;
  canRetry: boolean;
  operation: string | null;
  progress?: number;
  message?: string;
  
  // Actions
  startLoading: (type: LoadingType, operation: string, message?: string) => string;
  completeLoading: (operationId: string, result?: { error?: string; data?: any }) => void;
  executeWithLoading: <T>(operation: () => Promise<T>, type: LoadingType, operationName: string, message?: string) => Promise<T>;
  retry: () => Promise<void>;
  reset: () => void;
  updateProgress: (progress: number, message?: string) => void;
  setPhase: (phase: LoadingPhase) => void;
  
  // Computed Properties
  hasActiveOperations: boolean;
  isInitialLoad: boolean;
  isRefreshing: boolean;
  isSubmitting: boolean;
  isPerformingAction: boolean;
}
```

### Types

```typescript
type LoadingType = 'initial' | 'refresh' | 'action' | 'form' | null;
type LoadingPhase = 'initializing' | 'loading' | 'ready' | 'error';
```

## Usage Examples

### Basic Usage

```typescript
import { useConsolidatedLoading } from '@/hooks/useConsolidatedLoading';

function MyComponent() {
  const loading = useConsolidatedLoading({
    maxRetries: 3,
    onError: (error, retryCount) => {
      console.error(`Operation failed (attempt ${retryCount + 1}):`, error);
    }
  });

  const loadData = async () => {
    try {
      const data = await loading.executeWithLoading(
        () => fetchUserData(),
        'initial',
        'loadUsers',
        'Loading users...'
      );
      setUsers(data);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  if (loading.isLoading) {
    return <div>Loading...</div>;
  }

  if (loading.error) {
    return (
      <div>
        Error: {loading.error}
        {loading.canRetry && (
          <button onClick={loading.retry}>Retry</button>
        )}
      </div>
    );
  }

  return <div>Content loaded successfully!</div>;
}
```

### Manual Operation Control

```typescript
function ManualControlExample() {
  const loading = useConsolidatedLoading();

  const handleManualOperation = async () => {
    const operationId = loading.startLoading('action', 'processData', 'Processing...');
    
    try {
      // Simulate progress updates
      for (let i = 0; i <= 100; i += 20) {
        loading.updateProgress(i, `Processing... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      loading.completeLoading(operationId);
    } catch (error) {
      loading.completeLoading(operationId, { error: error.message });
    }
  };

  return (
    <div>
      <button onClick={handleManualOperation} disabled={loading.isLoading}>
        Start Manual Operation
      </button>
      
      {loading.isLoading && (
        <div>
          {loading.message}
          {loading.progress !== undefined && (
            <div>Progress: {loading.progress}%</div>
          )}
        </div>
      )}
    </div>
  );
}
```

### UserManagement Integration

```typescript
import { useUserManagementLoading } from '@/hooks/useUserManagementLoading';

function UserManagement() {
  const loading = useUserManagementLoading();
  const [users, setUsers] = useState([]);

  const loadUsers = async () => {
    try {
      const userData = await loading.loadUsers(() => fetchUsers());
      setUsers(userData);
    } catch (error) {
      // Error handled by hook
    }
  };

  const saveUser = async (userData) => {
    try {
      await loading.saveUser(() => createUser(userData), true);
      await loadUsers(); // Refresh list
    } catch (error) {
      // Error handled by hook
    }
  };

  // Use the ConsolidatedLoadingIndicator component
  return (
    <div>
      <ConsolidatedLoadingIndicator
        isLoading={loading.isLoading}
        loadingPhase={loading.loadingPhase}
        loadingType={loading.loadingType}
        error={loading.error}
        operation={loading.operation}
        message={loading.message}
        progress={loading.progress}
        canRetry={loading.canRetry}
        retryCount={loading.retryCount}
        onRetry={loading.retry}
      />
      
      {/* Your component content */}
    </div>
  );
}
```

## Migration Guide

### From Multiple Loading States

**Before:**
```typescript
const [loading, setLoading] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState(null);
const { loading: authLoading } = useAuth();

// Multiple loading indicators
if (authLoading) return <div>Authenticating...</div>;
if (loading) return <div>Loading...</div>;
if (isSubmitting) return <div>Submitting...</div>;
```

**After:**
```typescript
const loading = useConsolidatedLoading();

// Single loading indicator
return (
  <ConsolidatedLoadingIndicator
    isLoading={loading.isLoading}
    loadingPhase={loading.loadingPhase}
    loadingType={loading.loadingType}
    error={loading.error}
    operation={loading.operation}
    canRetry={loading.canRetry}
    retryCount={loading.retryCount}
    onRetry={loading.retry}
  />
);
```

### From useRetryableQuery

**Before:**
```typescript
const { data, loading, error, retry } = useRetryableQuery(fetchUsers);
```

**After:**
```typescript
const loading = useConsolidatedLoading();

const loadUsers = useCallback(async () => {
  try {
    const data = await loading.executeWithLoading(
      fetchUsers,
      'initial',
      'loadUsers'
    );
    setUsers(data);
  } catch (error) {
    // Handled by hook
  }
}, [loading]);
```

## Best Practices

1. **Use Appropriate Loading Types**
   - `initial`: First-time data loading
   - `refresh`: Refreshing existing data
   - `form`: Form submissions
   - `action`: User actions (delete, update, etc.)

2. **Provide Meaningful Operation Names**
   - Use descriptive names like 'loadUsers', 'saveUser', 'deleteUser'
   - These appear in error messages and logs

3. **Handle Errors Gracefully**
   - Use the `onError` callback for logging and user feedback
   - Let the hook manage retry logic

4. **Use Progress Updates for Long Operations**
   - Update progress for operations taking more than a few seconds
   - Provide meaningful progress messages

5. **Clean Up Properly**
   - The hook handles cleanup automatically
   - Use the `reset()` method when needed

## Testing

The hook includes comprehensive tests covering:
- State transitions
- Error handling
- Retry logic
- Progress updates
- Concurrent operations
- Cleanup

Run tests with:
```bash
npm test -- src/hooks/__tests__/useConsolidatedLoading.test.ts
```

## Performance Considerations

- **Minimum Loading Time**: 300ms minimum prevents flickering
- **Memory Management**: Automatic cleanup of operations and timers
- **Debounced Updates**: State updates are optimized to prevent excessive re-renders
- **Concurrent Operations**: Efficiently handles multiple simultaneous operations

## Troubleshooting

### Common Issues

1. **Loading State Not Updating**
   - Ensure you're using the returned state from the hook
   - Check that operations are properly awaited

2. **Flickering Still Occurs**
   - Verify minimum loading time is being enforced
   - Check for external state updates that might conflict

3. **Retry Not Working**
   - Ensure `canRetry` is true
   - Check retry count hasn't exceeded maximum

4. **Memory Leaks**
   - The hook automatically cleans up on unmount
   - Avoid storing hook references in external state

### Debug Mode

Enable debug logging by setting the `onStateChange` callback:

```typescript
const loading = useConsolidatedLoading({
  onStateChange: (state) => {
    console.log('Loading state changed:', state);
  }
});
```

## Future Enhancements

- Global loading state management
- Integration with React Query/SWR
- Advanced progress tracking
- Loading state persistence
- Performance metrics collection