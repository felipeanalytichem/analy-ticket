import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService, type Notification, type NotificationWithTicket, type NotificationContext } from '../notificationService';
import { supabase } from '../supabase';
import { toast } from 'sonner';
import { NotificationTemplateService } from '@/services/NotificationTemplateService';
import { NotificationPermissionValidator } from '@/services/NotificationPermissionValidator';
import { NotificationDataSecurity } from '@/services/NotificationDataSecurity';
import i18n from '@/i18n';

// Mock all dependencies
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis()
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    }))
  }
}));

vi.mock('sonner', () => ({
  toast: vi.fn()
}));

vi.mock('@/services/NotificationTemplateService', () => ({
  NotificationTemplateService: {
    getInstance: vi.fn(() => ({
      createTemplate: vi.fn(),
      serializeTemplate: vi.fn(),
      processNotificationForDisplay: vi.fn()
    }))
  }
}));

vi.mock('@/services/NotificationPermissionValidator', () => ({
  NotificationPermissionValidator: {
    getInstance: vi.fn(() => ({
      validateCreatePermission: vi.fn(),
      validateModifyPermission: vi.fn()
    }))
  }
}));

vi.mock('@/services/NotificationDataSecurity', () => ({
  NotificationDataSecurity: {
    getInstance: vi.fn(() => ({
      validateNotificationData: vi.fn(),
      processNotificationForStorage: vi.fn(),
      processNotificationForDisplay: vi.fn()
    }))
  }
}));

vi.mock('@/i18n', () => ({
  default: {
    t: vi.fn((key: string) => key)
  }
}));

