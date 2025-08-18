import { NotificationTemplateService } from './NotificationTemplateService';
import { NotificationWithTicket } from '@/lib/notificationService';
import i18n from '@/i18n';

export interface LanguageSwitchEvent {
  oldLanguage: string;
  newLanguage: string;
  timestamp: Date;
}

export interface NotificationLanguageCache {
  [notificationId: string]: {
    [language: string]: {
      title: string;
      message: string;
      cachedAt: Date;
    };
  };
}

/**
 * Service for managing dynamic language switching for notifications
 */
export class NotificationLanguageManager {
  private static instance: NotificationLanguageManager;
  private templateService: NotificationTemplateService;
  private languageCache: NotificationLanguageCache = {};
  private languageSwitchListeners: Array<(event: LanguageSwitchEvent) => void> = [];
  private currentLanguage: string;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.templateService = NotificationTemplateService.getInstance();
    this.currentLanguage = i18n.language || 'en-US';
    this.setupLanguageChangeListener();
  }

  static getInstance(): NotificationLanguageManager {
    if (!NotificationLanguageManager.instance) {
      NotificationLanguageManager.instance = new NotificationLanguageManager();
    }
    return NotificationLanguageManager.instance;
  }

  /**
   * Setup listener for i18n language changes
   */
  private setupLanguageChangeListener(): void {
    i18n.on('languageChanged', (newLanguage: string) => {
      const oldLanguage = this.currentLanguage;
      this.currentLanguage = newLanguage;
      
      const event: LanguageSwitchEvent = {
        oldLanguage,
        newLanguage,
        timestamp: new Date()
      };

      this.notifyLanguageSwitch(event);
    });
  }

  /**
   * Add a listener for language switch events
   */
  addLanguageSwitchListener(listener: (event: LanguageSwitchEvent) => void): () => void {
    this.languageSwitchListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.languageSwitchListeners.indexOf(listener);
      if (index > -1) {
        this.languageSwitchListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of language switch
   */
  private notifyLanguageSwitch(event: LanguageSwitchEvent): void {
    this.languageSwitchListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in language switch listener:', error);
      }
    });
  }

  /**
   * Process notifications for a specific language
   */
  processNotificationsForLanguage(
    notifications: NotificationWithTicket[],
    language?: string
  ): NotificationWithTicket[] {
    const targetLanguage = language || this.currentLanguage;
    
    return notifications.map(notification => {
      const processedContent = this.getNotificationContent(notification, targetLanguage);
      
      return {
        ...notification,
        title: processedContent.title,
        message: processedContent.message
      };
    });
  }

  /**
   * Get notification content for a specific language (with caching)
   */
  private getNotificationContent(
    notification: NotificationWithTicket,
    language: string
  ): { title: string; message: string } {
    const notificationId = notification.id || 'temp-' + Date.now();
    
    // Check cache first
    const cached = this.getCachedContent(notificationId, language);
    if (cached) {
      return cached;
    }

    // Process the notification content
    const processedContent = this.templateService.processNotificationForDisplay(
      {
        title: notification.title,
        message: notification.message,
        type: notification.type
      },
      language
    );

    // Cache the result
    this.cacheContent(notificationId, language, {
      title: processedContent.title,
      message: processedContent.message
    });

    return {
      title: processedContent.title,
      message: processedContent.message
    };
  }

  /**
   * Get cached content for a notification in a specific language
   */
  private getCachedContent(
    notificationId: string,
    language: string
  ): { title: string; message: string } | null {
    const notificationCache = this.languageCache[notificationId];
    if (!notificationCache) {
      return null;
    }

    const languageCache = notificationCache[language];
    if (!languageCache) {
      return null;
    }

    // Check if cache is still valid
    const now = new Date();
    const cacheAge = now.getTime() - languageCache.cachedAt.getTime();
    if (cacheAge > this.CACHE_TTL) {
      // Cache expired, remove it
      delete notificationCache[language];
      if (Object.keys(notificationCache).length === 0) {
        delete this.languageCache[notificationId];
      }
      return null;
    }

    return {
      title: languageCache.title,
      message: languageCache.message
    };
  }

  /**
   * Cache notification content for a specific language
   */
  private cacheContent(
    notificationId: string,
    language: string,
    content: { title: string; message: string }
  ): void {
    if (!this.languageCache[notificationId]) {
      this.languageCache[notificationId] = {};
    }

    this.languageCache[notificationId][language] = {
      title: content.title,
      message: content.message,
      cachedAt: new Date()
    };
  }

  /**
   * Clear cache for a specific notification
   */
  clearNotificationCache(notificationId: string): void {
    delete this.languageCache[notificationId];
  }

  /**
   * Clear all cached content
   */
  clearAllCache(): void {
    this.languageCache = {};
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = new Date();
    
    Object.keys(this.languageCache).forEach(notificationId => {
      const notificationCache = this.languageCache[notificationId];
      
      Object.keys(notificationCache).forEach(language => {
        const languageCache = notificationCache[language];
        const cacheAge = now.getTime() - languageCache.cachedAt.getTime();
        
        if (cacheAge > this.CACHE_TTL) {
          delete notificationCache[language];
        }
      });
      
      // Remove notification cache if empty
      if (Object.keys(notificationCache).length === 0) {
        delete this.languageCache[notificationId];
      }
    });
  }

  /**
   * Preload notifications for multiple languages
   */
  async preloadNotificationsForLanguages(
    notifications: NotificationWithTicket[],
    languages: string[]
  ): Promise<void> {
    const promises = notifications.flatMap(notification =>
      languages.map(language =>
        this.getNotificationContent(notification, language)
      )
    );

    await Promise.all(promises);
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return this.templateService.getAvailableLanguages();
  }

  /**
   * Switch language programmatically
   */
  async switchLanguage(language: string): Promise<void> {
    if (this.templateService.getAvailableLanguages().includes(language)) {
      await i18n.changeLanguage(language);
    } else {
      throw new Error(`Language ${language} is not supported`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalNotifications: number;
    totalLanguages: number;
    totalEntries: number;
    cacheSize: number;
  } {
    let totalEntries = 0;
    let totalLanguages = 0;
    const languages = new Set<string>();

    Object.values(this.languageCache).forEach(notificationCache => {
      const languageCount = Object.keys(notificationCache).length;
      totalEntries += languageCount;
      
      Object.keys(notificationCache).forEach(language => {
        languages.add(language);
      });
    });

    return {
      totalNotifications: Object.keys(this.languageCache).length,
      totalLanguages: languages.size,
      totalEntries,
      cacheSize: JSON.stringify(this.languageCache).length
    };
  }

  /**
   * Validate that all notification templates have translations
   */
  validateNotificationTranslations(language: string): {
    valid: boolean;
    missingKeys: string[];
  } {
    const templates = this.templateService.getNotificationTypeTemplates();
    const missingKeys: string[] = [];

    Object.entries(templates).forEach(([type, template]) => {
      if (!this.templateService.validateTranslationKey(template.title.key, language)) {
        missingKeys.push(`${type}.title: ${template.title.key}`);
      }
      if (!this.templateService.validateTranslationKey(template.message.key, language)) {
        missingKeys.push(`${type}.message: ${template.message.key}`);
      }
    });

    return {
      valid: missingKeys.length === 0,
      missingKeys
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.languageSwitchListeners = [];
    this.clearAllCache();
    i18n.off('languageChanged');
  }
}

export default NotificationLanguageManager;