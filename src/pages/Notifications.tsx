import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationService } from '@/lib/notificationService';
import { FeedbackPopup } from '@/components/tickets/FeedbackPopup';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

export const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    refresh
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [feedbackPopupOpen, setFeedbackPopupOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Check for feedback parameter in URL and open popup automatically
  useEffect(() => {
    const feedbackTicketId = searchParams.get('feedback');
    if (feedbackTicketId) {
      console.log('🎭 Auto-opening feedback popup for ticket:', feedbackTicketId);
      setSelectedTicketId(feedbackTicketId);
      setFeedbackPopupOpen(true);
      // Clear the parameter from URL after opening popup
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('feedback');
        return newParams;
      });
    }
  }, [searchParams, setSearchParams]);

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter(notification => {
    const matchesReadFilter = 
      filter === 'all' || 
      (filter === 'unread' && !notification.read) ||
      (filter === 'read' && notification.read);
    
    const matchesTypeFilter = 
      typeFilter === 'all' || notification.type === typeFilter;
    
    return matchesReadFilter && matchesTypeFilter;
  });

  // Get unique notification types for filter
  const notificationTypes = Array.from(new Set(notifications.map(n => n.type)));

  const handleNotificationClick = async (notificationId: string, ticketId?: string, notificationType?: string, message?: string) => {
    console.log('🔔 Notification clicked:', { notificationId, ticketId, notificationType, message });
    
    // Mark as read
    await markAsRead(notificationId);
    
    // Navigate to ticket if available
    if (ticketId) {
      // Special handling for feedback notifications - detect based on message content
      const isFeedbackRequest = message?.includes('avaliar o atendimento') || 
                               message?.includes('Avalie seu atendimento') ||
                               notificationType === 'feedback_request';
      
      if (isFeedbackRequest) {
        console.log('🔔 Opening feedback popup for ticket:', ticketId);
        // Open feedback popup
        setSelectedTicketId(ticketId);
        setFeedbackPopupOpen(true);
      } else if (notificationType === 'feedback_received') {
        console.log('🔔 Navigating for feedback_received');
        // Navigate to main page where they can see the feedback in ticket list
        navigate(`/`);
      } else {
        console.log('🔔 Default navigation for type:', notificationType);
        // Default navigation to main page
        navigate(`/`);
      }
    } else {
      console.log('🔔 No ticket ID available');
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      toast.success('All notifications marked as read');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    const success = await deleteNotification(notificationId);
    if (success) {
      toast.success('Notification removed');
    }
  };

  const handleRefresh = async () => {
    await refresh();
    toast.success('Notifications updated');
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 md:h-8 md:w-8" />
            Notifications
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
            Manage your system notifications
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Update</span>
            <span className="sm:hidden">Update</span>
          </Button>
          
          {unreadCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="flex-1 sm:flex-none"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Mark all as read ({unreadCount})</span>
              <span className="md:hidden">Mark all ({unreadCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unread</CardTitle>
            <Badge variant="destructive" className="h-4 w-4 p-0 flex items-center justify-center text-xs">
              !
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{unreadCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Read</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {notifications.length - unreadCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {notificationTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {NotificationService.getNotificationIcon(type)} {type.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Notifications ({filteredNotifications.length})
          </CardTitle>
          <CardDescription>
            {filter === 'unread' && 'Showing only unread notifications'}
            {filter === 'read' && 'Showing only read notifications'}
            {filter === 'all' && 'Showing all notifications'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === 'unread' ? 'No unread notification' : 'No notification found'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification, index) => {
                const icon = NotificationService.getNotificationIcon(notification.type);
                const colorClass = NotificationService.getNotificationColor(notification.priority);
                
                return (
                  <div key={notification.id}>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        !notification.read ? 'bg-blue-50/50 border-blue-200' : 'bg-background'
                      }`}
                      onClick={() => handleNotificationClick(notification.id, notification.ticket_id, notification.type, notification.message)}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <span className="text-2xl">{icon}</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className={`font-medium ${
                                !notification.read ? 'text-foreground' : 'text-muted-foreground'
                              }`}>
                                {notification.message}
                              </p>
                              
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>
                                  {formatDistanceToNow(new Date(notification.created_at), {
                                    addSuffix: true,
                                    locale: ptBR
                                  })}
                                </span>
                                
                                {notification.priority && notification.priority !== 'medium' && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className={`text-xs ${colorClass}`}>
                                      {notification.priority}
                                    </Badge>
                                  </>
                                )}
                                
                                <span>•</span>
                                <span className="capitalize">
                                  {notification.type.replace('_', ' ')}
                                </span>
                              </div>
                              
                              {notification.ticket && (
                                <div className="mt-2 p-2 bg-muted/30 rounded text-sm">
                                  <span className="font-medium">
                                    #{notification.ticket.ticket_number}
                                  </span>
                                  {' - '}
                                  <span className="text-muted-foreground">
                                    {notification.ticket.title}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2 ml-4">
                              {notification.ticket_id && (
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              )}
                              
                              {!notification.read && (
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              )}
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNotification(notification.id);
                                }}
                                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {index < filteredNotifications.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Popup */}
      <FeedbackPopup
        ticketId={selectedTicketId}
        open={feedbackPopupOpen}
        onOpenChange={setFeedbackPopupOpen}
        onFeedbackSubmitted={() => {
          setFeedbackPopupOpen(false);
          setSelectedTicketId(null);
          refresh(); // Refresh notifications after feedback submission
        }}
      />
    </div>
  );
}; 