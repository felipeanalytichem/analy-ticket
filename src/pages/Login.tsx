import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [error, setError] = useState('');

  const { signIn, user, loading, cleanupAuthConflicts } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setError(error.message);
        toast({
          title: t('auth.loginError'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('auth.loginSuccess'),
          description: t('auth.welcomeMessage'),
        });
        navigate('/');
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanupConflicts = async () => {
    setIsCleaningUp(true);
    setError('');

    try {
      const { error } = await cleanupAuthConflicts();
      
      if (error) {
        setError(t('auth.cleanupConflictsError') + error.message);
        toast({
          title: t('auth.cleanupError'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('auth.conflictsResolved'),
          description: t('auth.tryLoginAgain'),
        });
      }
    } catch (err) {
      setError(t('auth.unexpectedCleanupError'));
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-blue-600 rounded-xl flex items-center justify-center">
              <img 
                src="/lovable-uploads/1ad9392a-8c2e-46c2-8514-273edcd01d2e.png" 
                alt="Analy-Ticket" 
                className="h-18 w-auto"
              />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('auth.welcomeBack')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('auth.loginInstructions')}
          </p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">{t('auth.login')}</CardTitle>
            <CardDescription className="text-center">
              {t('auth.enterCredentials')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
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

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="remember"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600 dark:text-gray-400">
                    {t('auth.rememberMe')}
                  </Label>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || isCleaningUp}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  t('auth.signIn')
                )}
              </Button>

              {/* Cleanup button for auth conflicts */}
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 text-xs"
                onClick={handleCleanupConflicts}
                disabled={isLoading || isCleaningUp}
              >
                {isCleaningUp ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    {t('auth.resolvingConflicts')}
                  </>
                ) : (
                  t('auth.resolveAuthConflicts')
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                    {t('auth.noAccount')}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link to="/register">
                  <Button
                    variant="outline"
                    className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {t('auth.createAccount')}
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            {t('auth.copyright')}
          </p>
        </div>
      </div>
    </div>
  );
}