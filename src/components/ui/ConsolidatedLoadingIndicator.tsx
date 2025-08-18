import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { LoadingPhase, LoadingType } from '@/hooks/useConsolidatedLoading';

interface ConsolidatedLoadingIndicatorProps {
  isLoading: boolean;
  loadingPhase: LoadingPhase;
  loadingType: LoadingType;
  error: string | null;
  operation: string | null;
  message?: string;
  progress?: number;
  canRetry: boolean;
  retryCount: number;
  onRetry?: () => void;
  className?: string;
}

/**
 * A unified loading indicator component that works with the consolidated loading hook
 * to provide consistent, flicker-free loading states across the application.
 */
export const ConsolidatedLoadingIndicator: React.FC<ConsolidatedLoadingIndicatorProps> = ({
  isLoading,
  loadingPhase,
  loadingType,
  error,
  operation,
  message,
  progress,
  canRetry,
  retryCount,
  onRetry,
  className = ''
}) => {
  // Don't render anything if not loading and no error
  if (!isLoading && !error && loadingPhase === 'ready') {
    return null;
  }

  // Error state
  if (error && loadingPhase === 'error') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <div className="font-medium">Error occurred</div>
            <div className="text-sm">{error}</div>
            {retryCount > 0 && (
              <div className="text-xs mt-1 opacity-75">
                Retry attempt: {retryCount}
              </div>
            )}
          </div>
          {canRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="ml-4"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    const getLoadingMessage = () => {
      if (message) return message;
      if (operation) {
        switch (loadingType) {
          case 'initial':
            return `Loading ${operation}...`;
          case 'refresh':
            return `Refreshing ${operation}...`;
          case 'form':
            return `Submitting ${operation}...`;
          case 'action':
            return `Processing ${operation}...`;
          default:
            return `Loading...`;
        }
      }
      return 'Loading...';
    };

    const getLoadingIcon = () => {
      switch (loadingType) {
        case 'refresh':
          return <RefreshCw className="h-4 w-4 animate-spin" />;
        default:
          return <Loader2 className="h-4 w-4 animate-spin" />;
      }
    };

    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {getLoadingIcon()}
            <span className="text-sm font-medium">{getLoadingMessage()}</span>
          </div>
          
          {progress !== undefined && (
            <div className="w-48 space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="text-xs text-gray-500 text-center">
                {Math.round(progress)}% complete
              </div>
            </div>
          )}
          
          {retryCount > 0 && (
            <div className="text-xs text-gray-500">
              Retry attempt: {retryCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};