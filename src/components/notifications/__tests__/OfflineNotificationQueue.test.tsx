import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineNotificationQueue, useOfflineQueue } from '../OfflineNotificationQueue';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

describe('OfflineNotificationQueue', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility Logic', () => {
    it('should be hidden when online and no queue items', () => {
      const { container } = render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should be visible when offline', () => {
      render(
        <OfflineNotificationQueue isOnline={false} />
      );

      expect(screen.getByText('Offline Mode')).toBeInTheDocument();
    });

    it('should be visible when online but has queue items', () => {
      // Mock localStorage to return some queue items
      localStorageMock.getItem.mockReturnValue(JSON.stringify([
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ]));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(screen.getByText('Sync Queue')).toBeInTheDocument();
    });

    it('should allow hiding the queue manually', () => {
      render(
        <OfflineNotificationQueue isOnline={false} />
      );

      expect(screen.getByText('Offline Mode')).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument();
    });
  });

  describe('Queue Loading and Saving', () => {
    it('should load queue from localStorage on mount', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('notificationQueue');
      expect(screen.getByText('1 operations queued for sync')).toBeInTheDocument();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('notificationQueue');

      consoleErrorSpy.mockRestore();
    });

    it('should save queue to localStorage when queue changes', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'notificationQueue',
        expect.stringContaining('test-1')
      );
    });

    it('should remove localStorage item when queue is empty', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('notificationQueue');
    });
  });

  describe('Sync Functionality', () => {
    it('should call onSync when sync button is clicked', async () => {
      const onSync = vi.fn().mockResolvedValue(undefined);
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} onSync={onSync} />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      expect(onSync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test-1',
            type: 'markAsRead'
          })
        ])
      );
    });

    it('should show syncing state during sync operation', async () => {
      const onSync = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} onSync={onSync} />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      expect(screen.getByText('Syncing...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Syncing...')).not.toBeInTheDocument();
      });
    });

    it('should handle sync errors gracefully', async () => {
      const onSync = vi.fn().mockRejectedValue(new Error('Sync failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} onSync={onSync} />
      );

      const syncButton = screen.getByText('Sync Now');
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to sync operations:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });

    it('should auto-sync when coming back online', async () => {
      const onSync = vi.fn().mockResolvedValue(undefined);
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      const { rerender } = render(
        <OfflineNotificationQueue isOnline={false} onSync={onSync} />
      );

      expect(onSync).not.toHaveBeenCalled();

      // Come back online
      rerender(
        <OfflineNotificationQueue isOnline={true} onSync={onSync} />
      );

      await waitFor(() => {
        expect(onSync).toHaveBeenCalled();
      });
    });
  });

  describe('Queue Management', () => {
    it('should display queue operations correctly', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        },
        {
          id: 'test-2',
          type: 'delete',
          notificationId: 'notif-2',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'failed'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(screen.getByText('Mark notification as read')).toBeInTheDocument();
      expect(screen.getByText('Delete notification')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should allow retrying failed operations', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 1,
          status: 'failed',
          error: 'Network error'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(screen.getByText('Network error')).toBeInTheDocument();
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      // Should change status back to pending
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should allow clearing the entire queue', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      const clearButton = screen.getByText('Clear Queue');
      fireEvent.click(clearButton);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('notificationQueue');
    });
  });

  describe('Offline Indicators', () => {
    it('should show offline alert when offline', () => {
      render(
        <OfflineNotificationQueue isOnline={false} />
      );

      expect(screen.getByText(/You're currently offline/)).toBeInTheDocument();
    });

    it('should not show offline alert when online', () => {
      const mockQueue = [
        {
          id: 'test-1',
          type: 'markAsRead',
          notificationId: 'notif-1',
          timestamp: new Date().toISOString(),
          retryCount: 0,
          status: 'pending'
        }
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      render(
        <OfflineNotificationQueue isOnline={true} />
      );

      expect(screen.queryByText(/You're currently offline/)).not.toBeInTheDocument();
    });
  });
});

describe('useOfflineQueue Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('[]');
    
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  it('should initialize with online status', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useOfflineQueue();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.isOnline).toBe(true);
  });

  it('should update online status when network events occur', async () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useOfflineQueue();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.isOnline).toBe(true);

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    fireEvent(window, new Event('offline'));

    await waitFor(() => {
      expect(hookResult.isOnline).toBe(false);
    });

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    fireEvent(window, new Event('online'));

    await waitFor(() => {
      expect(hookResult.isOnline).toBe(true);
    });
  });

  it('should return null when online (no queuing needed)', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useOfflineQueue();
      return (
        <button onClick={() => {
          const result = hookResult.queueOperation({
            type: 'markAsRead',
            notificationId: 'test-notif'
          });
          console.log('Queue result:', result);
        }}>
          Queue Operation
        </button>
      );
    }

    render(<TestComponent />);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    fireEvent.click(screen.getByText('Queue Operation'));

    expect(consoleLogSpy).toHaveBeenCalledWith('Queue result:', null);

    consoleLogSpy.mockRestore();
  });

  it('should queue operation when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    let hookResult: any;
    
    function TestComponent() {
      hookResult = useOfflineQueue();
      return (
        <button onClick={() => {
          const result = hookResult.queueOperation({
            type: 'markAsRead',
            notificationId: 'test-notif'
          });
          console.log('Queue result:', result);
        }}>
          Queue Operation
        </button>
      );
    }

    render(<TestComponent />);

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    fireEvent.click(screen.getByText('Queue Operation'));

    expect(consoleLogSpy).toHaveBeenCalledWith('Queue result:', expect.stringMatching(/markAsRead-/));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'notificationQueue',
      expect.stringContaining('markAsRead')
    );

    consoleLogSpy.mockRestore();
  });
});