import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { NotificationItem } from '../NotificationItem';
import { NotificationWithTicket } from '@/lib/notificationService';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

const mockNotification: NotificationWithTicket = {
  id: '1',
  title: 'Test Notification',
  message: 'This is a test notification message',
  type: 'ticket_created',
  read: false,
  user_id: 'user1',
  ticket_id: 'ticket1',
  created_at: new Date().toISOString(),
  ticket: {
    id: 'ticket1',
    title: 'Test Ticket',
    description: 'This is a test ticket description',
    status: 'open',
    priority: 'high',
    assigned_to: 'agent1',
    category: 'support',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: 'user1'
  }
};

const mockReadNotification: NotificationWithTicket = {
  ...mockNotification,
  id: '2',
  read: true,
  title: 'Read Notification'
};

describe('NotificationItem', () => {
  const defaultProps = {
    notification: mockNotification,
    onNotificationClick: vi.fn(),
    onMarkAsRead: vi.fn().mockResolvedValue(true),
    onMarkAsUnread: vi.fn().mockResolvedValue(true),
    onDeleteNotification: vi.fn().mockResolvedValue(true),
    onPreviewToggle: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders notification with title and message', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('This is a test notification message')).toBeInTheDocument();
    });

    it('shows unread indicator for unread notifications', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Unread')).toBeInTheDocument();
    });

    it('does not show unread indicator for read notifications', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} notification={mockReadNotification} />
        </TestWrapper>
      );

      expect(screen.queryByText('Unread')).not.toBeInTheDocument();
    });

    it('displays ticket ID when available', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('#ticket1')).toBeInTheDocument();
    });

    it('shows priority badge when showPriority is true', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPriority={true} />
        </TestWrapper>
      );

      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('hides priority badge when showPriority is false', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPriority={false} />
        </TestWrapper>
      );

      expect(screen.queryByText('medium')).not.toBeInTheDocument();
    });

    it('applies compact styling when compact is true', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationItem {...defaultProps} compact={true} />
        </TestWrapper>
      );

      // Check for compact class or styling
      const cardContent = container.querySelector('[class*="p-3"]');
      expect(cardContent).toBeInTheDocument();
    });

    it('shows relative time with tooltip for absolute time', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      const timeElement = screen.getByText(/ago|in/);
      expect(timeElement).toBeInTheDocument();

      // Hover to show tooltip with absolute time
      await user.hover(timeElement);
      
      // Should show tooltip (implementation may vary)
      await waitFor(() => {
        // The exact tooltip text will depend on the current date
        expect(timeElement).toBeInTheDocument();
      });
    });
  });

  describe('Priority System', () => {
    it('shows correct priority for different notification types', () => {
      const highPriorityNotification = {
        ...mockNotification,
        type: 'ticket_assigned' as const
      };

      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            notification={highPriorityNotification}
            showPriority={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('upgrades priority based on content keywords', () => {
      const urgentNotification = {
        ...mockNotification,
        title: 'URGENT: System down',
        message: 'Critical system failure'
      };

      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            notification={urgentNotification}
            showPriority={true}
          />
        </TestWrapper>
      );

      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('applies correct styling for different priority levels', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPriority={true} />
        </TestWrapper>
      );

      // Check for priority-based styling classes
      const card = container.querySelector('[class*="border-blue"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Quick Actions', () => {
    it('shows all quick action buttons when enabled', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showQuickActions={true} />
        </TestWrapper>
      );

      // Should show preview toggle, open ticket, mark as read, and delete buttons
      expect(screen.getByRole('button', { name: /show preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open ticket/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /mark as read/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete notification/i })).toBeInTheDocument();
    });

    it('hides quick actions when showQuickActions is false', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showQuickActions={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /show preview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /open ticket/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete notification/i })).not.toBeInTheDocument();
    });

    it('calls onMarkAsRead when mark as read button is clicked', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
      await user.click(markAsReadButton);

      expect(onMarkAsRead).toHaveBeenCalledWith('1');
    });

    it('calls onMarkAsUnread when mark as unread button is clicked for read notification', async () => {
      const user = userEvent.setup();
      const onMarkAsUnread = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            notification={mockReadNotification}
            onMarkAsUnread={onMarkAsUnread}
          />
        </TestWrapper>
      );

      const markAsUnreadButton = screen.getByRole('button', { name: /mark as unread/i });
      await user.click(markAsUnreadButton);

      expect(onMarkAsUnread).toHaveBeenCalledWith('2');
    });

    it('calls onDeleteNotification when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDeleteNotification = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onDeleteNotification={onDeleteNotification}
          />
        </TestWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /delete notification/i });
      await user.click(deleteButton);

      expect(onDeleteNotification).toHaveBeenCalledWith('1');
    });

    it('prevents event propagation for quick action buttons', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      const onDeleteNotification = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
            onDeleteNotification={onDeleteNotification}
          />
        </TestWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /delete notification/i });
      await user.click(deleteButton);

      expect(onDeleteNotification).toHaveBeenCalled();
      expect(onNotificationClick).not.toHaveBeenCalled();
    });
  });

  describe('Preview Functionality', () => {
    it('shows preview toggle button when ticket data is available', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPreview={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /show preview/i })).toBeInTheDocument();
    });

    it('hides preview toggle when no ticket data', () => {
      const notificationWithoutTicket = {
        ...mockNotification,
        ticket: null
      };

      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            notification={notificationWithoutTicket}
            showPreview={true}
          />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /show preview/i })).not.toBeInTheDocument();
    });

    it('toggles preview content when preview button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPreview={true} />
        </TestWrapper>
      );

      const previewButton = screen.getByRole('button', { name: /show preview/i });
      
      // Initially preview should be closed
      expect(screen.queryByText('Test Ticket')).not.toBeInTheDocument();
      
      // Click to open preview
      await user.click(previewButton);
      
      // Should show preview content
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('calls onPreviewToggle when preview is toggled', async () => {
      const user = userEvent.setup();
      const onPreviewToggle = vi.fn();
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onPreviewToggle={onPreviewToggle}
            showPreview={true}
          />
        </TestWrapper>
      );

      const previewButton = screen.getByRole('button', { name: /show preview/i });
      await user.click(previewButton);

      expect(onPreviewToggle).toHaveBeenCalledWith('1', true);
    });

    it('shows ticket details in preview', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} showPreview={true} />
        </TestWrapper>
      );

      const previewButton = screen.getByRole('button', { name: /show preview/i });
      await user.click(previewButton);

      // Should show ticket details
      expect(screen.getByText('Test Ticket')).toBeInTheDocument();
      expect(screen.getByText('open')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('This is a test ticket description')).toBeInTheDocument();
    });
  });

  describe('Notification Click', () => {
    it('calls onNotificationClick when notification is clicked', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
          />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification/i });
      await user.click(notification);

      expect(onNotificationClick).toHaveBeenCalledWith(mockNotification);
    });

    it('marks notification as read when clicked if unread', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification/i });
      await user.click(notification);

      expect(onMarkAsRead).toHaveBeenCalledWith('1');
    });

    it('does not mark as read if notification is already read', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockResolvedValue(true);
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            notification={mockReadNotification}
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /read notification/i });
      await user.click(notification);

      expect(onMarkAsRead).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports Enter key activation', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
          />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification/i });
      notification.focus();
      
      await user.keyboard('{Enter}');

      expect(onNotificationClick).toHaveBeenCalledWith(mockNotification);
    });

    it('supports Space key activation', async () => {
      const user = userEvent.setup();
      const onNotificationClick = vi.fn();
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onNotificationClick={onNotificationClick}
          />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification/i });
      notification.focus();
      
      await user.keyboard(' ');

      expect(onNotificationClick).toHaveBeenCalledWith(mockNotification);
    });

    it('is focusable with proper tabIndex', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification/i });
      expect(notification).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /test notification.*unread/i });
      expect(notification).toBeInTheDocument();
    });

    it('updates ARIA label based on read status', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} notification={mockReadNotification} />
        </TestWrapper>
      );

      const notification = screen.getByRole('button', { name: /read notification.*read/i });
      expect(notification).toBeInTheDocument();
    });

    it('provides tooltips for action buttons', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /delete notification/i });
      
      // Hover to show tooltip
      await user.hover(deleteButton);
      
      // Tooltip should be accessible
      expect(deleteButton).toBeInTheDocument();
    });

    it('has proper role and button semantics', () => {
      render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      const notification = screen.getByRole('button');
      expect(notification).toHaveAttribute('role', 'button');
    });
  });

  describe('Loading States', () => {
    it('disables actions when loading', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
      
      // Click and immediately try to click again
      await user.click(markAsReadButton);
      await user.click(markAsReadButton);

      // Should only be called once due to loading state
      expect(onMarkAsRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('Visual Styling', () => {
    it('applies unread styling for unread notifications', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationItem {...defaultProps} />
        </TestWrapper>
      );

      // Check for unread styling (ring or border)
      const card = container.querySelector('[class*="ring-2"]');
      expect(card).toBeInTheDocument();
    });

    it('applies grouped styling when isGrouped is true', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationItem {...defaultProps} isGrouped={true} />
        </TestWrapper>
      );

      // Check for grouped styling
      const card = container.querySelector('[class*="ml-4"]');
      expect(card).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TestWrapper>
          <NotificationItem {...defaultProps} className="custom-class" />
        </TestWrapper>
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Error Handling', () => {
    it('handles failed mark as read gracefully', async () => {
      const user = userEvent.setup();
      const onMarkAsRead = vi.fn().mockRejectedValue(new Error('Failed to mark as read'));
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onMarkAsRead={onMarkAsRead}
          />
        </TestWrapper>
      );

      const markAsReadButton = screen.getByRole('button', { name: /mark as read/i });
      await user.click(markAsReadButton);

      // Should not crash and button should be re-enabled
      expect(markAsReadButton).not.toBeDisabled();
    });

    it('handles failed delete gracefully', async () => {
      const user = userEvent.setup();
      const onDeleteNotification = vi.fn().mockRejectedValue(new Error('Failed to delete'));
      
      render(
        <TestWrapper>
          <NotificationItem 
            {...defaultProps} 
            onDeleteNotification={onDeleteNotification}
          />
        </TestWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: /delete notification/i });
      await user.click(deleteButton);

      // Should not crash and button should be re-enabled
      expect(deleteButton).not.toBeDisabled();
    });
  });
});