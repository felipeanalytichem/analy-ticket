import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationLanguageManager, LanguageSwitchEvent } from '@/services/NotificationLanguageManager';
import { NotificationWithTicket } from '@/lib/notificationService';

export interface NotificationLanguageSyncOptions {
  preloadLanguages?: string[];
  enableCaching?: boolean;
  autoRefreshOnLanguageChange?: boolean;
}

/**
 * Hook for synchronizing notifications with language changes
 */
export function useNotificationLanguageSync(
  notifications: NotificationWithTicket[],
  options: NotificationLanguageSyncOptions = {}
) {
  const { i18n } = useTranslation();
  const [processedNotifications, setProcessedNotifications] = useState<NotificationWithTicket[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastLanguageSwitch, setLastLanguageSwitch] = useState<LanguageSwitchEvent | null>(null);
  
  const languageManagerRef = useRef<NotificationLanguageManager>();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const {
    preloadLanguages = [],
    enableCaching = true,
    autoRefreshOnLanguageChange = true
  } = options;

  // Initialize language manager
  useEffect(() => {
    languageManagerRef.current = NotificationLanguageManager.getInstance();
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Setup language change listener
  useEffect(() => {
    if (!languageManagerRef.current || !autoRefreshOnLanguageChange) {
      return;
    }

    const unsubscribe = languageManagerRef.current.addLanguageSwitchListener((event) => {
      setLastLanguageSwitch(event);
      
      // Re-process notifications with new language
      if (notifications.length > 0) {
        processNotifications(notifications, event.newLanguage);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [notifications, autoRefreshOnLanguageChange]);

  // Process notifications when they change or language changes
  const processNotifications = useCallback(async (
    notificationsToProcess: NotificationWithTicket[],
    language?: string
  ) => {
    if (!languageManagerRef.current) {
      return;
    }

    setIsProcessing(true);

    try {
      // Preload notifications for specified languages if enabled
      if (enableCaching && preloadLanguages.length > 0) {
        await languageManagerRef.current.preloadNotificationsForLanguages(
          notificationsToProcess,
          preloadLanguages
        );
      }

      // Process notifications for current language
      const processed = languageManagerRef.current.processNotificationsForLanguage(
        notificationsToProcess,
        language
      );

      setProcessedNotifications(processed);
    } catch (error) {
      console.error('Error processing notifications for language:', error);
      // Fallback to original notifications
      setProcessedNotifications(notificationsToProcess);
    } finally {
      setIsProcessing(false);
    }
  }, [enableCaching, preloadLanguages]);

  // Process notifications when they change
  useEffect(() => {
    if (notifications.length > 0) {
      processNotifications(notifications);
    } else {
      setProcessedNotifications([]);
    }
  }, [notifications, processNotifications]);

  // Switch language programmatically
  const switchLanguage = useCallback(async (language: string) => {
    if (!languageManagerRef.current) {
      return;
    }

    try {
      await languageManagerRef.current.switchLanguage(language);
    } catch (error) {
      console.error('Error switching language:', error);
      throw error;
    }
  }, []);

  // Get available languages
  const availableLanguages = useCallback(() => {
    return languageManagerRef.current?.getAvailableLanguages() || [];
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    if (languageManagerRef.current) {
      languageManagerRef.current.clearAllCache();
    }
  }, []);

  // Get cache statistics
  const getCacheStats = useCallback(() => {
    return languageManagerRef.current?.getCacheStats() || {
      totalNotifications: 0,
      totalLanguages: 0,
      totalEntries: 0,
      cacheSize: 0
    };
  }, []);

  // Validate translations for current language
  const validateTranslations = useCallback((language?: string) => {
    if (!languageManagerRef.current) {
      return { valid: true, missingKeys: [] };
    }

    const targetLanguage = language || i18n.language;
    return languageManagerRef.current.validateNotificationTranslations(targetLanguage);
  }, [i18n.language]);

  // Refresh notifications in current language
  const refreshNotifications = useCallback(() => {
    if (notifications.length > 0) {
      processNotifications(notifications);
    }
  }, [notifications, processNotifications]);

  // Get current language
  const currentLanguage = languageManagerRef.current?.getCurrentLanguage() || i18n.language;

  return {
    // Processed notifications in current language
    notifications: processedNotifications,
    
    // State
    isProcessing,
    currentLanguage,
    lastLanguageSwitch,
    
    // Actions
    switchLanguage,
    refreshNotifications,
    clearCache,
    
    // Utilities
    availableLanguages,
    getCacheStats,
    validateTranslations,
    
    // Raw access to language manager (for advanced use cases)
    languageManager: languageManagerRef.current
  };
}

export default useNotificationLanguageSync;