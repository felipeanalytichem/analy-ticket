# Network Error Handling

This document describes the enhanced network error handling system implemented to address connectivity issues like `ERR_INSUFFICIENT_RESOURCES` and `Failed to fetch` errors.

## Overview

The network error handling system provides:

1. **Error Analysis**: Identifies specific types of network errors
2. **Intelligent Retries**: Retries operations based on error type with appropriate delays
3. **User Feedback**: Provides meaningful error messages to users
4. **Integration**: Works seamlessly with React Query and Supabase operations

## Error Types

The system recognizes these network error types:

- `insufficient_resources`: Server resource exhaustion (ERR_INSUFFICIENT_RESOURCES)
- `failed_fetch`: Network fetch failures (Failed to fetch)
- `network_error`: General network connectivity issues
- `timeout`: Request timeouts
- `unknown`: Unrecognized errors (not retryable)

## Usage

### Basic Usage with withNetworkErrorHandling

```typescript
import { withNetworkErrorHandling } from '@/lib/networkErrorHandler';

// Wrap any async operation
const result = await withNetworkErrorHandling(
  () => supabase.from('users').select('*'),
  {
    operationName: 'fetch users',
    maxRetries: 3,
    showToast: true
  }
);
```

### Enhanced AuthContext Integration

The AuthContext now automatically handles network errors for all authentication operations:

```typescript
// Session validation with network error handling
const isValid = await validateSession();

// Profile loading with automatic retries
const profile = await loadUserProfile(userId, email);
```

### React Query Integration

React Query is configured to automatically retry network errors:

```typescript
// The query client automatically retries based on error analysis
const { data, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => supabase.from('users').select('*')
});
```

## Configuration Options

### NetworkRetryOptions

```typescript
interface NetworkRetryOptions {
  maxRetries?: number;        // Default: 3
  baseDelay?: number;         // Default: 1000ms
  maxDelay?: number;          // Default: 30000ms
  exponentialBackoff?: boolean; // Default: true
  jitter?: boolean;           // Default: true
}
```

### withNetworkErrorHandling Options

```typescript
interface Options extends NetworkRetryOptions {
  showToast?: boolean;        // Default: true
  operationName?: string;     // For logging and user feedback
}
```

## Error-Specific Behavior

### ERR_INSUFFICIENT_RESOURCES
- **Retry Delay**: 2 seconds
- **User Message**: "Server resources are temporarily unavailable"
- **Retryable**: Yes

### Failed to fetch
- **Retry Delay**: 1.5 seconds  
- **User Message**: "Unable to connect to the server"
- **Retryable**: Yes

### Network Error
- **Retry Delay**: 3 seconds
- **User Message**: "A network error occurred"
- **Retryable**: Yes

### Timeout
- **Retry Delay**: 5 seconds
- **User Message**: "The request took too long to complete"
- **Retryable**: Yes

## Implementation Details

### Error Analysis

The `analyzeNetworkError` function examines error messages and details to classify errors:

```typescript
const errorInfo = analyzeNetworkError(error);
// Returns: { type, originalError, retryable, suggestedDelay }
```

### Retry Logic

The retry handler implements:
- Exponential backoff with jitter
- Error-specific initial delays
- Maximum retry limits
- Graceful failure handling

### Toast Notifications

Users receive contextual feedback:
- Loading toast during retries
- Success toast on recovery
- Error toast with retry button on failure

## Testing

The system includes comprehensive tests covering:
- Error type identification
- Retry behavior
- Integration with operations
- Edge cases and error conditions

Run tests with:
```bash
npm test -- src/lib/__tests__/networkErrorHandler.test.ts
```

## Monitoring and Debugging

All network errors are logged with detailed information:

```typescript
console.error('🚨 Network error:', {
  type: errorInfo.type,
  retryable: errorInfo.retryable,
  message: error?.message,
  status: error?.status
});
```

Look for these log patterns:
- `🔄 Network retry attempt X/Y`
- `✅ Network retry succeeded`
- `🚨 All X retry attempts exhausted`
- `🚫 Error type X is not retryable`

## Best Practices

1. **Use withNetworkErrorHandling** for critical operations
2. **Provide meaningful operationName** for better user feedback
3. **Adjust maxRetries** based on operation criticality
4. **Monitor logs** for patterns in network failures
5. **Test with network conditions** that simulate real-world issues

## Future Enhancements

Potential improvements:
- Circuit breaker pattern for repeated failures
- Network quality detection
- Adaptive retry strategies
- Metrics collection for network health monitoring