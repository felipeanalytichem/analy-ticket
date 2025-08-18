import i18n from '@/i18n';

export interface NotificationTemplateParams {
  ticketNumber?: string;
  ticketTitle?: string;
  userName?: string;
  agentName?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPriority?: string;
  newPriority?: string;
  assigneeName?: string;
  resolvedBy?: string;
  closedBy?: string;
  commentAuthor?: string;
  dueDate?: string;
  timeRemaining?: string;
  [key: string]: any;
}

export interface NotificationTemplate {
  key: string;
  params?: NotificationTemplateParams;
}

export interface ProcessedNotificationContent {
  title: string;
  message: string;
  fallbackTitle: string;
  fallbackMessage: string;
}

/**
 * Service for handling notification templates with i18n support
 */
export class NotificationTemplateService {
  private static instance: NotificationTemplateService;
  private fallbackLanguage = 'en-US';

  static getInstance(): NotificationTemplateService {
    if (!NotificationTemplateService.instance) {
      NotificationTemplateService.instance = new NotificationTemplateService();
    }
    return NotificationTemplateService.instance;
  }

  /**
   * Process a notification template and return localized content
   */
  processTemplate(
    titleTemplate: NotificationTemplate | string,
    messageTemplate: NotificationTemplate | string,
    language?: string
  ): ProcessedNotificationContent {
    const currentLanguage = language || i18n.language || this.fallbackLanguage;
    
    // Process title
    const { text: title, fallback: fallbackTitle } = this.processTemplateString(
      titleTemplate,
      currentLanguage
    );

    // Process message
    const { text: message, fallback: fallbackMessage } = this.processTemplateString(
      messageTemplate,
      currentLanguage
    );

    return {
      title,
      message,
      fallbackTitle,
      fallbackMessage
    };
  }

  /**
   * Process a single template string (title or message)
   */
  private processTemplateString(
    template: NotificationTemplate | string,
    language: string
  ): { text: string; fallback: string } {
    // If it's already a plain string, return as-is
    if (typeof template === 'string') {
      try {
        const parsed = JSON.parse(template);
        if (parsed.key) {
          return this.translateTemplate(parsed, language);
        }
        return { text: template, fallback: template };
      } catch {
        return { text: template, fallback: template };
      }
    }

    // If it's a template object, translate it
    return this.translateTemplate(template, language);
  }

  /**
   * Translate a template using i18n
   */
  private translateTemplate(
    template: NotificationTemplate,
    language: string
  ): { text: string; fallback: string } {
    try {
      // Get translation in the requested language
      const translatedText = i18n.t(template.key, {
        ...template.params,
        lng: language,
        fallbackLng: this.fallbackLanguage
      });

      // Get fallback translation
      const fallbackText = i18n.t(template.key, {
        ...template.params,
        lng: this.fallbackLanguage
      });

      return {
        text: translatedText,
        fallback: fallbackText
      };
    } catch (error) {
      console.error('Error translating notification template:', error);
      
      // Return a basic fallback
      const fallback = `Notification: ${template.key}`;
      return {
        text: fallback,
        fallback
      };
    }
  }

  /**
   * Create a notification template object
   */
  createTemplate(key: string, params?: NotificationTemplateParams): NotificationTemplate {
    return { key, params };
  }

  /**
   * Serialize a template for storage
   */
  serializeTemplate(template: NotificationTemplate): string {
    return JSON.stringify(template);
  }

  /**
   * Deserialize a template from storage
   */
  deserializeTemplate(serialized: string): NotificationTemplate | null {
    try {
      const parsed = JSON.parse(serialized);
      if (parsed.key) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Validate that a translation key exists
   */
  validateTranslationKey(key: string, language?: string): boolean {
    const lang = language || i18n.language || this.fallbackLanguage;
    try {
      const translation = i18n.t(key, { lng: lang });
      return translation !== key; // If translation equals key, it means no translation was found
    } catch {
      return false;
    }
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): string[] {
    return Object.keys(i18n.options.resources || {});
  }

  /**
   * Get notification type templates
   */
  getNotificationTypeTemplates() {
    return {
      ticket_created: {
        title: this.createTemplate('notifications.types.ticket_created.title'),
        message: this.createTemplate('notifications.types.ticket_created.message')
      },
      ticket_assigned: {
        title: this.createTemplate('notifications.types.ticket_assigned.title'),
        message: this.createTemplate('notifications.types.ticket_assigned.message')
      },
      ticket_updated: {
        title: this.createTemplate('notifications.types.ticket_updated.title'),
        message: this.createTemplate('notifications.types.ticket_updated.message')
      },
      comment_added: {
        title: this.createTemplate('notifications.types.comment_added.title'),
        message: this.createTemplate('notifications.types.comment_added.message')
      },
      status_changed: {
        title: this.createTemplate('notifications.types.status_changed.title'),
        message: this.createTemplate('notifications.types.status_changed.message')
      },
      priority_changed: {
        title: this.createTemplate('notifications.types.priority_changed.title'),
        message: this.createTemplate('notifications.types.priority_changed.message')
      },
      assignment_changed: {
        title: this.createTemplate('notifications.types.assignment_changed.title'),
        message: this.createTemplate('notifications.types.assignment_changed.message')
      },
      sla_warning: {
        title: this.createTemplate('notifications.types.sla_warning.title'),
        message: this.createTemplate('notifications.types.sla_warning.message')
      },
      sla_breach: {
        title: this.createTemplate('notifications.types.sla_breach.title'),
        message: this.createTemplate('notifications.types.sla_breach.message')
      },
      first_response: {
        title: this.createTemplate('notifications.types.first_response.title'),
        message: this.createTemplate('notifications.types.first_response.message')
      },
      feedback_request: {
        title: this.createTemplate('notifications.types.feedback_request.title'),
        message: this.createTemplate('notifications.types.feedback_request.message')
      }
    };
  }

  /**
   * Process notification content for display
   */
  processNotificationForDisplay(
    notification: { title: string; message: string; type: string },
    language?: string
  ): ProcessedNotificationContent {
    const titleTemplate = this.deserializeTemplate(notification.title);
    const messageTemplate = this.deserializeTemplate(notification.message);

    if (titleTemplate && messageTemplate) {
      return this.processTemplate(titleTemplate, messageTemplate, language);
    }

    // Fallback for non-template notifications
    return {
      title: notification.title,
      message: notification.message,
      fallbackTitle: notification.title,
      fallbackMessage: notification.message
    };
  }
}

export default NotificationTemplateService;