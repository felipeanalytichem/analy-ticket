import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { NotificationBell } from '../NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { reconnectionManager } from '@/services/ReconnectionManager';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/hooks/useNotifications');
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/ReconnectionManager');
vi.mock('sonner');
vi.mock('@/lib/database');
vi.mock('@/components/tickets/dialogs/TicketDetailsDialog', () => ({
  TicketDetailsDialog: ({ open, onOpenChange }: any) => 
    open ? <div data-testid="ticket-dialog">Ticket Dialog</div> : null
}));

const mockUseNotifications = vi.mocked(useNotifications);
const mockUseAuth = vi.mocked(useAuth);
const mockReconnectionManager = vi.mocked(reconnectionManager);
const mockToast = vi.mocked(toast);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  </BrowserRouter>
);

const mockNotifications = [
  {
    id: '1',
    title: 'Test Notification 1',
    message: 'Test message 1',
    type: 'ticket_created',
    read: false,
    user_id: 'user1',
    ticket_id: 'ticket1',
    created_at: new Date().toISOString(),
    ticket: null
  },
  {
    id: '2',
    title: 'Test Notification 2',
    message: 'Test message 2',
    type: 'ticket_updated',
    read: true,
    user_id: 'user1',
    ticket_id: 'ticket2',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    ticket: null
  }
];

