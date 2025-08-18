import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../database';

describe('DatabaseService Query Integration Tests', () => {

  describe('Query validation in real scenarios', () => {
    it('should validate complex filter combinations', () => {
      const complexQuery = 'status.in.(open,in_progress,resolved),status.eq.closed.and.closed_at.gte.2024-01-01T00:00:00.000Z';
      
      expect(DatabaseService.validateQuerySyntax(complexQuery)).toBe(true);
    });

    it('should reject queries that would cause PostgREST errors', () => {
      const malformedQueries = [
        'status.eq.open.and(closed_at.is.null)', // Invalid chained and() usage
        'or(status.eq.open,and(assigned_to.is.null))', // Nested operators
      ];

      malformedQueries.forEach((query, index) => {
        const result = DatabaseService.validateQuerySyntax(query);
        if (result) {
          console.log(`Query ${index} "${query}" unexpectedly passed validation`);
        }
        expect(result).toBe(false);
      });
    });

    it('should build proper closed ticket filters', () => {
      const filter = DatabaseService.buildClosedTicketFilter();
      
      // Should be valid PostgREST syntax
      expect(DatabaseService.validateQuerySyntax(filter)).toBe(true);
      
      // Should not contain problematic and() wrapper
      expect(filter).not.toContain('and(');
      
      // Should contain proper chained syntax
      expect(filter).toContain('status.eq.closed.and.closed_at.gte.');
    });
  });
});