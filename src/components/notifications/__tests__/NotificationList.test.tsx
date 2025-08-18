import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { NotificationList } from '../NotificationList';
import { NotificationWithTicket } from '@/lib/notificationService';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

const mockNotifications: NotificationWithTicket[] = [
  {
    id: '1',
    title: 'New ticket created',
    message: 'A new ticket has been created',
    type: 'ticket_created',
    read: false,
    user_id: 'user1',
    ticket_id: 'ticket1',
    created_at: new Date().toISOString(),
    ticket: null
  },
  {
    id: '2',
    title: 'Ticket updated',
    message: 'Ticket has been updated',
    type: 'ticket_updated',
    read: true,
    user_id: 'user1',
    ticket_id: 'ticket1',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    ticket: null
  },
  {
    id: '3',
    title: 'Comment added',
    message: 'New comment added to ticket',
    type: 'comment_added',
    read: false,
    user_id: 'user1',
    ticket_id: 'ticket2',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    ticket: null
  },
  {
    id: '4',
    title: 'Ticket assigned',
    message: 'Ticket has been assigned',
    type: 'ticket_assigned',
    read: true,
    user_id: 'user1',
    ticket_id: 'ticket3',
    created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    ticket: null
  }
];

describe('NotificationList', () => {
  const defaultProps = {
    notifications: mockNotifications,
    loading: false,
    onNotificationClick: vi.fn(),
    onMarkAsRead: vi.fn().mockResolvedValue(true),
    onMarkAllAsRead: vi.fn().mockResolvedValue(true),
    onDeleteNotification: vi.fn().mockResolvedValue(true)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders notification list with title', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    it('displays unread count badge', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Should show unread count (2 unread notifications)
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} loading={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Loading notifications...')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} notifications={[]} />
        </TestWrapper>
      );

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    it('renders notifications grouped by date by default', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Should show date groups
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });

  describe('Grouping', () => {
    it('groups notifications by ticket when groupBy="ticket"', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} groupBy="ticket" />
        </TestWrapper>
      );

      expect(screen.getByText('Ticket #ticket1')).toBeInTheDocument();
      expect(screen.getByText('Ticket #ticket2')).toBeInTheDocument();
      expect(screen.getByText('Ticket #ticket3')).toBeInTheDocument();
    });

    it('groups notifications by type when groupBy="type"', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} groupBy="type" />
        </TestWrapper>
      );

      expect(screen.getByText('Ticket Created')).toBeInTheDocument();
      expect(screen.getByText('Ticket Updated')).toBeInTheDocument();
      expect(screen.getByText('Comment Added')).toBeInTheDocument();
      expect(screen.getByText('Ticket Assigned')).toBeInTheDocument();
    });

    it('shows all notifications without grouping when groupBy="none"', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} groupBy="none" />
        </TestWrapper>
      );

      expect(screen.getByText('All Notifications')).toBeInTheDocument();
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      expect(screen.getByText('Ticket updated')).toBeInTheDocument();
    });

    it('allows expanding and collapsing groups', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} groupBy="ticket" />
        </TestWrapper>
      );

      const ticketGroup = screen.getByText('Ticket #ticket1');
      
      // Initially expanded, should show notifications
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      
      // Click to collapse
      await user.click(ticketGroup);
      
      // Should hide notifications (this might need adjustment based on implementation)
      await waitFor(() => {
        expect(screen.queryByText('New ticket created')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search and Filtering', () => {
    it('filters notifications by search term', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search notifications...');
      await user.type(searchInput, 'comment');

      // Should only show notifications with "comment" in title/message
      expect(screen.getByText('Comment added')).toBeInTheDocument();
      expect(screen.queryByText('New ticket created')).not.toBeInTheDocument();
    });

    it('filters notifications by type', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Open type filter dropdown
      const typeFilter = screen.getByRole('button', { name: /type/i });
      await user.click(typeFilter);

      // Select ticket_created type
      const ticketCreatedOption = screen.getByText('Ticket Created');
      await user.click(ticketCreatedOption);

      // Should only show ticket_created notifications
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      expect(screen.queryByText('Ticket updated')).not.toBeInTheDocument();
    });

    it('filters notifications by read status', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Open status filter dropdown
      const statusFilter = screen.getByRole('button', { name: /status/i });
      await user.click(statusFilter);

      // Select unread only
      const unreadOption = screen.getByText('Unread');
      await user.click(unreadOption);

      // Should only show unread notifications
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      expect(screen.getByText('Comment added')).toBeInTheDocument();
      expect(screen.queryByText('Ticket updated')).not.toBeInTheDocument();
    });

    it('filters notifications by date range', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Open date filter dropdown
      const dateFilter = screen.getByRole('button', { name: /date/i });
      await user.click(dateFilter);

      // Select today only
      const todayOption = screen.getByText('Today');
      await user.click(todayOption);

      // Should only show today's notifications
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      expect(screen.getByText('Ticket updated')).toBeInTheDocument();
      expect(screen.queryByText('Comment added')).not.toBeInTheDocument();
    });

    it('clears all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Apply a search filter
      const searchInput = screen.getByPlaceholderText('Search notifications...');
      await user.type(searchInput, 'comment');

      // Should show clear button
      const clearButton = screen.getByText(/clear/i);
      expect(clearButton).toBeInTheDocument();

      // Click clear
      await user.click(clearButton);

      // Search should be cleared
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
    });

    it('shows no results message when filters match nothing', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText('Search notifications...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No notifications match your filters')).toBeInTheDocument();
    });
  });

  describe('Notification Actions', () => {
    it('calls onNotificationClick when notification is clicked', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
          />
        </TestWrapper>
      );

      const notification = screen.getByText('New ticket created');
      await user.click(notification);

      expect(onNotificationClick).toHaveBeenCalledWith(mockNotifications[0]);
    });

    it('marks notification as read when clicked if unread', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const notification = screen.getByText('New ticket created');
      await user.click(notification);

      expect(onMarkAsRead).toHaveBeenCalledWith('1');
    });

    it('does not mark as read if notification is already read', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const notification = screen.getByText('Ticket updated');
      await user.click(notification);

      expect(onMarkAsRead).not.toHaveBeenCalled();
    });

    it('calls onMarkAllAsRead when mark all button is clicked', async () => {
      const user = userEvent.setup();
      const onMarkAllAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onMarkAllAsRead={onMarkAllAsRead}
          />
        </TestWrapper>
      );

      const markAllButton = screen.getByRole('button', { name: /mark all read/i });
      await user.click(markAllButton);

      expect(onMarkAllAsRead).toHaveBeenCalled();
    });

    it('calls onDeleteNotification when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDeleteNotification = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onDeleteNotification={onDeleteNotification}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete notification/i });
      await user.click(deleteButtons[0]);

      expect(onDeleteNotification).toHaveBeenCalledWith('1');
    });

    it('prevents event propagation when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      const onDeleteNotification = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
            onDeleteNotification={onDeleteNotification}
          />
        </TestWrapper>
      );

      const deleteButtons = screen.getAllByRole('button', { name: /delete notification/i });
      await user.click(deleteButtons[0]);

      expect(onDeleteNotification).toHaveBeenCalled();
      expect(onNotificationClick).not.toHaveBeenCalled();
    });
  });

  describe('Visual Indicators', () => {
    it('shows unread indicator for unread notifications', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Should show unread indicators
      const unreadIndicators = screen.getAllByText('Unread');
      expect(unreadIndicators).toHaveLength(2); // 2 unread notifications
    });

    it('shows different icons for different notification types', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Icons should be present (testing by checking if notifications render properly)
      expect(screen.getByText('New ticket created')).toBeInTheDocument();
      expect(screen.getByText('Ticket updated')).toBeInTheDocument();
      expect(screen.getByText('Comment added')).toBeInTheDocument();
      expect(screen.getByText('Ticket assigned')).toBeInTheDocument();
    });

    it('shows ticket ID when available', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('#ticket1')).toBeInTheDocument();
      expect(screen.getByText('#ticket2')).toBeInTheDocument();
      expect(screen.getByText('#ticket3')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Check for search input
      const searchInput = screen.getByRole('textbox', { name: /search/i });
      expect(searchInput).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} />
        </TestWrapper>
      );

      const searchInput = screen.getByRole('textbox', { name: /search/i });
      
      // Should be able to focus and type in search
      await user.click(searchInput);
      await user.type(searchInput, 'test');
      
      expect(searchInput).toHaveValue('test');
    });
  });

  describe('Props Configuration', () => {
    it('hides search when showSearch is false', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} showSearch={false} />
        </TestWrapper>
      );

      expect(screen.queryByPlaceholderText('Search notifications...')).not.toBeInTheDocument();
    });

    it('hides filters when showFilters is false', () => {
      render(
        <TestWrapper>
          <NotificationList {...defaultProps} showFilters={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /type/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /status/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /date/i })).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationList {...defaultProps} className="custom-class" />
        </TestWrapper>
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('hides mark all button when onMarkAllAsRead is not provided', () => {
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onMarkAllAsRead={undefined}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
    });

    it('hides delete buttons when onDeleteNotification is not provided', () => {
      render(
        <TestWrapper>
          <NotificationList 
            {...defaultProps} 
            onDeleteNotification={undefined}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /delete notification/i })).not.toBeInTheDocument();
    });
  });
});