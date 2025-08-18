import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { NotificationTemplateService } from '@/services/NotificationTemplateService';
import { NotificationPermissionValidator } from '@/services/NotificationPermissionValidator';
import { NotificationDataSecurity } from '@/services/NotificationDataSecurity';
import i18n from '@/i18n';

export interface Notification {
  id?: string;
  user_id: string;
  message: string;
  type: 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'comment_added' | 'status_changed' | 'priority_changed' | 'assignment_changed' | 'sla_warning' | 'sla_breach';
  ticket_id?: string;
  read?: boolean;
  priority?: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at?: string;
  title: string;
}

export interface NotificationWithTicket extends Notification {
  ticket?: {
    id: string;
    title: string;
    ticket_number: string;
    status: string;
    priority: string;
  } | null;
}

export interface NotificationContext {
  ticketNumber?: string;
  ticketTitle?: string;
  userName?: string;
  agentName?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPriority?: string;
  newPriority?: string;
  assigneeName?: string;
  resolvedBy?: string;
  closedBy?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private currentSubscription: any = null;
  private currentUserId: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(userId?: string, limit = 50): Promise<NotificationWithTicket[]> {
    try {
      // If userId is provided, validate read permissions
      if (userId) {
        const permissionValidator = NotificationPermissionValidator.getInstance();
        const currentUser = await supabase.auth.getUser();
        
        if (currentUser.data.user && currentUser.data.user.id !== userId) {
          // Check if current user can read other user's notifications
          const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', currentUser.data.user.id)
            .single();
          
          if (!userProfile || userProfile.role !== 'admin') {
            console.warn('Unauthorized attempt to read other user notifications');
            return [];
          }
        }
      }

      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: notifications, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      if (!notifications) {
        return [];
      }

      const notificationsWithTickets: NotificationWithTicket[] = [];
      const dataSecurity = NotificationDataSecurity.getInstance();

      for (const notification of notifications) {
        let ticket = null;
        
        if (notification.ticket_id) {
          const { data: ticketData } = await supabase
            .from('tickets_new')
            .select('id, title, ticket_number, status, priority')
            .eq('id', notification.ticket_id)
            .single();
          ticket = ticketData;
        }

        // Decrypt notification content if encrypted
        let decryptedContent = {
          title: notification.title,
          message: notification.message || notification.title || 'Notificação'
        };

        if (notification.encrypted_fields && notification.encryption_data) {
          try {
            decryptedContent = await dataSecurity.processNotificationForDisplay({
              title: notification.title,
              message: notification.message || notification.title || 'Notificação',
              encrypted_fields: notification.encrypted_fields,
              encryption_data: notification.encryption_data
            });
          } catch (error) {
            console.error('Error decrypting notification:', error);
            // Keep original content as fallback
          }
        }

        const processedNotification: NotificationWithTicket = {
          id: notification.id,
          user_id: notification.user_id,
          message: decryptedContent.message,
          type: notification.type as 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'comment_added' | 'status_changed' | 'priority_changed' | 'assignment_changed' | 'sla_warning' | 'sla_breach',
          ticket_id: notification.ticket_id,
          read: notification.read !== undefined ? notification.read : false,
          priority: notification.priority || 'medium',
          created_at: notification.created_at,
          updated_at: notification.updated_at,
          title: decryptedContent.title,
          ticket
        };

        notificationsWithTickets.push(processedNotification);
      }

      return notificationsWithTickets;
    } catch (error) {
      console.error('Error in getNotifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      // Validate permission to modify notification
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        console.error('No authenticated user for markAsRead');
        return false;
      }

      const permissionValidator = NotificationPermissionValidator.getInstance();
      const permission = await permissionValidator.validateModifyPermission(
        currentUser.data.user.id,
        notificationId,
        'update'
      );

      if (!permission.allowed) {
        console.error('Permission denied for markAsRead:', permission.reason);
        return false;
      }

      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in markAsRead:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      // Validate permission - users can only mark their own notifications as read
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        console.error('No authenticated user for markAllAsRead');
        return false;
      }

      // Check if user is trying to mark their own notifications or if they're admin
      if (currentUser.data.user.id !== userId) {
        const { data: userProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentUser.data.user.id)
          .single();
        
        if (!userProfile || userProfile.role !== 'admin') {
          console.error('Permission denied: Cannot mark other user notifications as read');
          return false;
        }
      }

      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in markAllAsRead:', error);
      return false;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      // Validate permission to delete notification
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        console.error('No authenticated user for deleteNotification');
        return false;
      }

