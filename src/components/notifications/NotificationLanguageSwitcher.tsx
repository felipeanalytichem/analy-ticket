import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Globe, CheckCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { useNotificationLanguageSync } from '@/hooks/useNotificationLanguageSync';
import { NotificationWithTicket } from '@/lib/notificationService';

interface NotificationLanguageSwitcherProps {
  notifications: NotificationWithTicket[];
  onLanguageChange?: (language: string) => void;
  showCacheStats?: boolean;
  showValidation?: boolean;
}

export function NotificationLanguageSwitcher({
  notifications,
  onLanguageChange,
  showCacheStats = false,
  showValidation = false
}: NotificationLanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [isValidating, setIsValidating] = useState(false);

  const {
    notifications: processedNotifications,
    isProcessing,
    currentLanguage,
    lastLanguageSwitch,
    switchLanguage,
    refreshNotifications,
    clearCache,
    availableLanguages,
    getCacheStats,
    validateTranslations
  } = useNotificationLanguageSync(notifications, {
    preloadLanguages: ['en-US', 'pt-BR', 'es-ES'],
    enableCaching: true,
    autoRefreshOnLanguageChange: true
  });

  const handleLanguageChange = async (language: string) => {
    try {
      setSelectedLanguage(language);
      await switchLanguage(language);
      onLanguageChange?.(language);
    } catch (error) {
      console.error('Failed to switch language:', error);
    }
  };

  const handleValidateTranslations = async () => {
    setIsValidating(true);
    try {
      // Validate all available languages
      const results = availableLanguages().map(lang => ({
        language: lang,
        ...validateTranslations(lang)
      }));
      
      console.log('Translation validation results:', results);
    } catch (error) {
      console.error('Error validating translations:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const cacheStats = getCacheStats();
  const validationResult = validateTranslations();

  const getLanguageDisplayName = (langCode: string): string => {
    const languageNames: Record<string, string> = {
      'en-US': '🇺🇸 English',
      'pt-BR': '🇧🇷 Português',
      'es-ES': '🇪🇸 Español',
      'fr-FR': '🇫🇷 Français',
      'de-DE': '🇩🇪 Deutsch',
      'nl-NL': '🇳🇱 Nederlands'
    };
    return languageNames[langCode] || langCode;
  };

  return (
    <div className="space-y-4">
      {/* Language Switcher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('notifications.preferences.language.title')}
          </CardTitle>
          <CardDescription>
            {t('notifications.preferences.language.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {availableLanguages().map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {getLanguageDisplayName(lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant={currentLanguage === selectedLanguage ? 'default' : 'secondary'}>
              Current: {getLanguageDisplayName(currentLanguage)}
            </Badge>

            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>

          {lastLanguageSwitch && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Language switched from {getLanguageDisplayName(lastLanguageSwitch.oldLanguage)} to{' '}
                {getLanguageDisplayName(lastLanguageSwitch.newLanguage)} at{' '}
                {lastLanguageSwitch.timestamp.toLocaleTimeString()}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refreshNotifications}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={clearCache}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Translation Validation */}
      {showValidation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Translation Validation
            </CardTitle>
            <CardDescription>
              Check if all notification templates have translations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleValidateTranslations}
                disabled={isValidating}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Validate All Languages
              </Button>

              <Badge variant={validationResult.valid ? 'default' : 'destructive'}>
                {validationResult.valid ? 'Valid' : `${validationResult.missingKeys.length} Missing`}
              </Badge>
            </div>

            {!validationResult.valid && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Missing translations for current language:
                  <ul className="mt-2 list-disc list-inside">
                    {validationResult.missingKeys.slice(0, 5).map((key, index) => (
                      <li key={index} className="text-sm font-mono">{key}</li>
                    ))}
                    {validationResult.missingKeys.length > 5 && (
                      <li className="text-sm">... and {validationResult.missingKeys.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cache Statistics */}
      {showCacheStats && (
        <Card>
          <CardHeader>
            <CardTitle>Cache Statistics</CardTitle>
            <CardDescription>
              Performance metrics for notification language caching
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{cacheStats.totalNotifications}</div>
                <div className="text-sm text-muted-foreground">Notifications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{cacheStats.totalLanguages}</div>
                <div className="text-sm text-muted-foreground">Languages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{cacheStats.totalEntries}</div>
                <div className="text-sm text-muted-foreground">Cache Entries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {(cacheStats.cacheSize / 1024).toFixed(1)}KB
                </div>
                <div className="text-sm text-muted-foreground">Cache Size</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processed Notifications Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications Preview</CardTitle>
          <CardDescription>
            Showing {processedNotifications.length} notifications in {getLanguageDisplayName(currentLanguage)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {processedNotifications.slice(0, 5).map((notification, index) => (
              <div key={notification.id || index} className="p-3 border rounded-lg">
                <div className="font-medium text-sm">{notification.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{notification.message}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {notification.type}
                  </Badge>
                  <Badge variant={notification.read ? 'secondary' : 'default'} className="text-xs">
                    {notification.read ? 'Read' : 'Unread'}
                  </Badge>
                </div>
              </div>
            ))}
            {processedNotifications.length > 5 && (
              <div className="text-center text-sm text-muted-foreground py-2">
                ... and {processedNotifications.length - 5} more notifications
              </div>
            )}
            {processedNotifications.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No notifications to display
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default NotificationLanguageSwitcher;