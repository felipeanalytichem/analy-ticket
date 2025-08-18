import { vi } from 'vitest';

// Mock Supabase client
export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: null, error: null })
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  }))
};

// Mock the supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock timers
vi.useFakeTimers();

export const createMockNotification = (overrides = {}) => ({
  id: 'test-notification-id',
  user_id: 'test-user-id',
  message: 'Test notification message',
  type: 'ticket_created',
  title: 'Test Notification',
  priority: 'medium',
  read: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

export const createMockTicket = (overrides = {}) => ({
  id: 'test-ticket-id',
  title: 'Test Ticket',
  ticket_number: 'T-12345',
  status: 'open',
  priority: 'medium',
  ...overrides
});