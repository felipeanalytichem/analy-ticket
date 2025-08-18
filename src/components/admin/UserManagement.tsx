import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserList } from "@/components/admin/UserList";
import { UserForm } from "@/components/admin/UserForm";
import { UserPasswordDialog } from "@/components/admin/UserPasswordDialog";
import { supabase } from "@/integrations/supabase/client";
import { adminService } from "@/lib/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Users, 
  Plus, 
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wifi
} from "lucide-react";
import { EmailService } from '@/lib/emailService';
import { transformUserName } from '@/lib/utils';
import { SafeTranslation } from '@/components/ui/SafeTranslation';
import { useTranslation } from 'react-i18next';
import { UserManagementSkeleton } from './UserManagementSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { errorRecoveryService, ErrorType, type RecoveryResult } from '@/lib/errorRecoveryService';

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "agent" | "admin";
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  full_name?: string;
  temporary_password?: string | null;
  temporary_password_expires_at?: string | null;
  must_change_password?: boolean;
}

interface UserFormData {
  name: string;
  email: string;
  role: "user" | "agent" | "admin";
}

// Memoized UserManagement component for better performance
export const UserManagement = memo(() => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  
  // Optimized component state with progressive loading phases
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true); // Track first load for skeleton
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  
  // Enhanced error recovery state
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const [lastRecoveryResult, setLastRecoveryResult] = useState<RecoveryResult<User[]> | null>(null);
  const [connectivityStatus, setConnectivityStatus] = useState<boolean | null>(null);
  
  // Debounced search for better performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [tempPasswordColumnsExist, setTempPasswordColumnsExist] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Form state - memoized to prevent unnecessary re-renders
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  
  const { toast } = useToast();

  // Enhanced data loading with comprehensive error recovery
  const loadUsers = useCallback(async (isRetry = false) => {
    const loadOperation = async (): Promise<User[]> => {
      const startTime = performance.now();
      
      // Optimized query with specific fields to reduce data transfer
      const { data, error: dbError } = await supabase
        .from("users")
        .select(`
          id,
          email,
          full_name,
          role,
          avatar_url,
          created_at,
          updated_at,
          temporary_password,
          temporary_password_expires_at,
          must_change_password
        `)
        .order("created_at", { ascending: false })
        .limit(100); // Limit initial load for better performance

      if (dbError) {
        throw new Error(`Database query failed: ${dbError.message}`);
      }

      // Optimized transformation with early return for empty data
      if (!data || data.length === 0) {
        return [];
      }

      // Batch transform user data for better performance
      const transformedUsers = data.map(user => ({
        ...user,
        name: transformUserName(user.full_name, user.email)
      }));

      // Performance logging for monitoring
      const loadTime = performance.now() - startTime;
      if (loadTime > 2000) {
        console.warn(`User loading took ${loadTime.toFixed(2)}ms - consider optimization`);
      }

      return transformedUsers;
    };

    try {
      // Only show loading for initial load or retries
      if (!isRetry || users.length === 0) {
        setLoading(true);
      }
      setError(null);
      setRecoveryInProgress(true);

      // Execute with comprehensive error recovery
      const result = await errorRecoveryService.executeWithRetry(
        loadOperation,
        {
          operation: 'loadUsers',
          isRetry,
          userCount: users.length,
          timestamp: new Date().toISOString()
        },
        {
          maxRetries: isRetry ? 2 : 3, // Fewer retries for manual retries
          baseDelay: 1000,
          maxDelay: 10000
        }
      );

      setLastRecoveryResult(result);

      if (result.success && result.data) {
        setUsers(result.data);
        setInitialLoad(false);
        setRetryCount(0);
        
        // Log successful recovery if there were previous attempts
        if (result.attempts > 1) {
          console.log(`✅ User loading succeeded after ${result.attempts} attempts in ${result.totalTime}ms`);
          toast({
            title: "Connection Restored",
            description: `Successfully loaded users after ${result.attempts} attempts.`,
            variant: "default",
          });
        }
      } else {
        throw result.error || new Error('Failed to load users');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load users";
      console.error("Error loading users:", error);
      setError(errorMessage);
      setInitialLoad(false);
      
      // Update retry count
      if (isRetry) {
        setRetryCount(prev => prev + 1);
      }
      
      // Show toast with recovery information
      if (!isRetry) {
        toast({
          title: "Error Loading Users",
          description: `${errorMessage}${lastRecoveryResult ? ` (${lastRecoveryResult.attempts} attempts)` : ''}`,
          variant: "destructive",
        });
      }
      
      throw error; // Re-throw for retry handling
    } finally {
      setLoading(false);
      setRecoveryInProgress(false);
    }
  }, [toast, users.length, lastRecoveryResult]);

  // Enhanced retry function with comprehensive error recovery
  const retryLoadUsers = useCallback(async () => {
    try {
      setError(null);
      
      // Test connectivity before retrying
      const isConnected = await errorRecoveryService.testConnectivity();
      setConnectivityStatus(isConnected);
      
      if (!isConnected) {
        toast({
          title: "Connection Issue",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
        return;
      }
      
      await loadUsers(true); // Mark as retry attempt
    } catch (error) {
      console.error("Manual retry failed:", error);
      
      // Show detailed error information
      const errorStats = errorRecoveryService.getErrorStats();
      console.log("Error recovery statistics:", errorStats);
    }
  }, [loadUsers, toast]);

  // Test network connectivity
  const testConnectivity = useCallback(async () => {
    setConnectivityStatus(null); // Show loading state
    const isConnected = await errorRecoveryService.testConnectivity();
    setConnectivityStatus(isConnected);
    
    toast({
      title: isConnected ? "Connection OK" : "Connection Failed",
      description: isConnected 
        ? "Network connectivity is working properly." 
        : "Unable to connect to the server. Please check your internet connection.",
      variant: isConnected ? "default" : "destructive",
    });
    
    return isConnected;
  }, [toast]);

  const checkTempPasswordColumns = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('temporary_password, temporary_password_expires_at, must_change_password')
        .limit(1);
      
      if (!error) {
        setTempPasswordColumnsExist(true);
      } else {
        console.log('Temporary password columns not available:', error);
        setTempPasswordColumnsExist(false);
      }
    } catch (error) {
      console.log('Temporary password system not available');
      setTempPasswordColumnsExist(false);
    }
  }, []);

  // Optimized useEffect with reduced dependencies and better performance
  useEffect(() => {
    // Only load data when user is authenticated and has admin role
    if (user && userProfile && userProfile.role === 'admin' && !authLoading) {
      // Skip if data is already loaded to prevent unnecessary requests
      if (users.length > 0 && !error) {
        return;
      }
      
      // Progressive loading approach
      const performInitialLoad = async () => {
        try {
          // Load users and temp password columns in parallel for better performance
          const [usersResult] = await Promise.allSettled([
            loadUsers(),
            checkTempPasswordColumns()
          ]);
          
          // Handle any failures in parallel operations with enhanced recovery
          if (usersResult.status === 'rejected') {
            console.log("Initial load failed, error recovery service will handle retries automatically");
            // The error recovery service in loadUsers will handle automatic retries
            // No need for manual retry logic here
          }
        } catch (error) {
          console.error("Unexpected error during initial load:", error);
        }
      };
      
      performInitialLoad();
    }
  }, [user, userProfile, authLoading]); // Reduced dependencies for better performance

  // Simple authentication check
  const isAuthenticated = !!user && !!userProfile;
  const hasAdminRole = userProfile?.role === 'admin';
  const canAccessPage = isAuthenticated && hasAdminRole;



  // Optimized search and filtering with debounced search for better performance
  const filteredUsers = useMemo(() => {
    // Early return for no filters
    if (!debouncedSearchTerm.trim() && roleFilter === "all") {
      return users;
    }
    
    let filtered = users;
    
    // Optimized search filter with early termination
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(user => {
        // Check most common fields first for better performance
        return user.email.toLowerCase().includes(searchLower) ||
               user.name.toLowerCase().includes(searchLower) ||
               (user.full_name && user.full_name.toLowerCase().includes(searchLower));
      });
    }
    
    // Apply role filter after search for better performance
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    return filtered;
  }, [users, debouncedSearchTerm, roleFilter]);

  // Optimized callback handlers with stable references
  const handleDeleteUser = useCallback((userId: string) => {
    setDeleteUserId(userId);
  }, []);

  const handleCreateUser = useCallback(() => {
    setEditingUser(null);
    setIsCreating(true);
    setIsFormOpen(true);
  }, []);

  const handleEditUser = useCallback((user: User) => {
    setEditingUser(user);
    setIsCreating(false);
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingUser(null);
    setIsCreating(false);
  }, []);

  // Optimized search handler with debouncing for better performance
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleRoleFilterChange = useCallback((value: string) => {
    setRoleFilter(value);
  }, []);

  const handleSaveUser = useCallback(async (userData: UserFormData, generateTempPassword: boolean) => {
    const saveOperation = async () => {
      if (isCreating) {
        // Create user via Edge Function
        const response = await adminService.createUser({
          email: userData.email,
          name: userData.name,
          role: userData.role,
          generateTempPassword: generateTempPassword
        });

        if (response.user) {
          // Add user to list
          setUsers(prev => [response.user as User, ...prev]);
          
          // Set up password dialog state
          setCreatedUser(response.user as User);
          setGeneratedPassword(response.temporaryPassword || null);
          
          // Close form and show password dialog
          setIsFormOpen(false);
          setShowPasswordDialog(true);
        }

        return response;

      } else { // Update logic for existing user
        if (!editingUser) throw new Error('No user selected for editing');
        
        const updates: Partial<User> & { full_name?: string } = {
            full_name: userData.name,
            email: userData.email,
            role: userData.role,
            updated_at: new Date().toISOString()
        };
        
        const { error: profileUpdateError } = await supabase
          .from("users")
          .update(updates)
          .eq("id", editingUser.id);

        if (profileUpdateError) throw profileUpdateError;
        
        const originalUser = users.find(u => u.id === editingUser.id);
        const authUpdates: { email?: string; user_metadata?: any } = {};

        if (userData.email !== originalUser?.email) {
            authUpdates.email = userData.email;
        }
        if (userData.role !== originalUser?.role) {
            authUpdates.user_metadata = { role: userData.role };
        }

        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabase.auth.admin.updateUserById(
                editingUser.id,
                authUpdates
            );
            if (authError) {
                console.warn("Failed to update auth user:", authError);
                // Don't throw here, just warn - profile update succeeded
            }
        }

        // Update user in list
        setUsers(prev => prev.map(u => 
          u.id === editingUser.id 
            ? { ...u, ...updates, name: userData.name }
            : u
        ));
        
        // Close form
        setIsFormOpen(false);
        
        return { success: true };
      }
    };

    try {
      setIsSubmitting(true);
      
      // Execute with comprehensive error recovery
      const result = await errorRecoveryService.executeWithRetry(
        saveOperation,
        {
          operation: isCreating ? 'createUser' : 'updateUser',
          userData: { email: userData.email, role: userData.role },
          timestamp: new Date().toISOString()
        },
        {
          maxRetries: 2, // Fewer retries for user operations
          baseDelay: 1500,
          maxDelay: 8000
        }
      );

      if (result.success) {
        const successMessage = isCreating 
          ? "User has been successfully created in the authentication system."
          : "User details have been successfully updated.";
          
        toast({
          title: isCreating 
            ? t('admin.userManagement.userCreated', 'User Created')
            : t('admin.userManagement.userUpdated', 'User Updated'),
          description: result.attempts > 1 
            ? `${successMessage} (Completed after ${result.attempts} attempts)`
            : successMessage,
        });
        
        // Refresh data in background for updates
        if (!isCreating) {
          loadUsers();
        }
      } else {
        throw result.error || new Error('Save operation failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      
      // Get error recovery statistics for better error reporting
      const errorStats = errorRecoveryService.getErrorStats();
      const detailedMessage = lastRecoveryResult 
        ? `${errorMessage} (${lastRecoveryResult.attempts} attempts, ${lastRecoveryResult.totalTime}ms)`
        : errorMessage;
      
      toast({
        title: t('admin.userManagement.errorSavingUser', 'Error Saving User'),
        description: `Error saving user: ${detailedMessage}`,
        variant: "destructive",
      });
      
      console.error('Save user error with recovery stats:', { error, errorStats });
      throw error; // Re-throw to let form handle the error state
    } finally {
      setIsSubmitting(false);
    }
  }, [isCreating, editingUser, users, toast, loadUsers, t, lastRecoveryResult]);

  const handleResetTempPassword = useCallback(async (userId: string) => {
    const resetPasswordOperation = async () => {
      const tempPassword = await adminService.generateTemporaryPassword(userId);
      setGeneratedPassword(tempPassword);
      setShowPasswordDialog(true);
      
      // Refresh user list to show updated status
      await loadUsers();
      
      return tempPassword;
    };

    try {
      // Execute with error recovery
      const result = await errorRecoveryService.executeWithRetry(
        resetPasswordOperation,
        {
          operation: 'resetTempPassword',
          userId,
          timestamp: new Date().toISOString()
        },
        {
          maxRetries: 2,
          baseDelay: 1500,
          maxDelay: 6000
        }
      );

      if (result.success) {
        toast({
          title: t('admin.userManagement.tempPasswordGenerated'),
          description: result.attempts > 1 
            ? `${t('admin.userManagement.tempPasswordGeneratedDesc')} (Completed after ${result.attempts} attempts)`
            : t('admin.userManagement.tempPasswordGeneratedDesc'),
        });
      } else {
        throw result.error || new Error('Password reset failed');
      }
      
    } catch (error) {
      console.error('Error resetting temporary password:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('admin.userManagement.errorGeneratingPassword'),
        variant: "destructive",
      });
    }
  }, [loadUsers, toast, t]);

  const handleClosePasswordDialog = useCallback(() => {
    setShowPasswordDialog(false);
    setGeneratedPassword(null);
    setCreatedUser(null);
    setEditingUser(null);
    setIsCreating(false);
  }, []);



  const confirmDeleteUser = useCallback(async () => {
    if (!deleteUserId) return;
    
    const deleteOperation = async () => {
      console.log(`🗑️ Deleting user:`, deleteUserId);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteUserId);

      if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete user: ${error.message}`);
      }

      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== deleteUserId));
      
      console.log('✅ User deleted successfully');
      return { success: true };
    };
    
    try {
      // Execute with error recovery
      const result = await errorRecoveryService.executeWithRetry(
        deleteOperation,
        {
          operation: 'deleteUser',
          userId: deleteUserId,
          timestamp: new Date().toISOString()
        },
        {
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 5000
        }
      );

      if (result.success) {
        toast({
          title: t('admin.userManagement.userRemoved'),
          description: result.attempts > 1 
            ? `${t('admin.userManagement.userRemovedDesc')} (Completed after ${result.attempts} attempts)`
            : t('admin.userManagement.userRemovedDesc'),
        });
      } else {
        throw result.error || new Error('Delete operation failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: t('admin.userManagement.errorRemovingUser'),
        description: `Error removing user: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setDeleteUserId(null);
    }
  }, [deleteUserId, toast, t]);



  const handleSendInvitation = useCallback(async (user: User) => {
    try {
      console.log('📧 Sending invitation email to existing user:', user.email);
      
      const emailResult = await EmailService.sendUserInvitation(
        user.email,
        user.name,
        undefined // No temp password for existing users
      );

      if (emailResult.success) {
        toast({
          title: t('admin.userManagement.invitationSent'),
          description: t('admin.userManagement.invitationSentDesc', { email: user.email }),
        });
      } else {
        console.warn('⚠️ Failed to send invitation email:', emailResult.error);
        toast({
          title: t('admin.userManagement.sendError'),
          description: t('admin.userManagement.sendErrorDesc', { email: user.email, error: emailResult.error }),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error sending invitation email:', error);
      toast({
        title: t('admin.userManagement.sendError'),
        description: t('admin.userManagement.unexpectedError'),
        variant: "destructive",
      });
    }
  }, [toast, t]);

  // Show loading state during authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!canAccessPage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You don't have permission to access this page.
          </p>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Show skeleton during initial load for better perceived performance
  if (initialLoad && loading && users.length === 0 && !error) {
    return <UserManagementSkeleton />;
  }

  return (
    <div className="space-y-6" data-testid="user-management-container">
      {/* Progressive loading indicator - only show for subsequent loads */}
      {loading && !initialLoad && users.length === 0 && !error && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading users...</span>
        </div>
      )}

      {/* Enhanced error indicator with comprehensive recovery information */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error Loading Users
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
              
              {/* Recovery information */}
              {lastRecoveryResult && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Recovery attempts: {lastRecoveryResult.attempts} 
                    {lastRecoveryResult.totalTime && ` (${lastRecoveryResult.totalTime}ms)`}
                  </p>
                  {lastRecoveryResult.recoveryActions.length > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Actions taken: {lastRecoveryResult.recoveryActions.join(', ')}
                    </p>
                  )}
                </div>
              )}
              
              {/* Connectivity status */}
              {connectivityStatus !== null && (
                <div className="mt-2 flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${connectivityStatus ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-red-600 dark:text-red-400">
                    Network: {connectivityStatus ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="ml-4 flex flex-col gap-2">
              <Button
                onClick={retryLoadUsers}
                variant="outline"
                size="sm"
                disabled={loading || recoveryInProgress}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${(loading || recoveryInProgress) ? 'animate-spin' : ''}`} />
                {loading || recoveryInProgress ? 'Retrying...' : 'Retry'}
              </Button>
              
              <Button
                onClick={testConnectivity}
                variant="outline"
                size="sm"
                disabled={connectivityStatus === null}
              >
                {connectivityStatus === null ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-1" />
                )}
                Test Connection
              </Button>
            </div>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span data-testid="user-count">
                <SafeTranslation 
                  i18nKey="admin.userManagement.userCount" 
                  fallback="User Management ({{count}})"
                  values={{ count: users.length }}
                />
              </span>
            </CardTitle>
            <Button onClick={handleCreateUser} className="flex items-center gap-2" data-testid="create-user-button">
              <Plus className="h-4 w-4" />
              <SafeTranslation i18nKey="admin.userManagement.newUser" fallback="New User" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={t('admin.userManagement.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
              <SelectTrigger className="w-full sm:w-48" data-testid="role-filter">
                <SelectValue placeholder={t('admin.userManagement.filterByRole')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="role-filter-all">
                  <SafeTranslation i18nKey="admin.userManagement.allRoles" fallback="All Roles" />
                </SelectItem>
                <SelectItem value="admin" data-testid="role-filter-admin">
                  <SafeTranslation i18nKey="admin.userManagement.administrator" fallback="Administrator" />
                </SelectItem>
                <SelectItem value="agent" data-testid="role-filter-agent">
                  <SafeTranslation i18nKey="admin.userManagement.agent" fallback="Agent" />
                </SelectItem>
                <SelectItem value="user" data-testid="role-filter-user">
                  <SafeTranslation i18nKey="admin.userManagement.user" fallback="User" />
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <UserList
            users={filteredUsers}
            tempPasswordColumnsExist={tempPasswordColumnsExist}
            searchTerm={debouncedSearchTerm}
            roleFilter={roleFilter}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onSendInvitation={handleSendInvitation}
            onResetTempPassword={handleResetTempPassword}
          />
          
          {/* Search results info */}
          {debouncedSearchTerm && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <SafeTranslation 
                i18nKey="admin.userManagement.showingResults" 
                fallback="Showing {{filtered}} of {{total}} users"
                values={{ filtered: filteredUsers.length, total: users.length }}
              />
              <> <SafeTranslation 
                i18nKey="admin.userManagement.searchResults" 
                fallback='for "{{term}}"'
                values={{ term: debouncedSearchTerm }}
              /></>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-gray-100">
              <SafeTranslation i18nKey="admin.userManagement.confirmRemoval" fallback="Confirm Removal" />
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              <SafeTranslation i18nKey="admin.userManagement.confirmRemovalDesc" fallback="Are you sure you want to remove this user? This action cannot be undone." />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteUserId(null)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            >
              <SafeTranslation i18nKey="admin.userManagement.cancel" fallback="Cancel" />
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <SafeTranslation i18nKey="admin.userManagement.remove" fallback="Remove" />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Form */}
      <UserForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveUser}
        user={editingUser}
        isCreating={isCreating}
        tempPasswordColumnsExist={tempPasswordColumnsExist}
        isSubmitting={isSubmitting}
      />

      {/* Password Dialog */}
      <UserPasswordDialog
        isOpen={showPasswordDialog}
        onClose={handleClosePasswordDialog}
        user={createdUser}
        generatedPassword={generatedPassword}
      />
    </div>
  );
});

UserManagement.displayName = "UserManagement";
