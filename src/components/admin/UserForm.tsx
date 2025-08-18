import React, { useState, useCallback, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2, 
  Key,
  AlertTriangle
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

interface UserFormData {
  name: string;
  email: string;
  role: "user" | "agent" | "admin";
}

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: UserFormData, generateTempPassword: boolean) => Promise<void>;
  user?: User | null;
  isCreating: boolean;
  tempPasswordColumnsExist: boolean;
  isSubmitting: boolean;
}

export const UserForm = memo(({
  isOpen,
  onClose,
  onSave,
  user,
  isCreating,
  tempPasswordColumnsExist,
  isSubmitting
}: UserFormProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Isolated form state
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    role: "user"
  });
  
  const [generateTempPassword, setGenerateTempPassword] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize form data when user prop changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (user && !isCreating) {
        // Editing existing user
        setFormData({
          name: user.full_name || user.name || "",
          email: user.email || "",
          role: user.role || "user"
        });
      } else {
        // Creating new user
        setFormData({
          name: "",
          email: "",
          role: "user"
        });
      }
      setGenerateTempPassword(false);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, user, isCreating]);

  // Track form changes for unsaved changes detection
  const handleFormChange = useCallback((field: keyof UserFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle form submission with optimistic updates
  const handleSubmit = useCallback(async () => {
    // Validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.role) {
      toast({
        title: t('admin.userForm.requiredFields'),
        description: t('admin.userForm.requiredFieldsDesc'),
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: t('admin.userForm.invalidEmail'),
        description: t('admin.userForm.invalidEmailDesc'),
        variant: "destructive",
      });
      return;
    }

    try {
      // Optimistic update - immediately show success state
      setHasUnsavedChanges(false);
      
      await onSave(formData, generateTempPassword);
      
      // Form will be closed by parent component after successful save
    } catch (error) {
      // Error handling is done by parent component
      // Reset unsaved changes flag since save failed
      setHasUnsavedChanges(true);
    }
  }, [formData, generateTempPassword, onSave, toast]);

  // Handle dialog close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges && !isSubmitting) {
      const confirmClose = window.confirm(
        t('admin.userForm.unsavedChanges')
      );
      if (!confirmClose) {
        return;
      }
    }
    
    // Clean up form state
    setFormData({
      name: "",
      email: "",
      role: "user"
    });
    setGenerateTempPassword(false);
    setHasUnsavedChanges(false);
    
    onClose();
  }, [hasUnsavedChanges, isSubmitting, onClose]);

  // Handle Enter key submission
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isSubmitting]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent 
        className="max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        onKeyDown={handleKeyDown}
        data-testid="user-form"
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">
            <SafeTranslation 
              i18nKey={isCreating ? "admin.userForm.newUser" : "admin.userForm.editUser"} 
              fallback={isCreating ? "New User" : "Edit User"} 
            />
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">
              <SafeTranslation i18nKey="admin.userForm.fullNameRequired" fallback="Full Name *" />
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder={t('admin.userForm.fullName', 'Enter full name')}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              disabled={isSubmitting}
              autoFocus={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">
              <SafeTranslation i18nKey="admin.userForm.emailRequired" fallback="Email *" />
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
              placeholder={t('admin.userForm.email', 'Enter email')}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-gray-900 dark:text-gray-100">
              <SafeTranslation i18nKey="admin.userForm.roleRequired" fallback="Role *" />
            </Label>
            <Select
              value={formData.role}
              onValueChange={(value: "user" | "agent" | "admin") =>
                handleFormChange('role', value)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectItem value="user" className="text-gray-900 dark:text-gray-100">
                  <SafeTranslation i18nKey="admin.userForm.user" fallback="User" />
                </SelectItem>
                <SelectItem value="agent" className="text-gray-900 dark:text-gray-100">
                  <SafeTranslation i18nKey="admin.userForm.agent" fallback="Agent" />
                </SelectItem>
                <SelectItem value="admin" className="text-gray-900 dark:text-gray-100">
                  <SafeTranslation i18nKey="admin.userForm.administrator" fallback="Administrator" />
                </SelectItem>
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
                  disabled={isSubmitting}
                />
                <Label htmlFor="generateTempPassword" className="text-sm font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <Key className="h-4 w-4 text-blue-600" />
                  <SafeTranslation i18nKey="admin.userForm.generateTempPassword" fallback="Generate temporary password" />
                </Label>
              </div>
              
              {generateTempPassword && (
                <Alert className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700">
                  <AlertTriangle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Important:</strong> <SafeTranslation i18nKey="admin.userForm.tempPasswordInfo" fallback="A temporary password will be generated automatically. The user will be required to change it on the first login. The password expires in 24 hours." />
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isCreating && !tempPasswordColumnsExist && (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-900 dark:text-amber-100">
                <strong><SafeTranslation i18nKey="admin.userForm.tempPasswordNotAvailable" fallback="Temporary password system not available." /></strong><br/>
                <SafeTranslation i18nKey="admin.userForm.tempPasswordMigrationInfo" fallback="To enable this feature, apply the database migration." />
                <br/>
                <a 
                  href="/APPLY_MIGRATION.md" 
                  target="_blank"
                  className="text-blue-600 hover:underline font-medium"
                >
                  <SafeTranslation i18nKey="admin.userForm.viewInstructions" fallback="View instructions →" />
                </a>
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            data-testid="form-cancel-button"
          >
            <SafeTranslation i18nKey="admin.userForm.cancel" fallback="Cancel" />
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name.trim() || !formData.email.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="form-submit-button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <SafeTranslation i18nKey="admin.userForm.saving" fallback="Saving..." />
              </>
            ) : (
              <SafeTranslation 
                i18nKey={isCreating ? "admin.userForm.create" : "admin.userForm.save"} 
                fallback={isCreating ? "Create" : "Save"} 
              />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

UserForm.displayName = "UserForm";