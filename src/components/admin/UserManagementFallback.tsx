import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  RefreshCw, 
  AlertTriangle, 
  Mail,
  Shield,
  User,
  Crown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { transformUserName } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "agent" | "admin";
  created_at: string;
  full_name?: string;
}

interface UserManagementFallbackProps {
  error?: string;
  onRetry?: () => void;
}

/**
 * Fallback component for UserManagement that provides basic functionality
 * when the main component fails. Shows a simplified user list with retry capability.
 */
export const UserManagementFallback: React.FC<UserManagementFallbackProps> = ({ 
  error, 
  onRetry 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const { toast } = useToast();

  // Simple data loading for fallback mode
  const loadBasicUserData = useCallback(async () => {
    try {
      setLoading(true);
      setFallbackError(null);

      // Simple query with minimal data
      const { data, error: dbError } = await supabase
        .from("users")
        .select("id, email, role, created_at, full_name")
        .order("created_at", { ascending: false })
        .limit(50); // Limit to prevent performance issues

      if (dbError) {
        throw new Error(`Failed to load user data: ${dbError.message}`);
      }

      // Transform user data with name fallback
      const transformedUsers = (data || []).map(user => ({
        ...user,
        name: transformUserName(user.full_name, user.email)
      }));

      setUsers(transformedUsers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load users";
      console.error("Fallback component error:", error);
      setFallbackError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    loadBasicUserData();
  }, [loadBasicUserData]);

  // Handle retry from parent component
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    } else {
      // Fallback to reloading the page
      window.location.reload();
    }
  }, [onRetry]);

  // Handle internal retry for fallback data
  const handleFallbackRetry = useCallback(() => {
    loadBasicUserData();
  }, [loadBasicUserData]);

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'agent':
        return <Shield className="h-4 w-4 text-blue-600" />;
      default:
        return <User className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get role color
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30';
      case 'agent':
        return 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30';
      default:
        return 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  return (
    <div className="space-y-6" data-testid="user-management-fallback">
      {/* Error Alert */}
      <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          <div className="space-y-2">
            <div className="font-medium">User Management is running in fallback mode</div>
            <div className="text-sm">
              {error || "The main user management component encountered an error. Some features may be limited."}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>User Management (Fallback Mode)</span>
              {users.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({users.length} users)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={handleFallbackRetry} 
                variant="outline" 
                size="sm"
                disabled={loading}
                data-testid="fallback-retry-button"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              <Button 
                onClick={handleRetry}
                size="sm"
                data-testid="main-retry-button"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry Full Mode
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading user data...</span>
            </div>
          )}

          {/* Fallback Error State */}
          {fallbackError && !loading && (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Unable to Load User Data
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {fallbackError}
              </p>
              <Button onClick={handleFallbackRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* User List */}
          {!loading && !fallbackError && users.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Basic user information is displayed below. For full functionality, please retry the main component.
              </div>
              
              <div className="grid gap-3">
                {users.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    data-testid={`fallback-user-${user.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getRoleIcon(user.role)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {user.name}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !fallbackError && users.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Users Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No user data could be loaded in fallback mode.
              </p>
              <Button onClick={handleFallbackRetry} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Loading
              </Button>
            </div>
          )}

          {/* Limitations Notice */}
          {!loading && users.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Limited Functionality
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">
                    In fallback mode, you can only view basic user information. 
                    Features like editing, creating, or deleting users are not available. 
                    Please retry the full mode to access all functionality.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};