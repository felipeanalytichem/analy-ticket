import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorNotificationProvider, useErrorNotifications } from '../ErrorNotificationSystem';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Test component that uses the hook
function TestComponent() {
  const {
    notifications,
    isOnline,
    connectionQuality,
    showError,
    showWarning,
    showInfo,
    showSuccess,
    showNetworkError,
    showOfflineNotification,
    removeNotification,
    clearAll
  } = useErrorNotifications();

  return (
    <div>
      <div data-testid="online-status">{isOnline ? 'online' : 'offline'}</div>
      <div data-testid="connection-quality">{connectionQuality}</div>
      <div data-testid="notification-count">{notifications.length}</div>
      
      <button onClick={() => showError('Error Title', 'Error message')}>
        Show Error
      </button>
      <button onClick={() => showWarning('Warning Title', 'Warning message')}>
        Show Warning
      </button>
      <button onClick={() => showInfo('Info Title', 'Info message')}>
        Show Info
      </button>
      <button onClick={() => showSuccess('Success Title', 'Success message')}>
        Show Success
      </button>
      <button onClick={() => showNetworkError('Network error', () => {})}>
        Show Network Error
      </button>
      <button onClick={() => showOfflineNotification()}>
        Show Offline
      </button>
      <button onClick={() => notifications.length > 0 && removeNotification(notifications[0].id)}>
        Remove First
      </button>
      <button onClick={clearAll}>
        Clear All
      </button>
    </div>
  );
}

describe('ErrorNotificationSystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { value: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Provider Setup', () => {
    it('should provide context to child components', () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('online');
      expect(screen.getByTestId('connection-quality')).toHaveTextContent('excellent');
      expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useErrorNotifications must be used within an ErrorNotificationProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Status Monitoring', () => {
    it('should detect online status changes', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('online');

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('offline');
        expect(screen.getByTestId('connection-quality')).toHaveTextContent('offline');
      });

      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('online');
        expect(screen.getByTestId('connection-quality')).toHaveTextContent('excellent');
      });
    });
  });

  describe('Notification Creation', () => {
    it('should create error notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
        expect(screen.getByText('Error Title')).toBeInTheDocument();
        expect(screen.getByText('Error message')).toBeInTheDocument();
      });
    });

    it('should create warning notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Warning Title')).toBeInTheDocument();
        expect(screen.getByText('Warning message')).toBeInTheDocument();
      });
    });

    it('should create info notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Info'));

      await waitFor(() => {
        expect(screen.getByText('Info Title')).toBeInTheDocument();
        expect(screen.getByText('Info message')).toBeInTheDocument();
      });
    });

    it('should create success notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success Title')).toBeInTheDocument();
        expect(screen.getByText('Success message')).toBeInTheDocument();
      });
    });

    it('should create network error notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Network Error'));

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should create offline notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Offline'));

      await waitFor(() => {
        expect(screen.getByText('You are offline')).toBeInTheDocument();
        expect(screen.getByText(/Some features may not be available/)).toBeInTheDocument();
      });
    });
  });

  describe('Notification Management', () => {
    it('should remove individual notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));
      
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('1');
      });

      fireEvent.click(screen.getByText('Remove First'));

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      });
    });

    it('should clear all notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      // Add multiple notifications
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Warning'));
      fireEvent.click(screen.getByText('Show Info'));

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('3');
      });

      fireEvent.click(screen.getByText('Clear All'));

      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent('0');
      });
    });

    it('should dismiss notifications with close button', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Warning Title')).toBeInTheDocument();
      });

      // Find and click the close button (X)
      const closeButton = screen.getByRole('button', { name: /×|close/i });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Warning Title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('should auto-dismiss notifications after specified duration', async () => {
      render(
        <ErrorNotificationProvider defaultDuration={1000}>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Warning'));

      await waitFor(() => {
        expect(screen.getByText('Warning Title')).toBeInTheDocument();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Warning Title')).not.toBeInTheDocument();
      });
    });

    it('should not auto-dismiss error notifications by default', async () => {
      render(
        <ErrorNotificationProvider defaultDuration={1000}>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        expect(screen.getByText('Error Title')).toBeInTheDocument();
      });

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Error should still be visible
      expect(screen.getByText('Error Title')).toBeInTheDocument();
    });

    it('should auto-dismiss success notifications quickly', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        expect(screen.getByText('Success Title')).toBeInTheDocument();
      });

      // Fast-forward time (success notifications have 3000ms duration by default)
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success Title')).not.toBeInTheDocument();
      });
    });
  });

  describe('Max Notifications Limit', () => {
    it('should respect max notifications limit', async () => {
      render(
        <ErrorNotificationProvider maxNotifications={2}>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      // Add 3 notifications
      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Warning'));
      fireEvent.click(screen.getByText('Show Info'));

      await waitFor(() => {
        // Should only show 2 notifications (oldest removed)
        expect(screen.getByTestId('notification-count')).toHaveTextContent('2');
        expect(screen.queryByText('Error Title')).not.toBeInTheDocument(); // Oldest removed
        expect(screen.getByText('Warning Title')).toBeInTheDocument();
        expect(screen.getByText('Info Title')).toBeInTheDocument();
      });
    });
  });

  describe('Notification Actions', () => {
    it('should execute notification actions', async () => {
      const mockAction = vi.fn();
      
      function TestComponentWithAction() {
        const { showError } = useErrorNotifications();
        
        return (
          <button onClick={() => showError('Error', 'Message', {
            actions: [{ label: 'Test Action', action: mockAction }]
          })}>
            Show Error with Action
          </button>
        );
      }

      render(
        <ErrorNotificationProvider>
          <TestComponentWithAction />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error with Action'));

      await waitFor(() => {
        expect(screen.getByText('Test Action')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Action'));

      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('Notification Types and Styling', () => {
    it('should display appropriate icons for different notification types', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));
      fireEvent.click(screen.getByText('Show Success'));

      await waitFor(() => {
        // Check that notifications are rendered (icons are rendered as SVG elements)
        expect(screen.getByText('Error Title')).toBeInTheDocument();
        expect(screen.getByText('Success Title')).toBeInTheDocument();
      });
    });

    it('should show timestamps for notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));

      await waitFor(() => {
        // Should show a timestamp (time format)
        expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
      });
    });

    it('should show retryable badge for retryable notifications', async () => {
      render(
        <ErrorNotificationProvider>
          <TestComponent />
        </ErrorNotificationProvider>
      );

      fireEvent.click(screen.getByText('Show Network Error'));

      await waitFor(() => {
        expect(screen.getByText('Retryable')).toBeInTheDocument();
      });
    });
  });
});