import React from 'react';
import { Clock, Wifi, WifiOff, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigationQueue } from '@/hooks/useNavigationPersistence';

export interface NavigationQueueIndicatorProps {
  /**
   * Whether to show the indicator
   */
  show?: boolean;
  
  /**
   * Position of the indicator
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  /**
   * Custom className
   */
  className?: string;
  
  /**
   * Whether the app is currently online
   */
  isOnline?: boolean;
}

/**
 * Component that shows the status of queued navigations
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { isOnline } = useNavigationPersistence();
 * 
 *   return (
 *     <div>
 *       <NavigationQueueIndicator 
 *         isOnline={isOnline}
 *         position="top-right"
 *       />
 *       // rest of app
 *     </div>
 *   );
 * }
 * ```
 */
export function NavigationQueueIndicator({
  show = true,
  position = 'top-right',
  className,
  isOnline = true
}: NavigationQueueIndicatorProps) {
  const { queuedCount, isProcessing, hasQueuedNavigations } = useNavigationQueue();

  if (!show || (!hasQueuedNavigations && isOnline)) {
    return null;
  }

  const getIcon = () => {
    if (!isOnline) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    
    if (isProcessing) {
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    }
    
    if (hasQueuedNavigations) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getMessage = () => {
    if (!isOnline && hasQueuedNavigations) {
      return `${queuedCount} navigation${queuedCount !== 1 ? 's' : ''} queued`;
    }
    
    if (isProcessing) {
      return 'Processing queued navigations...';
    }
    
    if (hasQueuedNavigations) {
      return `${queuedCount} navigation${queuedCount !== 1 ? 's' : ''} pending`;
    }
    
    return 'All navigations processed';
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    
    if (isProcessing) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    
    if (hasQueuedNavigations) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const getPositionClasses = () => {
    if (position === 'inline') return '';
    
    const baseClasses = 'fixed z-50';
    switch (position) {
      case 'top-right':
        return `${baseClasses} top-4 right-4`;
      case 'top-left':
        return `${baseClasses} top-4 left-4`;
      case 'bottom-right':
        return `${baseClasses} bottom-4 right-4`;
      case 'bottom-left':
        return `${baseClasses} bottom-4 left-4`;
      default:
        return `${baseClasses} top-4 right-4`;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center space-x-2 px-3 py-2 rounded-md border text-sm font-medium transition-all duration-200 shadow-sm',
        getStatusColor(),
        getPositionClasses(),
        className
      )}
    >
      {getIcon()}
      <span>{getMessage()}</span>
      {!isOnline && (
        <div className="flex items-center space-x-1 ml-2">
          <WifiOff className="h-3 w-3" />
          <span className="text-xs">Offline</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version of the navigation queue indicator
 */
export function NavigationQueueBadge({
  className,
  isOnline = true
}: {
  className?: string;
  isOnline?: boolean;
}) {
  const { queuedCount, hasQueuedNavigations } = useNavigationQueue();

  if (!hasQueuedNavigations) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        isOnline 
          ? 'bg-yellow-100 text-yellow-800' 
          : 'bg-red-100 text-red-800',
        className
      )}
    >
      {!isOnline && <WifiOff className="h-3 w-3 mr-1" />}
      <Clock className="h-3 w-3 mr-1" />
      {queuedCount}
    </div>
  );
}