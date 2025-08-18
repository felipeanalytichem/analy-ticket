import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAuditService } from '@/lib/securityAuditService';

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        error: null
      })),
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          range: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          }))
        }))
      }))
    }))
  }
}));

describe('SecurityAuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('logSecurityEvent', () => {
    it('should log unauthorized ticket access', async () => {
      const mockData = {
        userId: 'user-123',
        action: 'unauthorized_ticket_access' as const,
        ticketId: 'ticket-456',
        userRole: 'user' as const,
        errorMessage: 'Access denied',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0...'
      };

      await expect(SecurityAuditService.logSecurityEvent(mockData)).resolves.not.toThrow();
    });

    it('should log invalid ticket query', async () => {
      const mockData = {
        userId: 'user-123',
        action: 'invalid_ticket_query' as const,
        userRole: 'user' as const,
        errorMessage: 'Invalid query parameters'
      };

      await expect(SecurityAuditService.logSecurityEvent(mockData)).resolves.not.toThrow();
    });

    it('should log ticket access denied', async () => {
      const mockData = {
        userId: 'user-123',
        action: 'ticket_access_denied' as const,
        ticketId: 'ticket-456',
        userRole: 'agent' as const,
        errorMessage: 'Insufficient permissions'
      };

      await expect(SecurityAuditService.logSecurityEvent(mockData)).resolves.not.toThrow();
    });
  });

  describe('convenience methods', () => {
    it('should log unauthorized ticket access with convenience method', async () => {
      await expect(
        SecurityAuditService.logUnauthorizedTicketAccess(
          'user-123',
          'ticket-456',
          'user',
          'Access denied',
          { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0...' }
        )
      ).resolves.not.toThrow();
    });

    it('should log invalid ticket query with convenience method', async () => {
      await expect(
        SecurityAuditService.logInvalidTicketQuery(
          'user-123',
          'user',
          'Invalid parameters',
          { query: 'invalid' },
          { ipAddress: '192.168.1.1' }
        )
      ).resolves.not.toThrow();
    });

    it('should log ticket access denied with convenience method', async () => {
      await expect(
        SecurityAuditService.logTicketAccessDenied(
          'user-123',
          'ticket-456',
          'agent',
          'Insufficient permissions',
          { ipAddress: '192.168.1.1' }
        )
      ).resolves.not.toThrow();
    });
  });

  describe('getClientInfo', () => {
    it('should return client information', () => {
      // Mock navigator
      Object.defineProperty(global, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Test Browser)'
        },
        writable: true
      });

      const clientInfo = SecurityAuditService.getClientInfo();
      
      expect(clientInfo).toEqual({
        userAgent: 'Mozilla/5.0 (Test Browser)'
      });
    });

    it('should handle missing navigator', () => {
      // Remove navigator
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        writable: true
      });

      const clientInfo = SecurityAuditService.getClientInfo();
      
      expect(clientInfo).toEqual({});
    });
  });
});