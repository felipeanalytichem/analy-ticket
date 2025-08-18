import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for monitoring
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Render appropriate error UI based on level
      return this.renderErrorUI();
    }

    return this.props.children;
  }

  private renderErrorUI() {
    const { level = 'component', showDetails = false } = this.props;
    const { error, errorInfo, retryCount } = this.state;
    const canRetry = retryCount < this.maxRetries;

    switch (level) {
      case 'critical':
        return this.renderCriticalError();
      case 'page':
        return this.renderPageError();
      case 'component':
      default:
        return this.renderComponentError();
    }
  }

  private renderCriticalError() {
    const { error } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-red-900 dark:text-red-100">
              Critical Error
            </CardTitle>
            <CardDescription>
              The application encountered a critical error and needs to be restarted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error?.message || 'An unexpected error occurred'}
              </AlertDescription>
            </Alert>
            
            <div className="flex flex-col space-y-2">
              <Button onClick={this.handleReload} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Application
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </div>

            {this.props.showDetails && error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  private renderPageError() {
    const { error, retryCount } = this.state;
    const canRetry = retryCount < this.maxRetries;

    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-orange-900 dark:text-orange-100">
              Page Error
            </CardTitle>
            <CardDescription>
              This page encountered an error and couldn't load properly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Bug className="h-4 w-4" />
              <AlertDescription>
                {error?.message || 'Something went wrong while loading this page'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again ({this.maxRetries - retryCount} left)
                </Button>
              )}
              <Button variant="outline" onClick={this.handleGoHome} className="flex-1">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </div>

            {!canRetry && (
              <Alert variant="destructive">
                <AlertDescription>
                  Maximum retry attempts reached. Please refresh the page or contact support.
                </AlertDescription>
              </Alert>
            )}

            {this.props.showDetails && error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                  Error Details
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                  {error.stack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  private renderComponentError() {
    const { error, retryCount } = this.state;
    const canRetry = retryCount < this.maxRetries;

    return (
      <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/10">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-100">
              Component Error
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error?.message || 'This component failed to render'}
            </p>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {canRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={this.handleRetry}
                  className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry ({this.maxRetries - retryCount})
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={this.handleReset}
                className="text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
              >
                Reset
              </Button>
            </div>

            {!canRetry && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                Component failed after {this.maxRetries} attempts
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}