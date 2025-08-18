import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  Tag,
  User,
  CheckCircle,
  Circle,
  Trash2,
  ExternalLink,
  Clock,
  AlertCircle,
  Info,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationWithTicket, NotificationType } from '@/lib/notificationService';
import { formatDistanceToNow, format, isToday, isYesterday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface NotificationGroup {
  id: string;
  type: 'ticket' | 'date' | 'type';
  title: string;
  subtitle?: string;
  notifications: NotificationWithTicket[];
  unreadCount: number;
  latestNotification: NotificationWithTicket;
  isExpanded: boolean;
}

export interface NotificationFilters {
  search: string;
  types: NotificationType[];
  readStatus: 'all' | 'read' | 'unread';
  dateRange: 'all' | 'today' | 'week' | 'month';
  ticketId?: string;
}

interface NotificationListProps {
  notifications: NotificationWithTicket[];
  loading?: boolean;
  onNotificationClick?: (notification: NotificationWithTicket) => void;
  onMarkAsRead?: (notificationId: string) => Promise<boolean>;
  onMarkAllAsRead?: () => Promise<boolean>;
  onDeleteNotification?: (notificationId: string) => Promise<boolean>;
  groupBy?: 'ticket' | 'date' | 'type' | 'none';
  showFilters?: boolean;
  showSearch?: boolean;
  className?: string;
}

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  ticket_created: 'Ticket Created',
  ticket_updated: 'Ticket Updated',
  ticket_assigned: 'Ticket Assigned',
  ticket_closed: 'Ticket Closed',
  comment_added: 'Comment Added',
  status_changed: 'Status Changed',
  priority_changed: 'Priority Changed',
  assignment_changed: 'Assignment Changed'
};

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  ticket_created: <Circle className="h-4 w-4 text-blue-500" />,
  ticket_updated: <Info className="h-4 w-4 text-blue-500" />,
  ticket_assigned: <User className="h-4 w-4 text-green-500" />,
  ticket_closed: <CheckCircle className="h-4 w-4 text-gray-500" />,
  comment_added: <AlertCircle className="h-4 w-4 text-orange-500" />,
  status_changed: <Tag className="h-4 w-4 text-purple-500" />,
  priority_changed: <AlertCircle className="h-4 w-4 text-red-500" />,
  assignment_changed: <User className="h-4 w-4 text-yellow-500" />
};

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  loading = false,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  groupBy = 'date',
  showFilters = true,
  showSearch = true,
  className
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<NotificationFilters>({
    search: '',
    types: [],
    readStatus: 'all',
    dateRange: 'all'
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  // Filter notifications based on current filters
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const title = translateNotificationContent(notification.title).toLowerCase();
        const message = translateNotificationContent(notification.message || '').toLowerCase();
        const ticketId = notification.ticket_id?.toLowerCase() || '';
        
        if (!title.includes(searchTerm) && 
            !message.includes(searchTerm) && 
            !ticketId.includes(searchTerm)) {
          return false;
        }
      }

      // Type filter
      if (filters.types.length > 0 && !filters.types.includes(notification.type)) {
        return false;
      }

      // Read status filter
      if (filters.readStatus === 'read' && !notification.read) {
        return false;
      }
      if (filters.readStatus === 'unread' && notification.read) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const notificationDate = new Date(notification.created_at);
        const now = new Date();
        
        switch (filters.dateRange) {
          case 'today':
            if (!isToday(notificationDate)) return false;
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (notificationDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (notificationDate < monthAgo) return false;
            break;
        }
      }

      // Ticket ID filter
      if (filters.ticketId && notification.ticket_id !== filters.ticketId) {
        return false;
      }

      return true;
    });
  }, [notifications, filters, translateNotificationContent]);

  // Group notifications based on groupBy prop
  const groupedNotifications = useMemo(() => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        type: 'date' as const,
        title: t('notifications.allNotifications', 'All Notifications'),
        notifications: filteredNotifications,
        unreadCount: filteredNotifications.filter(n => !n.read).length,
        latestNotification: filteredNotifications[0],
        isExpanded: true
      }];
    }

    const groups: Record<string, NotificationGroup> = {};

    filteredNotifications.forEach(notification => {
      let groupKey: string;
      let groupTitle: string;
      let groupSubtitle: string | undefined;

      switch (groupBy) {
        case 'ticket':
          groupKey = notification.ticket_id || 'no-ticket';
          groupTitle = notification.ticket_id 
            ? `Ticket #${notification.ticket_id}`
            : t('notifications.noTicket', 'General Notifications');
          break;
        
        case 'type':
          groupKey = notification.type;
          groupTitle = t(`notifications.types.${notification.type}`, NOTIFICATION_TYPE_LABELS[notification.type]);
          break;
        
        case 'date':
        default:
          const notificationDate = new Date(notification.created_at);
          const dayStart = startOfDay(notificationDate);
          groupKey = dayStart.toISOString();
          
          if (isToday(notificationDate)) {
            groupTitle = t('notifications.today', 'Today');
          } else if (isYesterday(notificationDate)) {
            groupTitle = t('notifications.yesterday', 'Yesterday');
          } else {
            groupTitle = format(notificationDate, 'EEEE, MMMM d', { locale: ptBR });
          }
          groupSubtitle = format(notificationDate, 'yyyy');
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          type: groupBy,
          title: groupTitle,
          subtitle: groupSubtitle,
          notifications: [],
          unreadCount: 0,
          latestNotification: notification,
          isExpanded: expandedGroups.has(groupKey)
        };
      }

      groups[groupKey].notifications.push(notification);
      if (!notification.read) {
        groups[groupKey].unreadCount++;
      }

      // Update latest notification if this one is newer
      if (new Date(notification.created_at) > new Date(groups[groupKey].latestNotification.created_at)) {
        groups[groupKey].latestNotification = notification;
      }
    });

    // Sort groups by latest notification date
    return Object.values(groups).sort((a, b) => 
      new Date(b.latestNotification.created_at).getTime() - 
      new Date(a.latestNotification.created_at).getTime()
    );
  }, [filteredNotifications, groupBy, expandedGroups, t]);

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback(async (notification: NotificationWithTicket) => {
    if (onMarkAsRead && !notification.read) {
      await onMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  }, [onNotificationClick, onMarkAsRead]);

  // Handle delete notification
  const handleDeleteNotification = useCallback(async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (onDeleteNotification) {
      await onDeleteNotification(notificationId);
    }
  }, [onDeleteNotification]);

  // Update filter
  const updateFilter = useCallback(<K extends keyof NotificationFilters>(
    key: K, 
    value: NotificationFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      types: [],
      readStatus: 'all',
      dateRange: 'all'
    });
  }, []);

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.types.length > 0) count++;
    if (filters.readStatus !== 'all') count++;
    if (filters.dateRange !== 'all') count++;
    return count;
  }, [filters]);

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  return (
    <TooltipProvider>
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              {t('notifications.title', 'Notifications')}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && onMarkAllAsRead && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMarkAllAsRead}
                      className="h-8 px-2"
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      {t('notifications.markAllRead', 'Mark all read')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('notifications.markAllRead', 'Mark all read')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          {(showSearch || showFilters) && (
            <div className="space-y-3">
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('notifications.searchPlaceholder', 'Search notifications...')}
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}

              {showFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Type Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <Tag className="h-4 w-4 mr-1" />
                        {t('notifications.filters.type', 'Type')}
                        {filters.types.length > 0 && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1">
                            {filters.types.length}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>{t('notifications.filters.selectTypes', 'Select Types')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => (
                        <DropdownMenuCheckboxItem
                          key={type}
                          checked={filters.types.includes(type as NotificationType)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFilter('types', [...filters.types, type as NotificationType]);
                            } else {
                              updateFilter('types', filters.types.filter(t => t !== type));
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {NOTIFICATION_TYPE_ICONS[type as NotificationType]}
                            {t(`notifications.types.${type}`, label)}
                          </div>
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Read Status Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('notifications.filters.status', 'Status')}
                        {filters.readStatus !== 'all' && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1">1</Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => updateFilter('readStatus', 'all')}>
                        {t('notifications.filters.all', 'All')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateFilter('readStatus', 'unread')}>
                        {t('notifications.filters.unread', 'Unread')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateFilter('readStatus', 'read')}>
                        {t('notifications.filters.read', 'Read')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Date Range Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8">
                        <Calendar className="h-4 w-4 mr-1" />
                        {t('notifications.filters.date', 'Date')}
                        {filters.dateRange !== 'all' && (
                          <Badge variant="secondary" className="ml-1 h-4 px-1">1</Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => updateFilter('dateRange', 'all')}>
                        {t('notifications.filters.allTime', 'All time')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateFilter('dateRange', 'today')}>
                        {t('notifications.filters.today', 'Today')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateFilter('dateRange', 'week')}>
                        {t('notifications.filters.thisWeek', 'This week')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateFilter('dateRange', 'month')}>
                        {t('notifications.filters.thisMonth', 'This month')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Clear Filters */}
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 px-2 text-muted-foreground"
                    >
                      {t('notifications.filters.clear', 'Clear')} ({activeFilterCount})
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('notifications.loading', 'Loading notifications...')}
              </p>
            </div>
          ) : groupedNotifications.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-muted-foreground mb-2">
                <Search className="h-8 w-8 mx-auto mb-2" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                {filters.search || activeFilterCount > 0
                  ? t('notifications.noResults', 'No notifications match your filters')
                  : t('notifications.empty', 'No notifications')
                }
              </p>
              {(filters.search || activeFilterCount > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  {t('notifications.filters.clearAll', 'Clear all filters')}
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-1">
                {groupedNotifications.map((group, groupIndex) => (
                  <div key={group.id} className="border-b border-border/50 last:border-b-0">
                    {/* Group Header */}
                    {groupBy !== 'none' && (
                      <div
                        className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-2">
                          {group.isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <h3 className="font-medium text-sm">{group.title}</h3>
                            {group.subtitle && (
                              <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {group.notifications.length}
                          </Badge>
                          {group.unreadCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {group.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Group Notifications */}
                    {(group.isExpanded || groupBy === 'none') && (
                      <div className="space-y-0">
                        {group.notifications.map((notification, index) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-all duration-200",
                              !notification.read && "bg-blue-50/50 dark:bg-blue-900/20 border-l-2 border-l-blue-500",
                              groupBy !== 'none' && "ml-6"
                            )}
                            onClick={() => handleNotificationClick(notification)}
                            style={{ animationDelay: `${(groupIndex * 50) + (index * 25)}ms` }}
                          >
                            {/* Notification Icon */}
                            <div className="flex-shrink-0 mt-0.5">
                              {NOTIFICATION_TYPE_ICONS[notification.type]}
                            </div>

                            {/* Notification Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 pr-2">
                                  <p className={cn(
                                    "text-sm font-medium line-clamp-2",
                                    !notification.read ? "text-foreground" : "text-muted-foreground"
                                  )}>
                                    {translateNotificationContent(notification.title)}
                                  </p>
                                  
                                  {notification.message && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                      {translateNotificationContent(notification.message)}
                                    </p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {notification.ticket_id && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {t('notifications.openTicket', 'Open ticket')}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  
                                  {onDeleteNotification && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
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
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(notification.created_at), { 
                                    addSuffix: true,
                                    locale: ptBR 
                                  })}
                                  
                                  {notification.ticket_id && (
                                    <>
                                      <Separator orientation="vertical" className="h-3" />
                                      <span>#{notification.ticket_id}</span>
                                    </>
                                  )}
                                </div>

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
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};