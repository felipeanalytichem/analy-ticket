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
import { UserManagementErrorBoundary } from "@/components/admin/UserManagementErrorBoundary";
import { UserList } from "@/components/admin/UserList";
import { UserManagementLoadingIndicator } from "@/components/admin/UserManagementLoadingIndicator";
import { UserForm } from "@/components/admin/UserForm";
import { UserPasswordDialog } from "@/components/admin/UserPasswordDialog";
import { useConsolidatedLoading } from "@/hooks/useConsolidatedLoading";
import { usePerformanceMonitor } from "@/hooks/usePerformanceMonitor";
import { useCleanupManager } from "@/hooks/useCleanupManager";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { useMemoryLeakPrevention } from "@/hooks/useMemoryLeakPrevention";
import { supabase } from "@/integrations/supabase/client";
import { adminService } from "@/lib/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { 
  Users, 
  Plus, 
  Search,
  Activity,
  BarChart3
} from "lucide-react";
import { EmailService } from '@/lib/emailService';
import { transformUserName } from '@/lib/utils';
import { SafeTranslation } from '@/components/ui/SafeTranslation';
import { useTranslation } from 'react-i18next';

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

export const UserManagementComplexBackup = memo(() => {
  const { user, userProfile } = useAuth();
  const { t } = useTranslation();
  
  // Performance monitoring and cleanup management
  const performanceMonitor = usePerformanceMonitor({
    componentName: 'UserManagement',
    enableMemoryTracking: true,
    logThreshold: 16, // 60fps threshold
    maxRenderHistory: 50
  });

  const cleanupManager = useCleanupManager();
  
  const memoryLeakPrevention = useMemoryLeakPrevention({
    componentName: 'UserManagement',
    enableLogging: process.env.NODE_ENV === 'development',
    trackEventListeners: true,
    trackObservers: true
  });
  
  // Optimized authentication state management
  const optimizedAuth = useOptimizedAuth({
    requireAuth: true,
    requireAdminRole: true,
    onAuthError: (error) => {
      console.error('[UserManagement] Authentication error:', error);
    },
    onAccessDenied: (userRole) => {
      console.warn('[UserManagement] Access denied for role:', userRole);
    }
  });
  
  // Main component state (non-form related)
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [tempPasswordColumnsExist, setTempPasswordColumnsExist] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Isolated form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Isolated password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  
  const { toast } = useToast();

  // Enhanced consolidated loading state management with error recovery
  const loadingManager = useConsolidatedLoading({
    maxRetries: 3,
    retryDelay: 1000,
    enableGracefulDegradation: true,
    cacheKey: 'user-management-data',
    onError: (error, retryCount) => {
      console.error(`Error loading users (attempt ${retryCount + 1}):`, error);
      if (retryCount === 0) {
        toast({
          title: t('admin.userManagement.errorRemovingUser'),
          description: "Failed to load user data. Attempting recovery...",
          variant: "destructive",
        });
      }
    },
    onSuccess: () => {
      if (loadingManager.retryCount > 0) {
        toast({
          title: "Recovery Successful",
          description: "User data loaded successfully after recovery.",
        });
      }
    },
    onPartialLoad: (result) => {
      toast({
        title: "Partial Data Loaded",
        description: `Showing ${result.data.length} cached users. Some features may be limited.`,
        variant: "default",
      });
    }
  });

  // Enhanced user loading with consolidated loading management
  const loadUsersQuery = useCallback(async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading users:", error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Transform user data to apply name transformation logic
    const transformedUsers = (data || []).map(user => ({
      ...user,
      name: transformUserName(user.full_name, user.email)
    }));

    return transformedUsers;
  }, []);

  // Load users with consolidated loading state and authentication guards
  const loadUsers = useCallback(async (isRefresh = false) => {
    // Block data loading if authentication is not ready
    if (!optimizedAuth.canLoadData) {
      console.log('[UserManagement] Data loading blocked - authentication not ready');
      return;
    }

    // Check permissions before loading data
    if (!optimizedAuth.permissionCheck.hasPermission) {
      console.warn('[UserManagement] Data loading blocked - insufficient permissions:', optimizedAuth.permissionCheck.reason);
      return;
    }

    try {
      const loadingType = isRefresh ? 'refresh' : 'initial';
      const result = await loadingManager.executeWithLoading(
        loadUsersQuery,
        loadingType,
        'user data'
      );
      setUsers(result);
    } catch (error) {
      console.error('Failed to load users:', error);
      // Error is already handled by the loading manager
    }
  }, [loadUsersQuery, loadingManager, optimizedAuth]);

  // Retry function for the loading manager with authentication state handling
  const retryLoadUsers = useCallback(async () => {
    // Clear any authentication errors first
    if (optimizedAuth.hasError) {
      optimizedAuth.clearError();
    }

    // Reset authentication state if needed
    if (!optimizedAuth.canLoadData) {
      optimizedAuth.resetAuthState();
      // Wait a bit for auth state to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Retry the loading manager
    await loadingManager.retry();
    
    // Reload users if authentication is ready
    if (optimizedAuth.canLoadData) {
      await loadUsers(true);
    }
  }, [loadingManager, loadUsers, optimizedAuth]);

  const checkTempPasswordColumns = async () => {
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
  };

  useEffect(() => {
    // Only load data when authentication is ready and user has permissions
    if (optimizedAuth.isReady && optimizedAuth.canAccessUserManagement) {
      loadUsers(false);
      checkTempPasswordColumns();
    }
  }, [optimizedAuth.isReady, optimizedAuth.canAccessUserManagement, loadUsers]);

  // Performance monitoring and cleanup effects
  useEffect(() => {
    // Log performance metrics periodically in development
    if (process.env.NODE_ENV === 'development') {
      const intervalId = setInterval(() => {
        performanceMonitor.logPerformance();
        memoryLeakPrevention.logMemoryStatus();
      }, 30000); // Every 30 seconds

      cleanupManager.addTimer(intervalId, 'interval', 'performance_logging');

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [performanceMonitor, memoryLeakPrevention, cleanupManager]);

  // Warn about slow renders
  useEffect(() => {
    if (performanceMonitor.isSlowRender && process.env.NODE_ENV === 'development') {
      console.warn(`[UserManagement] Slow render detected: ${performanceMonitor.metrics.lastRenderTime.toFixed(2)}ms`);
    }
  }, [performanceMonitor.isSlowRender, performanceMonitor.metrics.lastRenderTime]);

  // Prepare loading state for the consolidated indicator with optimized auth
  const loadingState = {
    isLoading: loadingManager.isLoading,
    loadingType: loadingManager.loadingType,
    error: loadingManager.error || optimizedAuth.stableError,
    authLoading: optimizedAuth.isAuthLoading,
    isAuthenticated: optimizedAuth.isAuthenticated,
    hasAdminRole: optimizedAuth.hasAdminRole,
    userRole: optimizedAuth.userRole,
    retryCount: loadingManager.retryCount,
    canRetry: loadingManager.canRetry && !optimizedAuth.isAuthLoading,
    operation: loadingManager.operation,
    isDataLoadingBlocked: optimizedAuth.isDataLoadingBlocked,
    canLoadData: optimizedAuth.canLoadData
  };



  // Memoized callback for setting delete user ID
  const handleDeleteUser = useCallback((userId: string) => {
    setDeleteUserId(userId);
  }, []);

  // User search and filtering with debouncing
  const userSearchFunction = useCallback((users: User[], term: string) => {
    const searchTerm = term.toLowerCase().trim();
    if (!searchTerm) return users;
    
    return users.filter(user => 
      user.name.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm))
    );
  }, []);

  const debouncedSearch = useDebouncedSearch(users, userSearchFunction, {
    delay: 300,
    minLength: 1,
    enableHistory: true,
    maxHistorySize: 10
  });

  // Memoized filtered users with role filter
  const filteredUsers = useMemo(() => {
    let filtered = debouncedSearch.filteredResults;
    
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    return filtered;
  }, [debouncedSearch.filteredResults, roleFilter]);

  // Memoized callback for role filter changes
  const handleRoleFilterChange = useCallback((value: string) => {
    setRoleFilter(value);
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
          // Optimistic update - add user to list immediately
          setUsers(prev => [response.user as User, ...prev]);
          
          // Set up password dialog state
          setCreatedUser(response.user as User);
          setGeneratedPassword(response.temporaryPassword || null);
          
          // Close form and show password dialog
          setIsFormOpen(false);
          setShowPasswordDialog(true);
        }

        toast({
          title: t('admin.userManagement.userCreated', 'User Created'),
          description: "User has been successfully created in the authentication system.",
        });
        return;

      } else { // Update logic for existing user
        if (!editingUser) return;
        
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
                toast({
                    title: "Warning",
                    description: "User profile updated, but failed to update authentication details.",
                    variant: "default",
                });
            }
        }

        // Optimistic update - update user in list immediately
        setUsers(prev => prev.map(u => 
          u.id === editingUser.id 
            ? { ...u, ...updates, name: userData.name }
            : u
        ));
        
        // Close form
        setIsFormOpen(false);
        
        toast({
          title: t('admin.userManagement.userUpdated', 'User Updated'),
          description: "User details have been successfully updated.",
        });
        
        // Refresh data in background
        loadUsers(true);
      }
    };

    try {
      const operationName = isCreating ? 'user creation' : 'user update';
      await loadingManager.executeWithLoading(
        saveOperation,
        'form',
        operationName
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: t('admin.userManagement.errorSavingUser', 'Error Saving User'),
        description: `Error saving user: ${errorMessage}`,
        variant: "destructive",
      });
      throw error; // Re-throw to let form handle the error state
    }
  }, [isCreating, editingUser, users, loadingManager, toast, loadUsers]);

  const generateTemporaryPassword = async (userId: string): Promise<string> => {
    try {
      const tempPassword = await adminService.generateTemporaryPassword(userId);
      return tempPassword;
    } catch (error) {
      console.error('Error generating temporary password:', error);
      throw error;
    }
  };

  const handleResetTempPassword = useCallback(async (userId: string) => {
    try {
      const tempPassword = await generateTemporaryPassword(userId);
      setGeneratedPassword(tempPassword);
      setShowPasswordDialog(true);
      
      // Refresh user list to show updated status
      loadUsers();
      
      toast({
        title: t('admin.userManagement.tempPasswordGenerated'),
        description: t('admin.userManagement.tempPasswordGeneratedDesc'),
      });
    } catch (error) {
      console.error('Error resetting temporary password:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('admin.userManagement.errorGeneratingPassword'),
        variant: "destructive",
      });
    }
  }, [loadUsers, toast]);

  // Handle password dialog close with state cleanup
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
      
      toast({
        title: t('admin.userManagement.userRemoved'),
        description: t('admin.userManagement.userRemovedDesc'),
      });
      
      console.log('✅ User deleted successfully');
    };

    try {
      await loadingManager.executeWithLoading(
        deleteOperation,
        'action',
        'user deletion'
      );
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
  }, [deleteUserId, toast, loadingManager]);



  // Send invitation email to existing user
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
  }, [toast]);

  return (
    <UserManagementErrorBoundary 
      onRetry={() => loadUsers(true)}
      onReset={loadingManager.reset}
      fallbackData={users}
      enableGracefulDegradation={true}
    >
      <UserManagementLoadingIndicator
        {...loadingState}
        onRetry={retryLoadUsers}
        onReset={loadingManager.reset}
      >
        <div className="space-y-6" data-testid="user-management-container">
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
                value={debouncedSearch.searchTerm}
                onChange={(e) => debouncedSearch.setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
              {debouncedSearch.isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              )}
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
            
            {/* Performance indicators in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={performanceMonitor.logPerformance}
                  className="flex items-center gap-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  Perf
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={memoryLeakPrevention.logMemoryStatus}
                  className="flex items-center gap-1"
                >
                  <Activity className="h-3 w-3" />
                  Mem
                </Button>
              </div>
            )}
          </div>

          <UserList
            users={filteredUsers}
            tempPasswordColumnsExist={tempPasswordColumnsExist}
            searchTerm={debouncedSearch.debouncedTerm}
            roleFilter={roleFilter}
            onEditUser={handleEditUser}
            onDeleteUser={handleDeleteUser}
            onSendInvitation={handleSendInvitation}
            onResetTempPassword={handleResetTempPassword}
          />
          
          {/* Search results info */}
          {debouncedSearch.debouncedTerm && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <SafeTranslation 
                i18nKey="admin.userManagement.showingResults" 
                fallback="Showing {{filtered}} of {{total}} users"
                values={{ filtered: filteredUsers.length, total: users.length }}
              />
              {debouncedSearch.debouncedTerm && (
                <> <SafeTranslation 
                  i18nKey="admin.userManagement.searchResults" 
                  fallback='for "{{term}}"'
                  values={{ term: debouncedSearch.debouncedTerm }}
                /></>
              )}
              {debouncedSearch.isSearching && (
                <> <SafeTranslation i18nKey="admin.userManagement.searching" fallback="(searching...)" /></>
              )}
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

      {/* Isolated User Form */}
      <UserForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveUser}
        user={editingUser}
        isCreating={isCreating}
        tempPasswordColumnsExist={tempPasswordColumnsExist}
        isSubmitting={loadingManager.isSubmitting}
      />

      {/* Isolated Password Dialog */}
      <UserPasswordDialog
        isOpen={showPasswordDialog}
        onClose={handleClosePasswordDialog}
        user={createdUser}
        generatedPassword={generatedPassword}
      />
        </div>
      </UserManagementLoadingIndicator>
    </UserManagementErrorBoundary>
  );
});

UserManagementComplexBackup.displayName = "UserManagementComplexBackup";