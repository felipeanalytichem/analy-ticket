import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { VirtualNotificationList } from './VirtualNotificationList';
import { useNotificationsPaginated } from '@/hooks/useNotificationsPaginated';
import { useNotificationLazyLoading } from '@/hooks/useNotificationLazyLoading';

interface NotificationPaginationDemoProps {
  userId: string;
}

export const NotificationPaginationDemo: React.FC<NotificationPaginationDemoProps> = ({ userId }) => {
  const [showVirtualList, setShowVirtualList] = useState(false);
  const [showPaginatedHook, setShowPaginatedHook] = useState(false);
  const [showLazyLoading, setShowLazyLoading] = useState(false);

  // Paginated hook demo
  const {
    notifications,
    loading,
    loadingMore,
    hasMore,
    unreadCount,
    totalCount,
    loadMore,
    refresh,
    markAsRead,
    deleteNotification
  } = useNotificationsPaginated({
    limit: 10,
    autoLoad: showPaginatedHook,
    filters: { read: false } // Only show unread notifications
  });

  // Lazy loading demo
  const lazyLoading = useNotificationLazyLoading();
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [notificationDetails, setNotificationDetails] = useState<any>(null);

  // Load notification details when selected
  useEffect(() => {
    if (selectedNotificationId && showLazyLoading) {
      lazyLoading.loadNotificationDetails(selectedNotificationId).then(details => {
        setNotificationDetails(details);
      });
    }
  }, [selectedNotificationId, showLazyLoading, lazyLoading]);

  const handleNotificationClick = (notification: any) => {
    console.log('Notification clicked:', notification);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    return await markAsRead(notificationId);
  };

  const handleDelete = async (notificationId: string) => {
    return await deleteNotification(notificationId);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Notification Pagination & Lazy Loading Demo</h1>
        <p className="text-gray-600">
          Demonstrating cursor-based pagination, virtual scrolling, and lazy loading for notifications
        </p>
      </div>

      {/* Virtual List Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Virtual Notification List
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVirtualList(!showVirtualList)}
            >
              {showVirtualList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
          <CardDescription>
            Efficiently renders large lists of notifications using virtual scrolling.
            Only visible items are rendered in the DOM for optimal performance.
          </CardDescription>
        </CardHeader>
        {showVirtualList && (
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="secondary">Virtual Scrolling</Badge>
                <Badge variant="secondary">Cursor-based Pagination</Badge>
                <Badge variant="secondary">Lazy Loading</Badge>
              </div>
              <VirtualNotificationList
                userId={userId}
                itemHeight={80}
                containerHeight={400}
                onNotificationClick={handleNotificationClick}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                queryOptions={{
                  limit: 20
                }}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Paginated Hook Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Paginated Notifications Hook
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPaginatedHook(!showPaginatedHook)}
            >
              {showPaginatedHook ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
          <CardDescription>
            React hook that provides paginated notifications with optimistic updates,
            caching, and automatic state management.
          </CardDescription>
        </CardHeader>
        {showPaginatedHook && (
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    {notifications.length} notifications
                  </Badge>
                  <Badge variant="destructive">
                    {unreadCount} unread
                  </Badge>
                  {totalCount && (
                    <Badge variant="outline">
                      {totalCount} total
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                  {hasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load More'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      notification.read ? 'bg-gray-50' : 'bg-white border-blue-200'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-sm font-medium ${!notification.read ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mb-1">
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkAsRead(notification.id!);
                            }}
                            className="h-6 px-2 text-xs"
                          >
                            Mark Read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notification.id!);
                          }}
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {notifications.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  No unread notifications found
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Lazy Loading Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Lazy Loading Details
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLazyLoading(!showLazyLoading)}
            >
              {showLazyLoading ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
          <CardDescription>
            Demonstrates lazy loading of notification details with caching and preloading.
            Details are only loaded when needed, improving performance.
          </CardDescription>
        </CardHeader>
        {showLazyLoading && (
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Badge variant="secondary">Intelligent Caching</Badge>
                <Badge variant="secondary">Preloading</Badge>
                <Badge variant="secondary">Memory Management</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Select Notification</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notifications.slice(0, 5).map((notification) => (
                      <button
                        key={notification.id}
                        className={`w-full text-left p-2 border rounded text-sm transition-colors ${
                          selectedNotificationId === notification.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedNotificationId(notification.id!)}
                      >
                        <div className="font-medium truncate">{notification.title}</div>
                        <div className="text-gray-500 text-xs truncate">{notification.message}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Notification Details</h4>
                  {selectedNotificationId ? (
                    <div className="border rounded p-3 bg-gray-50">
                      {lazyLoading.isLoading(selectedNotificationId) ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Loading details...</span>
                        </div>
                      ) : lazyLoading.hasError(selectedNotificationId) ? (
                        <div className="text-red-600 text-sm">
                          Error: {lazyLoading.getError(selectedNotificationId)}
                        </div>
                      ) : notificationDetails ? (
                        <div className="space-y-2 text-sm">
                          <div>
                            <strong>ID:</strong> {notificationDetails.id}
                          </div>
                          <div>
                            <strong>Type:</strong> {notificationDetails.type}
                          </div>
                          <div>
                            <strong>Priority:</strong> {notificationDetails.priority}
                          </div>
                          <div>
                            <strong>Created:</strong> {new Date(notificationDetails.created_at).toLocaleString()}
                          </div>
                          {notificationDetails.ticket && (
                            <div>
                              <strong>Ticket:</strong> #{notificationDetails.ticket.ticket_number} - {notificationDetails.ticket.title}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">No details loaded</div>
                      )}
                    </div>
                  ) : (
                    <div className="border rounded p-3 bg-gray-50 text-gray-500 text-sm">
                      Select a notification to view details
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h4 className="font-medium mb-2">Cache Statistics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {(() => {
                    const stats = lazyLoading.getCacheStats();
                    return (
                      <>
                        <div className="text-center">
                          <div className="font-medium text-lg">{stats.totalEntries}</div>
                          <div className="text-gray-500">Total Entries</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{stats.cachedEntries}</div>
                          <div className="text-gray-500">Cached</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{stats.loadingEntries}</div>
                          <div className="text-gray-500">Loading</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-lg">{stats.errorEntries}</div>
                          <div className="text-gray-500">Errors</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Features</CardTitle>
          <CardDescription>
            Key performance optimizations implemented in the notification system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Virtual Scrolling</h4>
              <p className="text-sm text-gray-600">
                Only renders visible items in large lists, maintaining smooth performance
                even with thousands of notifications.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Cursor-based Pagination</h4>
              <p className="text-sm text-gray-600">
                Efficient pagination using timestamps as cursors, avoiding offset-based
                pagination issues with large datasets.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Intelligent Caching</h4>
              <p className="text-sm text-gray-600">
                Caches notification details with TTL and LRU eviction, reducing
                redundant API calls and improving response times.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Optimistic Updates</h4>
              <p className="text-sm text-gray-600">
                Updates UI immediately for better user experience, with automatic
                rollback on API failures.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Prefetching</h4>
              <p className="text-sm text-gray-600">
                Preloads next page and notification details in the background
                for seamless user experience.
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Memory Management</h4>
              <p className="text-sm text-gray-600">
                Automatic cleanup of expired cache entries and memory-efficient
                virtual scrolling implementation.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPaginationDemo;