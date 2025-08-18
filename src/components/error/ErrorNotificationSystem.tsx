import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ErrorNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success' | 'network' | 'offline';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number; // Auto-dismiss after this many ms (0 = no auto-dismiss)
  actions?: ErrorAction[];
  persistent?: boolean;
  retryable?: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorAction {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  loading?: boolean;
}

interface ErrorNotificationState {
  notifications: ErrorNotification[];
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
}

type ErrorNotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: ErrorNotification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'UPDATE_CONNECTION'; payload: { isOnline: boolean; quality: 'excellent' | 'good' | 'poor' | 'offline' } }
  | { type: 'UPDATE_ACTION_LOADING'; payload: { notificationId: string; actionIndex: number; loading: boolean } };

const initialState: ErrorNotificationState = {
  notifications: [],
  isOnline: navigator.onLine,
  connectionQuality: 'excellent'
};

function errorNotificationReducer(
  state: ErrorNotificationState,
  action: ErrorNotificationAction
): ErrorNotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: []
      };
    
    case 'UPDATE_CONNECTION':
      return {
        ...state,
        isOnline: action.payload.isOnline,
        connectionQuality: action.payload.quality
      };
    
    case 'UPDATE_ACTION_LOADING':
      return {
        ...state,
        notifications: state.notifications.map(notification => {
          if (notification.id === action.payload.notificationId && notification.actions) {
            const updatedActions = [...notification.actions];
            updatedActions[action.payload.actionIndex] = {
              ...updatedActions[action.payload.actionIndex],
              loading: action.payload.loading
            };
            return { ...notification, actions: updatedActions };
          }
          return notification;
        })
      };
    
    default:
      return state;
  }
}

interface ErrorNotificationContextType {
  notifications: ErrorNotification[];
  isOnline: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline';
  addNotification: (notification: Omit<ErrorNotification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  showError: (title: string, message: string, options?: Partial<ErrorNotification>) => string;
  showWarning: (title: string, message: string, options?: Partial<ErrorNotification>) => string;
  showInfo: (title: string, message: string, options?: Partial<ErrorNotification>) => string;
  showSuccess: (title: string, message: string, options?: Partial<ErrorNotification>) => string;
  showNetworkError: (message: string, retryAction?: () => void) => string;
  showOfflineNotification: () => string;
}

const ErrorNotificationContext = createContext<ErrorNotificationContextType | undefined>(undefined);

export function useErrorNotifications() {
  const context = useContext(ErrorNotificationContext);
  if (!context) {
    throw new Error('useErrorNotifications must be used within an ErrorNotificationProvider');
  }
  return context;
}

interface ErrorNotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
}

export function ErrorNotificationProvider({ 
  children, 
  maxNotifications = 5,
  defaultDuration = 5000 
}: ErrorNotificationProviderProps) {
  const [state, dispatch] = useReducer(errorNotificationReducer, initialState);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ 
        type: 'UPDATE_CONNECTION', 
        payload: { isOnline: true, quality: 'excellent' } 
      });
    };

    const handleOffline = () => {
      dispatch({ 
        type: 'UPDATE_CONNECTION', 
        payload: { isOnline: false, quality: 'offline' } 
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-dismiss notifications
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    state.notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: notification.id });
        }, notification.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [state.notifications]);

  const addNotification = useCallback((
    notification: Omit<ErrorNotification, 'id' | 'timestamp'>
  ): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: ErrorNotification = {
      ...notification,
      id,
      timestamp: new Date(),
      duration: notification.duration ?? defaultDuration
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

    // Remove oldest notifications if we exceed the limit
    if (state.notifications.length >= maxNotifications) {
      const oldestId = state.notifications[0].id;
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: oldestId });
    }

    return id;
  }, [defaultDuration, maxNotifications, state.notifications.length]);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const showError = useCallback((
    title: string, 
    message: string, 
    options?: Partial<ErrorNotification>
  ): string => {
    return addNotification({
      type: 'error',
      title,
      message,
      duration: 0, // Errors don't auto-dismiss by default
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((
    title: string, 
    message: string, 
    options?: Partial<ErrorNotification>
  ): string => {
    return addNotification({
      type: 'warning',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  const showInfo = useCallback((
    title: string, 
    message: string, 
    options?: Partial<ErrorNotification>
  ): string => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    });
  }, [addNotification]);

  const showSuccess = useCallback((
    title: string, 
    message: string, 
    options?: Partial<ErrorNotification>
  ): string => {
    return addNotification({
      type: 'success',
      title,
      message,
      duration: 3000,
      ...options
    });
  }, [addNotification]);

  const showNetworkError = useCallback((
    message: string, 
    retryAction?: () => void
  ): string => {
    const actions: ErrorAction[] = [];
    
    if (retryAction) {
      actions.push({
        label: 'Retry',
        action: retryAction,
        variant: 'default'
      });
    }

    return addNotification({
      type: 'network',
      title: 'Network Error',
      message,
      actions,
      retryable: !!retryAction,
      duration: 0
    });
  }, [addNotification]);

  const showOfflineNotification = useCallback((): string => {
    return addNotification({
      type: 'offline',
      title: 'You are offline',
      message: 'Some features may not be available until your connection is restored.',
      persistent: true,
      duration: 0
    });
  }, [addNotification]);

  const contextValue: ErrorNotificationContextType = {
    notifications: state.notifications,
    isOnline: state.isOnline,
    connectionQuality: state.connectionQuality,
    addNotification,
    removeNotification,
    clearAll,
    showError,
    showWarning,
    showInfo,
    showSuccess,
    showNetworkError,
    showOfflineNotification
  };

  return (
    <ErrorNotificationContext.Provider value={contextValue}>
      {children}
      <ErrorNotificationContainer />
    </ErrorNotificationContext.Provider>
  );
}

function ErrorNotificationContainer() {
  const { notifications, removeNotification } = useErrorNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <ErrorNotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface ErrorNotificationCardProps {
  notification: ErrorNotification;
  onDismiss: () => void;
}

function ErrorNotificationCard({ notification, onDismiss }: ErrorNotificationCardProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'network':
        return <Wifi className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
      case 'offline':
        return <WifiOff className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getCardClassName = () => {
    const baseClasses = "animate-in slide-in-from-right-full duration-300";
    
    switch (notification.type) {
      case 'error':
        return `${baseClasses} border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10`;
      case 'warning':
        return `${baseClasses} border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10`;
      case 'info':
        return `${baseClasses} border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10`;
      case 'success':
        return `${baseClasses} border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10`;
      case 'network':
        return `${baseClasses} border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10`;
      case 'offline':
        return `${baseClasses} border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/10`;
      default:
        return `${baseClasses} border-gray-200 dark:border-gray-800`;
    }
  };

  const handleActionClick = async (action: ErrorAction, actionIndex: number) => {
    try {
      // Update loading state if needed
      if (action.loading !== undefined) {
        // This would need to be implemented in the context
      }
      
      await action.action();
    } catch (error) {
      console.error('Error executing notification action:', error);
    }
  };

  return (
    <Card className={getCardClassName()}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {notification.title}
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {notification.message}
                </p>
              </div>
              
              {!notification.persistent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {notification.actions && notification.actions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {notification.actions.map((action, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={action.variant || 'outline'}
                    onClick={() => handleActionClick(action, index)}
                    disabled={action.loading}
                    className="text-xs"
                  >
                    {action.loading && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {notification.timestamp.toLocaleTimeString()}
              </span>
              
              {notification.retryable && (
                <Badge variant="secondary" className="text-xs">
                  Retryable
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}