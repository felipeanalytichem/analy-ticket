import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotificationTemplates } from '../useNotificationTemplates';
import { NotificationTemplateService } from '@/services/NotificationTemplateService';

// Mock the NotificationTemplateService
vi.mock('@/services/NotificationTemplateService');

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    t: vi.fn(),
    language: 'en-US'
  }
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en-US'
    }
  }),
  initReactI18next: {}
}));

describe('useNotificationTemplates', () => {
  let mockTemplateService: any;

  beforeEach(() => {
    mockTemplateService = {
      processNotificationForDisplay: vi.fn(),
      createTemplate: vi.fn(),
      processTemplate: vi.fn(),
      validateTranslationKey: vi.fn(),
      getAvailableLanguages: vi.fn(),
      getNotificationTypeTemplates: vi.fn()
    };

    vi.mocked(NotificationTemplateService.getInstance).mockReturnValue(mockTemplateService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processNotification', () => {
    it('should process notification with current language', () => {
      const notification = {
        title: 'Test Title',
        message: 'Test Message',
        type: 'ticket_created'
      };

      const expectedResult = {
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      };

      mockTemplateService.processNotificationForDisplay.mockReturnValue(expectedResult);

      const { result } = renderHook(() => useNotificationTemplates());
      const processedNotification = result.current.processNotification(notification);

      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledWith(
        notification,
        'en-US'
      );
      expect(processedNotification).toEqual(expectedResult);
    });
  });

  describe('createTemplate', () => {
    it('should create template using service', () => {
      const key = 'test.key';
      const params = { ticketNumber: '123' };
      const expectedTemplate = { key, params };

      mockTemplateService.createTemplate.mockReturnValue(expectedTemplate);

      const { result } = renderHook(() => useNotificationTemplates());
      const template = result.current.createTemplate(key, params);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(key, params);
      expect(template).toEqual(expectedTemplate);
    });
  });

  describe('processTemplate', () => {
    it('should process template with title and message keys', () => {
      const titleKey = 'notifications.types.ticket_created.title';
      const messageKey = 'notifications.types.ticket_created.message';
      const params = { ticketNumber: '#123', userName: 'John' };

      const expectedResult = {
        title: 'New Ticket #123',
        message: 'New ticket created by John',
        fallbackTitle: 'New Ticket #123',
        fallbackMessage: 'New ticket created by John'
      };

      mockTemplateService.createTemplate
        .mockReturnValueOnce({ key: titleKey, params })
        .mockReturnValueOnce({ key: messageKey, params });
      
      mockTemplateService.processTemplate.mockReturnValue(expectedResult);

      const { result } = renderHook(() => useNotificationTemplates());
      const processed = result.current.processTemplate(titleKey, messageKey, params);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(titleKey, params);
      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(messageKey, params);
      expect(processed).toEqual(expectedResult);
    });
  });

  describe('validateTranslationKey', () => {
    it('should validate translation key with current language', () => {
      const key = 'test.key';
      mockTemplateService.validateTranslationKey.mockReturnValue(true);

      const { result } = renderHook(() => useNotificationTemplates());
      const isValid = result.current.validateTranslationKey(key);

      expect(mockTemplateService.validateTranslationKey).toHaveBeenCalledWith(key, 'en-US');
      expect(isValid).toBe(true);
    });
  });

  describe('availableLanguages', () => {
    it('should return available languages from service', () => {
      const languages = ['en-US', 'pt-BR', 'es-ES'];
      mockTemplateService.getAvailableLanguages.mockReturnValue(languages);

      const { result } = renderHook(() => useNotificationTemplates());

      expect(result.current.availableLanguages).toEqual(languages);
    });
  });

  describe('notificationTypeTemplates', () => {
    it('should return notification type templates from service', () => {
      const templates = {
        ticket_created: {
          title: { key: 'notifications.types.ticket_created.title' },
          message: { key: 'notifications.types.ticket_created.message' }
        }
      };
      mockTemplateService.getNotificationTypeTemplates.mockReturnValue(templates);

      const { result } = renderHook(() => useNotificationTemplates());

      expect(result.current.notificationTypeTemplates).toEqual(templates);
    });
  });

  describe('processNotifications', () => {
    it('should process multiple notifications', () => {
      const notifications = [
        { title: 'Title 1', message: 'Message 1', type: 'ticket_created' },
        { title: 'Title 2', message: 'Message 2', type: 'ticket_assigned' }
      ];

      const expectedResults = [
        { title: 'Processed Title 1', message: 'Processed Message 1', fallbackTitle: 'Title 1', fallbackMessage: 'Message 1' },
        { title: 'Processed Title 2', message: 'Processed Message 2', fallbackTitle: 'Title 2', fallbackMessage: 'Message 2' }
      ];

      mockTemplateService.processNotificationForDisplay
        .mockReturnValueOnce(expectedResults[0])
        .mockReturnValueOnce(expectedResults[1]);

      const { result } = renderHook(() => useNotificationTemplates());
      const processed = result.current.processNotifications(notifications);

      expect(processed).toEqual(expectedResults);
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFallbackText', () => {
    it('should return fallback text for notification type', () => {
      const templates = {
        ticket_created: {
          title: { key: 'notifications.types.ticket_created.title' },
          message: { key: 'notifications.types.ticket_created.message' }
        }
      };

      mockTemplateService.getNotificationTypeTemplates.mockReturnValue(templates);
      mockTemplateService.processTemplate.mockReturnValue({
        title: 'New Ticket',
        message: 'New ticket created',
        fallbackTitle: 'New Ticket',
        fallbackMessage: 'New ticket created'
      });

      const { result } = renderHook(() => useNotificationTemplates());
      const fallbackTitle = result.current.getFallbackText('ticket_created', 'title');
      const fallbackMessage = result.current.getFallbackText('ticket_created', 'message');

      expect(fallbackTitle).toBe('New Ticket');
      expect(fallbackMessage).toBe('New ticket created');
    });

    it('should return default fallback for unknown notification type', () => {
      mockTemplateService.getNotificationTypeTemplates.mockReturnValue({});

      const { result } = renderHook(() => useNotificationTemplates());
      const fallbackTitle = result.current.getFallbackText('unknown_type', 'title');
      const fallbackMessage = result.current.getFallbackText('unknown_type', 'message');

      expect(fallbackTitle).toBe('Notification');
      expect(fallbackMessage).toBe('New notification received');
    });
  });

  describe('memoization', () => {
    it('should memoize template service instance', () => {
      const { result, rerender } = renderHook(() => useNotificationTemplates());
      const service1 = result.current.templateService;
      
      rerender();
      const service2 = result.current.templateService;

      expect(service1).toBe(service2);
    });

    it('should memoize available languages', () => {
      const languages = ['en-US', 'pt-BR', 'es-ES'];
      mockTemplateService.getAvailableLanguages.mockReturnValue(languages);

      const { result, rerender } = renderHook(() => useNotificationTemplates());
      const languages1 = result.current.availableLanguages;
      
      rerender();
      const languages2 = result.current.availableLanguages;

      expect(languages1).toBe(languages2);
      expect(mockTemplateService.getAvailableLanguages).toHaveBeenCalledTimes(1);
    });
  });
});