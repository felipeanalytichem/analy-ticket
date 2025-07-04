import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  User, 
  Edit3, 
  Camera, 
  Palette, 
  Bell, 
  Volume2, 
  VolumeX, 
  BarChart3, 
  Clock, 
  Activity, 
  Shield, 
  Key, 
  Monitor, 
  Smartphone,
  LogOut,
  Eye,
  EyeOff,
  Lock,
  Calendar,
  MapPin,
  Ticket,
  CheckCircle,
  Plus,
  RotateCcw,
  ExternalLink,
  Info,
  ArrowLeft,
  Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DatabaseService from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { UploadService } from '@/lib/uploadService';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { useTheme } from '@/components/theme-provider';
import { AvatarEditor } from '@/components/profile/AvatarEditor';
import i18n from '@/i18n';

interface UserStats {
  totalCreated: number;
  totalAssigned: number;
  avgResolutionTime: string;
  statusBreakdown: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'created' | 'assigned' | 'resolved' | 'category_request';
  ticket_number: string;
  title: string;
  created_at: string;
}

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const { user, userProfile, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  
  // Avatar editor state
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  

  
  // Change password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Preferences state (theme now comes from global provider)
  const [language, setLanguage] = useState('en-US'); // Default to English
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [toastNotifications, setToastNotifications] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState('realtime');

  const loadUserData = useCallback(async () => {
    if (!user || !userProfile) return;
    
    try {
      setLoading(true);
      
      // Load real user statistics
      const realStats = await DatabaseService.getDashboardStats(user.id, userProfile.role);
      const userStats: UserStats = {
        totalCreated: realStats.myTickets,
        totalAssigned: realStats.assignedToMe,
        avgResolutionTime: '0h 0m', // TODO: Calculate real average resolution time
        statusBreakdown: {
          open: realStats.openTickets,
          in_progress: 0, // TODO: Get in_progress count
          resolved: realStats.resolvedTickets,
          closed: realStats.closedTickets
        }
      };
      setStats(userStats);
      
      // Load real recent activities from tickets
      try {
        const userTickets = await DatabaseService.getTickets({
          userId: user.id,
          limit: 5
        });
        
        const activities: RecentActivity[] = userTickets.map(ticket => ({
          id: ticket.id,
          type: 'created',
          ticket_number: ticket.ticket_number || 'N/A',
          title: ticket.title,
          created_at: ticket.created_at
        }));
        
        setRecentActivities(activities);
      } catch (error) {
        console.error('Error loading recent activities:', error);
        setRecentActivities([]);
      }
      
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error(t('messages.errorLoadingProfile'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, userProfile?.role, t]);

  const loadPreferences = useCallback(() => {
    try {
      const saved = localStorage.getItem('userPreferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        const savedLanguage = preferences.language || 'en-US';
        // Theme is now handled by global provider, don't set it here
        setLanguage(savedLanguage);
        setSoundNotifications(preferences.soundNotifications ?? true);
        setToastNotifications(preferences.toastNotifications ?? true);
        setNotificationFrequency(preferences.notificationFrequency || 'realtime');
        
        // Apply language to i18n
        i18n.changeLanguage(savedLanguage);
      } else {
        // Set default language to English and save it
        setLanguage('en-US');
        i18n.changeLanguage('en-US');
        // Save default preferences (theme is handled by global provider)
        const defaultPreferences = {
          language: 'en-US',
          soundNotifications: true,
          toastNotifications: true,
          notificationFrequency: 'realtime'
        };
        localStorage.setItem('userPreferences', JSON.stringify(defaultPreferences));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      // Fallback to English
      setLanguage('en-US');
      i18n.changeLanguage('en-US');
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    loadPreferences();
  }, []); // Only run once on mount

  // Update edit fields when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.full_name || '');
      setEditAvatar(userProfile.avatar_url || '');
    }
  }, [userProfile]);

  // Avatar save handler
  const handleAvatarSave = async (avatarUrl: string) => {
    setEditAvatar(avatarUrl);
    // Immediately update the profile
    if (userProfile) {
      try {
        const result = await updateProfile({
          full_name: userProfile.full_name,
          avatar_url: avatarUrl
        });
        
        if (!result.error) {
          toast.success('Avatar updated successfully!');
          // Refresh user data to show new avatar
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          toast.error('Failed to update avatar');
        }
      } catch (error) {
        console.error('Error updating avatar:', error);
        toast.error('Failed to update avatar');
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    
    try {
      // Use the AuthContext updateProfile function which properly updates state
      const result = await updateProfile({
        full_name: editName,
        avatar_url: editAvatar
      });
      
      if (result.error) {
        throw result.error;
      }
      
      setIsEditingProfile(false);
      toast.success(t('messages.profileUpdated'));
      
      // Force complete page reload to ensure changes are visible
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      toast.error(t('messages.errorUpdatingProfile'));
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('messages.passwordsDoNotMatch'));
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error(t('messages.passwordTooShort'));
      return;
    }
    
    try {
      // Implementar mudança de senha via Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      toast.success(t('messages.passwordChanged'));
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(t('messages.errorChangingPassword'));
    }
  };

  const handleSavePreferences = async () => {
    try {
      // Change language in i18n
      await i18n.changeLanguage(language);
      
      // Save preferences to localStorage (theme is handled by theme provider)
      const preferences = {
        language,
        soundNotifications,
        toastNotifications,
        notificationFrequency
      };
      
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      toast.success(t('messages.preferencesUpdated'));
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error(t('messages.errorSavingPreferences'));
    }
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      'user': t('profile.user') || 'User',
      'agent': t('profile.agent') || 'Agent',
      'admin': t('profile.admin') || 'Administrator'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'agent': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'created': return <Plus className="h-4 w-4 text-green-600" />;
      case 'assigned': return <User className="h-4 w-4 text-blue-600" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'category_request': return <RotateCcw className="h-4 w-4 text-orange-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityText = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'created': return t('profile.createdTicket') + ` #${activity.ticket_number}`;
      case 'assigned': return t('profile.assignedTicket') + ` #${activity.ticket_number}`;
      case 'resolved': return t('profile.resolvedTicket') + ` #${activity.ticket_number}`;
      case 'category_request': return t('profile.categoryRequest');
      default: return `Activity on ticket #${activity.ticket_number}`;
    }
  };

  const getDateLocale = () => {
    switch (language) {
      case 'pt-BR': return ptBR;
      case 'es-ES': return es;
      default: return enUS;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('profile.backToDashboard')}
          </Button>
          <h1 className="text-3xl font-bold">{t('profile.userProfile')}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t('profile.personalInformation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={userProfile.avatar_url || ''} />
                    <AvatarFallback className="text-lg">
                      {userProfile.full_name?.charAt(0) || userProfile.email.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => setIsAvatarEditorOpen(true)}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold">{userProfile.full_name || 'Name not provided'}</h3>
                    <p className="text-muted-foreground">{userProfile.email}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadgeColor(userProfile.role)}>
                      {getRoleDisplay(userProfile.role)}
                    </Badge>
                    {userProfile.role === 'agent' && (
                      <Badge variant="outline">Level 2</Badge>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingProfile(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    {t('profile.editProfile')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                {t('profile.preferences')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t('profile.interfaceTheme')}</Label>
                  <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t('profile.light')}</SelectItem>
                      <SelectItem value="dark">{t('profile.dark')}</SelectItem>
                      <SelectItem value="system">{t('profile.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>{t('profile.language')}</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">{t('profile.english')}</SelectItem>
                      <SelectItem value="pt-BR">{t('profile.portuguese')}</SelectItem>
                      <SelectItem value="es-ES">{t('profile.spanish')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t('profile.notifications')}
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {soundNotifications ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      <span>{t('profile.soundNotifications')}</span>
                    </div>
                    <Switch
                      checked={soundNotifications}
                      onCheckedChange={setSoundNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <span>{t('profile.toastNotifications')}</span>
                    </div>
                    <Switch
                      checked={toastNotifications}
                      onCheckedChange={setToastNotifications}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{t('profile.updateFrequency')}</Label>
                    <Select value={notificationFrequency} onValueChange={setNotificationFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">{t('profile.realtime')}</SelectItem>
                        <SelectItem value="30s">{t('profile.every30s')}</SelectItem>
                        <SelectItem value="1m">{t('profile.every1m')}</SelectItem>
                        <SelectItem value="5m">{t('profile.every5m')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button onClick={handleSavePreferences} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('profile.savePreferences')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('profile.security')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{t('profile.changePassword')}</h4>
                    <p className="text-sm text-muted-foreground">{t('profile.keepAccountSecure')}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setIsChangingPassword(true)}
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    {t('common.edit')}
                  </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('profile.lastLogin')}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(), { addSuffix: true, locale: getDateLocale() })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('profile.activeSessions')}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">1 session</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{t('profile.twoFactorAuth')}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {t('profile.comingSoon')}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats and Activities */}
        <div className="space-y-6">
          {/* Personal Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t('profile.personalStatistics')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalCreated}</div>
                      <div className="text-sm text-blue-600">{t('profile.totalCreated')}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{stats.totalAssigned}</div>
                      <div className="text-sm text-green-600">{t('profile.totalAssigned')}</div>
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-lg font-bold text-purple-600">{stats.avgResolutionTime}</div>
                    <div className="text-sm text-purple-600">{t('profile.avgResolutionTime')}</div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-3">{t('profile.statusBreakdown')}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">{t('status.open')}</span>
                        <span className="text-sm font-medium">{stats.statusBreakdown.open}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('status.inProgress')}</span>
                        <span className="text-sm font-medium">{stats.statusBreakdown.in_progress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('status.resolved')}</span>
                        <span className="text-sm font-medium">{stats.statusBreakdown.resolved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">{t('status.closed')}</span>
                        <span className="text-sm font-medium">{stats.statusBreakdown.closed}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities - Layout Melhorado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('profile.recentActivities')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivities.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">
                    {t('profile.noRecentActivities')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Your recent ticket activities will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentActivities.map((activity, index) => (
                    <div key={activity.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground leading-tight">
                                {getActivityText(activity)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {activity.title}
                              </p>
                            </div>
                            <time className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDistanceToNow(new Date(activity.created_at), { 
                                addSuffix: true, 
                                locale: getDateLocale() 
                              })}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>



      {/* Avatar Editor Dialog */}
      <AvatarEditor
        isOpen={isAvatarEditorOpen}
        onClose={() => setIsAvatarEditorOpen(false)}
        onSave={handleAvatarSave}
        currentAvatar={userProfile.avatar_url || ''}
        userId={user.id}
      />

      {/* Edit Profile Dialog */}
      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.editProfile')}</DialogTitle>
            <DialogDescription>
              Make changes to your profile information here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
                        <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                value={editAvatar}
                onChange={(e) => setEditAvatar(e.target.value)}
                placeholder="Enter avatar URL"
              />
              <p className="text-xs text-gray-500">
                Use the camera button on your avatar for advanced editing features
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveProfile}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isChangingPassword} onOpenChange={setIsChangingPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.changePassword')}</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangingPassword(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangePassword}>
              {t('profile.changePassword')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
