import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { VirtualNotificationList } from '../VirtualNotificationList';
import { NotificationPagination } from '@/services/NotificationPagination';

// Mock NotificationPagination
vi.mock('@/services/NotificationPagination', () => ({
  NotificationPagination: {
    getPaginatedNotifications: vi.fn(),
    prefetchNextPage: vi.fn()
  }
}));

describe('VirtualNotificationList', () => {
  const mockNotifications = Array(100).fill(null).map((_, i) => ({
    id: `${i + 1}`,
    user_id: 'user1',
    title: `Test Notification ${i + 1}`,
    message: `Test message ${i + 1}`,
    type: 'ticket_created' as const,
    priority: 'medium' as const,
    read: i % 3 === 0, // Every third notification is read
    created_at: new Date(Date.now() - i * 60000).toISOString(),
    updated_at: new Date(Date.now() - i * 60000).toISOString(),
    ticket_id: `ticket${i + 1}`,
    ticket: {
      id: `ticket${i + 1}`,
      title: `Test Ticket ${i + 1}`,
      ticket_number: `T-${String(i + 1).padStart(3, '0')}`,
      status: 'open',
      priority: 'medium'
    }
  }));

  const mockPaginatedResult = {
    data: mockNotifications.slice(0, 20),
    nextCursor: mockNotifications[19].created_at,
    hasMore: true
  };

  const defaultProps = {
    userId: 'user1',
    itemHeight: 80,
    containerHeight: 400,
    onNotificationClick: vi.fn(),
    onMarkAsRead: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render loading state initially', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockReturnValue(promise);

      render(<VirtualNotificationList {...defaultProps} />);

      expect(screen.getByText('Loading notifications...')).toBeInTheDocument();

      await act(async () => {
        resolvePromise!(mockPaginatedResult);
        await promise;
      });
    });

    it('should render notifications after loading', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      // Should only render visible items initially
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Notification 50')).not.toBeInTheDocument();
    });

    it('should render error state when loading fails', async () => {
      const error = new Error('Failed to load notifications');
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockRejectedValue(error);

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should render empty state when no notifications', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: [],
        hasMore: false
      });

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No notifications found')).toBeInTheDocument();
      });
    });

    it('should show scroll indicator', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/1 - \d+ of \d+/)).toBeInTheDocument();
      });
    });
  });

  describe('virtual scrolling', () => {
    it('should render only visible items', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      // Calculate how many items should be visible
      const visibleItems = Math.ceil(defaultProps.containerHeight / defaultProps.itemHeight) + 1;
      
      // Should render visible items
      for (let i = 1; i <= Math.min(visibleItems, 20); i++) {
        expect(screen.getByText(`Test Notification ${i}`)).toBeInTheDocument();
      }

      // Should not render items far below
      expect(screen.queryByText('Test Notification 20')).not.toBeInTheDocument();
    });

    it('should update visible items when scrolling', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const scrollContainer = screen.getByRole('generic');
      
      // Scroll down
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 400 } });

      await waitFor(() => {
        // Should show different items after scrolling
        expect(screen.queryByText('Test Notification 1')).not.toBeInTheDocument();
      });
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset.slice(0, 100),
        hasMore: true
      });

      const startTime = performance.now();
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Notification 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should render within 1 second

      // Should only render visible DOM nodes, not all 100 items
      const notificationElements = screen.getAllByText(/Notification \d+/);
      expect(notificationElements.length).toBeLessThan(20); // Much less than total dataset
    });
  });

  describe('pagination', () => {
    it('should load more notifications when scrolling near bottom', async () => {
      const moreNotifications = mockNotifications.slice(20, 40);
      vi.mocked(NotificationPagination.getPaginatedNotifications)
        .mockResolvedValueOnce(mockPaginatedResult)
        .mockResolvedValueOnce({
          data: moreNotifications,
          nextCursor: moreNotifications[19].created_at,
          hasMore: true
        });

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const scrollContainer = screen.getByRole('generic');
      
      // Scroll near bottom to trigger load more
      fireEvent.scroll(scrollContainer, { 
        target: { 
          scrollTop: 1400, // Near bottom of virtual list
          scrollHeight: 1600,
          clientHeight: 400
        } 
      });

      await waitFor(() => {
        expect(screen.getByText('Loading more...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledTimes(2);
      });
    });

    it('should show end of list indicator when no more items', async () => {
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: mockNotifications.slice(0, 10),
        hasMore: false
      });

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("You've reached the end of your notifications")).toBeInTheDocument();
      });
    });

    it('should not load more when already loading', async () => {
      let resolveSecondLoad: (value: any) => void;
      const secondLoadPromise = new Promise(resolve => {
        resolveSecondLoad = resolve;
      });

      vi.mocked(NotificationPagination.getPaginatedNotifications)
        .mockResolvedValueOnce(mockPaginatedResult)
        .mockReturnValueOnce(secondLoadPromise);

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const scrollContainer = screen.getByRole('generic');
      
      // Trigger load more
      fireEvent.scroll(scrollContainer, { 
        target: { 
          scrollTop: 1400,
          scrollHeight: 1600,
          clientHeight: 400
        } 
      });

      // Trigger again while loading
      fireEvent.scroll(scrollContainer, { 
        target: { 
          scrollTop: 1500,
          scrollHeight: 1600,
          clientHeight: 400
        } 
      });

      // Should only call once more (initial + first scroll)
      expect(NotificationPagination.getPaginatedNotifications).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveSecondLoad!({ data: [], hasMore: false });
        await secondLoadPromise;
      });
    });
  });

  describe('interactions', () => {
    it('should handle notification click', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Test Notification 1'));

      expect(defaultProps.onNotificationClick).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          title: 'Test Notification 1'
        })
      );
    });

    it('should handle mark as read', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 2')).toBeInTheDocument(); // Unread notification
      });

      const markReadButton = screen.getByText('Mark Read');
      fireEvent.click(markReadButton);

      expect(defaultProps.onMarkAsRead).toHaveBeenCalledWith('2');

      await waitFor(() => {
        // Button should disappear after marking as read
        expect(screen.queryByText('Mark Read')).not.toBeInTheDocument();
      });
    });

    it('should handle delete notification', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(defaultProps.onDelete).toHaveBeenCalledWith('1');

      await waitFor(() => {
        // Notification should be removed from list
        expect(screen.queryByText('Test Notification 1')).not.toBeInTheDocument();
      });
    });

    it('should prevent event bubbling on button clicks', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 2')).toBeInTheDocument();
      });

      const markReadButton = screen.getByText('Mark Read');
      fireEvent.click(markReadButton);

      // onNotificationClick should not be called when clicking the button
      expect(defaultProps.onNotificationClick).not.toHaveBeenCalled();
    });
  });

  describe('custom rendering', () => {
    it('should use custom notification renderer when provided', async () => {
      const customRenderer = vi.fn((notification, index) => (
        <div key={notification.id}>Custom: {notification.title}</div>
      ));

      render(
        <VirtualNotificationList 
          {...defaultProps} 
          renderNotification={customRenderer}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Custom: Test Notification 1')).toBeInTheDocument();
      });

      expect(customRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          title: 'Test Notification 1'
        }),
        0
      );
    });
  });

  describe('accessibility', () => {
    it('should be keyboard navigable', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const firstNotification = screen.getByText('Test Notification 1').closest('div');
      expect(firstNotification).toHaveAttribute('tabIndex', '0');
    });

    it('should have proper ARIA labels', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      // Check for accessibility attributes
      const markReadButton = screen.getByText('Mark Read');
      expect(markReadButton).toHaveAttribute('aria-label', expect.stringContaining('Mark'));
    });
  });

  describe('performance tests', () => {
    it('should handle rapid scrolling efficiently', async () => {
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset.slice(0, 100),
        hasMore: true
      });

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Notification 1')).toBeInTheDocument();
      });

      const scrollContainer = screen.getByRole('generic');
      const startTime = performance.now();

      // Simulate rapid scrolling
      for (let i = 0; i < 50; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 20 } });
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should handle rapid scrolling within 100ms
    });

    it('should maintain consistent performance with large datasets', async () => {
      const largeDataset = Array(5000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`,
        message: `Large message content ${i}`.repeat(20)
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset.slice(0, 200),
        hasMore: true
      });

      const startTime = performance.now();
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Notification 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should render within 2 seconds

      // Check that only visible items are in DOM
      const allNotificationElements = screen.getAllByText(/Notification \d+/);
      expect(allNotificationElements.length).toBeLessThan(20); // Much less than 200 total items
    });

    it('should handle memory efficiently during scrolling', async () => {
      const largeDataset = Array(2000).fill(null).map((_, i) => ({
        ...mockNotifications[0],
        id: `${i + 1}`,
        title: `Notification ${i + 1}`
      }));

      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue({
        data: largeDataset.slice(0, 100),
        hasMore: true
      });

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Notification 1')).toBeInTheDocument();
      });

      const scrollContainer = screen.getByRole('generic');
      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      // Scroll through many items
      for (let i = 0; i < 100; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 80 } });
        
        // Force a small delay to allow React to process
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });

    it('should handle concurrent operations efficiently', async () => {
      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Perform many concurrent operations
      const operations = [];
      const buttons = screen.getAllByText('Delete');
      
      for (let i = 0; i < Math.min(buttons.length, 10); i++) {
        operations.push(
          new Promise(resolve => {
            fireEvent.click(buttons[i]);
            resolve(true);
          })
        );
      }

      await Promise.all(operations);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockRejectedValue(error);

      render(<VirtualNotificationList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByText('Retry');
      expect(retryButton).toBeInTheDocument();

      // Retry should work
      vi.mocked(NotificationPagination.getPaginatedNotifications).mockResolvedValue(mockPaginatedResult);
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      });
    });

    it('should handle action errors gracefully', async () => {
      const onMarkAsReadError = vi.fn().mockResolvedValue(false);

      render(
        <VirtualNotificationList 
          {...defaultProps} 
          onMarkAsRead={onMarkAsReadError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Notification 2')).toBeInTheDocument();
      });

      const markReadButton = screen.getByText('Mark Read');
      fireEvent.click(markReadButton);

      // Should still show the button since the action failed
      await waitFor(() => {
        expect(screen.getByText('Mark Read')).toBeInTheDocument();
      });
    });
  });
});