      const permissionValidator = NotificationPermissionValidator.getInstance();
      const permission = await permissionValidator.validateModifyPermission(
        currentUser.data.user.id,
        notificationId,
        'delete'
      );

      if (!permission.allowed) {
        console.error('Permission denied for deleteNotification:', permission.reason);
        return false;
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in deleteNotification:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time notifications (Simplified)
   */
  static subscribeToNotifications(
    userId: string,
    onNotification: (notification: any) => void
  ) {
    console.log('🔔 Setting up real-time subscription for user:', userId);
    
    const channel = supabase
      .channel(`notifications-${userId}`, {
        config: {
          broadcast: { self: false }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Notification INSERT:', payload.new);
          onNotification(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 [Realtime] Notification UPDATE:', payload.new);
          onNotification(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    return channel;
  }

  /**
   * Create notification for ticket creation
   */
  static async createTicketCreatedNotification(ticketId: string, context: NotificationContext): Promise<boolean> {
    try {
      // Validate permission to create notification
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        console.error('No authenticated user for createTicketCreatedNotification');
        return false;
      }

      // Get all agents and admins to notify
      const { data: recipients, error: agentsError } = await supabase
        .from('users')
        .select('id')
        .in('role', ['agent', 'admin']);

      if (agentsError || !recipients) {
        console.error('Error getting agents for notification:', agentsError);
        return false;
      }

      // Validate permission for each recipient
      const permissionValidator = NotificationPermissionValidator.getInstance();
      const validRecipients = [];

      for (const recipient of recipients) {
        const permission = await permissionValidator.validateCreatePermission({
          userId: currentUser.data.user.id,
          targetUserId: recipient.id,
          notificationType: 'ticket_created',
          ticketId,
          priority: 'medium'
        });

        if (permission.allowed) {
          validRecipients.push(recipient);
        } else {
          console.warn(`Permission denied for recipient ${recipient.id}:`, permission.reason);
        }
      }

      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.ticket_created.title', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });
      const messageTemplate = templateService.createTemplate('notifications.types.ticket_created.message', {
        ticketTitle: context.ticketTitle || i18n.t('notifications.fallback.noTicketTitle'),
        userName: context.userName || i18n.t('notifications.fallback.unknownUser')
      });

      // Process notifications for security
      const dataSecurity = NotificationDataSecurity.getInstance();
      const notifications = [];

      for (const user of validRecipients) {
        const rawNotification = {
          title: templateService.serializeTemplate(titleTemplate),
          message: templateService.serializeTemplate(messageTemplate),
          type: 'ticket_created' as const
        };

        // Validate and sanitize the notification data
        const validation = dataSecurity.validateNotificationData({
          ...rawNotification,
          user_id: user.id
        });

        if (!validation.valid) {
          console.error('Invalid notification data:', validation.errors);
          continue;
        }

        // Process for storage (sanitize and encrypt if needed)
        const processedNotification = await dataSecurity.processNotificationForStorage(rawNotification);

        notifications.push({
          user_id: user.id,
          type: 'ticket_created' as const,
          title: processedNotification.title,
          message: processedNotification.message,
          priority: 'medium' as const,
          ticket_id: ticketId,
          read: false,
          encrypted_fields: processedNotification.encrypted_fields,
          encryption_data: processedNotification.encryption_data
        });
      }

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating ticket notifications:', error);
        return false;
      }

      console.log(`✅ Created ${notifications.length} ticket creation notifications`);
      return true;
    } catch (error) {
      console.error('Exception in createTicketCreatedNotification:', error);
      return false;
    }
  }

  /**
   * Create notification for ticket assignment
   */
  static async createTicketAssignedNotification(ticketId: string, assignedUserId: string, context: NotificationContext): Promise<boolean> {
    try {
      // Validate permission to create notification
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) {
        console.error('No authenticated user for createTicketAssignedNotification');
        return false;
      }

      const permissionValidator = NotificationPermissionValidator.getInstance();
      const permission = await permissionValidator.validateCreatePermission({
        userId: currentUser.data.user.id,
        targetUserId: assignedUserId,
        notificationType: 'ticket_assigned',
        ticketId,
        priority: 'high'
      });

      if (!permission.allowed) {
        console.error('Permission denied for createTicketAssignedNotification:', permission.reason);
        return false;
      }

      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.ticket_assigned.title', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });
      const messageTemplate = templateService.createTemplate('notifications.types.ticket_assigned.message', {
        ticketTitle: context.ticketTitle || i18n.t('notifications.fallback.noTicketTitle')
      });

      const notification = {
        user_id: assignedUserId,
        type: 'ticket_assigned' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        priority: 'high' as const,
        ticket_id: ticketId,
        read: false
      };

      const { error } = await supabase
        .from('notifications')
        .insert([notification]);

      if (error) {
        console.error('Error creating assignment notification:', error);
        return false;
      }

      console.log('✅ Created ticket assignment notification');
      return true;
    } catch (error) {
      console.error('Exception in createTicketAssignedNotification:', error);
      return false;
    }
  }

  /**
   * Create notification for status change
   */
  static async createTicketStatusNotification(ticketId: string, ticketUserId: string, context: NotificationContext): Promise<boolean> {
    try {
      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.status_changed.title', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });
      const messageTemplate = templateService.createTemplate('notifications.types.status_changed.message', {
        ticketTitle: context.ticketTitle || i18n.t('notifications.fallback.noTicketTitle'),
        status: context.newStatus || i18n.t('notifications.fallback.unknownTicket')
      });

      const notificationData = {
        user_id: ticketUserId,
        type: 'status_changed' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) {
        console.error('Error creating status notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createTicketStatusNotification:', error);
      return false;
    }
  }

  /**
   * Create notification for new comment
   */
  static async createCommentNotification(ticketId: string, context: NotificationContext): Promise<boolean> {
    try {
      // Get ticket details to find who to notify
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets_new')
        .select('user_id, assigned_to, title, ticket_number')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.error('Error getting ticket for comment notification:', ticketError);
        return false;
      }

      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.comment_added.title', {
        ticketNumber: ticket.ticket_number || '#' + ticketId.slice(-8)
      });
      const messageTemplate = templateService.createTemplate('notifications.types.comment_added.message', {
        ticketTitle: ticket.title || i18n.t('notifications.fallback.noTicketTitle')
      });

      const notifications = [];
      
      // Notify ticket creator (if not the commenter)
      if (context.userName !== 'ticket_creator') {
        notifications.push({
          user_id: ticket.user_id,
          type: 'comment_added' as const,
          title: templateService.serializeTemplate(titleTemplate),
          message: templateService.serializeTemplate(messageTemplate),
          priority: 'medium' as const,
          ticket_id: ticketId,
          read: false
        });
      }

      // Notify assigned agent (if exists and different from commenter)
      if (ticket.assigned_to && ticket.assigned_to !== ticket.user_id) {
        notifications.push({
          user_id: ticket.assigned_to,
          type: 'comment_added' as const,
          title: templateService.serializeTemplate(titleTemplate),
          message: templateService.serializeTemplate(messageTemplate),
          priority: 'medium' as const,
          ticket_id: ticketId,
          read: false
        });
      }

      if (notifications.length > 0) {
        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) {
          console.error('Error creating comment notifications:', error);
          return false;
        }

        console.log(`✅ Created ${notifications.length} comment notifications`);
      }

      return true;
    } catch (error) {
      console.error('Exception in createCommentNotification:', error);
      return false;
    }
  }

