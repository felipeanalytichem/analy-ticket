import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationService } from '../notificationService';
import { NotificationTestUtils } from './notificationTestUtils';

// Mock all dependencies
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(),
    channel: vi.fn()
  }
}));

vi.mock('sonner', () => ({
  toast: vi.fn()
}));

vi.mock('@/services/NotificationTemplateService', () => ({
  NotificationTemplateService: {
    getInstance: vi.fn()
  }
}));

vi.mock('@/services/NotificationPermissionValidator', () => ({
  NotificationPermissionValidator: {
    getInstance: vi.fn()
  }
}));

vi.mock('@/services/NotificationDataSecurity', () => ({
  NotificationDataSecurity: {
    getInstance: vi.fn()
  }
}));

vi.mock('@/i18n', () => ({
  default: {
    t: vi.fn((key: string) => key)
  }
}));

describe('NotificationService - Comprehensive Tests', () => {
  let mockSupabase: any;
  let mockQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup comprehensive mock query builder
    mockQuery = {
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

    // Make all methods return a promise that can be resolved
    Object.keys(mockQuery).forEach(key => {
      if (typeof mockQuery[key] === 'function') {
        mockQuery[key].mockResolvedValue = vi.fn();
      }
    });

    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } }
        })
      },
      from: vi.fn().mockReturnValue(mockQuery),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })
    };

    // Mock the imported supabase
    const { supabase } = require('../supabase');
    Object.assign(supabase, mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationService.getInstance();
      const instance2 = NotificationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockNotifications = NotificationTestUtils.createMockNotificationList(3);
      
      mockQuery.order.mockResolvedValue({
        data: mockNotifications,
        error: null
      });

      const result = await NotificationService.getNotifications('test-user-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQuery.limit).toHaveBeenCalledWith(50);
      expect(result).toHaveLength(3);
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await NotificationService.getNotifications('test-user-id');

      expect(result).toEqual([]);
    });

    it('should handle null data response', async () => {
      mockQuery.order.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await NotificationService.getNotifications('test-user-id');

      expect(result).toEqual([]);
    });

    it('should apply limit parameter', async () => {
      mockQuery.order.mockResolvedValue({
        data: [],
        error: null
      });

      await NotificationService.getNotifications('test-user-id', 25);

      expect(mockQuery.limit).toHaveBeenCalledWith(25);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count successfully', async () => {
      mockQuery.eq.mockResolvedValue({
        count: 5,
        error: null
      });

      const result = await NotificationService.getUnreadCount('test-user-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('read', false);
      expect(result).toBe(5);
    });

    it('should handle database errors', async () => {
      mockQuery.eq.mockResolvedValue({
        count: null,
        error: { message: 'Database error' }
      });

      const result = await NotificationService.getUnreadCount('test-user-id');

      expect(result).toBe(0);
    });

    it('should handle null count', async () => {
      mockQuery.eq.mockResolvedValue({
        count: null,
        error: null
      });

      const result = await NotificationService.getUnreadCount('test-user-id');

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    beforeEach(() => {
      // Mock permission validator
      const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
      NotificationPermissionValidator.getInstance.mockReturnValue({
        validateModifyPermission: vi.fn().mockResolvedValue({ allowed: true })
      });
    });

    it('should mark notification as read successfully', async () => {
      mockQuery.eq.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockQuery.update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'notification-1');
      expect(result).toBe(true);
    });

    it('should handle permission denied', async () => {
      const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
      NotificationPermissionValidator.getInstance.mockReturnValue({
        validateModifyPermission: vi.fn().mockResolvedValue({ 
          allowed: false, 
          reason: 'Permission denied' 
        })
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
      expect(mockQuery.update).not.toHaveBeenCalled();
    });

    it('should handle unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockQuery.eq.mockResolvedValue({
        error: { message: 'Database error' }
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for own user', async () => {
      mockQuery.eq.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAllAsRead('test-user-id');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockQuery.update).toHaveBeenCalledWith({
        read: true,
        updated_at: expect.any(String)
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockQuery.eq).toHaveBeenCalledWith('read', false);
      expect(result).toBe(true);
    });

    it('should allow admin to mark all notifications as read for other users', async () => {
      // Mock user query for admin check
      const mockUserQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null
        })
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        return mockQuery;
      });

      mockQuery.eq.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.markAllAsRead('other-user-id');

      expect(mockUserQuery.select).toHaveBeenCalledWith('role');
      expect(mockUserQuery.eq).toHaveBeenCalledWith('id', 'test-user-id');
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

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return mockUserQuery;
        return mockQuery;
      });

      const result = await NotificationService.markAllAsRead('other-user-id');

      expect(result).toBe(false);
      expect(mockQuery.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteNotification', () => {
    beforeEach(() => {
      const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
      NotificationPermissionValidator.getInstance.mockReturnValue({
        validateModifyPermission: vi.fn().mockResolvedValue({ allowed: true })
      });
    });

    it('should delete notification successfully', async () => {
      mockQuery.eq.mockResolvedValue({
        error: null
      });

      const result = await NotificationService.deleteNotification('notification-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'notification-1');
      expect(result).toBe(true);
    });

    it('should handle permission denied', async () => {
      const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
      NotificationPermissionValidator.getInstance.mockReturnValue({
        validateModifyPermission: vi.fn().mockResolvedValue({ 
          allowed: false, 
          reason: 'Permission denied' 
        })
      });

      const result = await NotificationService.deleteNotification('notification-1');

      expect(result).toBe(false);
      expect(mockQuery.delete).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToNotifications', () => {
    it('should create real-time subscription', () => {
      const callback = vi.fn();
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const result = NotificationService.subscribeToNotifications('user-1', callback);

      expect(mockSupabase.channel).toHaveBeenCalledWith('notifications-user-1', {
        config: { broadcast: { self: false } }
      });
      expect(mockChannel.on).toHaveBeenCalledTimes(2);
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(result).toBe(mockChannel);
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
        const { toast } = require('sonner');
        const { NotificationTemplateService } = require('@/services/NotificationTemplateService');
        
        NotificationTemplateService.getInstance.mockReturnValue({
          processNotificationForDisplay: vi.fn().mockReturnValue({
            title: 'Test Title',
            message: 'Test Message'
          })
        });

        const notification = NotificationTestUtils.createMockNotification({
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          ticket_id: 'ticket-1'
        });

        NotificationService.showToastNotification(notification);

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
        const { toast } = require('sonner');
        const { NotificationTemplateService } = require('@/services/NotificationTemplateService');
        
        NotificationTemplateService.getInstance.mockReturnValue({
          processNotificationForDisplay: vi.fn().mockReturnValue({
            title: 'Test Title',
            message: 'Test Message'
          })
        });

        const notification = NotificationTestUtils.createMockNotification({
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created'
        });
        delete notification.ticket_id;

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

  describe('Notification creation methods', () => {
    beforeEach(() => {
      // Mock all required services
      const { NotificationTemplateService } = require('@/services/NotificationTemplateService');
      const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
      const { NotificationDataSecurity } = require('@/services/NotificationDataSecurity');

      NotificationTemplateService.getInstance.mockReturnValue({
        createTemplate: vi.fn().mockReturnValue({ template: 'test-template' }),
        serializeTemplate: vi.fn().mockReturnValue('serialized-template')
      });

      NotificationPermissionValidator.getInstance.mockReturnValue({
        validateCreatePermission: vi.fn().mockResolvedValue({ allowed: true })
      });

      NotificationDataSecurity.getInstance.mockReturnValue({
        validateNotificationData: vi.fn().mockReturnValue({ valid: true }),
        processNotificationForStorage: vi.fn().mockResolvedValue({
          title: 'Processed Title',
          message: 'Processed Message',
          encrypted_fields: null,
          encryption_data: null
        })
      });
    });

    describe('createTicketCreatedNotification', () => {
      it('should create ticket created notifications for all agents', async () => {
        const mockAgentsQuery = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'agent-1' }, { id: 'agent-2' }],
            error: null
          })
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'users') return mockAgentsQuery;
          return mockQuery;
        });

        mockQuery.insert.mockResolvedValue({
          error: null
        });

        const context = NotificationTestUtils.createMockNotificationContext();
        const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

        expect(mockAgentsQuery.select).toHaveBeenCalledWith('id');
        expect(mockAgentsQuery.in).toHaveBeenCalledWith('role', ['agent', 'admin']);
        expect(mockQuery.insert).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      it('should handle database errors', async () => {
        const mockAgentsQuery = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'users') return mockAgentsQuery;
          return mockQuery;
        });

        const context = NotificationTestUtils.createMockNotificationContext();
        const result = await NotificationService.createTicketCreatedNotification('ticket-1', context);

        expect(result).toBe(false);
      });
    });

    describe('createTicketAssignedNotification', () => {
      it('should create ticket assigned notification', async () => {
        mockQuery.insert.mockResolvedValue({
          error: null
        });

        const context = NotificationTestUtils.createMockNotificationContext();
        const result = await NotificationService.createTicketAssignedNotification(
          'ticket-1',
          'agent-1',
          context
        );

        expect(mockQuery.insert).toHaveBeenCalledWith([
          expect.objectContaining({
            user_id: 'agent-1',
            type: 'ticket_assigned',
            priority: 'high',
            ticket_id: 'ticket-1'
          })
        ]);
        expect(result).toBe(true);
      });

      it('should handle permission denied', async () => {
        const { NotificationPermissionValidator } = require('@/services/NotificationPermissionValidator');
        NotificationPermissionValidator.getInstance.mockReturnValue({
          validateCreatePermission: vi.fn().mockResolvedValue({ 
            allowed: false, 
            reason: 'Permission denied' 
          })
        });

        const context = NotificationTestUtils.createMockNotificationContext();
        const result = await NotificationService.createTicketAssignedNotification(
          'ticket-1',
          'agent-1',
          context
        );

        expect(result).toBe(false);
        expect(mockQuery.insert).not.toHaveBeenCalled();
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

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'tickets_new') return mockTicketQuery;
          return mockQuery;
        });

        mockQuery.insert.mockResolvedValue({
          error: null
        });

        const context = NotificationTestUtils.createMockNotificationContext({
          userName: 'commenter'
        });

        const result = await NotificationService.createCommentNotification('ticket-1', context);

        expect(mockTicketQuery.select).toHaveBeenCalledWith('user_id, assigned_to, title, ticket_number');
        expect(mockQuery.insert).toHaveBeenCalledWith(
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
    });
  });

  describe('Error handling', () => {
    it('should handle exceptions in getNotifications', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await NotificationService.getNotifications('user-1');

      expect(result).toEqual([]);
    });

    it('should handle exceptions in getUnreadCount', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await NotificationService.getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('should handle exceptions in markAsRead', async () => {
      mockSupabase.auth.getUser.mockImplementation(() => {
        throw new Error('Auth error');
      });

      const result = await NotificationService.markAsRead('notification-1');

      expect(result).toBe(false);
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large notification datasets', async () => {
      const largeDataset = NotificationTestUtils.createMockNotificationList(1000);
      
      mockQuery.order.mockResolvedValue({
        data: largeDataset,
        error: null
      });

      const startTime = Date.now();
      const result = await NotificationService.getNotifications('test-user-id', 1000);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations', async () => {
      mockQuery.order.mockResolvedValue({
        data: NotificationTestUtils.createMockNotificationList(5),
        error: null
      });

      // Simulate concurrent calls
      const promises = Array.from({ length: 10 }, () => 
        NotificationService.getNotifications('test-user-id')
      );

      const results = await Promise.all(promises);

      // All results should be identical
      results.forEach(result => {
        expect(result).toHaveLength(5);
      });
    });

    it('should handle null/undefined user IDs gracefully', async () => {
      mockQuery.order.mockResolvedValue({
        data: [],
        error: null
      });

      const result1 = await NotificationService.getNotifications('');
      const result2 = await NotificationService.getUnreadCount('');

      expect(result1).toEqual([]);
      expect(result2).toBe(0);
    });

    it('should handle malformed notification data', async () => {
      const malformedData = [
        { id: 'test', user_id: null, message: null }, // Missing required fields
        { invalid: 'data' }, // Completely wrong structure
        null, // Null entry
        undefined // Undefined entry
      ];

      mockQuery.order.mockResolvedValue({
        data: malformedData,
        error: null
      });

      const result = await NotificationService.getNotifications('test-user-id');

      // Should handle malformed data gracefully
      expect(Array.isArray(result)).toBe(true);
    });
  });
});