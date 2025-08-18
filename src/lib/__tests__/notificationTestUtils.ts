import { vi } from 'vitest';
import type { Notification, NotificationWithTicket, NotificationContext } from '../notificationService';

/**
 * Test utilities for notification testing
 */
export class NotificationTestUtils {
  /**
   * Generate mock notification data
   */
  static createMockNotification(overrides: Partial<Notification> = {}): Notification {
    return {
      id: 'test-notification-id',
      user_id: 'test-user-id',
      message: 'Test notification message',
      type: 'ticket_created',
      ticket_id: 'test-ticket-id',
      read: false,
      priority: 'medium',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      title: 'Test Notification Title',
      ...overrides
    };
  }

  /**
   * Generate mock notification with ticket data
   */
  static createMockNotificationWithTicket(
    notificationOverrides: Partial<Notification> = {},
    ticketOverrides: Partial<NonNullable<NotificationWithTicket['ticket']>> = {}
  ): NotificationWithTicket {
    const notification = this.createMockNotification(notificationOverrides);
    return {
      ...notification,
      ticket: {
        id: 'test-ticket-id',
        title: 'Test Ticket Title',
        ticket_number: 'T-12345',
        status: 'open',
        priority: 'medium',
        ...ticketOverrides
      }
    };
  }

  /**
   * Generate mock notification context
   */
  static createMockNotificationContext(overrides: Partial<NotificationContext> = {}): NotificationContext {
    return {
      ticketNumber: 'T-12345',
      ticketTitle: 'Test Ticket Title',
      userName: 'Test User',
      agentName: 'Test Agent',
      oldStatus: 'open',
      newStatus: 'in_progress',
      oldPriority: 'low',
      newPriority: 'medium',
      assigneeName: 'Test Assignee',
      resolvedBy: 'Test Resolver',
      closedBy: 'Test Closer',
      ...overrides
    };
  }

  /**
   * Generate array of mock notifications
   */
  static createMockNotificationList(count: number, baseOverrides: Partial<Notification> = {}): Notification[] {
    return Array.from({ length: count }, (_, index) => 
      this.createMockNotification({
        id: `notification-${index + 1}`,
        title: `Notification ${index + 1}`,
        message: `Message ${index + 1}`,
        created_at: new Date(Date.now() - index * 60000).toISOString(),
        ...baseOverrides
      })
    );
  }

  /**
   * Generate mock notifications with different types
   */
  static createMockNotificationsByType(): Notification[] {
    const types: Notification['type'][] = [
      'ticket_created',
      'ticket_updated',
      'ticket_assigned',
      'comment_added',
      'status_changed',
      'priority_changed',
      'assignment_changed',
      'sla_warning',
      'sla_breach'
    ];

    return types.map((type, index) => 
      this.createMockNotification({
        id: `notification-${type}-${index}`,
        type,
        title: `${type.replace('_', ' ')} notification`,
        message: `Test ${type} message`
      })
    );
  }

  /**
   * Generate mock notifications with different priorities
   */
  static createMockNotificationsByPriority(): Notification[] {
    const priorities: Notification['priority'][] = ['low', 'medium', 'high'];
    
    return priorities.map((priority, index) => 
      this.createMockNotification({
        id: `notification-${priority}-${index}`,
        priority,
        title: `${priority} priority notification`,
        message: `Test ${priority} priority message`
      })
    );
  }

  /**
   * Generate mock encrypted notification data
   */
  static createMockEncryptedNotification(overrides: Partial<Notification> = {}): any {
    return {
      ...this.createMockNotification(overrides),
      encrypted_fields: ['title', 'message'],
      encryption_data: {
        key: 'mock-encryption-key',
        iv: 'mock-initialization-vector',
        algorithm: 'AES-256-GCM'
      }
    };
  }

  /**
   * Create mock Supabase query builder
   */
  static createMockSupabaseQuery(mockData: any = null, mockError: any = null) {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      mockResolvedValue: vi.fn().mockResolvedValue({
        data: mockData,
        error: mockError,
        count: Array.isArray(mockData) ? mockData.length : mockData ? 1 : 0
      })
    };

    // Make all methods return the resolved value
    Object.keys(query).forEach(key => {
      if (key !== 'mockResolvedValue' && typeof query[key as keyof typeof query] === 'function') {
        (query[key as keyof typeof query] as any).mockResolvedValue({
          data: mockData,
          error: mockError,
          count: Array.isArray(mockData) ? mockData.length : mockData ? 1 : 0
        });
      }
    });