describe('NotificationBell', () => {
  const mockUser = {
    id: 'user1',
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      userProfile: mockUser,
      user: mockUser,
      loading: false,
      signOut: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
      updateProfile: vi.fn()
    });

    mockUseNotifications.mockReturnValue({
      notifications: mockNotifications,
      unreadCount: 1,
      loading: false,
      error: null,
      markAsRead: vi.fn().mockResolvedValue(true),
      markAllAsRead: vi.fn().mockResolvedValue(true),
      deleteNotification: vi.fn().mockResolvedValue(true),
      refresh: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn()
    });

    mockReconnectionManager.getConnectionHealth.mockReturnValue({
      isHealthy: true,
      lastHeartbeat: new Date(),
      consecutiveFailures: 0
    });

    // Mock window events
    Object.defineProperty(window, 'addEventListener', {
      value: vi.fn(),
      writable: true
    });
    Object.defineProperty(window, 'removeEventListener', {
      value: vi.fn(),
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders notification bell button', () => {
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
    });

    it('displays unread count badge when there are unread notifications', () => {
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('does not display badge when no unread notifications', () => {
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });

    it('shows loading spinner when loading', () => {
      mockUseNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: true,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      // Loading spinner should be in the bell button
      expect(screen.getByRole('button')).toContainElement(
        screen.getByTestId('loader-2') || screen.getByLabelText(/loading/i)
      );
    });
  });

  describe('Connection Status', () => {
    it('shows green indicator when connected', () => {
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
      
      // Check for connection status indicator (green dot)
      const indicator = bellButton.querySelector('.bg-green-500');
      expect(indicator).toBeInTheDocument();
    });

    it('shows red indicator when disconnected', () => {
      mockReconnectionManager.getConnectionHealth.mockReturnValue({
        isHealthy: false,
        lastHeartbeat: new Date(),
        consecutiveFailures: 3,
        lastError: 'Connection failed'
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
      
      // Check for connection status indicator (red dot)
      const indicator = bellButton.querySelector('.bg-red-500');
      expect(indicator).toBeInTheDocument();
    });

    it('shows yellow indicator when reconnecting', () => {
      mockReconnectionManager.getConnectionHealth.mockReturnValue({
        isHealthy: false,
        lastHeartbeat: new Date(),
        consecutiveFailures: 2,
        lastError: 'Connection failed'
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toBeInTheDocument();
      
      // Check for connection status indicator (yellow dot)
      const indicator = bellButton.querySelector('.bg-yellow-500');
      expect(indicator).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown when bell is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      expect(screen.getByText('Test Notification 2')).toBeInTheDocument();
    });

    it('closes dropdown when escape key is pressed', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);
      
      expect(screen.getByText('Test Notification 1')).toBeInTheDocument();
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByText('Test Notification 1')).not.toBeInTheDocument();
      });
    });

    it('shows empty state when no notifications', async () => {
      const user = userEvent.setup();
      
      mockUseNotifications.mockReturnValue({
        notifications: [],
        unreadCount: 0,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });

  describe('Notification Actions', () => {
    it('marks notification as read when clicked', async () => {
      const user = userEvent.setup();
      const mockMarkAsRead = vi.fn().mockResolvedValue(true);
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: mockMarkAsRead,
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const notification = screen.getByText('Test Notification 1');
      await user.click(notification);

      expect(mockMarkAsRead).toHaveBeenCalledWith('1');
    });

    it('marks all notifications as read when button is clicked', async () => {
      const user = userEvent.setup();
      const mockMarkAllAsRead = vi.fn().mockResolvedValue(true);
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: mockMarkAllAsRead,
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const markAllButton = screen.getByRole('button', { name: /mark all as read/i });
      await user.click(markAllButton);

      expect(mockMarkAllAsRead).toHaveBeenCalled();
    });

    it('deletes notification when delete button is clicked', async () => {
      const user = userEvent.setup();
      const mockDeleteNotification = vi.fn().mockResolvedValue(true);
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: mockDeleteNotification,
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const deleteButtons = screen.getAllByRole('button', { name: /delete notification/i });
      await user.click(deleteButtons[0]);

      expect(mockDeleteNotification).toHaveBeenCalledWith('1');
    });

    it('refreshes notifications when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: mockRefresh,
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const refreshButton = screen.getByRole('button', { name: /refresh notifications/i });
      await user.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Notifications refreshed');
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation for notifications', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const notificationItems = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('Test Notification')
      );

      // Focus first notification
      notificationItems[0].focus();
      expect(notificationItems[0]).toHaveFocus();

      // Press Enter to activate
      await user.keyboard('{Enter}');
      
      // Should mark as read
      expect(mockUseNotifications().markAsRead).toHaveBeenCalled();
    });

    it('supports space key activation for notifications', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const notificationItems = screen.getAllByRole('button').filter(button => 
        button.getAttribute('aria-label')?.includes('Test Notification')
      );

      // Focus first notification
      notificationItems[0].focus();
      
      // Press Space to activate
      await user.keyboard(' ');
      
      // Should mark as read
      expect(mockUseNotifications().markAsRead).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toHaveAttribute('aria-label', 'Notifications');
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');
      expect(bellButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('updates aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      expect(bellButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(bellButton);
      
      expect(bellButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('provides descriptive labels for notification items', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const unreadNotification = screen.getByLabelText(/Test Notification 1.*Unread/);
      const readNotification = screen.getByLabelText(/Test Notification 2.*Read/);
      
      expect(unreadNotification).toBeInTheDocument();
      expect(readNotification).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when mark as read fails', async () => {
      const user = userEvent.setup();
      const mockMarkAsRead = vi.fn().mockResolvedValue(false);
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: mockMarkAsRead,
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const notification = screen.getByText('Test Notification 1');
      await user.click(notification);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Erro ao marcar notificação como lida');
      });
    });

    it('shows error toast when refresh fails', async () => {
      const user = userEvent.setup();
      const mockRefresh = vi.fn().mockRejectedValue(new Error('Refresh failed'));
      
      mockUseNotifications.mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        loading: false,
        error: null,
        markAsRead: vi.fn().mockResolvedValue(true),
        markAllAsRead: vi.fn().mockResolvedValue(true),
        deleteNotification: vi.fn().mockResolvedValue(true),
        refresh: mockRefresh,
        cleanup: vi.fn()
      });

      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const refreshButton = screen.getByRole('button', { name: /refresh notifications/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to refresh notifications');
      });
    });
  });

  describe('Navigation', () => {
    it('navigates to settings when settings button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const settingsButton = screen.getByRole('button', { name: /notification settings/i });
      await user.click(settingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/settings?tab=notifications');
    });

    it('navigates to notifications page when view all is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <NotificationBell />
        </TestWrapper>
      );

      const bellButton = screen.getByRole('button', { name: /notifications/i });
      await user.click(bellButton);

      const viewAllButton = screen.getByRole('button', { name: /view all notifications/i });
      await user.click(viewAllButton);

      expect(mockNavigate).toHaveBeenCalledWith('/notifications');
    });
  });
});