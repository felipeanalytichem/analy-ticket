import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationTemplateService } from '../NotificationTemplateService';
import { NotificationService } from '@/lib/notificationService';

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    t: vi.fn(),
    language: 'en-US',
    on: vi.fn(),
    off: vi.fn(),
    changeLanguage: vi.fn(),
    options: {
      resources: {
        'en-US': {},
        'pt-BR': {},
        'es-ES': {}
      }
    }
  }
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

describe('Notification i18n Integration', () => {
  let templateService: NotificationTemplateService;

  beforeEach(() => {
    templateService = NotificationTemplateService.getInstance();
    vi.clearAllMocks();
  });

  it('should create and process i18n notification templates', async () => {
    const { default: i18n } = await import('@/i18n');
    
    // Mock translation function
    vi.mocked(i18n.t).mockImplementation((key: string, options?: any) => {
      const translations: Record<string, string> = {
        'notifications.types.ticket_created.title': `New Ticket ${options?.ticketNumber || ''}`,
        'notifications.types.ticket_created.message': `New ticket "${options?.ticketTitle || ''}" created by ${options?.userName || ''}`,
        'notifications.fallback.noTicketTitle': 'Untitled ticket',
        'notifications.fallback.unknownUser': 'Unknown user'
      };
      return translations[key] || key;
    });

    // Test template creation
    const titleTemplate = templateService.createTemplate('notifications.types.ticket_created.title', {
      ticketNumber: '#123'
    });
    const messageTemplate = templateService.createTemplate('notifications.types.ticket_created.message', {
      ticketTitle: 'Test Ticket',
      userName: 'John Doe'
    });

    expect(titleTemplate.key).toBe('notifications.types.ticket_created.title');
    expect(titleTemplate.params?.ticketNumber).toBe('#123');

    // Test template processing
    const processed = templateService.processTemplate(titleTemplate, messageTemplate, 'en-US');

    expect(processed.title).toBe('New Ticket #123');
    expect(processed.message).toBe('New ticket "Test Ticket" created by John Doe');

    // Test serialization/deserialization
    const serializedTitle = templateService.serializeTemplate(titleTemplate);
    const deserializedTitle = templateService.deserializeTemplate(serializedTitle);

    expect(deserializedTitle).toEqual(titleTemplate);
  });

  it('should handle notification creation with i18n templates', async () => {
    const { default: i18n } = await import('@/i18n');
    
    // Mock translation function
    vi.mocked(i18n.t).mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        'notifications.fallback.noTicketTitle': 'Untitled ticket',
        'notifications.fallback.unknownUser': 'Unknown user'
      };
      return translations[key] || key;
    });

    // Mock supabase response
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        in: vi.fn(() => ({ data: [{ id: 'user1' }], error: null }))
      })),
      insert: vi.fn(() => ({ error: null }))
    } as any);

    // Test notification creation with templates
    const result = await NotificationService.createTicketCreatedNotification('ticket123', {
      ticketNumber: '#123',
      ticketTitle: 'Test Ticket',
      userName: 'John Doe'
    });

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(supabase.from).toHaveBeenCalledWith('notifications');
  });

  it('should validate translation keys', async () => {
    const { default: i18n } = await import('@/i18n');
    
    // Mock translation function to simulate existing/missing keys
    vi.mocked(i18n.t).mockImplementation((key: string) => {
      const existingKeys = [
        'notifications.types.ticket_created.title',
        'notifications.types.ticket_created.message'
      ];
      return existingKeys.includes(key) ? 'Translated text' : key;
    });

    // Test validation
    const validKey = templateService.validateTranslationKey('notifications.types.ticket_created.title');
    const invalidKey = templateService.validateTranslationKey('notifications.types.nonexistent.title');

    expect(validKey).toBe(true);
    expect(invalidKey).toBe(false);
  });

  it('should get notification type templates', () => {
    const templates = templateService.getNotificationTypeTemplates();

    expect(templates).toHaveProperty('ticket_created');
    expect(templates).toHaveProperty('ticket_assigned');
    expect(templates).toHaveProperty('comment_added');
    expect(templates).toHaveProperty('status_changed');
    expect(templates).toHaveProperty('sla_warning');
    expect(templates).toHaveProperty('sla_breach');

    // Check template structure
    expect(templates.ticket_created.title.key).toBe('notifications.types.ticket_created.title');
    expect(templates.ticket_created.message.key).toBe('notifications.types.ticket_created.message');
  });

  it('should handle fallback for missing translations', async () => {
    const { default: i18n } = await import('@/i18n');
    
    // Mock translation function to always return the key (no translation found)
    vi.mocked(i18n.t).mockImplementation((key: string, options?: any) => {
      if (options?.lng === 'en-US') {
        return `English fallback: ${key}`;
      }
      return key; // No translation found
    });

    const template = templateService.createTemplate('missing.key');
    const processed = templateService.processTemplate(template, template, 'pt-BR');

    expect(processed.fallbackTitle).toBe('English fallback: missing.key');
  });
});