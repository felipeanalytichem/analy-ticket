import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationWithTicket } from '@/lib/notificationService';
import { NotificationPagination, NotificationQueryOptions, PaginatedResult } from '@/services/NotificationPagination';
import { useNotificationLazyLoading } from './useNotificationLazyLoading';
import { toast } from 'sonner';

interface UseNotificationsPaginatedOptions {
  limit?: number;
  autoLoad?: boolean;
  enableLazyLoading?: boolean;
  filters?: Partial<NotificationQueryOptions>;
}

export const useNotificationsPaginated = (options: UseNotificationsPaginatedOptions = {}) => {
  const { userProfile } = useAuth();
  const {
    limit = 20,
    autoLoad = true,
    enableLazyLoading = true,
    filters = {}
  } = options;

  // State
  const [notifications, setNotifications] = useState<NotificationWithTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [totalCount, setTotalCount] = useState<number | undefined>();

  // Refs
  const loadingRef = useRef(false);
  const currentFiltersRef = useRef<string>('');

  // Lazy loading hook
  const lazyLoading = useNotificationLazyLoading({
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    maxCacheSize: 200
  });

  // Build query options
  const buildQueryOptions = useCallback((cursor?: string): NotificationQueryOptions => {
    return {
      userId: userProfile?.id,
      limit,
      cursor,
      ...filters
    };
  }, [userProfile?.id, limit, filters]);

  // Load notifications
  const loadNotifications = useCallback(async (reset = false) => {
    if (!userProfile?.id || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setError(null);
      
      if (reset) {
        setLoading(true);
        setNotifications([]);
        setNextCursor(undefined);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const queryOptions = buildQueryOptions(reset ? undefined : nextCursor);
      const result: PaginatedResult<NotificationWithTicket> = await NotificationPagination.getPaginatedNotifications(queryOptions);

      if (reset) {
        setNotifications(result.data);
        
        // Load total count for UI display
        if (userProfile.id) {
          const count = await NotificationPagination.getTotalCount(userProfile.id, filters);
          setTotalCount(count);
        }
      } else {
        setNotifications(prev => [...prev, ...result.data]);
      }

      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);

      // Preload notification details if lazy loading is enabled
      if (enableLazyLoading && result.data.length > 0) {
        const notificationIds = result.data
          .filter(n => n.id)
          .map(n => n.id!)
          .slice(0, 5); // Only preload first 5 for performance
        
        lazyLoading.batchPreloadNotifications(notificationIds);
      }

      // Prefetch next page for better UX
      if (result.hasMore && result.nextCursor) {
        NotificationPagination.prefetchNextPage(queryOptions, result.nextCursor);
      }

    } catch (err) {
      console.error('Error loading notifications:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [userProfile?.id, buildQueryOptions, nextCursor, filters, enableLazyLoading, lazyLoading]);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loadingRef.current) return;
    await loadNotifications(false);
  }, [hasMore, loadingMore, loadNotifications]);

  // Refresh notifications
  const refresh = useCallback(async () => {
    await loadNotifications(true);
  }, [loadNotifications]);

  // Mark notification as read with optimistic update
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read: true }
            : n
        )
      );

      // Make API call
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        // Revert optimistic update on error
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, read: false }
              : n
          )
        );
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!userProfile?.id) return false;

    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );

      // Make API call
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userProfile.id)
        .eq('read', false);

      if (error) {
        // Revert optimistic update on error
        await refresh();
        throw error;
      }

      toast.success('All notifications marked as read');
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
      return false;
    }
  }, [userProfile?.id, refresh]);

  // Delete notification with optimistic update
  const deleteNotification = useCallback(async (notificationId: string): Promise<boolean> => {
    try {
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setTotalCount(prev => prev ? prev - 1 : undefined);

      // Make API call
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        // Revert optimistic update on error
        await refresh();
        throw error;
      }

      // Clear from lazy loading cache
      lazyLoading.clearCache(notificationId);
      
      toast.success('Notification deleted');
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
      return false;
    }
  }, [refresh, lazyLoading]);

  // Get notification details with lazy loading
  const getNotificationDetails = useCallback(async (notificationId: string) => {
    if (!enableLazyLoading) {
      return notifications.find(n => n.id === notificationId) || null;
    }
    
    return await lazyLoading.loadNotificationDetails(notificationId);
  }, [enableLazyLoading, notifications, lazyLoading]);

  // Preload notification details
  const preloadNotificationDetails = useCallback((notificationId: string) => {
    if (enableLazyLoading) {
      lazyLoading.preloadNotificationDetails(notificationId);
    }
  }, [enableLazyLoading, lazyLoading]);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Auto-load on mount and filter changes
  useEffect(() => {
    if (!autoLoad || !userProfile?.id) return;

    const filtersString = JSON.stringify(filters);
    if (filtersString !== currentFiltersRef.current) {
      currentFiltersRef.current = filtersString;
      loadNotifications(true);
    }
  }, [autoLoad, userProfile?.id, filters, loadNotifications]);

  // Cleanup lazy loading cache on unmount
  useEffect(() => {
    const cleanup = lazyLoading.scheduleCleanup();
    return cleanup;
  }, [lazyLoading]);

  return {
    // Data
    notifications,
    unreadCount,
    totalCount,
    hasMore,
    
    // Loading states
    loading,
    loadingMore,
    error,
    
    // Actions
    loadMore,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    
    // Lazy loading
    getNotificationDetails,
    preloadNotificationDetails,
    isLoadingDetails: lazyLoading.isLoading,
    hasDetailsError: lazyLoading.hasError,
    getDetailsError: lazyLoading.getError,
    
    // Cache management
    clearDetailsCache: lazyLoading.clearCache,
    clearAllDetailsCache: lazyLoading.clearAllCache,
    getCacheStats: lazyLoading.getCacheStats
  };
};

export default useNotificationsPaginated;