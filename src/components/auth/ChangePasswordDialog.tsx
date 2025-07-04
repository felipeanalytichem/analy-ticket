import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Clock,
  Shield
} from "lucide-react";

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  temporaryPasswordExpiresAt?: string | null;
}

export const ChangePasswordDialog = ({ 
  isOpen, 
  onClose, 
  userEmail, 
  temporaryPasswordExpiresAt 
}: ChangePasswordDialogProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');

  const { toast } = useToast();

  // Calculate time remaining
  useEffect(() => {
    if (!temporaryPasswordExpiresAt) return;

    const updateTimeRemaining = () => {
      const expiry = new Date(temporaryPasswordExpiresAt);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('EXPIRADA');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [temporaryPasswordExpiresAt]);

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Deve ter pelo menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Deve conter pelo menos uma letra minúscula');
    }
    if (!/\d/.test(password)) {
      errors.push('Deve conter pelo menos um número');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Deve conter pelo menos um caractere especial');
    }

    return errors;
  };

  const handlePasswordChange = async () => {
    setError('');

    // Validate password
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(`Senha inválida:\n• ${passwordErrors.join('\n• ')}`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      // Clear temporary password status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: clearError } = await supabase.rpc('clear_temporary_password' as any, {
          user_id: user.id
        });

        if (clearError) {
          console.error('Error clearing temporary password:', clearError);
          // Don't throw - password was changed successfully
        }
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi atualizada e você pode continuar usando o sistema.",
      });

      onClose();
    } catch (error: any) {
      console.error('Error changing password:', error);
      setError(error.message || 'Erro ao alterar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Alterar Senha Obrigatória
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Alert */}
          <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm space-y-2">
              <div>
                <strong>Senha temporária detectada!</strong>
              </div>
              <div>
                Você deve alterar sua senha para continuar usando o sistema.
              </div>
              {timeRemaining && (
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="h-3 w-3" />
                  <span className={timeRemaining === 'EXPIRADA' ? 'text-red-600 font-bold' : ''}>
                    Tempo restante: {timeRemaining}
                  </span>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Current user info */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Alterando senha para: <strong className="text-gray-900 dark:text-gray-100">{userEmail}</strong>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Requisitos da senha:</strong>
              <ul className="mt-1 space-y-1 text-xs list-disc list-inside">
                <li>Mínimo 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos uma letra minúscula</li>
                <li>Pelo menos um número</li>
                <li>Pelo menos um caractere especial</li>
              </ul>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Critical Warning */}
          <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm">
              <strong>Importante:</strong> Se a senha temporária expirar, você será desconectado 
              e precisará solicitar uma nova senha temporária ao administrador.
            </AlertDescription>
          </Alert>

          {/* Action Button */}
          <Button
            onClick={handlePasswordChange}
            disabled={isLoading || !newPassword || !confirmPassword}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Lock className="mr-2 h-4 w-4 animate-spin" />
                Alterando Senha...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Alterar Senha
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 