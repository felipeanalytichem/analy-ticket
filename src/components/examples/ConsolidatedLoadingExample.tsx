import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConsolidatedLoadingIndicator } from '@/components/ui/ConsolidatedLoadingIndicator';
import { useConsolidatedLoading } from '@/hooks/useConsolidatedLoading';
import { useToast } from '@/components/ui/use-toast';

/**
 * Example component demonstrating the consolidated loading hook usage
 * This shows how to replace multiple loading states with a single, predictable interface
 */
export const ConsolidatedLoadingExample: React.FC = () => {
  const { toast } = useToast();
  
  const loadingManager = useConsolidatedLoading({
    maxRetries: 3,
    retryDelay: 1000,
    onError: (error, retryCount) => {
      toast({
        title: "Operation Failed",
        description: `Error: ${error.message} (Attempt ${retryCount + 1})`,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Operation completed successfully!",
      });
    }
  });

  // Simulate initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadingManager.executeWithLoading(
          () => new Promise(resolve => setTimeout(resolve, 2000)),
          'initial',
          'initialData',
          'Loading initial data...'
        );
      } catch (error) {
        // Error is handled by the hook
      }
    };

    loadInitialData();
  }, []);

  // Simulate different types of operations
  const handleRefresh = async () => {
    try {
      await loadingManager.executeWithLoading(
        () => new Promise(resolve => setTimeout(resolve, 1500)),
        'refresh',
        'userData',
        'Refreshing user data...'
      );
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleSubmitForm = async () => {
    try {
      await loadingManager.executeWithLoading(
        () => new Promise(resolve => setTimeout(resolve, 2000)),
        'form',
        'userForm',
        'Submitting form...'
      );
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleAction = async () => {
    try {
      await loadingManager.executeWithLoading(
        () => new Promise(resolve => setTimeout(resolve, 1000)),
        'action',
        'deleteUser',
        'Deleting user...'
      );
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleProgressOperation = async () => {
    const operationId = loadingManager.startLoading('action', 'progressOperation', 'Processing...');
    
    try {
      // Simulate progress updates
      for (let i = 0; i <= 100; i += 10) {
        loadingManager.updateProgress(i, `Processing... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      loadingManager.completeLoading(operationId);
    } catch (error) {
      loadingManager.completeLoading(operationId, { error: 'Progress operation failed' });
    }
  };

  const handleErrorOperation = async () => {
    try {
      await loadingManager.executeWithLoading(
        () => Promise.reject(new Error('Simulated network error')),
        'action',
        'errorOperation',
        'This will fail...'
      );
    } catch (error) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Consolidated Loading Hook Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Loading Indicator */}
          <ConsolidatedLoadingIndicator
            isLoading={loadingManager.isLoading}
            loadingPhase={loadingManager.loadingPhase}
            loadingType={loadingManager.loadingType}
            error={loadingManager.error}
            operation={loadingManager.operation}
            message={loadingManager.message}
            progress={loadingManager.progress}
            canRetry={loadingManager.canRetry}
            retryCount={loadingManager.retryCount}
            onRetry={loadingManager.retry}
            className="min-h-[100px]"
          />

          {/* Control Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={handleRefresh}
              disabled={loadingManager.isLoading}
              variant="outline"
            >
              Refresh Data
            </Button>
            
            <Button
              onClick={handleSubmitForm}
              disabled={loadingManager.isLoading}
              variant="default"
            >
              Submit Form
            </Button>
            
            <Button
              onClick={handleAction}
              disabled={loadingManager.isLoading}
              variant="secondary"
            >
              Perform Action
            </Button>
            
            <Button
              onClick={handleProgressOperation}
              disabled={loadingManager.isLoading}
              variant="outline"
            >
              Progress Operation
            </Button>
            
            <Button
              onClick={handleErrorOperation}
              disabled={loadingManager.isLoading}
              variant="destructive"
            >
              Trigger Error
            </Button>
            
            <Button
              onClick={loadingManager.reset}
              disabled={loadingManager.isLoading}
              variant="ghost"
            >
              Reset State
            </Button>
          </div>

          {/* State Information */}
          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-sm">Current State</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <div>Loading: {loadingManager.isLoading ? 'Yes' : 'No'}</div>
              <div>Phase: {loadingManager.loadingPhase}</div>
              <div>Type: {loadingManager.loadingType || 'None'}</div>
              <div>Operation: {loadingManager.operation || 'None'}</div>
              <div>Retry Count: {loadingManager.retryCount}</div>
              <div>Can Retry: {loadingManager.canRetry ? 'Yes' : 'No'}</div>
              <div>Has Active Operations: {loadingManager.hasActiveOperations ? 'Yes' : 'No'}</div>
              
              {/* Computed Properties */}
              <div className="pt-2 border-t">
                <div>Is Initial Load: {loadingManager.isInitialLoad ? 'Yes' : 'No'}</div>
                <div>Is Refreshing: {loadingManager.isRefreshing ? 'Yes' : 'No'}</div>
                <div>Is Submitting: {loadingManager.isSubmitting ? 'Yes' : 'No'}</div>
                <div>Is Performing Action: {loadingManager.isPerformingAction ? 'Yes' : 'No'}</div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};