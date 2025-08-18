import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationTemplateService } from '../NotificationTemplateService';
import i18n from '@/i18n';

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    t: vi.fn(),
    language: 'en-US',
    options: {
      resources: {
        'en-US': {},
        'pt-BR': {},
        'es-ES': {}
      }
    }
  }
}));

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;

  beforeEach(() => {
    service = NotificationTemplateService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationTemplateService.getInstance();
      const instance2 = NotificationTemplateService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('createTemplate', () => {
    it('should create template with key only', () => {
      const template = service.createTemplate('test.key');
      expect(template).toEqual({
        key: 'test.key',
        params: undefined
      });
    });

    it('should create template with key and params', () => {
      const params = { ticketNumber: '123', userName: 'John' };
      const template = service.createTemplate('test.key', params);
      expect(template).toEqual({
        key: 'test.key',
        params
      });
    });
  });

  describe('serializeTemplate', () => {
    it('should serialize template to JSON string', () => {
      const template = { key: 'test.key', params: { ticketNumber: '123' } };
      const serialized = service.serializeTemplate(template);
      expect(serialized).toBe(JSON.stringify(template));
    });
  });

  describe('deserializeTemplate', () => {
    it('should deserialize valid JSON template', () => {
      const template = { key: 'test.key', params: { ticketNumber: '123' } };
      const serialized = JSON.stringify(template);
      const deserialized = service.deserializeTemplate(serialized);
      expect(deserialized).toEqual(template);
    });

    it('should return null for invalid JSON', () => {
      const result = service.deserializeTemplate('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for JSON without key', () => {
      const result = service.deserializeTemplate('{"params": {}}');
      expect(result).toBeNull();
    });
  });

  describe('processTemplate', () => {
    beforeEach(() => {
      vi.mocked(i18n.t).mockImplementation((key: string, options?: any) => {
        if (key === 'notifications.types.ticket_created.title') {
          return `New Ticket ${options?.ticketNumber || ''}`;
        }
        if (key === 'notifications.types.ticket_created.message') {
          return `New ticket "${options?.ticketTitle || ''}" created by ${options?.userName || ''}`;
        }
        return key;
      });
    });

    it('should process template objects', () => {
      const titleTemplate = { key: 'notifications.types.ticket_created.title', params: { ticketNumber: '#123' } };
      const messageTemplate = { key: 'notifications.types.ticket_created.message', params: { ticketTitle: 'Test Ticket', userName: 'John' } };

      const result = service.processTemplate(titleTemplate, messageTemplate, 'en-US');

      expect(result.title).toBe('New Ticket #123');
      expect(result.message).toBe('New ticket "Test Ticket" created by John');
    });

    it('should process string templates', () => {
      const result = service.processTemplate('Plain title', 'Plain message', 'en-US');

      expect(result.title).toBe('Plain title');
      expect(result.message).toBe('Plain message');
    });

    it('should process JSON string templates', () => {
      const titleTemplate = JSON.stringify({ key: 'notifications.types.ticket_created.title', params: { ticketNumber: '#123' } });
      const messageTemplate = JSON.stringify({ key: 'notifications.types.ticket_created.message', params: { ticketTitle: 'Test Ticket', userName: 'John' } });

      const result = service.processTemplate(titleTemplate, messageTemplate, 'en-US');

      expect(result.title).toBe('New Ticket #123');
      expect(result.message).toBe('New ticket "Test Ticket" created by John');
    });
  });

  describe('processNotificationForDisplay', () => {
    beforeEach(() => {
      vi.mocked(i18n.t).mockImplementation((key: string, options?: any) => {
        if (key === 'notifications.types.ticket_created.title') {
          return `New Ticket ${options?.ticketNumber || ''}`;
        }
        if (key === 'notifications.types.ticket_created.message') {
          return `New ticket "${options?.ticketTitle || ''}" created by ${options?.userName || ''}`;
        }
        return key;
      });
    });

    it('should process notification with template data', () => {
      const notification = {
        title: JSON.stringify({ key: 'notifications.types.ticket_created.title', params: { ticketNumber: '#123' } }),
        message: JSON.stringify({ key: 'notifications.types.ticket_created.message', params: { ticketTitle: 'Test Ticket', userName: 'John' } }),
        type: 'ticket_created'
      };

      const result = service.processNotificationForDisplay(notification, 'en-US');

      expect(result.title).toBe('New Ticket #123');
      expect(result.message).toBe('New ticket "Test Ticket" created by John');
    });

    it('should handle plain text notifications', () => {
      const notification = {
        title: 'Plain Title',
        message: 'Plain Message',
        type: 'ticket_created'
      };

      const result = service.processNotificationForDisplay(notification, 'en-US');

      expect(result.title).toBe('Plain Title');
      expect(result.message).toBe('Plain Message');
    });
  });

  describe('validateTranslationKey', () => {
    beforeEach(() => {
      vi.mocked(i18n.t).mockImplementation((key: string) => {
        if (key === 'existing.key') {
          return 'Translated text';
        }
        return key; // Return key if no translation found
      });
    });

    it('should return true for existing translation key', () => {
      const result = service.validateTranslationKey('existing.key');
      expect(result).toBe(true);
    });

    it('should return false for non-existing translation key', () => {
      const result = service.validateTranslationKey('non.existing.key');
      expect(result).toBe(false);
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return available languages from i18n resources', () => {
      const languages = service.getAvailableLanguages();
      expect(languages).toEqual(['en-US', 'pt-BR', 'es-ES']);
    });
  });

  describe('getNotificationTypeTemplates', () => {
    it('should return all notification type templates', () => {
      const templates = service.getNotificationTypeTemplates();
      
      expect(templates).toHaveProperty('ticket_created');
      expect(templates).toHaveProperty('ticket_assigned');
      expect(templates).toHaveProperty('comment_added');
      expect(templates).toHaveProperty('status_changed');
      expect(templates).toHaveProperty('sla_warning');
      expect(templates).toHaveProperty('sla_breach');
      
      expect(templates.ticket_created.title.key).toBe('notifications.types.ticket_created.title');
      expect(templates.ticket_created.message.key).toBe('notifications.types.ticket_created.message');
    });
  });

  describe('error handling', () => {
    it('should handle translation errors gracefully', () => {
      vi.mocked(i18n.t).mockImplementation(() => {
        throw new Error('Translation error');
      });

      const template = { key: 'test.key', params: {} };
      const result = service.processTemplate(template, template, 'en-US');

      expect(result.title).toBe('Notification: test.key');
      expect(result.fallbackTitle).toBe('Notification: test.key');
    });

    it('should handle missing i18n resources', () => {
      vi.mocked(i18n).options = { resources: undefined };
      
      const languages = service.getAvailableLanguages();
      expect(languages).toEqual([]);
    });
  });

  describe('fallback mechanisms', () => {
    beforeEach(() => {
      vi.mocked(i18n.t).mockImplementation((key: string, options?: any) => {
        if (options?.lng === 'en-US') {
          return `English: ${key}`;
        }
        return key; // No translation found
      });
    });

    it('should provide fallback translations', () => {
      const template = { key: 'test.key', params: {} };
      const result = service.processTemplate(template, template, 'pt-BR');

      expect(result.fallbackTitle).toBe('English: test.key');
    });
  });
});