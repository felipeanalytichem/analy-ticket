import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bell, 
  BellRing, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  X,
  Eye,
  ArrowRight,
  Ticket
} from "lucide-react";
import { DatabaseService, TicketWithDetails, Notification } from "@/lib/database";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

interface NotificationWithTicket extends Notification {
  ticket?: TicketWithDetails;
}

interface AgentNotificationsProps {
  onTicketSelect?: (ticket: TicketWithDetails) => void;
}

// Global flag to prevent multiple subscriptions in React Strict Mode
let globalSubscriptionFlag = false;

export const AgentNotifications = ({ onTicketSelect }: AgentNotificationsProps) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use refs to track subscription state
  const subscriptionRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const componentIdRef = useRef(`agent-notifications-${Date.now()}-${Math.random()}`);
  
  const { userProfile } = useAuth();
  const { toast } = useToast();

  // Cleanup function
  const cleanupSubscription = () => {
    if (subscriptionRef.current) {
      console.log('🔔 Unsubscribing from notifications for user:', userIdRef.current);
      try {
        // Use removeChannel instead of unsubscribe to avoid the multiple subscription error
        supabase.removeChannel(subscriptionRef.current);
        console.log('🔔 Realtime subscription status: CLOSED');
        console.log('🔒 Subscription closed');
      } catch (error) {
        console.error('Error during unsubscribe:', error);
      }
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
      globalSubscriptionFlag = false;
    }
  };

  // Setup subscription only when needed
  useEffect(() => {
    if (userProfile?.id && (userProfile.role === 'agent' || userProfile.role === 'admin')) {
      userIdRef.current = userProfile.id;
      loadNotifications();
      
      // Only setup subscription if not already subscribed and component is mounted
      // Also check global flag to prevent React Strict Mode issues
      if (!isSubscribedRef.current && mountedRef.current && !globalSubscriptionFlag) {
        // Add a small delay to prevent React Strict Mode double execution issues
        const timer = setTimeout(() => {
          if (mountedRef.current && !isSubscribedRef.current && !globalSubscriptionFlag) {
            globalSubscriptionFlag = true;
            setupRealtimeSubscription();
          }
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }

    // Return cleanup function for this specific effect
    return () => {
      // Only cleanup if user changed, not on every re-render
      if (userIdRef.current && userIdRef.current !== userProfile?.id) {
        cleanupSubscription();
        console.log('🔔 Cleaning up periodic check');
      }
    };
  }, [userProfile?.id, userProfile?.role]);

  // Final cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupSubscription();
      console.log('🔔 Cleaning up periodic check');
    };
  }, []);

  const loadNotifications = async () => {
    if (!userProfile?.id) return;
    
    setIsLoading(true);
    try {
      // Buscar notificações do banco de dados
      let allNotifications = await DatabaseService.getUserNotifications(userProfile.id);
      
      // Chave para localStorage específica do usuário
      const storageKey = `agent_notifications_${userProfile.id}`;
      
      // Se não há notificações no banco, tentar carregar do localStorage
      if (!allNotifications || allNotifications.length === 0) {
        console.log('📝 No notifications found in database, checking localStorage...');
        
        try {
          const storedNotifications = localStorage.getItem(storageKey);
          if (storedNotifications) {
            const parsedNotifications = JSON.parse(storedNotifications);
            console.log(`📋 Loaded ${parsedNotifications.length} notifications from localStorage`);
            allNotifications = parsedNotifications;
          }
        } catch (error) {
          console.error('Error loading notifications from localStorage:', error);
        }
      }
      
      // Se ainda não há notificações, criar algumas de exemplo
      if (!allNotifications || allNotifications.length === 0) {
        console.log('📝 Creating sample notifications for agent');
        
        const sampleNotifications = [
          {
            id: `sample-1-${Date.now()}`,
            user_id: userProfile.id,
            type: 'ticket_assigned',
            title: t('tickets.newTicketAssigned'),
            message: t('tickets.ticketAssignedToYou', { ticketNumber: 'ACS-TK-202506-0027' }),
            ticket_id: null,
            read: false,
            priority: 'high',
            created_at: new Date(Date.now() - 60000).toISOString()
          },
          {
            id: `sample-2-${Date.now()}`,
            user_id: userProfile.id,
            type: 'comment_added',
            title: t('tickets.newCustomerResponse'),
            message: t('tickets.customerRespondedToTicket', { ticketNumber: 'ACS-TK-202506-0026' }),
            ticket_id: null,
            read: false,
            priority: 'medium',
            created_at: new Date(Date.now() - 120000).toISOString()
          },
          {
            id: `sample-3-${Date.now()}`,
            user_id: userProfile.id,
            type: 'ticket_assigned',
            title: t('tickets.newTicketAssigned'),
            message: t('tickets.ticketAssignedToYou', { ticketNumber: 'TK-MBTVRA2-XWCUY' }),
            ticket_id: null,
            read: false,
            priority: 'medium',
            created_at: new Date(Date.now() - 180000).toISOString()
          }
        ];

        allNotifications = sampleNotifications;
        
        // Salvar no localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(sampleNotifications));
          console.log('💾 Saved sample notifications to localStorage');
        } catch (error) {
          console.error('Error saving notifications to localStorage:', error);
        }
      }
      
      // Processar notificações
      const agentNotifications: any[] = [];
      
      for (const notification of allNotifications) {
        if (notification.ticket_id && !notification.ticket) {
          try {
            const ticket = await DatabaseService.getTicketById(notification.ticket_id);
            agentNotifications.push({
              ...notification,
              ticket
            });
          } catch (error) {
            agentNotifications.push(notification);
          }
        } else {
          agentNotifications.push(notification);
        }
      }

      // Ordenar por data de criação (mais recentes primeiro)
      agentNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Limitar a 20 notificações mais recentes
      const recentNotifications = agentNotifications.slice(0, 20);

      setNotifications(recentNotifications);
      setUnreadCount(recentNotifications.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast({
        title: t('tickets.error'),
        description: t('tickets.couldNotLoadNotifications'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!userProfile?.id || isSubscribedRef.current || !mountedRef.current) return;

    // Clean up any existing subscription first
    cleanupSubscription();

    // Criar um canal único baseado no ID do usuário e timestamp para evitar conflitos
    const channelName = `agent-notifications-${userProfile.id}-${Date.now()}`;
    
    console.log('🔔 Setting up real-time subscription for user:', userProfile.id);
    
    try {
      // Subscription para notificações do agente
      const notificationSubscription = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: userProfile.id }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfile.id}`
          },
          (payload) => {
            if (mountedRef.current) {
              console.log('🔔 Notification update received:', payload);
              loadNotifications(); // Recarregar notificações quando houver mudanças
            }
          }
        )
        .subscribe((status, err) => {
          console.log(`🔔 Realtime subscription status for ${channelName}:`, status);
          if (err) {
            console.error('🔔 Subscription error:', err);
          }
          
          if (status === 'SUBSCRIBED' && mountedRef.current) {
            console.log('🔔 Session ready, subscribing to realtime notifications');
            isSubscribedRef.current = true;
            subscriptionRef.current = notificationSubscription;
          }
        });

    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      // Tentar marcar no banco de dados
      try {
        await DatabaseService.markNotificationAsRead(notificationId);
      } catch (dbError) {
        console.warn('Could not mark notification as read in database:', dbError);
      }
      
      // Atualizar estado local
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      setNotifications(updatedNotifications);
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Salvar no localStorage
      if (userProfile?.id) {
        const storageKey = `agent_notifications_${userProfile.id}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));
        } catch (error) {
          console.error('Error saving to localStorage:', error);
        }
      }
      
      toast({
        title: t('tickets.notificationMarkedAsRead'),
        description: t('tickets.notificationMarkedAsReadSuccessfully'),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: t('tickets.error'),
        description: t('tickets.couldNotMarkNotificationAsRead'),
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    if (!userProfile?.id) return;
    
    try {
      // Tentar marcar no banco de dados
      try {
        await DatabaseService.markAllNotificationsAsRead(userProfile.id);
      } catch (dbError) {
        console.warn('Could not mark all notifications as read in database:', dbError);
      }
      
      // Atualizar estado local
      const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updatedNotifications);
      setUnreadCount(0);
      
      // Salvar no localStorage
      const storageKey = `agent_notifications_${userProfile.id}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedNotifications));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
      
      toast({
        title: t('tickets.allNotificationsMarkedAsRead'),
        description: t('tickets.notificationsUpdatedSuccessfully'),
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: t('tickets.error'),
        description: t('tickets.couldNotMarkAllNotificationsAsRead'),
        variant: "destructive",
      });
    }
  };

  const removeNotification = async (notificationId: string) => {
    // Attempt to delete from database first
    let success = false;
    try {
      success = await DatabaseService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }

    if (!success) {
      toast({
        title: t('tickets.error'),
        description: t('tickets.couldNotDeleteNotification'),
        variant: 'destructive'
      });
      return; // keep it in the list
    }

    // Update local state
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const notification = notifications.find(n => n.id === notificationId);
      return notification && !notification.read ? prev - 1 : prev;
    });

    // Persist to localStorage
    if (userProfile?.id) {
      const storageKey = `agent_notifications_${userProfile.id}`;
      try {
        const remaining = notifications.filter(n => n.id !== notificationId);
        localStorage.setItem(storageKey, JSON.stringify(remaining));
      } catch (error) {
        console.error('Error saving notifications to localStorage:', error);
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ticket_assigned':
      case 'agent_assigned': 
        return <Ticket className="h-4 w-4" />;
      case 'ticket_updated': 
        return <AlertCircle className="h-4 w-4" />;
      case 'comment_added':
      case 'message_received':
        return <Clock className="h-4 w-4" />;
      default: 
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('tickets.now');
    if (diffMins < 60) return t('tickets.minutesAgo', { minutes: diffMins });
    if (diffHours < 24) return t('tickets.hoursAgo', { hours: diffHours });
    if (diffDays < 7) return t('tickets.daysAgo', { days: diffDays });
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (userProfile?.role !== 'agent' && userProfile?.role !== 'admin') {
    return null;
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Panel */}
      {isOpen && (
        <Card className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden shadow-lg z-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('tickets.notifications')}</CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    className="text-xs"
                    disabled={isLoading}
                  >
                    {t('tickets.markAllAsRead')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p>{t('tickets.loadingNotifications')}</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('tickets.noNotifications')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }
                        if (notification.ticket && onTicketSelect) {
                          onTicketSelect(notification.ticket);
                          setIsOpen(false);
                        } else if (notification.ticket_id && onTicketSelect) {
                          // Se não temos o objeto ticket, buscar pelo ID
                          DatabaseService.getTicketById(notification.ticket_id)
                            .then(ticket => {
                              onTicketSelect(ticket);
                              setIsOpen(false);
                            })
                            .catch(error => {
                              console.error('Error fetching ticket:', error);
                              toast({
                                title: t('tickets.error'),
                                description: t('tickets.couldNotOpenTicket'),
                                variant: "destructive",
                              });
                            });
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`p-1 rounded-full ${getPriorityColor(notification.priority || 'medium')} text-white`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotification(notification.id);
                                }}
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.created_at)}
                            </span>
                            
                            {(notification.ticket || notification.ticket_id) && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                {t('tickets.viewTicket')}
                                <ArrowRight className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 