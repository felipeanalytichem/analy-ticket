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

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification 
  } = useNotifications();

  const handleNotificationClick = async (notificationId: string, ticketId?: string, message?: string) => {
    console.log('🔔 NotificationBell: Notification clicked:', { notificationId, ticketId, message });
    
    // Find the full notification object for debugging
    const fullNotification = notifications.find(n => n.id === notificationId);
    console.log('🔔 NotificationBell: Full notification object:', fullNotification);
    
    try {
      // Mark as read first
      console.log('🔔 NotificationBell: Marking notification as read...');
      await markAsRead(notificationId);
      console.log('🔔 NotificationBell: Notification marked as read successfully');
      
      // Close the dropdown first
      setIsOpen(false);
      
      // Navigate based on notification type
      if (ticketId) {
        const isFeedbackRequest = message?.includes('avaliar o atendimento') || 
                                 message?.includes('Avalie seu atendimento');
        
        // Small delay to ensure dropdown closes before navigation
        setTimeout(() => {
          if (isFeedbackRequest) {
            console.log('🔔 NotificationBell: Opening notifications page for feedback, navigating to:', `/notifications?feedback=${ticketId}`);
            navigate(`/notifications?feedback=${ticketId}`);
          } else {
            console.log('🔔 NotificationBell: Navigating to ticket detail, navigating to:', `/ticket/${ticketId}`);
            navigate(`/ticket/${ticketId}`);
          }
          console.log('🔔 NotificationBell: Navigation completed');
        }, 100);
      } else {
        console.warn('🔔 NotificationBell: No ticket_id provided, cannot navigate', { notificationId, ticketId, message });
        console.warn('🔔 NotificationBell: Available notification data:', fullNotification);
        toast.error('Não foi possível abrir o ticket - ID não encontrado');
      }
    } catch (error) {
      console.error('🔔 NotificationBell: Error handling notification click:', error);
      toast.error('Erro ao processar notificação');
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (!success) {
      toast.error('Erro ao marcar todas as notificações como lidas');
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    const success = await deleteNotification(notificationId);
    if (!success) {
      toast.error('Erro ao excluir notificação');
    }
  };

  return (
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
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-6 px-2 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Carregando notificações...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma notificação
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
                        <p className={`text-sm font-medium ${
                          !notification.read ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {notification.message || notification.title || 'Notificação'}
                        </p>
                        
                        <div className="flex items-center space-x-1 ml-2">
                          {notification.ticket_id && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" aria-label="Abrir ticket" />
                          )}
                          
                          <Button
                            aria-label="Excluir notificação"
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
                          <span className="text-xs text-blue-600 font-medium">Não lida</span>
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
  );
}; 