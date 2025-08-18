import { supabase } from '@/lib/supabase';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];
type NotificationType = Database['public']['Enums']['notification_type'];

export interface NotificationPermissionContext {
  userId: string;
  targetUserId: string;
  notificationType: NotificationType;
  ticketId?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface PermissionValidationResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: UserRole;
}

export interface NotificationAccessLog {
  id?: string;
  user_id: string;
  action: 'create' | 'read' | 'update' | 'delete';
  notification_id?: string;
  notification_type?: NotificationType;
  target_user_id?: string;
  ticket_id?: string;
  allowed: boolean;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

/**
 * Service for validating notification permissions and logging access
 */
export class NotificationPermissionValidator {
  private static instance: NotificationPermissionValidator;

  static getInstance(): NotificationPermissionValidator {
    if (!NotificationPermissionValidator.instance) {
      NotificationPermissionValidator.instance = new NotificationPermissionValidator();
    }
    return NotificationPermissionValidator.instance;
  }

  /**
   * Validate if a user can create a notification
   */
  async validateCreatePermission(context: NotificationPermissionContext): Promise<PermissionValidationResult> {
    try {
      // Get user role
      const userRole = await this.getUserRole(context.userId);
      if (!userRole) {
        return {
          allowed: false,
          reason: 'User not found or invalid role'
        };
      }

      // Check role-based permissions for notification creation
      const rolePermission = this.checkRoleBasedCreatePermission(userRole, context.notificationType);
      if (!rolePermission.allowed) {
        await this.logAccess({
          user_id: context.userId,
          action: 'create',
          notification_type: context.notificationType,
          target_user_id: context.targetUserId,
          ticket_id: context.ticketId,
          allowed: false,
          reason: rolePermission.reason,
          created_at: new Date().toISOString()
        });
        return rolePermission;
      }

      // Check ticket-specific permissions if applicable
      if (context.ticketId) {
        const ticketPermission = await this.validateTicketAccess(context.userId, context.ticketId, userRole);
        if (!ticketPermission.allowed) {
          await this.logAccess({
            user_id: context.userId,
            action: 'create',
            notification_type: context.notificationType,
            target_user_id: context.targetUserId,
            ticket_id: context.ticketId,
            allowed: false,
            reason: ticketPermission.reason,
            created_at: new Date().toISOString()
          });
          return ticketPermission;
        }
      }

      // Log successful permission validation
      await this.logAccess({
        user_id: context.userId,
        action: 'create',
        notification_type: context.notificationType,
        target_user_id: context.targetUserId,
        ticket_id: context.ticketId,
        allowed: true,
        created_at: new Date().toISOString()
      });

      return { allowed: true };
    } catch (error) {
      console.error('Error validating create permission:', error);
      return {
        allowed: false,
        reason: 'Permission validation failed'
      };
    }
  }

  /**
   * Validate if a user can read notifications
   */
  async validateReadPermission(userId: string, notificationId: string): Promise<PermissionValidationResult> {
    try {
      // Get user role
      const userRole = await this.getUserRole(userId);
      if (!userRole) {
        return {
          allowed: false,
          reason: 'User not found or invalid role'
        };
      }

      // Get notification details
      const { data: notification, error } = await supabase
        .from('notifications')
        .select('user_id, type, ticket_id')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        await this.logAccess({
          user_id: userId,
          action: 'read',
          notification_id: notificationId,
          allowed: false,
          reason: 'Notification not found',
          created_at: new Date().toISOString()
        });
        return {
          allowed: false,
          reason: 'Notification not found'
        };
      }

      // Users can always read their own notifications
      if (notification.user_id === userId) {
        await this.logAccess({
          user_id: userId,
          action: 'read',
          notification_id: notificationId,
          allowed: true,
          created_at: new Date().toISOString()
        });
        return { allowed: true };
      }

      // Admins can read all notifications
      if (userRole === 'admin') {
        await this.logAccess({
          user_id: userId,
          action: 'read',
          notification_id: notificationId,
          allowed: true,
          reason: 'Admin access',
          created_at: new Date().toISOString()
        });
        return { allowed: true };
      }

      // Agents can read notifications for tickets they're involved with
      if (userRole === 'agent' && notification.ticket_id) {
        const ticketAccess = await this.validateTicketAccess(userId, notification.ticket_id, userRole);
        await this.logAccess({
          user_id: userId,
          action: 'read',
          notification_id: notificationId,
          ticket_id: notification.ticket_id,
          allowed: ticketAccess.allowed,
          reason: ticketAccess.reason,
          created_at: new Date().toISOString()
        });
        return ticketAccess;
      }

      // Default deny
      await this.logAccess({
        user_id: userId,
        action: 'read',
        notification_id: notificationId,
        allowed: false,
        reason: 'Insufficient permissions',
        created_at: new Date().toISOString()
      });

      return {
        allowed: false,
        reason: 'Insufficient permissions to read this notification'
      };
    } catch (error) {
      console.error('Error validating read permission:', error);
      return {
        allowed: false,
        reason: 'Permission validation failed'
      };
    }
  }

