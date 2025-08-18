import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NotificationWithTicket } from '@/lib/notificationService';
import { NotificationPagination, NotificationQueryOptions, PaginatedResult } from '@/services/NotificationPagination';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VirtualNotificationListProps {
  userId: string;
  queryOptions?: Partial<NotificationQueryOptions>;
  itemHeight?: number;
  containerHeight?: number;
  onNotificationClick?: (notification: NotificationWithTicket) => void;
  onMarkAsRead?: (notificationId: string) => Promise<boolean>;
  onDelete?: (notificationId: string) => Promise<boolean>;
  renderNotification?: (notification: NotificationWithTicket, index: number) => React.ReactNode;
}

interface VirtualItem {
  index: number;
  notification: NotificationWithTicket;
  top: number;
  height: number;
}

export const VirtualNotificationList: React.FC<VirtualNotificationListProps> = ({
  userId,
  queryOptions = {},
  itemHeight = 80,
  containerHeight = 400,
  onNotificationClick,
  onMarkAsRead,
  onDelete,
  renderNotification
}) => {
  const [notifications, setNotifications] = useState<NotificationWithTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [scrollTop, setScrollTop] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Calculate visible items based on scroll position
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      notifications.length
    );

    const items: VirtualItem[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      if (notifications[i]) {
        items.push({
          index: i,
          notification: notifications[i],
          top: i * itemHeight,
          height: itemHeight
        });
      }
    }

    return items;
  }, [notifications, scrollTop, itemHeight, containerHeight]);

  // Total height of the virtual list
  const totalHeight = notifications.length * itemHeight;

  // Load initial notifications
  const loadNotifications = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(reset);
      setError(null);

      const options: NotificationQueryOptions = {
        ...queryOptions,
        userId,
        cursor: reset ? undefined : nextCursor,
        limit: queryOptions.limit || 20
      };

      const result: PaginatedResult<NotificationWithTicket> = await NotificationPagination.getPaginatedNotifications(options);

      if (reset) {
        setNotifications(result.data);
      } else {
        setNotifications(prev => [...prev, ...result.data]);
      }

      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);

      // Prefetch next page for better UX
      if (result.hasMore && result.nextCursor) {
        NotificationPagination.prefetchNextPage(options, result.nextCursor);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
      loadingRef.current = false;
    }
  }, [userId, queryOptions, nextCursor]);

  // Load more notifications when scrolling near bottom
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || loadingRef.current) return;

    setIsLoadingMore(true);
    await loadNotifications(false);
  }, [hasMore, isLoadingMore, loadNotifications]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    // Load more when near bottom (within 200px)
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 200 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // Default notification renderer
  const defaultRenderNotification = useCallback((notification: NotificationWithTicket, index: number) => {
    const handleClick = () => {
      onNotificationClick?.(notification);
    };

    const handleMarkAsRead = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (notification.id && !notification.read) {
        const success = await onMarkAsRead?.(notification.id);
        if (success) {
          setNotifications(prev => 
            prev.map(n => 
              n.id === notification.id ? { ...n, read: true } : n
            )
          );
        }
      }
    };

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (notification.id) {
        const success = await onDelete?.(notification.id);
        if (success) {
          setNotifications(prev => prev.filter(n => n.id !== notification.id));
        }
      }
    };

    const priorityColors = {
      low: 'border-l-blue-500',
      medium: 'border-l-yellow-500',
      high: 'border-l-red-500'
    };

    return (
      <div
        key={notification.id || index}
        className={`
          p-4 border-l-4 ${priorityColors[notification.priority || 'medium']}
          ${notification.read ? 'bg-gray-50' : 'bg-white'}
          hover:bg-gray-100 cursor-pointer transition-colors
          border-b border-gray-200
        `}
        onClick={handleClick}
        style={{ height: itemHeight }}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm font-medium truncate ${!notification.read ? 'font-semibold' : ''}`}>
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-600 truncate mb-1">
              {notification.message}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{new Date(notification.created_at).toLocaleDateString()}</span>
              {notification.ticket && (
                <span>• Ticket #{notification.ticket.ticket_number}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 ml-2">
            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAsRead}
                className="h-6 px-2 text-xs"
              >
                Mark Read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  }, [onNotificationClick, onMarkAsRead, onDelete, itemHeight]);

  // Load initial data
  useEffect(() => {
    loadNotifications(true);
  }, [userId, JSON.stringify(queryOptions)]);

  // Retry function for error state
  const retry = useCallback(() => {
    loadNotifications(true);
  }, [loadNotifications]);

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading notifications...</span>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="text-center">
          <p>No notifications found</p>
          <Button variant="ghost" size="sm" onClick={retry} className="mt-2">
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="overflow-auto border rounded-lg"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleItems.map(item => (
            <div
              key={item.notification.id || item.index}
              style={{
                position: 'absolute',
                top: item.top,
                left: 0,
                right: 0,
                height: item.height
              }}
            >
              {renderNotification 
                ? renderNotification(item.notification, item.index)
                : defaultRenderNotification(item.notification, item.index)
              }
            </div>
          ))}
        </div>
        
        {/* Loading indicator at bottom */}
        {isLoadingMore && (
          <div className="flex items-center justify-center p-4 border-t">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-gray-600">Loading more...</span>
          </div>
        )}
        
        {/* End of list indicator */}
        {!hasMore && notifications.length > 0 && (
          <div className="flex items-center justify-center p-4 border-t text-sm text-gray-500">
            You've reached the end of your notifications
          </div>
        )}
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        {Math.floor(scrollTop / itemHeight) + 1} - {Math.min(Math.floor(scrollTop / itemHeight) + Math.ceil(containerHeight / itemHeight), notifications.length)} of {notifications.length}
      </div>
    </div>
  );
};

export default VirtualNotificationList;