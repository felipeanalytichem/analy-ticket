import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Save, 
  Shield, 
  Bell, 
  Palette, 
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  FileText,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { userProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    ticketUpdates: true,
    systemAlerts: true,
    weeklyReports: false,
  });

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('common.loading')}
          </h1>
        </div>
      </div>
    );
  }

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.security.errors.passwordsDontMatch'),
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('settings.security.errors.passwordTooShort'),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        toast({
          title: t('common.error'),
          description: t('settings.security.errors.unexpectedError'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('settings.security.success.title'),
          description: t('settings.security.success.description'),
        });
        setPasswordData({
          newPassword: '',
          confirmPassword: '',
        });
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('settings.security.errors.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationToggle = (setting: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    
    toast({
      title: t('settings.notifications.success.title'),
      description: t('settings.notifications.success.description'),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('settings.backToDashboard')}
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('settings.title')}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="security" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t('settings.tabs.security')}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t('settings.tabs.notifications')}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {t('settings.tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger value="about" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('settings.tabs.about')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t('settings.security.title')}
                </CardTitle>
                <CardDescription>
                  {t('settings.security.description')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="newPassword">{t('settings.security.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      placeholder={t('settings.security.enterNewPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">{t('settings.security.confirmPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      placeholder={t('settings.security.confirmNewPassword')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handlePasswordChange}
                  disabled={isLoading || !passwordData.newPassword}
                  className="w-full"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isLoading ? t('settings.security.changing') : t('settings.security.changePassword')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.notifications.title')}</CardTitle>
                <CardDescription>
                  {t('settings.notifications.description')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.emailNotifications.title')}</Label>
                    <p className="text-sm text-gray-500">
                      {t('settings.notifications.emailNotifications.description')}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => 
                      handleNotificationToggle('emailNotifications', checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.ticketUpdates.title')}</Label>
                    <p className="text-sm text-gray-500">
                      {t('settings.notifications.ticketUpdates.description')}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.ticketUpdates}
                    onCheckedChange={(checked) => 
                      handleNotificationToggle('ticketUpdates', checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.systemAlerts.title')}</Label>
                    <p className="text-sm text-gray-500">
                      {t('settings.notifications.systemAlerts.description')}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.systemAlerts}
                    onCheckedChange={(checked) => 
                      handleNotificationToggle('systemAlerts', checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.notifications.weeklyReports.title')}</Label>
                    <p className="text-sm text-gray-500">
                      {t('settings.notifications.weeklyReports.description')}
                    </p>
                  </div>
                  <Switch
                    checked={notificationSettings.weeklyReports}
                    onCheckedChange={(checked) => 
                      handleNotificationToggle('weeklyReports', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.appearance.title')}</CardTitle>
                <CardDescription>
                  {t('settings.appearance.description')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="h-20 flex flex-col gap-2"
                  >
                    <div className="w-6 h-6 bg-white border-2 border-gray-300 rounded"></div>
                    {t('settings.appearance.themes.light')}
                  </Button>
                  
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="h-20 flex flex-col gap-2"
                  >
                    <div className="w-6 h-6 bg-gray-800 border-2 border-gray-600 rounded"></div>
                    {t('settings.appearance.themes.dark')}
                  </Button>
                  
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className="h-20 flex flex-col gap-2"
                  >
                    <div className="w-6 h-6 bg-gradient-to-r from-white to-gray-800 border-2 border-gray-400 rounded"></div>
                    {t('settings.appearance.themes.system')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.about.title')}</CardTitle>
                <CardDescription>
                  {t('settings.about.description')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('settings.about.version')}</Label>
                    <p className="text-2xl font-bold text-primary">2.1.0</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t('settings.about.lastUpdated')}</Label>
                    <p className="text-lg">January 20, 2025</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-lg font-semibold">{t('settings.about.quickLinks')}</h4>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/changelog')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t('settings.about.viewChangelog')}
                    <ExternalLink className="ml-auto h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => navigate('/knowledge')}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t('settings.about.helpDocs')}
                    <ExternalLink className="ml-auto h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t('settings.about.aboutTitle')}</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.about.aboutDescription')}
                  </p>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.about.recentUpdates.title')}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {t('settings.about.recentUpdates.description')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 