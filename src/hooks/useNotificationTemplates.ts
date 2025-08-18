import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationTemplateService, NotificationTemplateParams, ProcessedNotificationContent } from '@/services/NotificationTemplateService';

/**
 * Hook for using notification templates with i18n support
 */
export function useNotificationTemplates() {
  const { i18n } = useTranslation();
  const templateService = useMemo(() => NotificationTemplateService.getInstance(), []);

  /**
   * Process a notification for display in the current language
   */
  const processNotification = useCallback((
    notification: { title: string; message: string; type: string }
  ): ProcessedNotificationContent => {
    return templateService.processNotificationForDisplay(notification, i18n.language);
  }, [templateService, i18n.language]);

  /**
   * Create a notification template
   */
  const createTemplate = useCallback((key: string, params?: NotificationTemplateParams) => {
    return templateService.createTemplate(key, params);
  }, [templateService]);

  /**
   * Process a template with specific parameters
   */
  const processTemplate = useCallback((
    titleKey: string,
    messageKey: string,
    params?: NotificationTemplateParams
  ): ProcessedNotificationContent => {
    const titleTemplate = templateService.createTemplate(titleKey, params);
    const messageTemplate = templateService.createTemplate(messageKey, params);
    
    return templateService.processTemplate(titleTemplate, messageTemplate, i18n.language);
  }, [templateService, i18n.language]);

  /**
   * Validate that a translation key exists
   */
  const validateTranslationKey = useCallback((key: string): boolean => {
    return templateService.validateTranslationKey(key, i18n.language);
  }, [templateService, i18n.language]);

  /**
   * Get all available languages
   */
  const availableLanguages = useMemo(() => {
    return templateService.getAvailableLanguages();
  }, [templateService]);

  /**
   * Get notification type templates
   */
  const notificationTypeTemplates = useMemo(() => {
    return templateService.getNotificationTypeTemplates();
  }, [templateService]);

  /**
   * Process multiple notifications at once
   */
  const processNotifications = useCallback((
    notifications: Array<{ title: string; message: string; type: string }>
  ): ProcessedNotificationContent[] => {
    return notifications.map(notification => 
      templateService.processNotificationForDisplay(notification, i18n.language)
    );
  }, [templateService, i18n.language]);

  /**
   * Get fallback text for a notification type
   */
  const getFallbackText = useCallback((notificationType: string, field: 'title' | 'message'): string => {
    const templates = templateService.getNotificationTypeTemplates();
    const typeTemplate = templates[notificationType as keyof typeof templates];
    
    if (typeTemplate) {
      const template = field === 'title' ? typeTemplate.title : typeTemplate.message;
      const processed = templateService.processTemplate(template, template, 'en-US');
      return field === 'title' ? processed.fallbackTitle : processed.fallbackMessage;
    }
    
    return field === 'title' ? 'Notification' : 'New notification received';
  }, [templateService]);

  return {
    processNotification,
    createTemplate,
    processTemplate,
    validateTranslationKey,
    availableLanguages,
    notificationTypeTemplates,
    processNotifications,
    getFallbackText,
    templateService
  };
}

export default useNotificationTemplates;