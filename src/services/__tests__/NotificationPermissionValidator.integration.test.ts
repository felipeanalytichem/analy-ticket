import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationPermissionValidator } from '../NotificationPermissionValidator';
import { NotificationService } from '@/lib/notificationService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn()
        })),
        in: vi.fn(() => ({
          single: vi.fn()
        })),
        order: vi.fn(() => ({
          limit: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}));

describe('NotificationPermissionValidator Integration Tests', () => {
  let validator: NotificationPermissionValidator;
  let mockSupabaseAuth: any;
  let mockSupabaseFrom: any;

  beforeEach(() => {
    validator = NotificationPermissionValidator.getInstance();
    mockSupabaseAuth = vi.mocked(supabase.auth);
    mockSupabaseFrom = vi.mocked(supabase.from);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Integration with NotificationService', () => {
    it('should validate permissions when marking notification as read', async () => {
      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      // Mock notification query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user1', type: 'ticket_created', ticket_id: 'ticket1' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      // Mock notification update
      mockSupabaseFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await NotificationService.markAsRead('notification1');

      expect(result).toBe(true);
      expect(mockSupabaseAuth.getUser).toHaveBeenCalled();
    });

    it('should deny marking notification as read for unauthorized user', async () => {
      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      // Mock notification query - different user's notification
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'other_user', type: 'ticket_created', ticket_id: 'ticket1' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await NotificationService.markAsRead('notification1');

      expect(result).toBe(false);
    });

    it('should validate permissions when deleting notification', async () => {
      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      // Mock notification query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user1', type: 'ticket_created', ticket_id: 'ticket1' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      // Mock notification delete
      mockSupabaseFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await NotificationService.deleteNotification('notification1');

      expect(result).toBe(true);
    });

    it('should validate permissions when getting notifications for other users', async () => {
      // Mock authenticated user (admin)
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1', email: 'admin@test.com' } },
        error: null
      });

      // Mock admin role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock notifications query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'notification1',
                    user_id: 'user1',
                    title: 'Test Notification',
                    message: 'Test message',
                    type: 'ticket_created',
                    read: false,
                    priority: 'medium',
                    created_at: '2024-01-01T00:00:00Z',
                    ticket_id: 'ticket1'
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      // Mock ticket query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'ticket1',
                title: 'Test Ticket',
                ticket_number: 'T-001',
                status: 'open',
                priority: 'medium'
              },
              error: null
            })
          })
        })
      });

      const notifications = await NotificationService.getNotifications('user1');

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toBe('user1');
    });

    it('should deny getting notifications for other users as regular user', async () => {
      // Mock authenticated user (regular user)
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      const notifications = await NotificationService.getNotifications('other_user');

      expect(notifications).toHaveLength(0);
    });
  });

  describe('Role-based access scenarios', () => {
    it('should handle agent accessing assigned ticket notifications', async () => {
      const context = {
        userId: 'agent1',
        targetUserId: 'user1',
        notificationType: 'status_changed' as const,
        ticketId: 'ticket1',
        priority: 'medium' as const
      };

      // Mock agent role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'agent' },
              error: null
            })
          })
        })
      });

      // Mock ticket query - agent is assigned
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user1', assigned_to: 'agent1' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await validator.validateCreatePermission(context);

      expect(result.allowed).toBe(true);
    });

    it('should handle agent accessing unassigned ticket notifications', async () => {
      const context = {
        userId: 'agent1',
        targetUserId: 'user1',
        notificationType: 'status_changed' as const,
        ticketId: 'ticket1',
        priority: 'medium' as const
      };

      // Mock agent role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'agent' },
              error: null
            })
          })
        })
      });

      // Mock ticket query - agent is not assigned
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user1', assigned_to: 'other_agent' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await validator.validateCreatePermission(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No access to this ticket');
    });

    it('should handle user accessing their own ticket notifications', async () => {
      const context = {
        userId: 'user1',
        targetUserId: 'user1',
        notificationType: 'comment_added' as const,
        ticketId: 'ticket1',
        priority: 'medium' as const
      };

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      // Mock ticket query - user owns the ticket
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user1', assigned_to: 'agent1' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await validator.validateCreatePermission(context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Audit logging integration', () => {
    it('should log successful permission grants', async () => {
      const context = {
        userId: 'admin1',
        targetUserId: 'user1',
        notificationType: 'ticket_created' as const,
        priority: 'medium' as const
      };

      // Mock admin role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        insert: mockInsert
      });

      await validator.validateCreatePermission(context);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'admin1',
          action: 'create',
          notification_type: 'ticket_created',
          target_user_id: 'user1',
          allowed: true
        })
      );
    });

    it('should log permission denials', async () => {
      const context = {
        userId: 'user1',
        targetUserId: 'user2',
        notificationType: 'sla_breach' as const,
        priority: 'high' as const
      };

      // Mock user role query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValueOnce({
        insert: mockInsert
      });

      await validator.validateCreatePermission(context);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user1',
          action: 'create',
          notification_type: 'sla_breach',
          target_user_id: 'user2',
          allowed: false,
          reason: expect.stringContaining('cannot create notifications of type')
        })
      );
    });
  });

  describe('Error handling in integration scenarios', () => {
    it('should handle database connection errors gracefully', async () => {
      const context = {
        userId: 'user1',
        targetUserId: 'user2',
        notificationType: 'ticket_created' as const,
        priority: 'medium' as const
      };

      // Mock database error
      mockSupabaseFrom.mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const result = await validator.validateCreatePermission(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not found or invalid role');
    });

    it('should handle missing user gracefully', async () => {
      // Mock authenticated user not found
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User not found' }
      });

      const result = await NotificationService.markAsRead('notification1');

      expect(result).toBe(false);
    });
  });
});