  /**
   * Helper methods for UI
   */
  static getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      'ticket_created': '🎫',
      'ticket_assigned': '👤',
      'status_changed': '🔄',
      'comment_added': '💬',
      'priority_changed': '⚡',
      'feedback_request': '⭐',
      'resolved': '✅',
      'closed': '🔒',
      'reopened': '🔓',
      'sla_warning': '⚠️',
      'sla_breach': '🚨',
      'first_response': '💬',
      'task_assigned': '📋',
      'task_due_reminder': '⏰',
      'task_completed': '✔️',
      'task_commented': '💭',
      default: '🔔'
    };
    return icons[type] || icons.default;
  }

  static getNotificationColor(priority: string): string {
    const colors: Record<string, string> = {
      low: 'text-blue-600',
      medium: 'text-yellow-600',
      high: 'text-red-600'
    };
    return colors[priority] || colors.medium;
  }

  /**
   * Show toast notification
   */
  static showToastNotification(notification: Notification): void {
    const icon = this.getNotificationIcon(notification.type || 'default');
    const templateService = NotificationTemplateService.getInstance();
    
    // Process the notification content using the template service
    const processedContent = templateService.processNotificationForDisplay({
      title: notification.title,
      message: notification.message,
      type: notification.type
    });
    
    const displayMessage = `${processedContent.title}: ${processedContent.message}`;
    
    toast(`${icon} ${displayMessage}`, {
      duration: 5000,
      action: notification.ticket_id ? {
        label: i18n.t('notifications.actions.viewTicket'),
        onClick: () => {
          window.location.href = `/ticket/${notification.ticket_id}`;
        }
      } : undefined
    });
  }

  /**
   * Create SLA warning notification
   */
  static async createSLAWarningNotification(ticketId: string, userId: string, context: NotificationContext): Promise<boolean> {
    try {
      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.sla_warning.title');
      const messageTemplate = templateService.createTemplate('notifications.types.sla_warning.message', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });

      const notificationData = {
        user_id: userId,
        type: 'sla_warning' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        ticket_id: ticketId,
        priority: 'high' as const,
        read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert([notificationData]);

      if (error) {
        console.error('Error creating SLA warning notification:', error);
        return false;
      }

      console.log('✅ SLA warning notification created successfully');
      return true;
    } catch (error) {
      console.error('Exception in createSLAWarningNotification:', error);
      return false;
    }
  }

  /**
   * Create SLA breach notification (urgent)
   */
  static async createSLABreachNotification(ticketId: string, userId: string, context: NotificationContext): Promise<boolean> {
    try {
      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.sla_breach.title');
      const messageTemplate = templateService.createTemplate('notifications.types.sla_breach.message', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });

      const notificationData = {
        user_id: userId,
        type: 'sla_breach' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        ticket_id: ticketId,
        priority: 'high' as const,
        read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert([notificationData]);

      if (error) {
        console.error('Error creating SLA breach notification:', error);
        return false;
      }

      console.log('🚨 SLA breach notification created successfully');
      return true;
    } catch (error) {
      console.error('Exception in createSLABreachNotification:', error);
      return false;
    }
  }

  /**
   * Create first response tracking notification
   */
  static async createFirstResponseNotification(ticketId: string, userId: string, context: NotificationContext): Promise<boolean> {
    try {
      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.first_response.title');
      const messageTemplate = templateService.createTemplate('notifications.types.first_response.message', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });

      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) {
        console.error('Error creating first response notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createFirstResponseNotification:', error);
      return false;
    }
  }

  static async createFeedbackRequestNotification(ticketId: string, userId: string, context: NotificationContext): Promise<boolean> {
    try {
      const templateService = NotificationTemplateService.getInstance();
      const titleTemplate = templateService.createTemplate('notifications.types.feedback_request.title');
      const messageTemplate = templateService.createTemplate('notifications.types.feedback_request.message', {
        ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
      });

      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: templateService.serializeTemplate(titleTemplate),
        message: templateService.serializeTemplate(messageTemplate),
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) {
        console.error('Error creating feedback request notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in createFeedbackRequestNotification:', error);
      return false;
    }
  }
} 