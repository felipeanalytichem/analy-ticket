import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationLanguageManager } from '../NotificationLanguageManager';
import { NotificationTemplateService } from '../NotificationTemplateService';
import { NotificationWithTicket } from '@/lib/notificationService';

// Mock dependencies
vi.mock('../NotificationTemplateService');
vi.mock('@/i18n', () => ({
  default: {
    language: 'en-US',
    on: vi.fn(),
    off: vi.fn(),
    changeLanguage: vi.fn()
  }
}));

describe('NotificationLanguageManager', () => {
  let manager: NotificationLanguageManager;
  let mockTemplateService: any;

  beforeEach(() => {
    mockTemplateService = {
      processNotificationForDisplay: vi.fn(),
      getAvailableLanguages: vi.fn(),
      validateTranslationKey: vi.fn(),
      getNotificationTypeTemplates: vi.fn()
    };

    vi.mocked(NotificationTemplateService.getInstance).mockReturnValue(mockTemplateService);
    manager = NotificationLanguageManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (NotificationLanguageManager as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = NotificationLanguageManager.getInstance();
      const instance2 = NotificationLanguageManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('processNotificationsForLanguage', () => {
    it('should process notifications for specified language', () => {
      const notifications: NotificationWithTicket[] = [
        {
          id: '1',
          user_id: 'user1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          created_at: '2024-01-01T00:00:00Z',
          read: false,
          priority: 'medium'
        }
      ];

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      const result = manager.processNotificationsForLanguage(notifications, 'pt-BR');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Processed Title');
      expect(result[0].message).toBe('Processed Message');
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledWith(
        {
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created'
        },
        'pt-BR'
      );
    });

    it('should use current language when no language specified', () => {
      const notifications: NotificationWithTicket[] = [
        {
          id: '1',
          user_id: 'user1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          created_at: '2024-01-01T00:00:00Z',
          read: false,
          priority: 'medium'
        }
      ];

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      manager.processNotificationsForLanguage(notifications);

      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledWith(
        expect.any(Object),
        'en-US'
      );
    });
  });

  describe('language switch listeners', () => {
    it('should add and remove language switch listeners', () => {
      const listener = vi.fn();
      const unsubscribe = manager.addLanguageSwitchListener(listener);

      expect(typeof unsubscribe).toBe('function');

      // Simulate language change
      const event = {
        oldLanguage: 'en-US',
        newLanguage: 'pt-BR',
        timestamp: new Date()
      };

      // Access private method for testing
      (manager as any).notifyLanguageSwitch(event);

      expect(listener).toHaveBeenCalledWith(event);

      // Test unsubscribe
      unsubscribe();
      (manager as any).notifyLanguageSwitch(event);

      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should handle errors in language switch listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      manager.addLanguageSwitchListener(errorListener);
      manager.addLanguageSwitchListener(normalListener);

      const event = {
        oldLanguage: 'en-US',
        newLanguage: 'pt-BR',
        timestamp: new Date()
      };

      // Should not throw error
      expect(() => {
        (manager as any).notifyLanguageSwitch(event);
      }).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('caching', () => {
    it('should cache notification content', () => {
      const notification: NotificationWithTicket = {
        id: '1',
        user_id: 'user1',
        title: 'Test Title',
        message: 'Test Message',
        type: 'ticket_created',
        created_at: '2024-01-01T00:00:00Z',
        read: false,
        priority: 'medium'
      };

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      // First call should process and cache
      const result1 = manager.processNotificationsForLanguage([notification], 'en-US');
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = manager.processNotificationsForLanguage([notification], 'en-US');
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(1); // Still 1

      expect(result1[0].title).toBe(result2[0].title);
    });

    it('should clear notification cache', () => {
      const notification: NotificationWithTicket = {
        id: '1',
        user_id: 'user1',
        title: 'Test Title',
        message: 'Test Message',
        type: 'ticket_created',
        created_at: '2024-01-01T00:00:00Z',
        read: false,
        priority: 'medium'
      };

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      // Process and cache
      manager.processNotificationsForLanguage([notification], 'en-US');
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(1);

      // Clear cache
      manager.clearNotificationCache('1');

      // Should process again
      manager.processNotificationsForLanguage([notification], 'en-US');
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', () => {
      const stats1 = manager.getCacheStats();
      expect(stats1.totalNotifications).toBe(0);

      // Add some cache entries
      const notification: NotificationWithTicket = {
        id: '1',
        user_id: 'user1',
        title: 'Test Title',
        message: 'Test Message',
        type: 'ticket_created',
        created_at: '2024-01-01T00:00:00Z',
        read: false,
        priority: 'medium'
      };

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      manager.processNotificationsForLanguage([notification], 'en-US');

      const stats2 = manager.getCacheStats();
      expect(stats2.totalNotifications).toBe(1);

      // Clear all cache
      manager.clearAllCache();

      const stats3 = manager.getCacheStats();
      expect(stats3.totalNotifications).toBe(0);
    });
  });

  describe('preloadNotificationsForLanguages', () => {
    it('should preload notifications for multiple languages', async () => {
      const notifications: NotificationWithTicket[] = [
        {
          id: '1',
          user_id: 'user1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'ticket_created',
          created_at: '2024-01-01T00:00:00Z',
          read: false,
          priority: 'medium'
        }
      ];

      mockTemplateService.processNotificationForDisplay.mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message',
        fallbackTitle: 'Fallback Title',
        fallbackMessage: 'Fallback Message'
      });

      await manager.preloadNotificationsForLanguages(notifications, ['en-US', 'pt-BR', 'es-ES']);

      // Should have been called for each language
      expect(mockTemplateService.processNotificationForDisplay).toHaveBeenCalledTimes(3);
    });
  });

  describe('switchLanguage', () => {
    it('should switch language if supported', async () => {
      mockTemplateService.getAvailableLanguages.mockReturnValue(['en-US', 'pt-BR', 'es-ES']);

      const i18n = await import('@/i18n');
      vi.mocked(i18n.default.changeLanguage).mockResolvedValue(undefined);

      await manager.switchLanguage('pt-BR');

      expect(i18n.default.changeLanguage).toHaveBeenCalledWith('pt-BR');
    });

    it('should throw error for unsupported language', async () => {
      mockTemplateService.getAvailableLanguages.mockReturnValue(['en-US', 'pt-BR']);

      await expect(manager.switchLanguage('fr-FR')).rejects.toThrow(
        'Language fr-FR is not supported'
      );
    });
  });

  describe('validateNotificationTranslations', () => {
    it('should validate notification translations', () => {
      const templates = {
        ticket_created: {
          title: { key: 'notifications.types.ticket_created.title' },
          message: { key: 'notifications.types.ticket_created.message' }
        },
        ticket_assigned: {
          title: { key: 'notifications.types.ticket_assigned.title' },
          message: { key: 'notifications.types.ticket_assigned.message' }
        }
      };

      mockTemplateService.getNotificationTypeTemplates.mockReturnValue(templates);
      mockTemplateService.validateTranslationKey.mockReturnValue(true);

      const result = manager.validateNotificationTranslations('en-US');

      expect(result.valid).toBe(true);
      expect(result.missingKeys).toHaveLength(0);
    });

    it('should identify missing translations', () => {
      const templates = {
        ticket_created: {
          title: { key: 'notifications.types.ticket_created.title' },
          message: { key: 'notifications.types.ticket_created.message' }
        }
      };

      mockTemplateService.getNotificationTypeTemplates.mockReturnValue(templates);
      mockTemplateService.validateTranslationKey
        .mockReturnValueOnce(true)  // title exists
        .mockReturnValueOnce(false); // message missing

      const result = manager.validateNotificationTranslations('pt-BR');

      expect(result.valid).toBe(false);
      expect(result.missingKeys).toContain('ticket_created.message: notifications.types.ticket_created.message');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = manager.getCacheStats();

      expect(stats).toHaveProperty('totalNotifications');
      expect(stats).toHaveProperty('totalLanguages');
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('cacheSize');
      expect(typeof stats.totalNotifications).toBe('number');
    });
  });

  describe('getCurrentLanguage', () => {
    it('should return current language', () => {
      const language = manager.getCurrentLanguage();
      expect(language).toBe('en-US');
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return available languages from template service', () => {
      const languages = ['en-US', 'pt-BR', 'es-ES'];
      mockTemplateService.getAvailableLanguages.mockReturnValue(languages);

      const result = manager.getAvailableLanguages();

      expect(result).toEqual(languages);
    });
  });
});