describe('NotificationService', () => {
  let mockSupabaseQuery: any;
  let mockTemplateService: any;
  let mockPermissionValidator: any;
  let mockDataSecurity: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockSupabaseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis()
    };

    // Add mockResolvedValue method to all query methods
    Object.keys(mockSupabaseQuery).forEach(key => {
      if (typeof mockSupabaseQuery[key] === 'function') {
        mockSupabaseQuery[key].mockResolvedValue = vi.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 0
        });
      }
    });

    (supabase.from as any).mockReturnValue(mockSupabaseQuery);
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'test-user-id' } }
    });

    mockTemplateService = {
      createTemplate: vi.fn().mockReturnValue({ template: 'test-template' }),
      serializeTemplate: vi.fn().mockReturnValue('serialized-template'),
      processNotificationForDisplay: vi.fn().mockReturnValue({
        title: 'Test Title',
        message: 'Test Message'
      })
    };
    (NotificationTemplateService.getInstance as any).mockReturnValue(mockTemplateService);

    mockPermissionValidator = {
      validateCreatePermission: vi.fn().mockResolvedValue({ allowed: true }),
      validateModifyPermission: vi.fn().mockResolvedValue({ allowed: true })
    };
    (NotificationPermissionValidator.getInstance as any).mockReturnValue(mockPermissionValidator);

    mockDataSecurity = {
      validateNotificationData: vi.fn().mockReturnValue({ valid: true }),
      processNotificationForStorage: vi.fn().mockResolvedValue({
        title: 'Processed Title',
        message: 'Processed Message',
        encrypted_fields: null,
        encryption_data: null
      }),
      processNotificationForDisplay: vi.fn().mockResolvedValue({
        title: 'Decrypted Title',
        message: 'Decrypted Message'
      })
    };
    (NotificationDataSecurity.getInstance as any).mockReturnValue(mockDataSecurity);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationService.getInstance();
      const instance2 = NotificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockNotifications = [
        {
          id: '1',
          user_id: 'user-1',
          title: 'Test Notification',
          message: 'Test Message',
          type: 'ticket_created',
          ticket_id: 'ticket-1',
          read: false,
          priority: 'medium',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabaseQuery.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseQuery.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabaseQuery.limit).toHaveBeenCalledWith(50);
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        user_id: 'user-1',
        title: 'Test Notification',
        message: 'Test Message',
        type: 'ticket_created'
      });
    });

    it('should handle unauthorized access to other user notifications', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: 'different-user-id' } }
      });

      mockSupabaseQuery.mockResolvedValue({
        data: [{ role: 'user' }],
        error: null
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('should allow admin to access other user notifications', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: 'admin-user-id' } }
      });

      // Mock admin role check
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        return mockSupabaseQuery;
      });

      mockSupabaseQuery.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(mockUserQuery.select).toHaveBeenCalledWith('role');
      expect(mockUserQuery.eq).toHaveBeenCalledWith('id', 'admin-user-id');
      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseQuery.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('should decrypt encrypted notifications', async () => {
      const mockNotifications = [
        {
          id: '1',
          user_id: 'user-1',
          title: 'Encrypted Title',
          message: 'Encrypted Message',
          type: 'ticket_created',
          encrypted_fields: ['title', 'message'],
          encryption_data: { key: 'encrypted-key' },
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabaseQuery.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(mockDataSecurity.processNotificationForDisplay).toHaveBeenCalledWith({
        title: 'Encrypted Title',
        message: 'Encrypted Message',
        encrypted_fields: ['title', 'message'],
        encryption_data: { key: 'encrypted-key' }
      });
      expect(result[0].title).toBe('Decrypted Title');
      expect(result[0].message).toBe('Decrypted Message');
    });

    it('should handle decryption errors gracefully', async () => {
      const mockNotifications = [
        {
          id: '1',
          user_id: 'user-1',
          title: 'Encrypted Title',
          message: 'Encrypted Message',
          type: 'ticket_created',
          encrypted_fields: ['title', 'message'],
          encryption_data: { key: 'encrypted-key' },
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabaseQuery.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      mockDataSecurity.processNotificationForDisplay.mockRejectedValue(
        new Error('Decryption failed')
      );

      const result = await NotificationService.getNotifications('user-1');

      expect(result[0].title).toBe('Encrypted Title');
      expect(result[0].message).toBe('Encrypted Message');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count successfully', async () => {
      mockSupabaseQuery.mockResolvedValue({
        count: 5,
        error: null
      });

      const result = await NotificationService.getUnreadCount('user-1');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('read', false);
      expect(result).toBe(5);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseQuery.mockResolvedValue({
        count: null,
        error: { message: 'Database error' }
      });

      const result = await NotificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('should handle null count', async () => {
      mockSupabaseQuery.mockResolvedValue({
        count: null,
        error: null
      });

      const result = await NotificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(mockPermissionValidator.validateModifyPermission).toHaveBeenCalledWith(
        'test-user-id',
        'notification-1',
        'update'
      );
      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseQuery.update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('id', 'notification-1');
      expect(result).toBe(true);
    });

    it('should handle permission denied', async () => {
      mockPermissionValidator.validateModifyPermission.mockResolvedValue({
        allowed: false,
        reason: 'Permission denied'
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
      expect(mockSupabaseQuery.update).not.toHaveBeenCalled();
    });

    it('should handle unauthenticated user', async () => {
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: null }
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: { message: 'Database error' }
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for own user', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAllAsRead('test-user-id');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseQuery.update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('read', false);
      expect(result).toBe(true);
    });

    it('should allow admin to mark all notifications as read for other users', async () => {
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        return mockSupabaseQuery;
      });

      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAllAsRead('other-user-id');

      expect(mockUserQuery.select).toHaveBeenCalledWith('role');
      expect(result).toBe(true);
    });

    it('should deny non-admin users from marking other user notifications', async () => {
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'user' },
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        return mockSupabaseQuery;
      });

      const result = await NotificationService.markAllAsRead('other-user-id');

      expect(result).toBe(false);
      expect(mockSupabaseQuery.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.deleteNotification('notification-1');

      expect(mockPermissionValidator.validateModifyPermission).toHaveBeenCalledWith(
        'test-user-id',
        'notification-1',
        'delete'
      );
      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockSupabaseQuery.delete).toHaveBeenCalled();
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('id', 'notification-1');
      expect(result).toBe(true);
    });

    it('should handle permission denied', async () => {
      mockPermissionValidator.validateModifyPermission.mockResolvedValue({
        allowed: false,
        reason: 'Permission denied'
      });

      const result = await NotificationService.deleteNotification('notification-1');

      expect(result).toBe(false);
      expect(mockSupabaseQuery.delete).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToNotifications', () => {
    it('should create real-time subscription', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      (supabase.channel as any).mockReturnValue(mockChannel);

      const callback = vi.fn();
      const result = NotificationService.subscribeToNotifications('user-1', callback);

      expect(supabase.channel).toHaveBeenCalledWith('notifications-user-1', {
        config: { broadcast: { self: false } }
      });
      expect(mockChannel.on).toHaveBeenCalledTimes(2);
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(result).toBe(mockChannel);
    });
  });

  describe('createTicketCreatedNotification', () => {
    beforeEach(() => {
      const mockAgentsQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            { id: 'agent-1' },
            { id: 'agent-2' }
          ],
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'users') return mockAgentsQuery;
        return mockSupabaseQuery;
      });

      mockSupabaseQuery.mockResolvedValue({
        error: null
      });
    });

    it('should create ticket created notifications for all agents', async () => {
      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket',
        userName: 'Test User'
      };

      const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

      expect(mockPermissionValidator.validateCreatePermission).toHaveBeenCalledTimes(2);
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'notifications.types.ticket_created.title',
        { ticketNumber: 'T-12345' }
      );
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'notifications.types.ticket_created.message',
        { ticketTitle: 'Test Ticket', userName: 'Test User' }
      );
      expect(mockDataSecurity.validateNotificationData).toHaveBeenCalledTimes(2);
      expect(mockDataSecurity.processNotificationForStorage).toHaveBeenCalledTimes(2);
      expect(mockSupabaseQuery.insert).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle permission denied for some recipients', async () => {
      mockPermissionValidator.validateCreatePermission
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValueOnce({ allowed: false, reason: 'Permission denied' });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket',
        userName: 'Test User'
      };

      const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

      expect(result).toBe(true);
      // Should still create notification for allowed recipient
      expect(mockSupabaseQuery.insert).toHaveBeenCalled();
    });

    it('should handle invalid notification data', async () => {
      mockDataSecurity.validateNotificationData.mockReturnValue({
        valid: false,
        errors: ['Invalid data']
      });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket',
        userName: 'Test User'
      };

      const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

      expect(result).toBe(true);
      // Should not insert any notifications due to validation failure
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith([]);
    });
  });

  describe('createTicketAssignedNotification', () => {
    it('should create ticket assigned notification', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket'
      };

      const result = await NotificationService.createTicketAssignedNotification(
        'ticket-1',
        'agent-1',
        context
      );

      expect(mockPermissionValidator.validateCreatePermission).toHaveBeenCalledWith({
        userId: 'test-user-id',
        targetUserId: 'agent-1',
        notificationType: 'ticket_assigned',
        ticketId: 'ticket-1',
        priority: 'high'
      });
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'notifications.types.ticket_assigned.title',
        { ticketNumber: 'T-12345' }
      );
      expect(result).toBe(true);
    });

    it('should handle permission denied', async () => {
      mockPermissionValidator.validateCreatePermission.mockResolvedValue({
        allowed: false,
        reason: 'Permission denied'
      });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket'
      };

      const result = await NotificationService.createTicketAssignedNotification(
        'ticket-1',
        'agent-1',
        context
      );

      expect(result).toBe(false);
      expect(mockSupabaseQuery.insert).not.toHaveBeenCalled();
    });
  });

  describe('createTicketStatusNotification', () => {
    it('should create status change notification', async () => {
      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket',
        newStatus: 'In Progress'
      };

      const result = await NotificationService.createTicketStatusNotification(
        'ticket-1',
        'user-1',
        context
      );

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'notifications.types.status_changed.title',
        { ticketNumber: 'T-12345' }
      );
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        'notifications.types.status_changed.message',
        { ticketTitle: 'Test Ticket', status: 'In Progress' }
      );
      expect(result).toBe(true);
    });
  });

  describe('createCommentNotification', () => {
    it('should create comment notifications for ticket creator and assigned agent', async () => {
      const mockTicketQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            user_id: 'creator-1',
            assigned_to: 'agent-1',
            title: 'Test Ticket',
            ticket_number: 'T-12345'
          },
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'tickets_new') return mockTicketQuery;
        return mockSupabaseQuery;
      });

      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const context: NotificationContext = {
        userName: 'commenter'
      };

      const result = await NotificationService.createCommentNotification('ticket-1', context);

      expect(mockTicketQuery.select).toHaveBeenCalledWith('user_id, assigned_to, title, ticket_number');
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'creator-1',
            type: 'comment_added'
          }),
          expect.objectContaining({
            user_id: 'agent-1',
            type: 'comment_added'
          })
        ])
      );
      expect(result).toBe(true);
    });

    it('should not notify ticket creator if they are the commenter', async () => {
      const mockTicketQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            user_id: 'creator-1',
            assigned_to: 'agent-1',
            title: 'Test Ticket',
            ticket_number: 'T-12345'
          },
          error: null
        })
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'tickets_new') return mockTicketQuery;
        return mockSupabaseQuery;
      });

      mockSupabaseQuery.mockResolvedValue({
        error: null
      });

      const context: NotificationContext = {
        userName: 'ticket_creator'
      };

      const result = await NotificationService.createCommentNotification('ticket-1', context);

      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'agent-1',
            type: 'comment_added'
          })
        ])
      );
      expect(result).toBe(true);
    });
  });

  describe('Helper methods', () => {
    describe('getNotificationIcon', () => {
      it('should return correct icons for notification types', () => {
        expect(NotificationService.getNotificationIcon('ticket_created')).toBe('🎫');
        expect(NotificationService.getNotificationIcon('ticket_assigned')).toBe('👤');
        expect(NotificationService.getNotificationIcon('status_changed')).toBe('🔄');
        expect(NotificationService.getNotificationIcon('comment_added')).toBe('💬');
        expect(NotificationService.getNotificationIcon('sla_warning')).toBe('⚠️');
        expect(NotificationService.getNotificationIcon('sla_breach')).toBe('🚨');
        expect(NotificationService.getNotificationIcon('unknown_type')).toBe('🔔');
      });
    });

    describe('getNotificationColor', () => {
      it('should return correct colors for priorities', () => {
        expect(NotificationService.getNotificationColor('low')).toBe('text-blue-600');
        expect(NotificationService.getNotificationColor('medium')).toBe('text-yellow-600');
        expect(NotificationService.getNotificationColor('high')).toBe('text-red-600');
        expect(NotificationService.getNotificationColor('unknown')).toBe('text-yellow-600');
      });
    });

    describe('showToastNotification', () => {
      it('should show toast notification with correct content', () => {
        const notification: Notification = {
          id: '1',
          user_id: 'user-1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          ticket_id: 'ticket-1',
          created_at: '2024-01-01T00:00:00Z'
        };

        NotificationService.showToastNotification(notification);

        expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledWith({
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created'
        });
        expect(toast).toHaveBeenCalledWith(
          '🎫 Test Title: Test Message',
          expect.objectContaining({
            duration: 5000,
            action: expect.objectContaining({
              label: 'notifications.actions.viewTicket'
            })
          })
        );
      });

      it('should show toast without action for notifications without ticket_id', () => {
        const notification: Notification = {
          id: '1',
          user_id: 'user-1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          created_at: '2024-01-01T00:00:00Z'
        };

        NotificationService.showToastNotification(notification);

        expect(toast).toHaveBeenCalledWith(
          '🎫 Test Title: Test Message',
          expect.objectContaining({
            duration: 5000,
            action: undefined
          })
        );
      });
    });
  });

  describe('SLA Notifications', () => {
    describe('createSLAWarningNotification', () => {
      it('should create SLA warning notification', async () => {
        mockSupabaseQuery.mockResolvedValue({
          error: null
        });

        const context: NotificationContext = {
          ticketNumber: 'T-12345'
        };

        const result = await NotificationService.createSLAWarningNotification(
          'ticket-1',
          'user-1',
          context
        );

        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          'notifications.types.sla_warning.title'
        );
        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          'notifications.types.sla_warning.message',
          { ticketNumber: 'T-12345' }
        );
        expect(mockSupabaseQuery.insert).toHaveBeenCalledWith([
          expect.objectContaining({
            user_id: 'user-1',
            type: 'sla_warning',
            priority: 'high',
            ticket_id: 'ticket-1'
          })
        ]);
        expect(result).toBe(true);
      });
    });

    describe('createSLABreachNotification', () => {
      it('should create SLA breach notification', async () => {
        mockSupabaseQuery.mockResolvedValue({
          error: null
        });

        const context: NotificationContext = {
          ticketNumber: 'T-12345'
        };

        const result = await NotificationService.createSLABreachNotification(
          'ticket-1',
          'user-1',
          context
        );

        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          'notifications.types.sla_breach.title'
        );
        expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
          'notifications.types.sla_breach.message',
          { ticketNumber: 'T-12345' }
        );
        expect(mockSupabaseQuery.insert).toHaveBeenCalledWith([
          expect.objectContaining({
            user_id: 'user-1',
            type: 'sla_breach',
            priority: 'high',
            ticket_id: 'ticket-1'
          })
        ]);
        expect(result).toBe(true);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle exceptions in getNotifications', async () => {
      (supabase.from as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('should handle exceptions in getUnreadCount', async () => {
      (supabase.from as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await NotificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('should handle exceptions in markAsRead', async () => {
      (supabase.auth.getUser as any).mockImplementation(() => {
        throw new Error('Auth error');
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });

    it('should handle exceptions in notification creation methods', async () => {
      (supabase.auth.getUser as any).mockImplementation(() => {
        throw new Error('Auth error');
      });

      const context: NotificationContext = {
        ticketNumber: 'T-12345',
        ticketTitle: 'Test Ticket'
      };

      const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

      expect(result).toBe(false);
    });
  });
});