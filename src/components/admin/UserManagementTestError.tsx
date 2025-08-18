import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bug, Zap } from 'lucide-react';

/**
 * Test component to simulate various error scenarios for testing the fallback UI
 * This component should only be used for testing purposes
 */
export const UserManagementTestError: React.FC = () => {
  const [errorType, setErrorType] = useState<string | null>(null);

  const simulateError = (type: string) => {
    setErrorType(type);
    
    // Simulate different types of errors
    switch (type) {
      case 'render':
        // This will cause a render error
        throw new Error('Simulated render error for testing fallback UI');
      
      case 'network':
        throw new Error('Network connection failed - simulated for testing');
      
      case 'database':
        throw new Error('Database query failed - simulated for testing');
      
      case 'permission':
        throw new Error('Permission denied - simulated for testing');
      
      case 'timeout':
        throw new Error('Request timeout - simulated for testing');
      
      default:
        throw new Error('Unknown error - simulated for testing');
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <Bug className="h-5 w-5" />
          Error Simulation Test Component
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="font-medium text-orange-800 dark:text-orange-200">
              Testing Mode
            </span>
          </div>
          <p className="text-sm text-orange-700 dark:text-orange-300">
            This component is used to test the fallback UI by simulating different error scenarios.
            Click any button below to trigger an error and see the fallback component in action.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => simulateError('render')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Render Error
          </Button>
          
          <Button 
            onClick={() => simulateError('network')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Network Error
          </Button>
          
          <Button 
            onClick={() => simulateError('database')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Database Error
          </Button>
          
          <Button 
            onClick={() => simulateError('permission')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Permission Error
          </Button>
          
          <Button 
            onClick={() => simulateError('timeout')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Timeout Error
          </Button>
          
          <Button 
            onClick={() => simulateError('unknown')}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Unknown Error
          </Button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          <strong>Note:</strong> This component should be removed from production builds.
          It's only intended for testing the error boundary and fallback UI functionality.
        </div>
      </CardContent>
    </Card>
  );
};