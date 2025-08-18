import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Database, 
  Clock,
  Users
} from 'lucide-react';

interface UserDataErrorStateProps {
  error: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  onRetry: () => void;
  onReset: () => void;
}

export const UserDataErrorState: React.FC<UserDataErrorStateProps> = ({
  error,
  retryCount,
  maxRetries,
  canRetry,
  onRetry,
  onReset,
}) => {
  const getErrorType = (errorMessage: string) => {
    const lowerMessage = errorMessage.toLowerCase();
    
    // Check database errors first (more specific)
    if (lowerMessage.includes('database') || 
        lowerMessage.includes('query') ||
        lowerMessage.includes('sql')) {
      return 'database';
    }
    
    // Check timeout errors
    if (lowerMessage.includes('timeout')) {
      return 'timeout';
    }
    
    // Check network errors (less specific, check last)
    if (lowerMessage.includes('network') || 
        lowerMessage.includes('fetch') ||
        lowerMessage.includes('connection')) {
      return 'network';
    }
    
    return 'unknown';
  };

  const errorType = getErrorType(error);

  const getErrorIcon = () => {
    switch (errorType) {
      case 'network':
        return <Wifi className="h-12 w-12 text-red-500" />;
      case 'timeout':
        return <Clock className="h-12 w-12 text-orange-500" />;
      case 'database':
        return <Database className="h-12 w-12 text-red-500" />;
      default:
        return <AlertTriangle className="h-12 w-12 text-red-500" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'network':
        return 'Network Connection Error';
      case 'timeout':
        return 'Request Timeout';
      case 'database':
        return 'Database Error';
      default:
        return 'Failed to Load Users';
    }
  };

  const getErrorDescription = () => {
    switch (errorType) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'timeout':
        return 'The request took too long to complete. This might be due to server load or network issues.';
      case 'database':
        return 'There was an issue accessing the user database. This is likely a temporary problem.';
      default:
        return 'An unexpected error occurred while loading user data. Please try again.';
    }
  };

  const getSuggestions = () => {
    switch (errorType) {
      case 'network':
        return [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact your network administrator if the problem persists'
        ];
      case 'timeout':
        return [
          'Wait a moment and try again',
          'Check if the server is experiencing high load',
          'Try refreshing the page'
        ];
      case 'database':
        return [
          'This is usually a temporary issue',
          'Try again in a few moments',
          'Contact system administrator if the problem persists'
        ];
      default:
        return [
          'Try refreshing the page',
          'Check your internet connection',
          'Contact support if the problem continues'
        ];
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader>
        <div className="flex items-center justify-center mb-4">
          {getErrorIcon()}
        </div>
        <CardTitle className="text-center text-red-600 dark:text-red-400 flex items-center justify-center gap-2">
          <Users className="h-5 w-5" />
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {getErrorDescription()}
          </AlertDescription>
        </Alert>

        {/* Retry Information */}
        {retryCount > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Retry attempt {retryCount} of {maxRetries}
          </div>
        )}

        {/* Suggestions */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">What you can try:</h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {getSuggestions().map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-gray-400 mt-1">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>

        {/* Technical Details */}
        <details className="text-sm text-gray-600 dark:text-gray-400">
          <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-auto">
            <div><strong>Error:</strong> {error}</div>
            <div><strong>Retry Count:</strong> {retryCount}/{maxRetries}</div>
            <div><strong>Time:</strong> {new Date().toLocaleString()}</div>
          </div>
        </details>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button 
            onClick={onRetry} 
            disabled={!canRetry}
            className="flex items-center gap-2 flex-1"
          >
            <RefreshCw className="h-4 w-4" />
            {canRetry ? 'Try Again' : 'Max Retries Reached'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onReset}
            className="flex items-center gap-2 flex-1"
          >
            <RefreshCw className="h-4 w-4" />
            Reset & Retry
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 flex-1"
          >
            Reload Page
          </Button>
        </div>

        {/* Additional Help */}
        <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If this problem continues, please contact your system administrator.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};