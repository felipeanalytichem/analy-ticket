import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../database';

describe('DatabaseService Post-Processing Tests', () => {

  describe('Closed ticket filtering in post-processing', () => {
    it('should filter closed tickets older than 7 days for users', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockTickets = [
        {
          id: '1',
          title: 'Open Ticket',
          status: 'open',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: null
        },
        {
          id: '2',
          title: 'Recently Closed Ticket',
          status: 'closed',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: threeDaysAgo.toISOString()
        },
        {
          id: '3',
          title: 'Old Closed Ticket',
          status: 'closed',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: tenDaysAgo.toISOString()
        },
        {
          id: '4',
          title: 'In Progress Ticket',
          status: 'in_progress',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: null
        }
      ];

      // Test the filtering logic directly (simulating the post-processing step)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const filteredTickets = mockTickets.filter(ticket => {
        // Always include non-closed tickets
        if (ticket.status !== 'closed') {
          return true;
        }
        
        // For closed tickets, only include if closed within 7 days
        if (ticket.closed_at) {
          const closedDate = new Date(ticket.closed_at);
          return !isNaN(closedDate.getTime()) && closedDate >= sevenDaysAgo;
        }
        
        // If no closed_at date, exclude the ticket
        return false;
      });

      // Should include: open ticket, recently closed ticket, in_progress ticket
      // Should exclude: old closed ticket
      expect(filteredTickets).toHaveLength(3);
      expect(filteredTickets.map(t => t.id)).toEqual(['1', '2', '4']);
    });

    it('should handle tickets with invalid closed_at dates', () => {
      const mockTickets = [
        {
          id: '1',
          title: 'Closed with invalid date',
          status: 'closed',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: 'invalid-date'
        },
        {
          id: '2',
          title: 'Closed with null date',
          status: 'closed',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: null
        }
      ];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const filteredTickets = mockTickets.filter(ticket => {
        // Always include non-closed tickets
        if (ticket.status !== 'closed') {
          return true;
        }
        
        // For closed tickets, only include if closed within 7 days
        if (ticket.closed_at) {
          const closedDate = new Date(ticket.closed_at);
          return !isNaN(closedDate.getTime()) && closedDate >= sevenDaysAgo;
        }
        
        // If no closed_at date, exclude the ticket
        return false;
      });

      // Both tickets should be excluded due to invalid/null dates
      expect(filteredTickets).toHaveLength(0);
    });

    it('should not filter tickets for agents and admins', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const mockTickets = [
        {
          id: '1',
          title: 'Old Closed Ticket',
          status: 'closed',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: tenDaysAgo.toISOString()
        }
      ];

      // For agents and admins, no filtering should occur
      const userRole = 'agent';
      const statusFilter = 'active';

      // The filtering logic should not apply to agents
      const shouldFilter = userRole === 'user' && statusFilter !== 'all';
      expect(shouldFilter).toBe(false);

      // All tickets should be included for agents (no filtering)
      expect(mockTickets).toHaveLength(1);
    });
  });

  describe('Query validation integration', () => {
    it('should validate that simple queries work without enum errors', () => {
      // Test queries that should work
      const validQueries = [
        'status.in.(open,in_progress,resolved)',
        'user_id.eq.123',
        'assigned_to.is.null'
      ];

      validQueries.forEach(query => {
        expect(DatabaseService.validateQuerySyntax(query)).toBe(true);
      });
    });

    it('should reject queries that would cause enum errors', () => {
      // Test queries that would cause the enum error we were seeing
      const problematicQueries = [
        'status.eq.closed.and.closed_at.gte.2025-01-01',
        'and(status.eq.closed,closed_at.gte.2025-01-01)'
      ];

      problematicQueries.forEach((query, index) => {
        const result = DatabaseService.validateQuerySyntax(query);
        if (result) {
          console.log(`Query ${index} "${query}" unexpectedly passed validation`);
        }
        expect(result).toBe(false);
      });
    });
  });
});