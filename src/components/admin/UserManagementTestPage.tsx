import React, { useState } from 'react';
import { UserManagement } from './UserManagement';
import { UserManagementFallback } from './UserManagementFallback';
import { UserManagementTestError } from './UserManagementTestError';
import { UserManagementErrorBoundary } from './UserManagementErrorBoundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Bug } from 'lucide-react';

/**
 * Test page to demonstrate the fallback UI functionality
 * This component should only be used for testing purposes
 */
export const UserManagementTestPage: React.FC = () => {
  const [testMode, setTestMode] = useState<'normal' | 'fallback' | 'error'>('normal');

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            User Management Fallback UI Test Page
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800 dark:text-orange-200">
                Testing Environment
              </span>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              This page is used to test the fallback UI functionality. Use the tabs below to test different scenarios.
            </p>
          </div>

          <Tabs value={testMode} onValueChange={(value) => setTestMode(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="normal" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Normal Mode
              </TabsTrigger>
              <TabsTrigger value="fallback" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Fallback Mode
              </TabsTrigger>
              <TabsTrigger value="error" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Error Simulation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="normal" className="mt-6">
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Normal User Management Component
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This shows the normal UserManagement component with full functionality.
                  </p>
                </div>
                
                <UserManagementErrorBoundary
                  enableGracefulDegradation={true}
                  useFallbackComponent={false}
                  onRetry={() => window.location.reload()}
                  onReset={() => window.location.reload()}
                >
                  <UserManagement />
                </UserManagementErrorBoundary>
              </div>
            </TabsContent>

            <TabsContent value="fallback" className="mt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    Fallback Component
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This shows the UserManagementFallback component with limited functionality.
                  </p>
                </div>
                
                <UserManagementFallback 
                  error="Simulated error for testing fallback UI"
                  onRetry={() => setTestMode('normal')}
                />
              </div>
            </TabsContent>

            <TabsContent value="error" className="mt-6">
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    Error Simulation
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    Click any button below to simulate different error scenarios and see the fallback UI in action.
                  </p>
                </div>
                
                <UserManagementErrorBoundary
                  enableGracefulDegradation={true}
                  useFallbackComponent={true}
                  onRetry={() => setTestMode('normal')}
                  onReset={() => setTestMode('normal')}
                >
                  <UserManagementTestError />
                </UserManagementErrorBoundary>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Test Instructions
            </h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• <strong>Normal Mode:</strong> Shows the full UserManagement component</li>
              <li>• <strong>Fallback Mode:</strong> Shows the fallback component directly</li>
              <li>• <strong>Error Simulation:</strong> Click error buttons to trigger fallback UI</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};