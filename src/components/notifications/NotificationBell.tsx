import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  Wifi, 
  WifiOff, 
  Loader2,
  Settings,
  RefreshCw
} from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationService } from '@/lib/notificationService';
import { reconnectionManager } from '@/services/ReconnectionManager';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
// TicketDetailsDialog removed - using navigation to UnifiedTicketDetail instead
import DatabaseService, { TicketWithDetails } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';

interface ConnectionStatus {
  isConnected: boolean;
  isReconnecting: boolean;
  lastError?: string;
  consecutiveFailures: number;
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Ticket dialog state removed - using navigation to UnifiedTicketDetail instead
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isReconnecting: false,
    consecutiveFailures: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    refresh
  } = useNotifications();

  // Connection status monitoring
  useEffect(() => {
    if (!userProfile?.id) return;

    const updateConnectionStatus = () => {
      const health = reconnectionManager.getConnectionHealth(userProfile.id);
      if (health) {
        setConnectionStatus({
          isConnected: health.isHealthy,
          isReconnecting: health.consecutiveFailures > 0 && health.consecutiveFailures < 5,
          lastError: health.lastError,
          consecutiveFailures: health.consecutiveFailures
        });
      }
    };

    // Initial status check
    updateConnectionStatus();

    // Listen for connection events
    const handleReconnectionNeeded = (event: CustomEvent) => {
      if (event.detail.userId === userProfile.id) {
        setConnectionStatus(prev => ({
          ...prev,
          isReconnecting: true
        }));
      }
    };

    const handleMissedNotificationsSync = (event: CustomEvent) => {
      if (event.detail.userId === userProfile.id) {
        // Refresh notifications when missed notifications are synced
        refresh();
        updateConnectionStatus();
      }
    };

    // Add event listeners
    window.addEventListener('reconnection-needed', handleReconnectionNeeded as EventListener);
    window.addEventListener('missed-notifications-sync', handleMissedNotificationsSync as EventListener);

    // Periodic status check
    const statusInterval = setInterval(updateConnectionStatus, 5000);

    return () => {
      window.removeEventListener('reconnection-needed', handleReconnectionNeeded as EventListener);
      window.removeEventListener('missed-notifications-sync', handleMissedNotificationsSync as EventListener);
      clearInterval(statusInterval);
    };
  }, [userProfile?.id, refresh]);

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

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      toast.success(t('notifications.refreshed', 'Notifications refreshed'));
    } catch (error) {
      toast.error(t('notifications.errors.refreshFailed', 'Failed to refresh notifications'));
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh, t]);

  // Force reconnection handler
  const handleForceReconnection = useCallback(() => {
    if (!userProfile?.id) return;
    
    setConnectionStatus(prev => ({ ...prev, isReconnecting: true }));
    reconnectionManager.forceReconnection(userProfile.id, () => {
      refresh();
    });
    toast.info(t('notifications.reconnecting', 'Reconnecting...'));
  }, [userProfile?.id, refresh, t]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
      bellRef.current?.focus();
    }
  }, [isOpen]);

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
          // For regular tickets, navigate to unified ticket detail page
          console.log('🔔 NotificationBell: Navigating to unified ticket detail page');
          navigate(`/ticket/${ticketId}`);
          try {
            // Still mark notification as read when navigating
            const ticketDetails = await DatabaseService.getTicketById(ticketId);
            if (!ticketDetails) {
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
      <TooltipProvider>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button 
                  ref={bellRef}
                  variant="ghost" 
                  size="sm" 
                  className="relative transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  onKeyDown={handleKeyDown}
                  aria-label={t('notifications.bellAriaLabel', 'Notifications')}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                >
                  {/* Bell icon with loading state */}
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Bell className={`h-5 w-5 transition-all duration-200 ${
                      unreadCount > 0 ? 'animate-pulse text-primary' : ''
                    }`} />
                  )}
                  
                  {/* Unread count badge */}
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-in zoom-in-50 duration-200"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Badge>
                  )}
                  
                  {/* Connection status indicator */}
                  <div className="absolute -bottom-1 -right-1">
                    {connectionStatus.isReconnecting ? (
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" 
                           aria-label={t('notifications.reconnecting', 'Reconnecting')} />
                    ) : !connectionStatus.isConnected ? (
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" 
                           aria-label={t('notifications.disconnected', 'Disconnected')} />
                    ) : (
                      <div className="w-3 h-3 bg-green-500 rounded-full" 
                           aria-label={t('notifications.connected', 'Connected')} />
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="text-center">
                <p className="font-medium">
                  {t('notifications.title', 'Notifications')} 
                  {unreadCount > 0 && ` (${unreadCount})`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connectionStatus.isReconnecting 
                    ? t('notifications.reconnecting', 'Reconnecting...') 
                    : connectionStatus.isConnected 
                      ? t('notifications.connected', 'Connected')
                      : t('notifications.disconnected', 'Disconnected')
                  }
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
      
          <DropdownMenuContent 
            align="end" 
            className="w-80 animate-in slide-in-from-top-2 duration-200"
            onKeyDown={handleKeyDown}
          >
            <DropdownMenuLabel className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t('notifications.title', 'Notificações')}</span>
                {/* Connection status icon */}
                {connectionStatus.isReconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                ) : !connectionStatus.isConnected ? (
                  <WifiOff className="h-4 w-4 text-red-500" />
                ) : (
                  <Wifi className="h-4 w-4 text-green-500" />
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {/* Refresh button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="h-6 w-6 p-0"
                      aria-label={t('notifications.refresh', 'Refresh notifications')}
                    >
                      <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('notifications.refresh', 'Refresh notifications')}
                  </TooltipContent>
                </Tooltip>

                {/* Force reconnection button (only show when disconnected) */}
                {!connectionStatus.isConnected && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleForceReconnection}
                        className="h-6 w-6 p-0"
                        aria-label={t('notifications.reconnect', 'Reconnect')}
                      >
                        <Wifi className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('notifications.reconnect', 'Reconnect')}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Mark all as read button */}
                {unreadCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="h-6 px-2 text-xs"
                        aria-label={t('notifications.markAllRead', 'Mark all as read')}
                      >
                        <CheckCheck className="h-3 w-3 mr-1" />
                        {t('notifications.markAllRead', 'Marcar todas como lidas')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('notifications.markAllRead', 'Mark all as read')}
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Settings button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/settings?tab=notifications');
                      }}
                      className="h-6 w-6 p-0"
                      aria-label={t('notifications.settings', 'Notification settings')}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('notifications.settings', 'Notification settings')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </DropdownMenuLabel>
          
            <DropdownMenuSeparator />
            
            {/* Connection status message */}
            {!connectionStatus.isConnected && (
              <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 text-sm">
                <div className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-800 dark:text-yellow-200">
                    {t('notifications.connectionIssue', 'Connection issue - some notifications may be delayed')}
                  </span>
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="p-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('notifications.loading', 'Loading notifications...')}
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground font-medium">
                  {t('notifications.empty', 'No notifications')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('notifications.emptyDescription', 'You\'ll see notifications here when they arrive')}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                {notifications.map((notification, index) => {
                  const icon = NotificationService.getNotificationIcon(notification.type);
                  
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`p-3 cursor-pointer transition-all duration-200 hover:bg-muted/50 focus:bg-muted/50 focus:outline-none ${
                        !notification.read 
                          ? 'bg-blue-50/50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' 
                          : ''
                      } animate-in slide-in-from-right-2`}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => handleNotificationClick(notification.id, notification.ticket_id, notification.message)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNotificationClick(notification.id, notification.ticket_id, notification.message);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${translateNotificationContent(notification.title)} - ${
                        !notification.read ? t('notifications.unread', 'Unread') : t('notifications.read', 'Read')
                      }`}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className="text-lg" role="img" aria-hidden="true">{icon}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 pr-2">
                              <p className={`text-sm font-medium line-clamp-2 ${
                                !notification.read ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {translateNotificationContent(notification.title) || 
                                 t('notifications.fallback.title')}
                              </p>
                              
                              {/* Show message preview if available */}
                              {notification.message && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                  {translateNotificationContent(notification.message)}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {notification.ticket_id && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <ExternalLink 
                                      className="h-3 w-3 text-muted-foreground" 
                                      aria-label={t('notifications.openTicket', 'Open ticket')} 
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t('notifications.openTicket', 'Open ticket')}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    aria-label={t('notifications.delete', 'Delete notification')}
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t('notifications.delete', 'Delete notification')}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { 
                                addSuffix: true,
                                locale: ptBR 
                              })}
                            </p>

                            {!notification.read && (
                              <div className="flex items-center">
                                <div className="h-2 w-2 bg-blue-500 rounded-full mr-1 animate-pulse" />
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  {t('notifications.unread', 'Unread')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </ScrollArea>
            )}
            
            {/* Footer with view all link */}
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/notifications');
                    }}
                    className="w-full justify-center text-xs"
                  >
                    {t('notifications.viewAll', 'View all notifications')}
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      {/* Ticket Details Dialog removed - using navigation to UnifiedTicketDetail instead */}
    </>
  );
}; 