import React from 'react';
import { Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingState } from '@/contexts/LoadingContext';

interface LoadingFallbackProps {
  loading: LoadingState;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'skeleton' | 'progress';
}

export function LoadingFallback({ 
  loading, 
  className = '', 
  size = 'md',
  variant = 'spinner'
}: LoadingFallbackProps) {
  if (!loading.isLoading) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8'
  };

  if (variant === 'progress' && loading.progress !== undefined) {
    return (
      <div className={`flex flex-col items-center justify-center space-y-4 ${containerClasses[size]} ${className}`}>
        <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
        {loading.message && (
          <p className="text-sm text-muted-foreground text-center">{loading.message}</p>
        )}
        <div className="w-full max-w-xs">
          <Progress value={loading.progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-1">
            {Math.round(loading.progress)}%
          </p>
        </div>
        {loading.canCancel && loading.onCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={loading.onCancel}
            className="flex items-center gap-2"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 ${containerClasses[size]} ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
        {loading.message && (
          <p className="text-sm text-muted-foreground">{loading.message}</p>
        )}
      </div>
    );
  }

  // Default spinner variant
  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${containerClasses[size]} ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      {loading.message && (
        <p className="text-sm text-muted-foreground text-center">{loading.message}</p>
      )}
      {loading.canCancel && loading.onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={loading.onCancel}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Cancel
        </Button>
      )}
    </div>
  );
}

interface ErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  canRetry?: boolean;
  retryCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ErrorFallback({
  error,
  onRetry,
  onDismiss,
  canRetry = true,
  retryCount = 0,
  className = '',
  size = 'md'
}: ErrorFallbackProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const containerClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8'
  };

  return (
    <Card className={`${className}`}>
      <CardContent className={`flex flex-col items-center justify-center space-y-4 ${containerClasses[size]}`}>
        <AlertCircle className={`${sizeClasses[size]} text-destructive`} />
        
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-destructive">
            {size === 'lg' ? 'Something went wrong' : 'Error'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {error.message || 'An unexpected error occurred.'}
          </p>
          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Retry attempts: {retryCount}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {canRetry && onRetry && (
            <Button
              onClick={onRetry}
              size={size === 'sm' ? 'sm' : 'default'}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="outline"
              onClick={onDismiss}
              size={size === 'sm' ? 'sm' : 'default'}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Specialized loading components for common scenarios
export function PageLoadingFallback({ message = 'Loading page...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingFallback
        loading={{ isLoading: true, message }}
        size="lg"
        className="text-center"
      />
    </div>
  );
}

export function ComponentLoadingFallback({ message }: { message?: string }) {
  return (
    <LoadingFallback
      loading={{ isLoading: true, message }}
      size="md"
      variant="skeleton"
      className="min-h-[100px]"
    />
  );
}

export function InlineLoadingFallback({ message }: { message?: string }) {
  return (
    <LoadingFallback
      loading={{ isLoading: true, message }}
      size="sm"
      className="py-2"
    />
  );
}