  /**
   * Validate if a user can update/delete notifications
   */
  async validateModifyPermission(userId: string, notificationId: string, action: 'update' | 'delete'): Promise<PermissionValidationResult> {
    try {
      // Get user role
      const userRole = await this.getUserRole(userId);
      if (!userRole) {
        return {
          allowed: false,
          reason: 'User not found or invalid role'
        };
      }

      // Get notification details
      const { data: notification, error } = await supabase
        .from('notifications')
        .select('user_id, type, ticket_id')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        await this.logAccess({
          user_id: userId,
          action,
          notification_id: notificationId,
          allowed: false,
          reason: 'Notification not found',
          created_at: new Date().toISOString()
        });
        return {
          allowed: false,
          reason: 'Notification not found'
        };
      }

      // Users can modify their own notifications (mark as read, delete)
      if (notification.user_id === userId) {
        await this.logAccess({
          user_id: userId,
          action,
          notification_id: notificationId,
          allowed: true,
          created_at: new Date().toISOString()
        });
        return { allowed: true };
      }

      // Admins can modify all notifications
      if (userRole === 'admin') {
        await this.logAccess({
          user_id: userId,
          action,
          notification_id: notificationId,
          allowed: true,
          reason: 'Admin access',
          created_at: new Date().toISOString()
        });
        return { allowed: true };
      }

      // Default deny for modification by others
      await this.logAccess({
        user_id: userId,
        action,
        notification_id: notificationId,
        allowed: false,
        reason: 'Insufficient permissions',
        created_at: new Date().toISOString()
      });

      return {
        allowed: false,
        reason: 'Insufficient permissions to modify this notification'
      };
    } catch (error) {
      console.error('Error validating modify permission:', error);
      return {
        allowed: false,
        reason: 'Permission validation failed'
      };
    }
  }

  /**
   * Get user role from database
   */
  private async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !user) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return user.role;
    } catch (error) {
      console.error('Error in getUserRole:', error);
      return null;
    }
  }

  /**
   * Check role-based permissions for notification creation
   */
  private checkRoleBasedCreatePermission(userRole: UserRole, notificationType: NotificationType): PermissionValidationResult {
    // Define which roles can create which notification types
    const rolePermissions: Record<UserRole, NotificationType[]> = {
      'user': [
        'comment_added' // Users can create notifications when they comment
      ],
      'agent': [
        'ticket_created',
        'ticket_updated',
        'ticket_assigned',
        'comment_added',
        'status_changed',
        'priority_changed',
        'assignment_changed'
      ],
      'admin': [
        'ticket_created',
        'ticket_updated',
        'ticket_assigned',
        'comment_added',
        'status_changed',
        'priority_changed',
        'assignment_changed',
        'sla_warning',
        'sla_breach'
      ]
    };

    const allowedTypes = rolePermissions[userRole] || [];
    
    if (allowedTypes.includes(notificationType)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Role '${userRole}' cannot create notifications of type '${notificationType}'`,
      requiredRole: this.getMinimumRoleForNotificationType(notificationType)
    };
  }

  /**
   * Get minimum role required for a notification type
   */
  private getMinimumRoleForNotificationType(notificationType: NotificationType): UserRole {
    const adminOnlyTypes: NotificationType[] = ['sla_warning', 'sla_breach'];
    const agentTypes: NotificationType[] = [
      'ticket_created',
      'ticket_updated',
      'ticket_assigned',
      'status_changed',
      'priority_changed',
      'assignment_changed'
    ];

    if (adminOnlyTypes.includes(notificationType)) {
      return 'admin';
    }
    if (agentTypes.includes(notificationType)) {
      return 'agent';
    }
    return 'user';
  }

  /**
   * Validate ticket access for notification operations
   */
  private async validateTicketAccess(userId: string, ticketId: string, userRole: UserRole): Promise<PermissionValidationResult> {
    try {
      const { data: ticket, error } = await supabase
        .from('tickets_new')
        .select('user_id, assigned_to')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return {
          allowed: false,
          reason: 'Ticket not found'
        };
      }

      // Admins have access to all tickets
      if (userRole === 'admin') {
        return { allowed: true };
      }

      // Users can access their own tickets
      if (ticket.user_id === userId) {
        return { allowed: true };
      }

      // Agents can access assigned tickets
      if (userRole === 'agent' && ticket.assigned_to === userId) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'No access to this ticket'
      };
    } catch (error) {
      console.error('Error validating ticket access:', error);
      return {
        allowed: false,
        reason: 'Ticket access validation failed'
      };
    }
  }

  /**
   * Log notification access for audit purposes
   */
  private async logAccess(logEntry: NotificationAccessLog): Promise<void> {
    try {
      // Create audit log table if it doesn't exist (handled by migration)
      const { error } = await supabase
        .from('notification_access_logs')
        .insert(logEntry);

      if (error) {
        console.error('Error logging notification access:', error);
      }
    } catch (error) {
      console.error('Error in logAccess:', error);
    }
  }

  /**
   * Get access logs for a user (admin only)
   */
  async getAccessLogs(requestingUserId: string, targetUserId?: string, limit = 100): Promise<NotificationAccessLog[]> {
    try {
      // Verify requesting user is admin
      const userRole = await this.getUserRole(requestingUserId);
      if (userRole !== 'admin') {
        await this.logAccess({
          user_id: requestingUserId,
          action: 'read',
          allowed: false,
          reason: 'Unauthorized access to audit logs',
          created_at: new Date().toISOString()
        });
        return [];
      }

      let query = supabase
        .from('notification_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (targetUserId) {
        query = query.eq('user_id', targetUserId);
      }

      const { data: logs, error } = await query;

      if (error) {
        console.error('Error fetching access logs:', error);
        return [];
      }

      return logs || [];
    } catch (error) {
      console.error('Error in getAccessLogs:', error);
      return [];
    }
  }

  /**
   * Check if user has permission to view notification analytics
   */
  async validateAnalyticsAccess(userId: string): Promise<PermissionValidationResult> {
    try {
      const userRole = await this.getUserRole(userId);
      
      if (userRole === 'admin') {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'Only administrators can access notification analytics',
        requiredRole: 'admin'
      };
    } catch (error) {
      console.error('Error validating analytics access:', error);
      return {
        allowed: false,
        reason: 'Analytics access validation failed'
      };
    }
  }
}