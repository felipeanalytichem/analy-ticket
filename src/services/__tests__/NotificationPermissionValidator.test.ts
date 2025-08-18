import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationPermissionValidator } from '../NotificationPermissionValidator';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn()
        })),
        in: vi.fn(() => ({
          single: vi.fn()
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

describe('NotificationPermissionValidator', () => {
  let validator: NotificationPermissionValidator;
  let mockSupabaseFrom: any;

  beforeEach(() => {
    validator = NotificationPermissionValidator.getInstance();
    mockSupabaseFrom = vi.mocked(supabase.from);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCreatePermission', () => {
    it('should allow admin to create any notification type', async () => {
      // Mock user role query
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

      // Mock ticket access query
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

      const result = await validator.validateCreatePermission({
        userId: 'admin1',
        targetUserId: 'user1',
        notificationType: 'sla_breach',
        ticketId: 'ticket1',
        priority: 'high'
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny user creating admin-only notification types', async () => {
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
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await validator.validateCreatePermission({
        userId: 'user1',
        targetUserId: 'user2',
        notificationType: 'sla_breach',
        priority: 'high'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot create notifications of type');
      expect(result.requiredRole).toBe('admin');
    });

    it('should allow agent to create ticket-related notifications', async () => {
      // Mock user role query
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

      // Mock ticket access query
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

      const result = await validator.validateCreatePermission({
        userId: 'agent1',
        targetUserId: 'user1',
        notificationType: 'ticket_assigned',
        ticketId: 'ticket1',
        priority: 'medium'
      });

      expect(result.allowed).toBe(true);
    });

    it('should deny access when user not found', async () => {
      // Mock user role query returning null
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' }
            })
          })
        })
      });

      const result = await validator.validateCreatePermission({
        userId: 'nonexistent',
        targetUserId: 'user1',
        notificationType: 'ticket_created',
        priority: 'medium'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not found or invalid role');
    });

    it('should validate ticket access for ticket-related notifications', async () => {
      // Mock user role query
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

      // Mock ticket access query - agent not assigned to ticket
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

      const result = await validator.validateCreatePermission({
        userId: 'agent1',
        targetUserId: 'user1',
        notificationType: 'status_changed',
        ticketId: 'ticket1',
        priority: 'medium'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No access to this ticket');
    });
  });

  describe('validateReadPermission', () => {
    it('should allow users to read their own notifications', async () => {
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

      const result = await validator.validateReadPermission('user1', 'notification1');

      expect(result.allowed).toBe(true);
    });

    it('should allow admins to read all notifications', async () => {
      // Mock user role query
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

      // Mock notification query
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

      const result = await validator.validateReadPermission('admin1', 'notification1');

      expect(result.allowed).toBe(true);
    });

    it('should deny regular users reading other users notifications', async () => {
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

      const result = await validator.validateReadPermission('user1', 'notification1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Insufficient permissions to read this notification');
    });

    it('should handle notification not found', async () => {
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

      // Mock notification query returning null
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const result = await validator.validateReadPermission('user1', 'nonexistent');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Notification not found');
    });
  });

  describe('validateModifyPermission', () => {
    it('should allow users to modify their own notifications', async () => {
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

      const result = await validator.validateModifyPermission('user1', 'notification1', 'update');

      expect(result.allowed).toBe(true);
    });

    it('should allow admins to modify all notifications', async () => {
      // Mock user role query
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

      // Mock notification query
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

      const result = await validator.validateModifyPermission('admin1', 'notification1', 'delete');

      expect(result.allowed).toBe(true);
    });

    it('should deny regular users modifying other users notifications', async () => {
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

      const result = await validator.validateModifyPermission('user1', 'notification1', 'delete');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Insufficient permissions to modify this notification');
    });
  });

  describe('validateAnalyticsAccess', () => {
    it('should allow admins to access analytics', async () => {
      // Mock user role query
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

      const result = await validator.validateAnalyticsAccess('admin1');

      expect(result.allowed).toBe(true);
    });

    it('should deny non-admins access to analytics', async () => {
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

      const result = await validator.validateAnalyticsAccess('user1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Only administrators can access notification analytics');
      expect(result.requiredRole).toBe('admin');
    });
  });

  describe('getAccessLogs', () => {
    it('should allow admins to get access logs', async () => {
      // Mock user role query
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

      // Mock access logs query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'log1',
                  user_id: 'user1',
                  action: 'create',
                  allowed: true,
                  created_at: '2024-01-01T00:00:00Z'
                }
              ],
              error: null
            })
          })
        })
      });

      const logs = await validator.getAccessLogs('admin1');

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('create');
    });

    it('should deny non-admins access to logs', async () => {
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
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const logs = await validator.getAccessLogs('user1');

      expect(logs).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock user role query with error
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await validator.validateCreatePermission({
        userId: 'user1',
        targetUserId: 'user2',
        notificationType: 'ticket_created',
        priority: 'medium'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not found or invalid role');
    });

    it('should handle exceptions in permission validation', async () => {
      // Mock user role query to throw exception
      mockSupabaseFrom.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      const result = await validator.validateCreatePermission({
        userId: 'user1',
        targetUserId: 'user2',
        notificationType: 'ticket_created',
        priority: 'medium'
      });

      expect(result.allowed).toBe(false);
      // The exception is caught in getUserRole and returns null, which results in "User not found or invalid role"
      expect(result.reason).toBe('User not found or invalid role');
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = NotificationPermissionValidator.getInstance();
      const instance2 = NotificationPermissionValidator.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});