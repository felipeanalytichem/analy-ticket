import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationErrorBoundary, withNotificationErrorBoundary } from '../NotificationErrorBoundary';
import { NotificationErrorType } from '@/services/NotificationErrorHandler';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

describe('NotificationErrorBoundary', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Mock console.error to avoid noise in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Error Boundary Functionality', () => {
    it('should render children when no error occurs', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={false} />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should catch and display error when child component throws', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Network error" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to the notification service/)).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();
      
      render(
        <NotificationErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
    });

    it('should render custom fallback when provided', () => {
      const fallback = <div>Custom error fallback</div>;
      
      render(
        <NotificationErrorBoundary fallback={fallback}>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    });
  });

  describe('Error Categorization', () => {
    it('should categorize network errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="fetch failed" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should categorize permission errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="unauthorized access" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should categorize validation errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="invalid data format" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Invalid Data')).toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should categorize database errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="database connection failed" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should categorize rate limit errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="too many requests" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Too Many Requests')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should categorize subscription errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="websocket connection lost" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Real-time Connection Lost')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should categorize cache errors correctly', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="cache error occurred" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Cache Error')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should handle unknown errors', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="unknown error" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  describe('Online/Offline Detection', () => {
    it('should show offline status when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('No Internet Connection')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should update status when online/offline events are fired', async () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      // Initially online
      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      fireEvent(window, new Event('offline'));

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      fireEvent(window, new Event('online'));

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for retryable errors', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="network error" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should not show retry button for non-retryable errors', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="permission denied" />
        </NotificationErrorBoundary>
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should handle retry with delay and show retry count', async () => {
      const { rerender } = render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="network error" />
        </NotificationErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      // Should show retrying state
      expect(screen.getByText('Retrying...')).toBeInTheDocument();

      // Wait for retry to complete
      await waitFor(() => {
        expect(screen.queryByText('Retrying...')).not.toBeInTheDocument();
      }, { timeout: 2000 });

      // Component should recover after retry
      rerender(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={false} />
        </NotificationErrorBoundary>
      );
    });

    it('should show reset button', () => {
      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('should handle page refresh', () => {
      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true
      });

      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} />
        </NotificationErrorBoundary>
      );

      const refreshButton = screen.getByText('Refresh Page');
      fireEvent.click(refreshButton);

      expect(reloadMock).toHaveBeenCalled();
    });
  });

  describe('Custom Error Events', () => {
    it('should handle custom notification error events', async () => {
      render(
        <NotificationErrorBoundary>
          <div>Normal content</div>
        </NotificationErrorBoundary>
      );

      // Initially should show normal content
      expect(screen.getByText('Normal content')).toBeInTheDocument();

      // Dispatch custom error event
      const errorEvent = new CustomEvent('notificationError', {
        detail: {
          error: {
            type: NotificationErrorType.NETWORK_ERROR,
            message: 'Custom network error'
          }
        }
      });

      fireEvent(window, errorEvent);

      await waitFor(() => {
        expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      });
    });
  });

  describe('Development Mode Features', () => {
    it('should show technical details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test error with stack" />
        </NotificationErrorBoundary>
      );

      expect(screen.getByText('Technical Details')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not show technical details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <NotificationErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test error" />
        </NotificationErrorBoundary>
      );

      expect(screen.queryByText('Technical Details')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Higher-Order Component', () => {
    it('should wrap component with error boundary using HOC', () => {
      const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => (
        <ThrowError shouldThrow={shouldThrow} />
      );

      const WrappedComponent = withNotificationErrorBoundary(TestComponent);

      const { rerender } = render(<WrappedComponent shouldThrow={false} />);
      expect(screen.getByText('No error')).toBeInTheDocument();

      rerender(<WrappedComponent shouldThrow={true} />);
      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });

    it('should pass error boundary props to HOC', () => {
      const onError = vi.fn();
      const TestComponent = () => <ThrowError shouldThrow={true} />;
      
      const WrappedComponent = withNotificationErrorBoundary(TestComponent, {
        onError
      });

      render(<WrappedComponent />);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <NotificationErrorBoundary>
          <div>Test</div>
        </NotificationErrorBoundary>
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('notificationError', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('notificationError', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});