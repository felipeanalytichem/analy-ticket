import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationService } from '@/lib/notificationService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { TicketDetailsDialog } from '@/components/tickets/dialogs/TicketDetailsDialog';
import DatabaseService, { TicketWithDetails } from '@/lib/database';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithDetails | null>(null);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  // Helper function to translate notification content
  const translateNotificationContent = (content: string): string => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.key && parsed.params) {
        return String(t(parsed.key, parsed.params));
      }
      return content;
    } catch {
      // If it's not JSON, return as-is (fallback for old notifications)
      return content;
    }
  };

  const handleNotificationClick = async (notificationId: string, ticketId?: string, message?: string) => {
    console.log('🔔 NotificationBell: Notification clicked:', { notificationId, ticketId, message });
    
    try {
      // Mark as read first
      console.log('🔔 NotificationBell: Marking notification as read...');
      await markAsRead(notificationId);
      console.log('🔔 NotificationBell: Notification marked as read successfully');
      
      // Close the dropdown first
      setIsOpen(false);
      
      if (ticketId) {
        const isFeedbackRequest = message?.includes('avaliar o atendimento') || 
                                 message?.includes('Avalie seu atendimento');
        
        if (isFeedbackRequest) {
          // For feedback requests, still navigate to notifications page
          console.log('🔔 NotificationBell: Opening notifications page for feedback');
          navigate(`/notifications?feedback=${ticketId}`);
        } else {
          // For regular tickets, open the dialog
          console.log('🔔 NotificationBell: Fetching ticket details for dialog');
          try {
            const ticketDetails = await DatabaseService.getTicketById(ticketId);
            if (ticketDetails) {
              setSelectedTicket(ticketDetails);
              setIsTicketDialogOpen(true);
              console.log('🔔 NotificationBell: Opening ticket details dialog');
            } else {
              console.error('🔔 NotificationBell: Ticket not found:', ticketId);
              toast.error(t('notifications.errors.ticketNotFound'));
            }
          } catch (error) {
            console.error('🔔 NotificationBell: Error fetching ticket details:', error);
            toast.error(t('notifications.errors.loadingTicketDetails'));
          }
        }
      } else {
        console.warn('🔔 NotificationBell: No ticket_id provided, cannot open ticket');
        toast.error(t('notifications.errors.cannotOpenTicket'));
      }
    } catch (error) {
      console.error('🔔 NotificationBell: Error handling notification click:', error);
      toast.error(t('notifications.errors.processingNotification'));
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (!success) {
      toast.error(t('notifications.errors.markingAllAsRead'));
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    const success = await deleteNotification(notificationId);
    if (!success) {
      toast.error(t('notifications.errors.deletingNotification'));
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
      
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{t('notifications.title', 'Notificações')}</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-6 px-2 text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                {t('notifications.markAllRead', 'Marcar todas como lidas')}
              </Button>
            )}
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('notifications.loading', 'Loading notifications...')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('notifications.empty', 'No notifications')}
            </div>
          ) : (
            <ScrollArea className="h-96">
              {notifications.map((notification) => {
                const icon = NotificationService.getNotificationIcon(notification.type);
                
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`p-3 cursor-pointer hover:bg-muted/50 ${
                      !notification.read ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification.id, notification.ticket_id, notification.message)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex-shrink-0">
                        <span className="text-lg">{icon}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${
                              !notification.read ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {translateNotificationContent(notification.title) || 
                               t('notifications.fallback.title')}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-1 ml-2">
                            {notification.ticket_id && (
                              <ExternalLink className="h-3 w-3 text-muted-foreground" aria-label="Abrir ticket" />
                            )}
                            
                            <Button
                              aria-label={t('aria.deleteNotification')}
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteNotification(e, notification.id)}
                              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { 
                            addSuffix: true,
                            locale: ptBR 
                          })}
                        </p>

                        {!notification.read && (
                          <div className="flex items-center mt-2">
                            <div className="h-2 w-2 bg-blue-500 rounded-full mr-2" />
                            <span className="text-xs text-blue-600 font-medium">{t('notifications.unread', 'Unread')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </ScrollArea>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ticket Details Dialog */}
      <TicketDetailsDialog
        open={isTicketDialogOpen}
        onOpenChange={setIsTicketDialogOpen}
        ticket={selectedTicket}
        onTicketUpdate={() => {
          // Refresh notifications if needed
          console.log('🔔 NotificationBell: Ticket updated, could refresh notifications here');
        }}
      />
    </>
  );
}; 