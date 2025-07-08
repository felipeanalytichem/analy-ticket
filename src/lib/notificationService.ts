import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface Notification {
  id?: string;
  user_id: string;
  message: string;
  type: 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'comment_added' | 'status_changed' | 'priority_changed';
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

        const processedNotification: NotificationWithTicket = {
          id: notification.id,
          user_id: notification.user_id,
          message: notification.message || notification.title || 'Notificação',
          type: notification.type as 'ticket_created' | 'ticket_updated' | 'ticket_assigned' | 'comment_added' | 'status_changed' | 'priority_changed',
          ticket_id: notification.ticket_id,
          read: notification.read !== undefined ? notification.read : false,
          priority: notification.priority || 'medium',
          created_at: notification.created_at,
          updated_at: notification.updated_at,
          title: notification.title,
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
      // Get all agents and admins to notify
      const { data: recipients, error: agentsError } = await supabase
        .from('users')
        .select('id')
        .in('role', ['agent', 'admin']);

      if (agentsError || !recipients) {
        console.error('Error getting agents for notification:', agentsError);
        return false;
      }

      const notifications = recipients.map(user => ({
        user_id: user.id,
        type: 'ticket_created' as const,
        title: JSON.stringify({
          key: 'notifications.types.ticket_created.title',
          params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
        }),
        message: JSON.stringify({
          key: 'notifications.types.ticket_created.message',
          params: { 
            ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
            userName: context.userName || 'notifications.fallback.unknownUser'
          }
        }),
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false
      }));

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
      const notification = {
        user_id: assignedUserId,
        type: 'ticket_assigned' as const,
        title: JSON.stringify({
          key: 'notifications.types.ticket_assigned.title',
          params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
        }),
        message: JSON.stringify({
          key: 'notifications.types.ticket_assigned.message',
          params: { 
            ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle'
          }
        }),
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
      const notificationData = {
        user_id: ticketUserId,
        type: 'status_changed' as const,
        title: JSON.stringify({
          key: 'notifications.types.status_changed.title',
          params: { ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8) }
        }),
        message: JSON.stringify({
          key: 'notifications.types.status_changed.message',
          params: { 
            ticketTitle: context.ticketTitle || 'notifications.fallback.noTitle',
            status: context.newStatus || 'unknown'
          }
        }),
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

      const notifications = [];
      
      // Notify ticket creator (if not the commenter)
      if (context.userName !== 'ticket_creator') {
        notifications.push({
          user_id: ticket.user_id,
          type: 'comment_added' as const,
          title: JSON.stringify({
            key: 'notifications.types.comment_added.title',
            params: { ticketNumber: ticket.ticket_number || '#' + ticketId.slice(-8) }
          }),
          message: JSON.stringify({
            key: 'notifications.types.comment_added.message',
            params: { ticketTitle: ticket.title || 'notifications.fallback.noTitle' }
          }),
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
          title: JSON.stringify({
            key: 'notifications.types.comment_added.title',
            params: { ticketNumber: ticket.ticket_number || '#' + ticketId.slice(-8) }
          }),
          message: JSON.stringify({
            key: 'notifications.types.comment_added.message',
            params: { ticketTitle: ticket.title || 'notifications.fallback.noTitle' }
          }),
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
    
    // Try to translate the message and title if they're JSON i18n keys
    let message = notification.message;
    let title = notification.title;
    
    try {
      const parsedMessage = JSON.parse(notification.message);
      if (parsedMessage.key) {
        // For toast notifications, we'll use a simplified message since we don't have access to t() here
        message = 'New notification';
      }
    } catch {
      // If it's not JSON, use as-is
    }
    
    try {
      const parsedTitle = JSON.parse(notification.title);
      if (parsedTitle.key) {
        // Use a simplified title for toast
        title = '🔔 New Notification';
      }
    } catch {
      // If it's not JSON, use as-is
    }
    
    const displayMessage = `${title}: ${message}`;
    
    toast(`${icon} ${displayMessage}`, {
      duration: 5000,
      action: notification.ticket_id ? {
        label: 'View Ticket',
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
      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: JSON.stringify({
          key: 'notifications.types.sla_warning.title'
        }),
        message: JSON.stringify({
          key: 'notifications.types.sla_warning.message',
          params: { 
            ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
          }
        }),
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
      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: JSON.stringify({
          key: 'notifications.types.sla_breach.title'
        }),
        message: JSON.stringify({
          key: 'notifications.types.sla_breach.message',
          params: { 
            ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
          }
        }),
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
      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: JSON.stringify({
          key: 'notifications.types.first_response.title'
        }),
        message: JSON.stringify({
          key: 'notifications.types.first_response.message',
          params: { 
            ticketNumber: context.ticketNumber || '#' + ticketId.slice(-8)
          }
        }),
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
      const notificationData = {
        user_id: userId,
        type: 'status_changed' as const,
        title: 'Avalie seu atendimento',
        message: `Seu chamado #${context.ticketNumber} foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.`,
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