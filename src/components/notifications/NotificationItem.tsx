import React, { useState, useCallback, useMemo } from 'react';
import { 
  Clock, 
  ExternalLink, 
  Trash2, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  Circle,
  AlertTriangle,
  AlertCircle,
  Info,
  User,
  Tag,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Ticket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NotificationWithTicket, NotificationType } from '@/lib/notificationService';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface NotificationPriority {
  level: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

interface NotificationItemProps {
  notification: NotificationWithTicket;
  showPreview?: boolean;
  showQuickActions?: boolean;
  showPriority?: boolean;
  compact?: boolean;
  isGrouped?: boolean;
  onNotificationClick?: (notification: NotificationWithTicket) => void;
  onMarkAsRead?: (notificationId: string) => Promise<boolean>;
  onMarkAsUnread?: (notificationId: string) => Promise<boolean>;
  onDeleteNotification?: (notificationId: string) => Promise<boolean>;
  onPreviewToggle?: (notificationId: string, isOpen: boolean) => void;
  className?: string;
}

// Priority mapping based on notification type and content
const NOTIFICATION_PRIORITIES: Record<NotificationType, NotificationPriority['level']> = {
  ticket_created: 'medium',
  ticket_updated: 'low',
  ticket_assigned: 'high',
  ticket_closed: 'low',
  comment_added: 'medium',
  status_changed: 'medium',
  priority_changed: 'high',
  assignment_changed: 'high'
};

const PRIORITY_CONFIG: Record<NotificationPriority['level'], NotificationPriority> = {
  low: {
    level: 'low',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-900/50',
    borderColor: 'border-gray-200 dark:border-gray-800',
    icon: <Info className="h-4 w-4" />
  },
  medium: {
    level: 'medium',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    icon: <Circle className="h-4 w-4" />
  },
  high: {
    level: 'high',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: <AlertCircle className="h-4 w-4" />
  },
  urgent: {
    level: 'urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: <AlertTriangle className="h-4 w-4" />
  }
};

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  ticket_created: <Ticket className="h-4 w-4 text-blue-500" />,
  ticket_updated: <Info className="h-4 w-4 text-blue-500" />,
  ticket_assigned: <User className="h-4 w-4 text-green-500" />,
  ticket_closed: <CheckCircle className="h-4 w-4 text-gray-500" />,
  comment_added: <MessageSquare className="h-4 w-4 text-orange-500" />,
  status_changed: <Tag className="h-4 w-4 text-purple-500" />,
  priority_changed: <AlertTriangle className="h-4 w-4 text-red-500" />,
  assignment_changed: <User className="h-4 w-4 text-yellow-500" />
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  showPreview = true,
  showQuickActions = true,
  showPriority = true,
  compact = false,
  isGrouped = false,
  onNotificationClick,
  onMarkAsRead,
  onMarkAsUnread,
  onDeleteNotification,
  onPreviewToggle,
  className
}) => {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Determine notification priority
  const priority = useMemo(() => {
    let basePriority = NOTIFICATION_PRIORITIES[notification.type];
    
    // Upgrade priority based on content keywords
    const content = `${notification.title} ${notification.message || ''}`.toLowerCase();
    if (content.includes('urgent') || content.includes('critical') || content.includes('emergency')) {
      basePriority = 'urgent';
    } else if (content.includes('important') || content.includes('priority')) {
      basePriority = 'high';
    }
    
    return PRIORITY_CONFIG[basePriority];
  }, [notification]);

  // Helper function to translate notification content
  const translateNotificationContent = useCallback((content: string): string => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.key && parsed.params) {
        return String(t(parsed.key, parsed.params));
      }
      return content;
    } catch {
      return content;
    }
  }, [t]);

  // Handle notification click
  const handleNotificationClick = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Mark as read if unread
      if (!notification.read && onMarkAsRead) {
        await onMarkAsRead(notification.id);
      }
      
      // Call click handler
      onNotificationClick?.(notification);
    } finally {
      setIsLoading(false);
    }
  }, [notification, onNotificationClick, onMarkAsRead, isLoading]);

  // Handle mark as read/unread toggle
  const handleReadToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      if (notification.read && onMarkAsUnread) {
        await onMarkAsUnread(notification.id);
      } else if (!notification.read && onMarkAsRead) {
        await onMarkAsRead(notification.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [notification.read, notification.id, onMarkAsRead, onMarkAsUnread, isLoading]);

  // Handle delete
  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      if (onDeleteNotification) {
        await onDeleteNotification(notification.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [notification.id, onDeleteNotification, isLoading]);

  // Handle preview toggle
  const handlePreviewToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !isPreviewOpen;
    setIsPreviewOpen(newState);
    onPreviewToggle?.(notification.id, newState);
  }, [isPreviewOpen, notification.id, onPreviewToggle]);

  // Format notification date
  const formattedDate = useMemo(() => {
    const date = new Date(notification.created_at);
    return {
      relative: formatDistanceToNow(date, { addSuffix: true, locale: ptBR }),
      absolute: format(date, 'PPpp', { locale: ptBR })
    };
  }, [notification.created_at]);

  // Get notification preview content
  const previewContent = useMemo(() => {
    if (!notification.ticket) return null;
    
    return {
      ticketTitle: notification.ticket.title || `Ticket #${notification.ticket_id}`,
      ticketStatus: notification.ticket.status,
      ticketPriority: notification.ticket.priority,
      ticketDescription: notification.ticket.description,
      assignedTo: notification.ticket.assigned_to,
      category: notification.ticket.category
    };
  }, [notification.ticket, notification.ticket_id]);

  const translatedTitle = translateNotificationContent(notification.title);
  const translatedMessage = notification.message ? translateNotificationContent(notification.message) : '';

  return (
    <TooltipProvider>
      <Card 
        className={cn(
          "transition-all duration-200 hover:shadow-md cursor-pointer",
          !notification.read && "ring-2 ring-blue-500/20",
          showPriority && priority.borderColor,
          showPriority && !notification.read && priority.bgColor,
          compact && "p-2",
          isGrouped && "ml-4 border-l-2 border-l-muted",
          className
        )}
        onClick={handleNotificationClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleNotificationClick();
          }
        }}
        aria-label={`${translatedTitle} - ${!notification.read ? t('notifications.unread', 'Unread') : t('notifications.read', 'Read')}`}
      >
        <CardContent className={cn("p-4", compact && "p-3")}>
          <div className="flex items-start gap-3">
            {/* Notification Type Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {NOTIFICATION_TYPE_ICONS[notification.type]}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-2">
                  {/* Title and Priority */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn(
                      "font-medium text-sm line-clamp-2",
                      !notification.read ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {translatedTitle}
                    </h3>
                    
                    {showPriority && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs px-1.5 py-0.5",
                              priority.color,
                              priority.borderColor
                            )}
                          >
                            {priority.icon}
                            <span className="ml-1 capitalize">{priority.level}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t(`notifications.priority.${priority.level}`, priority.level)}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Message */}
                  {translatedMessage && !compact && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {translatedMessage}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>{formattedDate.relative}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formattedDate.absolute}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {notification.ticket_id && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1">
                          <Ticket className="h-3 w-3" />
                          <span>#{notification.ticket_id}</span>
                        </div>
                      </>
                    )}

                    {!notification.read && (
                      <>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {t('notifications.unread', 'Unread')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                {showQuickActions && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Preview Toggle */}
                    {showPreview && notification.ticket_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePreviewToggle}
                            className="h-6 w-6 p-0 hover:bg-muted"
                            disabled={isLoading}
                            aria-label={isPreviewOpen 
                              ? t('notifications.hidePreview', 'Hide preview')
                              : t('notifications.showPreview', 'Show preview')
                            }
                          >
                            {isPreviewOpen ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isPreviewOpen 
                            ? t('notifications.hidePreview', 'Hide preview')
                            : t('notifications.showPreview', 'Show preview')
                          }
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Open Ticket */}
                    {notification.ticket_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotificationClick();
                            }}
                            className="h-6 w-6 p-0 hover:bg-muted"
                            disabled={isLoading}
                            aria-label={t('notifications.openTicket', 'Open ticket')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('notifications.openTicket', 'Open ticket')}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Mark as Read/Unread */}
                    {(onMarkAsRead || onMarkAsUnread) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReadToggle}
                            className="h-6 w-6 p-0 hover:bg-muted"
                            disabled={isLoading}
                            aria-label={notification.read 
                              ? t('notifications.markAsUnread', 'Mark as unread')
                              : t('notifications.markAsRead', 'Mark as read')
                            }
                          >
                            {notification.read ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {notification.read 
                            ? t('notifications.markAsUnread', 'Mark as unread')
                            : t('notifications.markAsRead', 'Mark as read')
                          }
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Delete */}
                    {onDeleteNotification && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                            disabled={isLoading}
                            aria-label={t('notifications.delete', 'Delete notification')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('notifications.delete', 'Delete notification')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Content */}
              {showPreview && previewContent && (
                <Collapsible open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                  <CollapsibleContent className="mt-3 pt-3 border-t border-border/50">
                    <div className="space-y-2 text-xs">
                      <div className="font-medium text-foreground">
                        {previewContent.ticketTitle}
                      </div>
                      
                      <div className="flex items-center gap-4 text-muted-foreground">
                        {previewContent.ticketStatus && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <span className="capitalize">{previewContent.ticketStatus}</span>
                          </div>
                        )}
                        
                        {previewContent.ticketPriority && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="capitalize">{previewContent.ticketPriority}</span>
                          </div>
                        )}
                        
                        {previewContent.assignedTo && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{previewContent.assignedTo}</span>
                          </div>
                        )}
                      </div>
                      
                      {previewContent.ticketDescription && (
                        <p className="text-muted-foreground line-clamp-3 mt-2">
                          {previewContent.ticketDescription}
                        </p>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};