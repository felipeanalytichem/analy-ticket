import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Loader2, 
  Search, 
  Copy,
  Check,
  RefreshCw,
  Clock,
  UserPlus,
  Send,
  Key,
  AlertTriangle,
  Eye,
  EyeOff
} from "lucide-react";
import { EmailService } from '@/lib/emailService';

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

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [generateTempPassword, setGenerateTempPassword] = useState(false);
  const [tempPasswordColumnsExist, setTempPasswordColumnsExist] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const roleLabels = {
    admin: "Administrator",
    agent: "Agent", 
    user: "User"
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "agent": return "default";
      case "user": return "secondary";
      default: return "secondary";
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const transformedUsers = data.map(user => ({
        ...user,
        name: user.full_name || user.email || 'Name not available'
      }));

      setUsers(transformedUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        title: "Error",
        description: "Error loading users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    loadUsers();
    checkTempPasswordColumns();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateUser = () => {
    setEditingUser({
      id: "",
      name: "",
      email: "",
      role: "user",
      created_at: "",
      updated_at: "",
    });
    setIsCreating(true);
    setGenerateTempPassword(false);
  };

  const handleEditUser = (user: User) => {
    setEditingUser({
      ...user,
      name: user.full_name || user.name || user.email || ''
    });
    setIsCreating(false);
    setGenerateTempPassword(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser?.name || !editingUser?.email || !editingUser?.role) {
      toast({
        title: "Required Fields",
        description: "Please fill in name, email and role.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (isCreating) {
        // Create user with Supabase Auth Admin
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: editingUser.email,
          password: 'password-placeholder',
          email_confirm: true,
          user_metadata: { full_name: editingUser.name, role: editingUser.role }
        });

        if (authError) throw authError;

        const { data, error } = await supabase
          .from('users')
          .select()
          .eq('id', authData.user.id)
          .single();

        if (error) throw error;

        setUsers(prev => [data as User, ...prev]);
        
        if (generateTempPassword && tempPasswordColumnsExist) {
            console.log(`[User Creation] Temporary password generated for ${editingUser.email}: ${tempPassword}`);
            setGeneratedPassword(tempPassword);
            setEditingUser(data as User);
            setShowPasswordDialog(true);
        } else {
            setGeneratedPassword(null);
            setEditingUser(data as User);
            setShowPasswordDialog(true); 
        }

        toast({
          title: "User Created",
          description: "User has been successfully created in the authentication system.",
        });
        return;

      } else { // Update logic for existing user
        const updates: Partial<User> & { full_name?: string } = {
            full_name: editingUser.name,
            email: editingUser.email,
            role: editingUser.role,
            updated_at: new Date().toISOString()
        };
        
        const { error: profileUpdateError } = await supabase
          .from("users")
          .update(updates)
          .eq("id", editingUser.id);

        if (profileUpdateError) throw profileUpdateError;
        
        const originalUser = users.find(u => u.id === editingUser.id);
        const authUpdates: { email?: string; user_metadata?: any } = {};

        if (editingUser.email !== originalUser?.email) {
            authUpdates.email = editingUser.email;
        }
        if (editingUser.role !== originalUser?.role) {
            authUpdates.user_metadata = { ...originalUser?.user_metadata, role: editingUser.role };
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

        // Also update auth user email if changed
        if (editingUser.email !== users.find(u => u.id === editingUser.id)?.email) {
            const { error: authError } = await supabase.auth.admin.updateUserById(
                editingUser.id,
                { email: editingUser.email }
            );
            if (authError) {
                console.warn("Failed to update auth user email:", authError);
                toast({
                    title: "Warning",
                    description: "User profile updated, but failed to update authentication email. The user may need to log in with their old email.",
                    variant: "default",
                });
            }
        }

        await loadUsers();
        toast({
          title: "User Updated",
          description: "User details have been successfully updated.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      console.error("Error saving user:", errorMessage);
      toast({
        title: "Error",
        description: `Error saving user: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      if (!showPasswordDialog) {
          setEditingUser(null);
          setIsCreating(false);
      }
    }
  };

  const generateTemporaryPassword = async (userId: string): Promise<string> => {
    const password = Math.random().toString(36).slice(-8).toUpperCase();
    
    const { error: updateUserError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: password }
    );
    
    if (updateUserError) {
      throw updateUserError;
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const { error: profileError } = await supabase
      .from('users')
      .update({ 
        temporary_password: 'set', 
        temporary_password_expires_at: expiresAt.toISOString(),
        must_change_password: true,
      })
      .eq('id', userId);

    if (profileError) {
      console.warn('Could not update user profile with temp password metadata:', profileError.message);
    }

    return password;
  };

  const handleResetTempPassword = async (userId: string) => {
    try {
      const tempPassword = await generateTemporaryPassword(userId);
      setGeneratedPassword(tempPassword);
      setShowPasswordDialog(true);
      
      // Refresh user list to show updated status
      loadUsers();
      
      toast({
        title: "Temporary Password Generated",
        description: "New temporary password has been generated successfully.",
      });
    } catch (error) {
      console.error('Error resetting temporary password:', error);
      toast({
        title: "Error",
        description: "Error generating new temporary password.",
        variant: "destructive",
      });
    }
  };

  // Copy password to clipboard
  const copyPasswordToClipboard = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
        toast({
          title: "Copied!",
          description: "Temporary password copied to clipboard.",
        });
      } catch (err) {
        console.error('Failed to copy password:', err);
        toast({
          title: "Error",
          description: "Failed to copy password.",
          variant: "destructive",
        });
      }
    }
  };

  // Check if temporary password is expired
  const isPasswordExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Get remaining time for password expiry
  const getPasswordExpiryTime = (expiresAt: string | null) => {
    if (!expiresAt) return '';
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    
    try {
      console.log('🗑️ Deleting user:', deleteUserId);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', deleteUserId);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      // Remove from local state
      setUsers(prev => prev.filter(user => user.id !== deleteUserId));
      
      toast({
        title: "User Removed",
        description: "User has been removed successfully.",
      });
      
      console.log('✅ User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Error removing user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteUserId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Send invitation email to existing user
  const handleSendInvitation = async (user: User) => {
    try {
      console.log('📧 Sending invitation email to existing user:', user.email);
      
      const emailResult = await EmailService.sendUserInvitation(
        user.email,
        user.name,
        undefined // No temp password for existing users
      );

      if (emailResult.success) {
        toast({
          title: "Invitation Sent",
          description: `Invitation access email sent to ${user.email}.`,
        });
      } else {
        console.warn('⚠️ Failed to send invitation email:', emailResult.error);
        toast({
          title: "Send Error",
          description: `Failed to send invitation email to ${user.email}: ${emailResult.error}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error sending invitation email:', error);
      toast({
        title: "Send Error",
        description: "Unexpected error sending invitation email.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management ({users.length})
            </CardTitle>
            <Button onClick={handleCreateUser} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchTerm || roleFilter !== "all" 
                  ? "No users found with the applied filters."
                  : "No users registered."
                }
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {user.name || 'Name not available'}
                        </h3>
                        <Badge variant={getRoleColor(user.role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {roleLabels[user.role]}
                        </Badge>
                        {tempPasswordColumnsExist && user.temporary_password && (
                          <Badge variant={isPasswordExpired(user.temporary_password_expires_at) ? "destructive" : "outline"}>
                            <Clock className="h-3 w-3 mr-1" />
                            {isPasswordExpired(user.temporary_password_expires_at) ? "Password expired" : "Temporary password"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Created on: {formatDate(user.created_at)}
                      </p>
                      {tempPasswordColumnsExist && user.temporary_password && !isPasswordExpired(user.temporary_password_expires_at) && (
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Password expires in: {getPasswordExpiryTime(user.temporary_password_expires_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendInvitation(user)}
                        title="Send invitation email"
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        title="Edit user"
                        className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {tempPasswordColumnsExist && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetTempPassword(user.id)}
                          title="Generate new temporary password"
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteUserId(user.id)}
                        title="Remove user"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-gray-100">Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Are you sure you want to remove this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setDeleteUserId(null)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => {
        if (!open) {
          setEditingUser(null);
          setIsCreating(false);
          setGenerateTempPassword(false);
        }
      }}>
        <DialogContent className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              {isCreating ? "New User" : "Edit User"}
            </DialogTitle>
          </DialogHeader>
          
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">Full Name</Label>
                <Input
                  id="name"
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      name: e.target.value
                    })
                  }
                  placeholder="Enter full name"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      email: e.target.value
                    })
                  }
                  placeholder="Enter email"
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-gray-900 dark:text-gray-100">Role</Label>
                                 <Select
                   value={editingUser.role}
                   onValueChange={(value: "user" | "agent" | "admin") =>
                     setEditingUser({
                       ...editingUser,
                       role: value
                     })
                   }
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    <SelectItem value="user" className="text-gray-900 dark:text-gray-100">User</SelectItem>
                    <SelectItem value="agent" className="text-gray-900 dark:text-gray-100">Agent</SelectItem>
                    <SelectItem value="admin" className="text-gray-900 dark:text-gray-100">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isCreating && tempPasswordColumnsExist && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center space-x-2">
                    <input
                      id="generateTempPassword"
                      type="checkbox"
                      checked={generateTempPassword}
                      onChange={(e) => setGenerateTempPassword(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <Label htmlFor="generateTempPassword" className="text-sm font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Key className="h-4 w-4 text-blue-600" />
                      Generate temporary password
                    </Label>
                  </div>
                  
                  {generateTempPassword && (
                    <Alert className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                      <AlertTriangle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Important:</strong> A temporary password will be generated automatically. 
                        The user will be required to change it on the first login. The password expires in 24 hours.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {isCreating && !tempPasswordColumnsExist && (
                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                    <strong>Temporary password system not available.</strong><br/>
                    To enable this feature, apply the database migration.
                    <br/>
                    <a 
                      href="/APPLY_MIGRATION.md" 
                      target="_blank"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      View instructions →
                    </a>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingUser(null);
                setIsCreating(false);
                setGenerateTempPassword(false);
              }}
              disabled={isSubmitting}
              className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              disabled={isSubmitting || !editingUser?.name || !editingUser?.email}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isCreating ? "Create" : "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Invitation Dialog with Temporary Password */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPasswordDialog(false);
          setGeneratedPassword(null);
          setCopiedPassword(false);
          setEditingUser(null);
          setIsCreating(false);
          setGenerateTempPassword(false);
          setShowPassword(false);
        }
      }}>
        <DialogContent className="max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <UserPlus className="h-5 w-5 text-green-600" />
              User Created - Invitation Instructions
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-900 dark:text-green-100">
                <strong>User created successfully!</strong><br/>
                {generatedPassword ? 
                  "Temporary password generated. Share the information below with the user." :
                  "The user needs to register using the link below."
                }
              </AlertDescription>
            </Alert>

            {/* User Information */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">User Information:</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div><strong>Email:</strong> {editingUser?.email}</div>
                <div><strong>Name:</strong> {editingUser?.name}</div>
                <div><strong>Role:</strong> {editingUser?.role && roleLabels[editingUser.role]}</div>
              </div>
            </div>

            {/* Registration Link */}
            <div className="space-y-2">
              <Label className="text-gray-900 dark:text-gray-100">Registration Link:</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={`${window.location.origin}/register`}
                  readOnly
                  className="text-sm bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/register`);
                    toast({
                      title: "Copied!",
                      description: "Registration link copied to clipboard.",
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Temporary Password Display */}
            {generatedPassword && (
              <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <Label className="text-amber-900 dark:text-amber-100 font-medium">Generated Temporary Password:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedPassword}
                    type={showPassword ? "text" : "password"}
                    readOnly
                    className="font-mono text-sm bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-600 text-gray-900 dark:text-gray-100"
                  />
                  <Button
                    onClick={() => setShowPassword(!showPassword)}
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-600"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    onClick={copyPasswordToClipboard}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border-amber-300 dark:border-amber-600"
                  >
                    {copiedPassword ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Alert className="mt-2 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
                    <strong>Important:</strong> This password expires in 24 hours and must be changed on the first login.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Instructions */}
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Instructions for the user:</strong><br/>
                1. Access the registration link<br/>
                2. Use the email: <strong>{editingUser?.email}</strong><br/>
                {generatedPassword ? 
                  "3. Use the provided temporary password" :
                  "3. Create a strong password"
                }<br/>
                4. Complete registration
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => {
                setShowPasswordDialog(false);
                setGeneratedPassword(null);
                setCopiedPassword(false);
                setEditingUser(null);
                setIsCreating(false);
                setGenerateTempPassword(false);
                setShowPassword(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              I Understand
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
