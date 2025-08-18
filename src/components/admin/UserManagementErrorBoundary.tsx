import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Users,
  Database,
  Wifi,
  Clock,
  Shield
} from 'lucide-react';
import { UserManagementFallback } from './UserManagementFallback';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  onReset?: () => void;
  fallbackData?: any[];
  enableGracefulDegradation?: boolean;
  useFallbackComponent?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorBoundary: boolean;
  retryCount: number;
  lastErrorTime: number;
}

/**
 * Enhanced error boundary specifically for user management that provides:
 * - Consolidated error handling for all user management operations
 * - Graceful degradation with partial data display
 * - Intelligent retry mechanisms with exponential backoff
 * - Prevention of rapid state changes and re-renders
 */
export class UserManagementErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_COOLDOWN = 5000; // 5 seconds between retries

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorBoundary: false,
      retryCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error, 
      errorBoundary: true,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UserManagementErrorBoundary caught an error:', error, errorInfo);
    
    // Log additional context for debugging
    console.error('Error boundary context:', {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    });
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }
  }

  private getErrorType = (error?: Error): string => {
    if (!error) return 'unknown';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('database') || message.includes('query')) {
      return 'database';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'permission';
    }
    
    return 'unknown';
  };

  private getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case 'network':
        return <Wifi className="h-8 w-8 text-red-500" />;
      case 'timeout':
        return <Clock className="h-8 w-8 text-orange-500" />;
      case 'database':
        return <Database className="h-8 w-8 text-red-500" />;
      case 'permission':
        return <Shield className="h-8 w-8 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
    }
  };

  private getErrorTitle = (errorType: string): string => {
    switch (errorType) {
      case 'network':
        return 'Network Connection Error';
      case 'timeout':
        return 'Request Timeout';
      case 'database':
        return 'Database Access Error';
      case 'permission':
        return 'Permission Error';
      default:
        return 'User Management Error';
    }
  };

  private getErrorDescription = (errorType: string): string => {
    switch (errorType) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection.';
      case 'timeout':
        return 'The request took too long to complete. The server may be experiencing high load.';
      case 'database':
        return 'There was an issue accessing the user database. This is usually temporary.';
      case 'permission':
        return 'You do not have sufficient permissions to perform this action.';
      default:
        return 'An unexpected error occurred in the user management system.';
    }
  };

  private canRetry = (): boolean => {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;
    
    return (
      this.state.retryCount < this.MAX_RETRIES &&
      timeSinceLastError >= this.RETRY_COOLDOWN
    );
  };

  private handleRetry = () => {
    if (!this.canRetry()) {
      return;
    }

    // Prevent rapid retries by adding a cooldown
    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
      lastErrorTime: Date.now()
    }));

    // Clear any existing retry timeout
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
    }

    // Schedule retry with exponential backoff
    this.retryTimeoutRef = setTimeout(() => {
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorBoundary: false 
      });
      
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    }, retryDelay);
  };

  private handleReset = () => {
    // Clear any pending retries
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef);
      this.retryTimeoutRef = null;
    }

    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorBoundary: false,
      retryCount: 0,
      lastErrorTime: 0
    });
    
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private renderGracefulDegradation = () => {
    if (!this.props.enableGracefulDegradation || !this.props.fallbackData) {
      return null;
    }

    return (
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
            Limited Functionality Mode
          </h4>
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
          Some features may be unavailable, but you can still view cached user data.
        </p>
        
        {/* Render fallback data if available */}
        {this.props.fallbackData.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Cached Users ({this.props.fallbackData.length}):
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {this.props.fallbackData.slice(0, 5).map((user: any, index: number) => (
                <div key={index} className="text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                  <Users className="h-3 w-3" />
                  {user.name || user.email} ({user.role})
                </div>
              ))}
              {this.props.fallbackData.length > 5 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                  ... and {this.props.fallbackData.length - 5} more users
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      const errorType = this.getErrorType(this.state.error);
      const canRetryNow = this.canRetry();
      const nextRetryTime = this.state.lastErrorTime + this.RETRY_COOLDOWN;
      const timeUntilRetry = Math.max(0, nextRetryTime - Date.now());

      // Use fallback component if enabled
      if (this.props.useFallbackComponent) {
        return (
          <UserManagementFallback 
            error={this.state.error?.message}
            onRetry={this.handleReset}
          />
        );
      }

      return (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              {this.getErrorIcon(errorType)}
            </div>
            <CardTitle className="text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              {this.getErrorTitle(errorType)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {this.getErrorDescription(errorType)}
              </AlertDescription>
            </Alert>

            {/* Retry Information */}
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center space-y-1">
              <div>Retry attempt {this.state.retryCount} of {this.MAX_RETRIES}</div>
              {!canRetryNow && timeUntilRetry > 0 && (
                <div className="text-orange-600 dark:text-orange-400">
                  Next retry available in {Math.ceil(timeUntilRetry / 1000)} seconds
                </div>
              )}
            </div>

            {/* Technical Details */}
            <details className="text-sm text-gray-600 dark:text-gray-400">
              <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-auto space-y-1">
                <div><strong>Error:</strong> {this.state.error?.message}</div>
                <div><strong>Type:</strong> {errorType}</div>
                <div><strong>Boundary:</strong> {this.state.errorBoundary ? 'React Error Boundary' : 'Runtime Error'}</div>
                <div><strong>Retry Count:</strong> {this.state.retryCount}/{this.MAX_RETRIES}</div>
                <div><strong>Time:</strong> {new Date().toLocaleString()}</div>
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button 
                onClick={this.handleRetry} 
                disabled={!canRetryNow}
                className="flex items-center gap-2 flex-1"
              >
                <RefreshCw className="h-4 w-4" />
                {canRetryNow ? 'Retry Now' : 'Retry Cooldown'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleReset}
                className="flex items-center gap-2 flex-1"
              >
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 flex-1"
              >
                Reload Page
              </Button>
            </div>

            {/* Graceful Degradation */}
            {this.renderGracefulDegradation()}

            {/* Additional Help */}
            <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If this problem persists, please contact your system administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}