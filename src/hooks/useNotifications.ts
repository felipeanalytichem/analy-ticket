import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService, NotificationWithTicket, Notification } from '@/lib/notificationService';
import { toast } from 'sonner';

export const useNotifications = () => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationWithTicket[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const subscriptionRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);
      setError(null);
      
      const [notificationsData, unreadCountData] = await Promise.all([
        NotificationService.getNotifications(userProfile.id),
        NotificationService.getUnreadCount(userProfile.id)
      ]);

      setNotifications(notificationsData);
      setUnreadCount(unreadCountData);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Erro ao carregar notificações');
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const success = await NotificationService.markAsRead(notificationId);
      if (success) {
        // Update local state immediately
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId 
              ? { ...n, read: true }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Erro ao marcar notificação como lida');
      return false;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userProfile?.id) return false;

    try {
      const success = await NotificationService.markAllAsRead(userProfile.id);
      if (success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
        setUnreadCount(0);
        toast.success('Todas as notificações foram marcadas como lidas');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Erro ao marcar todas as notificações como lidas');
      return false;
    }
  }, [userProfile?.id]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const success = await NotificationService.deleteNotification(notificationId);
      if (success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setUnreadCount(prev => {
          const notification = notifications.find(n => n.id === notificationId);
          return notification && !notification.read ? Math.max(0, prev - 1) : prev;
        });
        toast.success('Notificação excluída');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Erro ao excluir notificação');
      return false;
    }
  }, [notifications]);

  // Handle new notification from real-time
  const handleNewNotification = useCallback((notification: Notification) => {
    console.log('🔔 New notification received:', notification);
    
    // Add to notifications list
    setNotifications(prev => {
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      return [{
        ...notification,
        ticket: null // Will be loaded if needed
      }, ...prev];
    });
    
    // Update unread count
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }

    // Show toast notification only if user has enabled it
    try {
      const userPreferences = localStorage.getItem('userPreferences');
      let toastNotificationsEnabled = true; // Default to enabled
      
      if (userPreferences) {
        const preferences = JSON.parse(userPreferences);
        toastNotificationsEnabled = preferences.toastNotifications ?? true;
      }
      
      if (toastNotificationsEnabled) {
        NotificationService.showToastNotification(notification);
      }
    } catch (error) {
      // If there's an error reading preferences, default to showing toast
      console.warn('Error reading toast notification preferences:', error);
      NotificationService.showToastNotification(notification);
    }
  }, []);

  // Setup real-time subscription
  const setupSubscription = useCallback(() => {
    if (!userProfile?.id || isSubscribedRef.current) return;

    console.log('🔔 Setting up notification subscription for:', userProfile.id);
    
    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    const subscription = NotificationService.subscribeToNotifications(
      userProfile.id,
      handleNewNotification
    );

    subscriptionRef.current = subscription;
    isSubscribedRef.current = true;
  }, [userProfile?.id, handleNewNotification]);

  // Cleanup subscription
  const cleanupSubscription = useCallback(() => {
    console.log('🔔 Cleaning up notification subscription');
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    isSubscribedRef.current = false;
  }, []);

  // Load notifications on mount and user change
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Setup real-time subscription
  useEffect(() => {
    if (userProfile?.id) {
      // Small delay to ensure auth is ready
      const timer = setTimeout(setupSubscription, 1000);
      return () => clearTimeout(timer);
    } else {
      cleanupSubscription();
    }
  }, [userProfile?.id, setupSubscription, cleanupSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupSubscription;
  }, [cleanupSubscription]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
    cleanup: cleanupSubscription
  };
}; 