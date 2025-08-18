import React, { memo } from "react";
import { UserListItem } from "./UserListItem";
import { SafeTranslation } from '@/components/ui/SafeTranslation';

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

interface UserListProps {
  users: User[];
  tempPasswordColumnsExist: boolean;
  searchTerm: string;
  roleFilter: string;
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onSendInvitation: (user: User) => void;
  onResetTempPassword: (userId: string) => void;
}

export const UserList = memo<UserListProps>(({
  users,
  tempPasswordColumnsExist,
  searchTerm,
  roleFilter,
  onEditUser,
  onDeleteUser,
  onSendInvitation,
  onResetTempPassword
}) => {
  // Users are already filtered in parent component for better performance
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <SafeTranslation 
          i18nKey={searchTerm || roleFilter !== "all" 
            ? "admin.userManagement.noUsersFound"
            : "admin.userManagement.noUsersRegistered"
          }
          fallback={searchTerm || roleFilter !== "all" 
            ? "No users found with the applied filters."
            : "No users registered."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="user-list">
      {users.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          tempPasswordColumnsExist={tempPasswordColumnsExist}
          onEdit={onEditUser}
          onDelete={onDeleteUser}
          onSendInvitation={onSendInvitation}
          onResetTempPassword={onResetTempPassword}
        />
      ))}
    </div>
  );
});

UserList.displayName = "UserList";