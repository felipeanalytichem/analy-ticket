import React, { useState, useCallback, memo } from "react";
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
import { 
  UserPlus,
  Check,
  Copy,
  Eye,
  EyeOff,
  Clock,
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

interface UserPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  generatedPassword: string | null;
}

const getRoleLabel = (role: string, t: any) => {
  switch (role) {
    case 'admin': return t('admin.userPasswordDialog.administrator', 'Administrator');
    case 'agent': return t('admin.userPasswordDialog.agent', 'Agent');
    case 'user': return t('admin.userPasswordDialog.user', 'User');
    default: return role;
  }
};

export const UserPasswordDialog = memo(({
  isOpen,
  onClose,
  user,
  generatedPassword
}: UserPasswordDialogProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Isolated dialog state
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Copy password to clipboard with optimistic feedback
  const copyPasswordToClipboard = useCallback(async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
        toast({
          title: t('admin.userPasswordDialog.copySuccess'),
          description: t('admin.userPasswordDialog.copySuccessDesc'),
        });
      } catch (err) {
        console.error('Failed to copy password:', err);
        toast({
          title: t('admin.userPasswordDialog.copyError'),
          description: t('admin.userPasswordDialog.copyErrorDesc'),
          variant: "destructive",
        });
      }
    }
  }, [generatedPassword, toast]);

  // Copy registration link to clipboard
  const copyRegistrationLink = useCallback(async () => {
    const registrationLink = `${window.location.origin}/register`;
    try {
      await navigator.clipboard.writeText(registrationLink);
      toast({
        title: t('admin.userPasswordDialog.copySuccess'),
        description: t('admin.userPasswordDialog.copyLinkSuccess'),
      });
    } catch (err) {
      console.error('Failed to copy registration link:', err);
      toast({
        title: t('admin.userPasswordDialog.copyError'),
        description: t('admin.userPasswordDialog.copyLinkError'),
        variant: "destructive",
      });
    }
  }, [toast]);

  // Handle dialog close with state cleanup
  const handleClose = useCallback(() => {
    // Clean up dialog state
    setCopiedPassword(false);
    setShowPassword(false);
    onClose();
  }, [onClose]);

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <UserPlus className="h-5 w-5 text-green-600" />
            <SafeTranslation i18nKey="admin.userPasswordDialog.title" fallback="User Created - Invitation Instructions" />
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-900 dark:text-green-100">
              <strong><SafeTranslation i18nKey="admin.userPasswordDialog.userCreatedSuccess" fallback="User created successfully!" /></strong><br/>
              <SafeTranslation 
                i18nKey={generatedPassword ? "admin.userPasswordDialog.tempPasswordGenerated" : "admin.userPasswordDialog.userNeedsRegistration"}
                fallback={generatedPassword ? 
                  "Temporary password generated. Share the information below with the user." :
                  "The user needs to register using the link below."
                }
              />
            </AlertDescription>
          </Alert>

          {/* User Information */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              <SafeTranslation i18nKey="admin.userPasswordDialog.userInformation" fallback="User Information:" />
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div><strong><SafeTranslation i18nKey="admin.userPasswordDialog.email" fallback="Email:" /></strong> {user.email}</div>
              <div><strong><SafeTranslation i18nKey="admin.userPasswordDialog.name" fallback="Name:" /></strong> {user.name}</div>
              <div><strong><SafeTranslation i18nKey="admin.userPasswordDialog.role" fallback="Role:" /></strong> {user.role && getRoleLabel(user.role, t)}</div>
            </div>
          </div>

          {/* Registration Link */}
          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-gray-100">
              <SafeTranslation i18nKey="admin.userPasswordDialog.registrationLink" fallback="Registration Link:" />
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={`${window.location.origin}/register`}
                readOnly
                className="text-sm bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
              <Button
                onClick={copyRegistrationLink}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              >
                <Copy className="h-4 w-4" />
                <SafeTranslation i18nKey="admin.userPasswordDialog.copy" fallback="Copy" />
              </Button>
            </div>
          </div>

          {/* Temporary Password Display */}
          {generatedPassword && (
            <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Label className="text-amber-900 dark:text-amber-100 font-medium">
                <SafeTranslation i18nKey="admin.userPasswordDialog.generatedTempPassword" fallback="Generated Temporary Password:" />
              </Label>
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
                  title={t(showPassword ? 'admin.userPasswordDialog.hidePassword' : 'admin.userPasswordDialog.showPassword')}
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
                      <SafeTranslation i18nKey="admin.userPasswordDialog.copied" fallback="Copied" />
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <SafeTranslation i18nKey="admin.userPasswordDialog.copy" fallback="Copy" />
                    </>
                  )}
                </Button>
              </div>
              <Alert className="mt-2 bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-900 dark:text-amber-100">
                  <strong>Important:</strong> <SafeTranslation i18nKey="admin.userPasswordDialog.tempPasswordExpires" fallback="This password expires in 24 hours and must be changed on the first login." />
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Instructions */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              <strong><SafeTranslation i18nKey="admin.userPasswordDialog.instructions" fallback="Instructions for the user:" /></strong><br/>
              <SafeTranslation i18nKey="admin.userPasswordDialog.step1" fallback="1. Access the registration link" /><br/>
              <SafeTranslation i18nKey="admin.userPasswordDialog.step2" fallback="2. Use the email: {{email}}" values={{ email: user.email }} /><br/>
              <SafeTranslation 
                i18nKey={generatedPassword ? "admin.userPasswordDialog.step3TempPassword" : "admin.userPasswordDialog.step3CreatePassword"}
                fallback={generatedPassword ? 
                  "3. Use the provided temporary password" :
                  "3. Create a strong password"
                }
              /><br/>
              <SafeTranslation i18nKey="admin.userPasswordDialog.step4" fallback="4. Complete registration" />
            </AlertDescription>
          </Alert>
        </div>
        
        <DialogFooter>
          <Button
            onClick={handleClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <SafeTranslation i18nKey="admin.userPasswordDialog.understand" fallback="I Understand" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

UserPasswordDialog.displayName = "UserPasswordDialog";