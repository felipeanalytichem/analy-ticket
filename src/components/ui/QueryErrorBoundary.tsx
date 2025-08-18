import React, { Component, ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class QueryErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Query Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Something went wrong</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {this.state.error?.message || 'An unexpected error occurred while loading data.'}
                </p>
              </div>
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  reset();
                }}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          )}
        </QueryErrorResetBoundary>
      );
    }

    return this.props.children;
  }
}

export function QueryErrorBoundary({ children, fallback }: Props) {
  return (
    <QueryErrorBoundaryClass fallback={fallback}>
      {children}
    </QueryErrorBoundaryClass>
  );
}