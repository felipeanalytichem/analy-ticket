import React from 'react';
import { useLoading } from '@/contexts/LoadingContext';
import { LoadingFallback, ErrorFallback } from '@/components/ui/LoadingFallback';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function GlobalLoadingIndicator() {
  const { globalLoading, errors, clearError, clearAllErrors, hasErrors } = useLoading();

  // Don't render anything if there's no global loading or errors
  if (!globalLoading.isLoading && !hasErrors()) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {/* Global loading indicator */}
      {globalLoading.isLoading && (
        <Card className="p-4 shadow-lg border-primary/20 bg-background/95 backdrop-blur">
          <LoadingFallback
            loading={globalLoading}
            size="sm"
            className="text-left"
          />
        </Card>
      )}

      {/* Error notifications */}
      {Object.entries(errors).map(([errorId, errorState]) => (
        <Card key={errorId} className="p-4 shadow-lg border-destructive/20 bg-background/95 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <ErrorFallback
              error={errorState.error}
              onRetry={errorState.onRetry}
              canRetry={errorState.canRetry}
              retryCount={errorState.retryCount}
              size="sm"
              className="flex-1 border-none shadow-none p-0"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearError(errorId)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Card>
      ))}

      {/* Clear all errors button when there are multiple errors */}
      {Object.keys(errors).length > 1 && (
        <Card className="p-2 shadow-lg border-muted bg-background/95 backdrop-blur">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllErrors}
            className="w-full text-xs"
          >
            Clear All Errors
          </Button>
        </Card>
      )}
    </div>
  );
}

// Page-level loading overlay
export function PageLoadingOverlay() {
  const { pageLoading, isAnyLoading } = useLoading();

  // Check if any page is loading
  const loadingPages = Object.entries(pageLoading).filter(([_, loading]) => loading.isLoading);
  
  if (loadingPages.length === 0) {
    return null;
  }

  // Show overlay for the first loading page
  const [pageId, loading] = loadingPages[0];

  return (
    <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <Card className="p-8 shadow-xl max-w-md w-full mx-4">
        <LoadingFallback
          loading={loading}
          size="lg"
          variant={loading.progress !== undefined ? 'progress' : 'spinner'}
        />
        {loadingPages.length > 1 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            {loadingPages.length - 1} more page{loadingPages.length > 2 ? 's' : ''} loading...
          </p>
        )}
      </Card>
    </div>
  );
}

// Component to show loading state in navigation or header
export function NavigationLoadingIndicator() {
  const { isAnyLoading, getLoadingMessage } = useLoading();

  if (!isAnyLoading()) {
    return null;
  }

  const message = getLoadingMessage();

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
      {message && <span className="truncate max-w-[200px]">{message}</span>}
    </div>
  );
}