    return query;
  }

  /**
   * Create mock Supabase auth user
   */
  static createMockAuthUser(overrides: any = {}) {
    return {
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          role: 'user',
          ...overrides
        }
      },
      error: null
    };
  }

  /**
   * Create mock user profile data
   */
  static createMockUserProfile(overrides: any = {}) {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'user',
      name: 'Test User',
      created_at: '2024-01-01T00:00:00Z',
      ...overrides
    };
  }

  /**
   * Create mock ticket data
   */
  static createMockTicket(overrides: any = {}) {
    return {
      id: 'test-ticket-id',
      title: 'Test Ticket',
      ticket_number: 'T-12345',
      status: 'open',
      priority: 'medium',
      user_id: 'test-user-id',
      assigned_to: 'test-agent-id',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      ...overrides
    };
  }

  /**
   * Create mock real-time channel
   */
  static createMockRealtimeChannel() {
    return {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback('SUBSCRIBED');
        }
        return Promise.resolve();
      }),
      unsubscribe: vi.fn().mockResolvedValue(undefined)
    };
  }

  /**
   * Create mock template service
   */
  static createMockTemplateService() {
    return {
      createTemplate: vi.fn().mockReturnValue({
        template: 'mock-template',
        variables: {}
      }),
      serializeTemplate: vi.fn().mockReturnValue('serialized-template'),
      processNotificationForDisplay: vi.fn().mockReturnValue({
        title: 'Processed Title',
        message: 'Processed Message'
      }),
      getInstance: vi.fn().mockReturnThis()
    };
  }

  /**
   * Create mock permission validator
   */
  static createMockPermissionValidator() {
    return {
      validateCreatePermission: vi.fn().mockResolvedValue({ allowed: true }),
      validateModifyPermission: vi.fn().mockResolvedValue({ allowed: true }),
      validateReadPermission: vi.fn().mockResolvedValue({ allowed: true }),
      getInstance: vi.fn().mockReturnThis()
    };
  }

  /**
   * Create mock data security service
   */
  static createMockDataSecurity() {
    return {
      validateNotificationData: vi.fn().mockReturnValue({ valid: true }),
      processNotificationForStorage: vi.fn().mockResolvedValue({
        title: 'Processed Title',
        message: 'Processed Message',
        encrypted_fields: null,
        encryption_data: null
      }),
      processNotificationForDisplay: vi.fn().mockResolvedValue({
        title: 'Decrypted Title',
        message: 'Decrypted Message'
      }),
      sanitizeContent: vi.fn().mockReturnValue('sanitized-content'),
      encryptSensitiveData: vi.fn().mockResolvedValue({
        encrypted_data: 'encrypted-content',
        encryption_key: 'mock-key'
      }),
      getInstance: vi.fn().mockReturnThis()
    };
  }

  /**
   * Create mock notification cache
   */
  static createMockNotificationCache() {
    return {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockReturnValue(false),
      delete: vi.fn().mockResolvedValue(true)
    };
  }

  /**
   * Create mock error scenarios
   */
  static createMockErrors() {
    return {
      networkError: new Error('Network connection failed'),
      authError: new Error('Authentication failed'),
      permissionError: new Error('Permission denied'),
      validationError: new Error('Validation failed'),
      databaseError: { message: 'Database error', code: 'DB_ERROR' },
      encryptionError: new Error('Encryption failed'),
      decryptionError: new Error('Decryption failed')
    };
  }

  /**
   * Setup common mocks for notification tests
   */
  static setupCommonMocks() {
    const mocks = {
      supabase: {
        from: vi.fn(),
        auth: {
          getUser: vi.fn().mockResolvedValue(this.createMockAuthUser())
        },
        channel: vi.fn().mockReturnValue(this.createMockRealtimeChannel())
      },
      templateService: this.createMockTemplateService(),
      permissionValidator: this.createMockPermissionValidator(),
      dataSecurity: this.createMockDataSecurity(),
      cache: this.createMockNotificationCache(),
      toast: vi.fn(),
      i18n: {
        t: vi.fn((key: string) => key)
      }
    };

    return mocks;
  }

  /**
   * Create performance test data
   */
  static createPerformanceTestData(size: number) {
    return {
      notifications: this.createMockNotificationList(size),
      users: Array.from({ length: Math.min(size, 100) }, (_, index) => 
        this.createMockUserProfile({ id: `user-${index + 1}` })
      ),
      tickets: Array.from({ length: Math.min(size, 50) }, (_, index) => 
        this.createMockTicket({ id: `ticket-${index + 1}` })
      )
    };
  }

  /**
   * Create concurrent user test scenarios
   */
  static createConcurrentUserScenarios(userCount: number) {
    return Array.from({ length: userCount }, (_, index) => ({
      userId: `user-${index + 1}`,
      notifications: this.createMockNotificationList(10, { user_id: `user-${index + 1}` }),
      actions: [
        'getNotifications',
        'markAsRead',
        'deleteNotification',
        'subscribeToNotifications'
      ]
    }));
  }

  /**
   * Create accessibility test data
   */
  static createAccessibilityTestData() {
    return {
      notifications: [
        this.createMockNotification({
          title: 'Screen reader test notification',
          message: 'This notification should be accessible to screen readers',
          type: 'ticket_created'
        }),
        this.createMockNotification({
          title: 'High contrast test notification',
          message: 'This notification should be visible in high contrast mode',
          type: 'sla_warning',
          priority: 'high'
        }),
        this.createMockNotification({
          title: 'Keyboard navigation test',
          message: 'This notification should be navigable with keyboard',
          type: 'comment_added'
        })
      ]
    };
  }

  /**
   * Validate notification structure
   */
  static validateNotificationStructure(notification: any): boolean {
    const requiredFields = ['id', 'user_id', 'message', 'type', 'created_at', 'title'];
    return requiredFields.every(field => notification.hasOwnProperty(field));
  }

  /**
   * Validate notification with ticket structure
   */
  static validateNotificationWithTicketStructure(notification: any): boolean {
    if (!this.validateNotificationStructure(notification)) {
      return false;
    }

    if (notification.ticket) {
      const requiredTicketFields = ['id', 'title', 'ticket_number', 'status', 'priority'];
      return requiredTicketFields.every(field => notification.ticket.hasOwnProperty(field));
    }

    return true;
  }

  /**
   * Create mock database transaction
   */
  static createMockTransaction() {
    return {
      begin: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    };
  }

  /**
   * Create mock WebSocket connection
   */
  static createMockWebSocket() {
    return {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null
    };
  }

  /**
   * Simulate network conditions
   */
  static simulateNetworkConditions() {
    return {
      offline: () => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        });
      },
      online: () => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true
        });
      },
      slowConnection: (delay: number = 2000) => {
        return new Promise(resolve => setTimeout(resolve, delay));
      }
    };
  }
}

