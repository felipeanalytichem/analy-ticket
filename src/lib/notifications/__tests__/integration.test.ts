import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationManager } from '../NotificationManager';
import { mockSupabaseClient } from './setup';

describe('Notification System Integration', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    notificationManager = NotificationManager.getInstance();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await notificationManager.cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should integrate all core services successfully', async () => {
    // Mock successful database operations
    mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'test-notification-1',
          user_id: 'test-user-id',
          message: 'Test notification',
          type: 'ticket_created',
          title: 'Test Title',
          priority: 'medium',
          read: false,
          created_at: new Date().toISOString()
        }
      ],
      error: null
    });

    mockSupabaseClient.from().select().eq().single = vi.fn().mockResolvedValue({
      data: {
        id: 'test-ticket-id',
        title: 'Test Ticket',
        ticket_number: 'T-12345',
        status: 'open',
        priority: 'medium'
      },
      error: null
    });

    // Test creating a notification
    const createResult = await notificationManager.createNotification({
      user_id: 'test-user-id',
      message: 'Test notification message',
      type: 'ticket_created',
      title: 'Test Notification',
      priority: 'medium'
    });

    expect(createResult).toBe(true);

    // Test getting notifications (should use cache)
    const notifications = await notificationManager.getNotifications('test-user-id');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: 'test-notification-1',
      user_id: 'test-user-id',
      message: 'Test notification',
      type: 'ticket_created'
    });

    // Test subscription creation
    const callback = vi.fn();
    const subscription = notificationManager.subscribe('test-user-id', callback);
    expect(subscription).toMatchObject({
      id: expect.any(String),
      userId: 'test-user-id',
      unsubscribe: expect.any(Function)
    });

    // Test connection status
    const status = notificationManager.getConnectionStatus('test-user-id');
    expect(status).toMatchObject({
      connected: expect.any(Boolean),
      reconnectAttempts: expect.any(Number)
    });

    // Test cleanup
    subscription.unsubscribe();
    expect(notificationManager.getConnectionStatus('test-user-id').connected).toBe(false);
  });

  it('should handle errors gracefully across all services', async () => {
    // Mock database error
    mockSupabaseClient.from().insert().then = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' }
    });

    // Should not throw error, but return false
    const result = await notificationManager.createNotification({
      user_id: 'test-user-id',
      message: 'Test notification',
      type: 'ticket_created',
      title: 'Test Title'
    });

    expect(result).toBe(false);

    // Should still be able to get notifications (empty array on error)
    mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Select failed' }
    });

    const notifications = await notificationManager.getNotifications('test-user-id');
    expect(notifications).toEqual([]);
  });

  it('should demonstrate caching functionality', async () => {
    const mockNotifications = [
      {
        id: 'test-notification-1',
        user_id: 'test-user-id',
        message: 'Test notification 1',
        type: 'ticket_created',
        title: 'Test Title 1',
        priority: 'medium',
        read: false,
        created_at: new Date().toISOString()
      }
    ];

    // First call should hit database
    mockSupabaseClient.from().select().eq().order().then = vi.fn().mockResolvedValue({
      data: mockNotifications,
      error: null
    });

    const notifications1 = await notificationManager.getNotifications('test-user-id');
    expect(notifications1).toHaveLength(1);
    expect(mockSupabaseClient.from().select).toHaveBeenCalledTimes(1);

    // Second call should use cache (no additional database call)
    const notifications2 = await notificationManager.getNotifications('test-user-id');
    expect(notifications2).toHaveLength(1);
    expect(mockSupabaseClient.from().select).toHaveBeenCalledTimes(1); // Still 1, not 2
  });
});