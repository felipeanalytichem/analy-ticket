import React, { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Edit, 
  Trash2, 
  Send,
  RefreshCw,
  Clock
} from "lucide-react";
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

interface UserListItemProps {
  user: User;
  tempPasswordColumnsExist: boolean;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onSendInvitation: (user: User) => void;
  onResetTempPassword: (userId: string) => void;
}

const getRoleLabel = (role: string, t: any) => {
  switch (role) {
    case 'admin': return t('admin.userListItem.administrator', 'Administrator');
    case 'agent': return t('admin.userListItem.agent', 'Agent');
    case 'user': return t('admin.userListItem.user', 'User');
    default: return role;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case "admin": return "destructive";
    case "agent": return "default";
    case "user": return "secondary";
    default: return "secondary";
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

const isPasswordExpired = (expiresAt: string | null) => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

const getPasswordExpiryTime = (expiresAt: string | null) => {
  if (!expiresAt) return '';
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  
  if (diff <= 0) return 'Expired'; // This will be translated in the component
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
};

export const UserListItem = memo<UserListItemProps>(({
  user,
  tempPasswordColumnsExist,
  onEdit,
  onDelete,
  onSendInvitation,
  onResetTempPassword
}) => {
  const { t } = useTranslation();
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {user.name}
            </h3>
            <Badge variant={getRoleColor(user.role)}>
              <Shield className="h-3 w-3 mr-1" />
              {getRoleLabel(user.role, t)}
            </Badge>
            {tempPasswordColumnsExist && user.temporary_password && (
              <Badge variant={isPasswordExpired(user.temporary_password_expires_at) ? "destructive" : "outline"}>
                <Clock className="h-3 w-3 mr-1" />
                <SafeTranslation 
                  i18nKey={isPasswordExpired(user.temporary_password_expires_at) ? "admin.userListItem.passwordExpired" : "admin.userListItem.temporaryPassword"}
                  fallback={isPasswordExpired(user.temporary_password_expires_at) ? "Password expired" : "Temporary password"}
                />
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <SafeTranslation i18nKey="admin.userListItem.createdOn" fallback="Created on:" /> {formatDate(user.created_at)}
          </p>
          {tempPasswordColumnsExist && user.temporary_password && !isPasswordExpired(user.temporary_password_expires_at) && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              <SafeTranslation i18nKey="admin.userListItem.passwordExpiresIn" fallback="Password expires in:" /> {getPasswordExpiryTime(user.temporary_password_expires_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSendInvitation(user)}
            title={t('admin.userListItem.sendInvitation')}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(user)}
            title={t('admin.userListItem.editUser')}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {tempPasswordColumnsExist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResetTempPassword(user.id)}
              title={t('admin.userListItem.generateTempPassword')}
              className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(user.id)}
            title={t('admin.userListItem.removeUser')}
            className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
});

UserListItem.displayName = "UserListItem";