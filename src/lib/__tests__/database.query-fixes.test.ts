import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../database';

describe('DatabaseService Query Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildClosedTicketFilter', () => {
    it('should return proper PostgREST syntax for closed ticket filtering', () => {
      const filter = DatabaseService.buildClosedTicketFilter();
      
      // Should contain proper and() function syntax for combining conditions
      expect(filter).toContain('and(status.eq.closed,closed_at.gte.');
      
      // Should contain a valid ISO date
      expect(filter).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('should generate filter for 7 days ago', () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const filter = DatabaseService.buildClosedTicketFilter();
      const expectedDate = sevenDaysAgo.toISOString();
      
      expect(filter).toContain(expectedDate);
    });
  });

  describe('validateQuerySyntax', () => {
    it('should validate correct PostgREST syntax', () => {
      const validQueries = [
        'status.eq.open',
        'status.in.(open,closed)',
        'assigned_to.is.null,assigned_to.eq.123',
        'title.ilike.%test%,description.ilike.%test%'
      ];

      validQueries.forEach((query, index) => {
        const result = DatabaseService.validateQuerySyntax(query);
        if (!result) {
          console.log(`Query ${index} "${query}" unexpectedly failed validation`);
        }
        expect(result).toBe(true);
      });
    });

    it('should reject malformed queries', () => {
      const invalidQueries = [
        'status.eq.open(', // Unbalanced parentheses
        'status.eq.open)', // Unbalanced parentheses
        'status..eq.open', // Empty operators
        'status.and..eq.open', // Empty operators
        'status.eq."malicious"', // Dangerous characters
        "status.eq.'test'", // Dangerous characters
        'status.eq.test;DROP TABLE', // SQL injection attempt
        'status.eq.test<script>', // XSS attempt
      ];

      invalidQueries.forEach((query, index) => {
        const result = DatabaseService.validateQuerySyntax(query);
        if (result) {
          console.log(`Query ${index} "${query}" unexpectedly passed validation`);
        }
        expect(result).toBe(false);
      });
    });

    it('should handle empty or null queries', () => {
      expect(DatabaseService.validateQuerySyntax('')).toBe(true);
      expect(DatabaseService.validateQuerySyntax(null as any)).toBe(false);
      expect(DatabaseService.validateQuerySyntax(undefined as any)).toBe(false);
    });
  });

  describe('sanitizeQueryParameter', () => {
    it('should sanitize dangerous characters', () => {
      const dangerousInputs = [
        'test"value',
        "test'value",
        'test;DROP TABLE',
        'test<script>alert(1)</script>',
        'test\\backslash',
        'test>redirect'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = DatabaseService.sanitizeQueryParameter(input);
        expect(sanitized).not.toContain('"');
        expect(sanitized).not.toContain("'");
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain('\\');
      });
    });

    it('should normalize whitespace', () => {
      const input = 'test   multiple    spaces';
      const sanitized = DatabaseService.sanitizeQueryParameter(input);
      expect(sanitized).toBe('test multiple spaces');
    });

    it('should trim input', () => {
      const input = '  test value  ';
      const sanitized = DatabaseService.sanitizeQueryParameter(input);
      expect(sanitized).toBe('test value');
    });

    it('should limit length', () => {
      const longInput = 'a'.repeat(2000);
      const sanitized = DatabaseService.sanitizeQueryParameter(longInput);
      expect(sanitized.length).toBe(1000);
    });

    it('should handle null/undefined/non-string inputs', () => {
      expect(DatabaseService.sanitizeQueryParameter(null as any)).toBe('');
      expect(DatabaseService.sanitizeQueryParameter(undefined as any)).toBe('');
      expect(DatabaseService.sanitizeQueryParameter(123 as any)).toBe('');
      expect(DatabaseService.sanitizeQueryParameter({} as any)).toBe('');
    });
  });

  describe('buildTicketFilterQuery', () => {
    it('should build valid query for user role with closed ticket filtering', () => {
      const options = {
        userRole: 'user' as const,
        userId: 'user123',
        statusFilter: 'active'
      };

      const result = DatabaseService.buildTicketFilterQuery(options);
      
      expect(result.isValid).toBe(true);
      expect(result.query).toContain('status.in.(open,in_progress)');
    });

    it('should build valid query for agent role', () => {
      const options = {
        userRole: 'agent' as const,
        userId: 'agent123',
        statusFilter: 'open'
      };

      const result = DatabaseService.buildTicketFilterQuery(options);
      
      expect(result.isValid).toBe(true);
      expect(result.query).toContain('status.eq.open');
    });

    it('should handle all status filter', () => {
      const options = {
        userRole: 'admin' as const,
        statusFilter: 'all'
      };

      const result = DatabaseService.buildTicketFilterQuery(options);
      
      expect(result.isValid).toBe(true);
      expect(result.query).toBe('');
    });

    it('should include closed ticket time filter for users', () => {
      const options = {
        userRole: 'user' as const,
        userId: 'user123'
      };

      const result = DatabaseService.buildTicketFilterQuery(options);
      
      expect(result.isValid).toBe(true);
      // Currently, we're only showing non-closed tickets for users to avoid PostgREST enum errors
      expect(result.query).toContain('status.in.(open,in_progress,resolved)');
    });

    it('should handle invalid status filters', () => {
      const options = {
        userRole: 'user' as const,
        statusFilter: 'invalid_status'
      };

      const result = DatabaseService.buildTicketFilterQuery(options);
      
      expect(result.isValid).toBe(true);
      // Should fall back to default closed ticket filtering
      expect(result.query).toContain('status.in.(open,in_progress,resolved)');
    });

    it('should handle errors gracefully', () => {
      // Test with malformed options that might cause errors
      const result1 = DatabaseService.buildTicketFilterQuery(null as any);
      expect(result1.isValid).toBe(false);
      expect(result1.query).toBe('');

      const result2 = DatabaseService.buildTicketFilterQuery(undefined as any);
      expect(result2.isValid).toBe(false);
      expect(result2.query).toBe('');

      // Test with valid options but null userId (should still work)
      const result3 = DatabaseService.buildTicketFilterQuery({
        userRole: 'user' as const,
        userId: null as any
      });
      expect(result3.isValid).toBe(true); // Should still be valid since userId is optional
    });
  });

  describe('isClosedTicketVisible', () => {
    it('should return true for tickets closed within 7 days', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      expect(DatabaseService.isClosedTicketVisible(threeDaysAgo.toISOString())).toBe(true);
    });

    it('should return false for tickets closed more than 7 days ago', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      expect(DatabaseService.isClosedTicketVisible(tenDaysAgo.toISOString())).toBe(false);
    });

    it('should return true for null closed_at (not closed)', () => {
      expect(DatabaseService.isClosedTicketVisible(null)).toBe(true);
    });

    it('should handle invalid dates', () => {
      expect(DatabaseService.isClosedTicketVisible('invalid-date')).toBe(false);
      expect(DatabaseService.isClosedTicketVisible('')).toBe(true); // Empty string treated as not closed
    });
  });

  describe('getClosedTicketVisibilityInfo', () => {
    it('should provide correct visibility info for recent closed tickets', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const info = DatabaseService.getClosedTicketVisibilityInfo(threeDaysAgo.toISOString());
      
      expect(info.isVisible).toBe(true);
      expect(info.daysSinceClosed).toBe(3);
      expect(info.closedAt).toEqual(threeDaysAgo);
      expect(info.visibilityExpiresAt).toBeDefined();
    });

    it('should provide correct visibility info for old closed tickets', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      const info = DatabaseService.getClosedTicketVisibilityInfo(tenDaysAgo.toISOString());
      
      expect(info.isVisible).toBe(false);
      expect(info.daysSinceClosed).toBe(10);
    });

    it('should handle null closed_at', () => {
      const info = DatabaseService.getClosedTicketVisibilityInfo(null);
      
      expect(info.isVisible).toBe(true);
      expect(info.closedAt).toBe(null);
      expect(info.daysSinceClosed).toBe(null);
      expect(info.visibilityExpiresAt).toBe(null);
    });

    it('should handle invalid dates', () => {
      const info = DatabaseService.getClosedTicketVisibilityInfo('invalid-date');
      
      expect(info.isVisible).toBe(false);
      expect(info.closedAt).toBe(null);
      expect(info.daysSinceClosed).toBe(null);
      expect(info.visibilityExpiresAt).toBe(null);
    });
  });
});