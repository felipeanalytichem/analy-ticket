import { useCallback } from 'react';
import { useConsolidatedLoading } from './useConsolidatedLoading';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Specialized hook for UserManagement component that consolidates all loading states
 * and provides a clean interface for the component to use.
 */
export function useUserManagementLoading() {
  const { loading: authLoading } = useAuth();
  
  const consolidatedLoading = useConsolidatedLoading({
    maxRetries: 3,
    retryDelay: 1000,
    onError: (error, retryCount) => {
      console.error(`User management operation failed (attempt ${retryCount + 1}):`, error);
    },
    onSuccess: () => {
      console.log('User management operation completed successfully');
    }
  });

  // Initialize with auth loading state
  const initializeLoading = useCallback(() => {
    if (authLoading) {
      consolidatedLoading.setPhase('loading');
      consolidatedLoading.startLoading('initial', 'authentication', 'Checking authentication...');
    } else {
      consolidatedLoading.setPhase('ready');
    }
  }, [authLoading, consolidatedLoading]);

  // Load users operation
  const loadUsers = useCallback(async (queryFn: () => Promise<any[]>) => {
    return consolidatedLoading.executeWithLoading(
      queryFn,
      'initial',
      'loadUsers',
      'Loading users...'
    );
  }, [consolidatedLoading]);

  // Refresh users operation
  const refreshUsers = useCallback(async (queryFn: () => Promise<any[]>) => {
    return consolidatedLoading.executeWithLoading(
      queryFn,
      'refresh',
      'refreshUsers',
      'Refreshing user data...'
    );
  }, [consolidatedLoading]);

  // Save user operation (create or update)
  const saveUser = useCallback(async (
    saveFn: () => Promise<any>,
    isCreating: boolean = false
  ) => {
    const operation = isCreating ? 'createUser' : 'updateUser';
    const message = isCreating ? 'Creating user...' : 'Updating user...';
    
    return consolidatedLoading.executeWithLoading(
      saveFn,
      'form',
      operation,
      message
    );
  }, [consolidatedLoading]);

  // Delete user operation
  const deleteUser = useCallback(async (deleteFn: () => Promise<void>) => {
    return consolidatedLoading.executeWithLoading(
      deleteFn,
      'action',
      'deleteUser',
      'Removing user...'
    );
  }, [consolidatedLoading]);

  // Generate temporary password operation
  const generateTempPassword = useCallback(async (generateFn: () => Promise<string>) => {
    return consolidatedLoading.executeWithLoading(
      generateFn,
      'action',
      'generateTempPassword',
      'Generating temporary password...'
    );
  }, [consolidatedLoading]);

  // Send invitation operation
  const sendInvitation = useCallback(async (sendFn: () => Promise<void>) => {
    return consolidatedLoading.executeWithLoading(
      sendFn,
      'action',
      'sendInvitation',
      'Sending invitation...'
    );
  }, [consolidatedLoading]);

  return {
    // State
    ...consolidatedLoading,
    
    // Auth-specific state
    isAuthenticating: authLoading,
    
    // Computed loading states for backward compatibility
    loading: consolidatedLoading.isLoading || authLoading,
    isSubmitting: consolidatedLoading.isSubmitting,
    
    // Operations
    initializeLoading,
    loadUsers,
    refreshUsers,
    saveUser,
    deleteUser,
    generateTempPassword,
    sendInvitation,
    
    // Convenience methods
    isLoadingUsers: consolidatedLoading.operation === 'loadUsers' && consolidatedLoading.isLoading,
    isRefreshingUsers: consolidatedLoading.operation === 'refreshUsers' && consolidatedLoading.isLoading,
    isSavingUser: (consolidatedLoading.operation === 'createUser' || consolidatedLoading.operation === 'updateUser') && consolidatedLoading.isLoading,
    isDeletingUser: consolidatedLoading.operation === 'deleteUser' && consolidatedLoading.isLoading,
    isGeneratingPassword: consolidatedLoading.operation === 'generateTempPassword' && consolidatedLoading.isLoading,
    isSendingInvitation: consolidatedLoading.operation === 'sendInvitation' && consolidatedLoading.isLoading,
  };
}