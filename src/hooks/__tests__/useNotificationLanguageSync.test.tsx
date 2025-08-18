import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotificationLanguageSync } from '../useNotificationLanguageSync';
import { NotificationLanguageManager } from '@/services/NotificationLanguageManager';
import { NotificationWithTicket } from '@/lib/notificationService';

// Mock dependencies
vi.mock('@/services/NotificationLanguageManager');
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en-US'
    }
  }),
  initReactI18next: {}
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    language: 'en-US',
    on: vi.fn(),
    off: vi.fn(),
    changeLanguage: vi.fn()
  }
}));

describe('useNotificationLanguageSync', () => {
  let mockLanguageManager: any;
  const mockNotifications: NotificationWithTicket[] = [
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

  beforeEach(() => {
    mockLanguageManager = {
      addLanguageSwitchListener: vi.fn(),
      processNotificationsForLanguage: vi.fn(),
      preloadNotificationsForLanguages: vi.fn(),
      switchLanguage: vi.fn(),
      getAvailableLanguages: vi.fn(),
      clearAllCache: vi.fn(),
      getCacheStats: vi.fn(),
      validateNotificationTranslations: vi.fn(),
      getCurrentLanguage: vi.fn()
    };

    vi.mocked(NotificationLanguageManager.getInstance).mockReturnValue(mockLanguageManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty notifications', () => {
      const { result } = renderHook(() => useNotificationLanguageSync([]));

      expect(result.current.notifications).toEqual([]);
      expect(result.current.isProcessing).toBe(false);
    });

    it('should process notifications on mount', () => {
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(mockLanguageManager.processNotificationsForLanguage).toHaveBeenCalledWith(
        mockNotifications,
        undefined
      );
      expect(result.current.notifications).toEqual(mockNotifications);
    });
  });

  describe('language switching', () => {
    it('should setup language change listener', () => {
      const mockUnsubscribe = vi.fn();
      mockLanguageManager.addLanguageSwitchListener.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => 
        useNotificationLanguageSync(mockNotifications, { autoRefreshOnLanguageChange: true })
      );

      expect(mockLanguageManager.addLanguageSwitchListener).toHaveBeenCalled();

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not setup listener when autoRefreshOnLanguageChange is false', () => {
      renderHook(() => 
        useNotificationLanguageSync(mockNotifications, { autoRefreshOnLanguageChange: false })
      );

      expect(mockLanguageManager.addLanguageSwitchListener).not.toHaveBeenCalled();
    });

    it('should switch language programmatically', async () => {
      mockLanguageManager.switchLanguage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      await act(async () => {
        await result.current.switchLanguage('pt-BR');
      });

      expect(mockLanguageManager.switchLanguage).toHaveBeenCalledWith('pt-BR');
    });

    it('should handle language switch errors', async () => {
      const error = new Error('Language not supported');
      mockLanguageManager.switchLanguage.mockRejectedValue(error);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      await expect(result.current.switchLanguage('invalid-lang')).rejects.toThrow(error);
    });
  });

  describe('preloading', () => {
    it('should preload notifications for specified languages', async () => {
      mockLanguageManager.preloadNotificationsForLanguages.mockResolvedValue(undefined);
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      renderHook(() => 
        useNotificationLanguageSync(mockNotifications, {
          preloadLanguages: ['en-US', 'pt-BR'],
          enableCaching: true
        })
      );

      // Wait for async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockLanguageManager.preloadNotificationsForLanguages).toHaveBeenCalledWith(
        mockNotifications,
        ['en-US', 'pt-BR']
      );
    });

    it('should not preload when caching is disabled', () => {
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      renderHook(() => 
        useNotificationLanguageSync(mockNotifications, {
          preloadLanguages: ['en-US', 'pt-BR'],
          enableCaching: false
        })
      );

      expect(mockLanguageManager.preloadNotificationsForLanguages).not.toHaveBeenCalled();
    });
  });

  describe('utility functions', () => {
    it('should return available languages', () => {
      const languages = ['en-US', 'pt-BR', 'es-ES'];
      mockLanguageManager.getAvailableLanguages.mockReturnValue(languages);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(result.current.availableLanguages()).toEqual(languages);
    });

    it('should clear cache', () => {
      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      act(() => {
        result.current.clearCache();
      });

      expect(mockLanguageManager.clearAllCache).toHaveBeenCalled();
    });

    it('should get cache stats', () => {
      const stats = {
        totalNotifications: 5,
        totalLanguages: 3,
        totalEntries: 15,
        cacheSize: 1024
      };
      mockLanguageManager.getCacheStats.mockReturnValue(stats);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(result.current.getCacheStats()).toEqual(stats);
    });

    it('should validate translations', () => {
      const validationResult = {
        valid: true,
        missingKeys: []
      };
      mockLanguageManager.validateNotificationTranslations.mockReturnValue(validationResult);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(result.current.validateTranslations('en-US')).toEqual(validationResult);
      expect(mockLanguageManager.validateNotificationTranslations).toHaveBeenCalledWith('en-US');
    });

    it('should refresh notifications', () => {
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      act(() => {
        result.current.refreshNotifications();
      });

      // Should be called twice: once on mount, once on refresh
      expect(mockLanguageManager.processNotificationsForLanguage).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle processing errors gracefully', async () => {
      mockLanguageManager.processNotificationsForLanguage.mockImplementation(() => {
        throw new Error('Processing error');
      });

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      // Should fallback to original notifications
      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.isProcessing).toBe(false);
    });

    it('should handle preloading errors gracefully', async () => {
      mockLanguageManager.preloadNotificationsForLanguages.mockRejectedValue(
        new Error('Preload error')
      );
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      const { result } = renderHook(() => 
        useNotificationLanguageSync(mockNotifications, {
          preloadLanguages: ['en-US', 'pt-BR'],
          enableCaching: true
        })
      );

      // Wait for async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should still process notifications despite preload error
      expect(result.current.notifications).toEqual(mockNotifications);
    });
  });

  describe('state management', () => {
    it('should track processing state', async () => {
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>(resolve => {
        resolveProcessing = resolve;
      });

      mockLanguageManager.preloadNotificationsForLanguages.mockReturnValue(processingPromise);
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      const { result } = renderHook(() => 
        useNotificationLanguageSync(mockNotifications, {
          preloadLanguages: ['en-US'],
          enableCaching: true
        })
      );

      // Should be processing initially
      expect(result.current.isProcessing).toBe(true);

      await act(async () => {
        resolveProcessing!();
        await processingPromise;
      });

      // Should finish processing
      expect(result.current.isProcessing).toBe(false);
    });

    it('should update when notifications change', () => {
      mockLanguageManager.processNotificationsForLanguage.mockReturnValue(mockNotifications);

      const { result, rerender } = renderHook(
        ({ notifications }) => useNotificationLanguageSync(notifications),
        { initialProps: { notifications: [] } }
      );

      expect(result.current.notifications).toEqual([]);

      rerender({ notifications: mockNotifications });

      expect(mockLanguageManager.processNotificationsForLanguage).toHaveBeenCalledWith(
        mockNotifications,
        undefined
      );
    });
  });

  describe('current language', () => {
    it('should return current language from manager', () => {
      mockLanguageManager.getCurrentLanguage.mockReturnValue('pt-BR');

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(result.current.currentLanguage).toBe('pt-BR');
    });

    it('should fallback to i18n language when manager not available', () => {
      vi.mocked(NotificationLanguageManager.getInstance).mockReturnValue(null as any);

      const { result } = renderHook(() => useNotificationLanguageSync(mockNotifications));

      expect(result.current.currentLanguage).toBe('en-US');
    });
  });
});