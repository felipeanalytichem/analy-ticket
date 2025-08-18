import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationErrorType } from '@/services/NotificationErrorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: NotificationErrorType | null;
  isRetrying: boolean;
  retryCount: number;
  isOnline: boolean;
}

export class NotificationErrorBoundary extends Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: null,
      isRetrying: false,
      retryCount: 0,
      isOnline: navigator.onLine
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorType: NotificationErrorBoundary.categorizeError(error)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NotificationErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service if available
    this.reportError(error, errorInfo);
  }

  componentDidMount() {
    // Listen for online/offline events
    this.onlineListener = () => this.setState({ isOnline: true });
    this.offlineListener = () => this.setState({ isOnline: false });
    
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);

    // Listen for custom notification errors
    window.addEventListener('notificationError', this.handleNotificationError);
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
    }
    if (this.offlineListener) {
      window.removeEventListener('offline', this.offlineListener);
    }

    window.removeEventListener('notificationError', this.handleNotificationError);
  }

  private static categorizeError(error: Error): NotificationErrorType {
    const message = error.message?.toLowerCase() || '';
    
    // Check in order of specificity
    if (message.includes('permission') || message.includes('unauthorized')) {
      return NotificationErrorType.PERMISSION_ERROR;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return NotificationErrorType.VALIDATION_ERROR;
    }
    if (message.includes('rate limit') || message.includes('too many')) {
      return NotificationErrorType.RATE_LIMIT_ERROR;
    }
    if (message.includes('websocket') || message.includes('subscription')) {
      return NotificationErrorType.SUBSCRIPTION_ERROR;
    }
    if (message.includes('cache')) {
      return NotificationErrorType.CACHE_ERROR;
    }
    if (message.includes('database') || (message.includes('connection') && !message.includes('websocket'))) {
      return NotificationErrorType.DATABASE_ERROR;
    }
    if (message.includes('network') || message.includes('fetch') || !navigator.onLine) {
      return NotificationErrorType.NETWORK_ERROR;
    }
    
    return NotificationErrorType.UNKNOWN_ERROR;
  }

  private handleNotificationError = (event: CustomEvent) => {
    const { error } = event.detail;
    this.setState({
      hasError: true,
      error: new Error(error.message),
      errorType: error.type
    });
  };

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // In a real app, you would send this to your error tracking service
      console.error('Error reported to monitoring:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    this.setState({ isRetrying: true });
    
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorType: null,
        isRetrying: false,
        retryCount: prevState.retryCount + 1
      }));
    }, delay);
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: null,
      isRetrying: false,
      retryCount: 0
    });
  };

  private getErrorMessage(): { title: string; description: string; canRetry: boolean } {
    const { errorType, isOnline } = this.state;

    if (!isOnline) {
      return {
        title: 'No Internet Connection',
        description: 'Please check your internet connection and try again.',
        canRetry: true
      };
    }

    switch (errorType) {
      case NotificationErrorType.NETWORK_ERROR:
        return {
          title: 'Connection Problem',
          description: 'Unable to connect to the notification service. This might be a temporary issue.',
          canRetry: true
        };
      
      case NotificationErrorType.PERMISSION_ERROR:
        return {
          title: 'Access Denied',
          description: 'You don\'t have permission to access notifications. Please contact your administrator.',
          canRetry: false
        };
      
      case NotificationErrorType.VALIDATION_ERROR:
        return {
          title: 'Invalid Data',
          description: 'There was a problem with the notification data. Please refresh the page.',
          canRetry: false
        };
      
      case NotificationErrorType.DATABASE_ERROR:
        return {
          title: 'Service Temporarily Unavailable',
          description: 'The notification service is temporarily unavailable. Please try again in a moment.',
          canRetry: true
        };
      
      case NotificationErrorType.RATE_LIMIT_ERROR:
        return {
          title: 'Too Many Requests',
          description: 'You\'re making requests too quickly. Please wait a moment before trying again.',
          canRetry: true
        };
      
      case NotificationErrorType.SUBSCRIPTION_ERROR:
        return {
          title: 'Real-time Connection Lost',
          description: 'Lost connection to real-time notifications. Trying to reconnect...',
          canRetry: true
        };
      
      case NotificationErrorType.CACHE_ERROR:
        return {
          title: 'Cache Error',
          description: 'There was a problem with cached data. Refreshing should fix this.',
          canRetry: true
        };
      
      default:
        return {
          title: 'Something Went Wrong',
          description: 'An unexpected error occurred with notifications. Please try refreshing the page.',
          canRetry: true
        };
    }
  }

  private getErrorIcon() {
    const { errorType, isOnline } = this.state;

    if (!isOnline) {
      return <WifiOff className="h-8 w-8 text-red-500" />;
    }

    switch (errorType) {
      case NotificationErrorType.NETWORK_ERROR:
      case NotificationErrorType.DATABASE_ERROR:
      case NotificationErrorType.SUBSCRIPTION_ERROR:
        return <Wifi className="h-8 w-8 text-yellow-500" />;
      
      case NotificationErrorType.PERMISSION_ERROR:
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      
      default:
        return <AlertTriangle className="h-8 w-8 text-orange-500" />;
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { title, description, canRetry } = this.getErrorMessage();
      const { isRetrying, retryCount } = this.state;

      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {this.getErrorIcon()}
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Connection Status Indicator */}
            <Alert variant={this.state.isOnline ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {this.state.isOnline ? (
                  <Wifi className="h-4 w-4" />
                ) : (
                  <WifiOff className="h-4 w-4" />
                )}
                <AlertDescription>
                  {this.state.isOnline ? 'Connected' : 'Offline'}
                </AlertDescription>
              </div>
            </Alert>

            {/* Retry Information */}
            {retryCount > 0 && (
              <Alert>
                <AlertDescription>
                  Retry attempt: {retryCount}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  variant="default"
                  size="sm"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
              
              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
              >
                Reset
              </Button>
              
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Refresh Page
              </Button>
            </div>

            {/* Technical Details (for debugging) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <>
                      {'\n\nStack Trace:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withNotificationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <NotificationErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </NotificationErrorBoundary>
    );
  };
}