/**
 * Test data generators for specific scenarios
 */
export const NotificationTestData = {
  // Real-time subscription test data
  realtimeEvents: {
    insert: {
      eventType: 'INSERT',
      new: NotificationTestUtils.createMockNotification(),
      old: null
    },
    update: {
      eventType: 'UPDATE',
      new: NotificationTestUtils.createMockNotification({ read: true }),
      old: NotificationTestUtils.createMockNotification({ read: false })
    },
    delete: {
      eventType: 'DELETE',
      new: null,
      old: NotificationTestUtils.createMockNotification()
    }
  },

  // Error scenarios
  errorScenarios: {
    databaseUnavailable: {
      error: { message: 'Database unavailable', code: 'CONNECTION_ERROR' },
      data: null
    },
    permissionDenied: {
      error: { message: 'Permission denied', code: 'PERMISSION_ERROR' },
      data: null
    },
    invalidData: {
      error: { message: 'Invalid data format', code: 'VALIDATION_ERROR' },
      data: null
    }
  },

  // Performance test scenarios
  performanceScenarios: {
    largeDataset: NotificationTestUtils.createPerformanceTestData(1000),
    concurrentUsers: NotificationTestUtils.createConcurrentUserScenarios(50),
    highFrequencyUpdates: Array.from({ length: 100 }, (_, index) => ({
      timestamp: Date.now() + index * 100,
      notification: NotificationTestUtils.createMockNotification({
        id: `rapid-${index}`,
        created_at: new Date(Date.now() + index * 100).toISOString()
      })
    }))
  }
};