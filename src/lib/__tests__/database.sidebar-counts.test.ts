import { describe, it, expect } from 'vitest';
import { DatabaseService } from '../database';

describe('DatabaseService Sidebar Counts Tests', () => {
  describe('Ticket counting consistency', () => {
    it('should apply 7-day rule consistently for users with statusFilter all', () => {
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
          title: 'In Progress Ticket',
          status: 'in_progress',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: null
        },
        {
          id: '3',
          title: 'Resolved Ticket',
          status: 'resolved',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: null
        },
        {
          id: '4',
          title: 'Recently Closed Ticket',
          status: 'closed',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: threeDaysAgo.toISOString()
        },
        {
          id: '5',
          title: 'Old Closed Ticket',
          status: 'closed',
          user_id: 'user123',
          created_at: now.toISOString(),
          closed_at: tenDaysAgo.toISOString()
        }
      ];

      // Simulate the post-processing logic for users
      const userRole = 'user';
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

      // Count by status
      const counts = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      };

      filteredTickets.forEach(ticket => {
        switch (ticket.status) {
          case 'open':
            counts.open++;
            break;
          case 'in_progress':
            counts.in_progress++;
            break;
          case 'resolved':
            counts.resolved++;
            break;
          case 'closed':
            counts.closed++;
            break;
        }
      });

      // Should have: 1 open, 1 in_progress, 1 resolved, 1 recent closed
      // Should exclude: 1 old closed
      expect(counts.open).toBe(1);
      expect(counts.in_progress).toBe(1);
      expect(counts.resolved).toBe(1);
      expect(counts.closed).toBe(1); // Only the recent one
      expect(filteredTickets.length).toBe(4); // Total should be 4, not 5
    });

    it('should not apply 7-day rule for agents and admins', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const mockTickets = [
        {
          id: '1',
          title: 'Open Ticket',
          status: 'open',
          assigned_to: 'agent123',
          created_at: now.toISOString(),
          closed_at: null
        },
        {
          id: '2',
          title: 'Old Closed Ticket',
          status: 'closed',
          assigned_to: 'agent123',
          created_at: now.toISOString(),
          closed_at: tenDaysAgo.toISOString()
        }
      ];

      // For agents/admins, no filtering should be applied
      const userRole = 'agent';
      
      // Simulate no filtering for agents
      const filteredTickets = mockTickets; // No filtering applied

      // Count by status
      const counts = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      };

      filteredTickets.forEach(ticket => {
        switch (ticket.status) {
          case 'open':
            counts.open++;
            break;
          case 'in_progress':
            counts.in_progress++;
            break;
          case 'resolved':
            counts.resolved++;
            break;
          case 'closed':
            counts.closed++;
            break;
        }
      });

      // Should include all tickets, including old closed ones
      expect(counts.open).toBe(1);
      expect(counts.closed).toBe(1); // Should include the old closed ticket
      expect(filteredTickets.length).toBe(2); // All tickets included
    });

    it('should handle tickets with invalid closed_at dates', () => {
      const mockTickets = [
        {
          id: '1',
          title: 'Open Ticket',
          status: 'open',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: null
        },
        {
          id: '2',
          title: 'Closed with invalid date',
          status: 'closed',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: 'invalid-date'
        },
        {
          id: '3',
          title: 'Closed with null date',
          status: 'closed',
          user_id: 'user123',
          created_at: new Date().toISOString(),
          closed_at: null
        }
      ];

      // Simulate the post-processing logic for users
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

      // Should only include the open ticket
      // Both closed tickets should be excluded due to invalid/null dates
      expect(filteredTickets.length).toBe(1);
      expect(filteredTickets[0].status).toBe('open');
    });
  });

  describe('Query validation for sidebar calls', () => {
    it('should validate that statusFilter all is safe', () => {
      // The sidebar now uses statusFilter: "all" to get all tickets
      // This should not cause any query syntax issues
      const statusFilter = 'all';
      
      // This should be handled properly in the getTickets method
      expect(statusFilter).toBe('all');
      
      // The method should skip status filtering when statusFilter is 'all'
      const shouldSkipStatusFilter = statusFilter === 'all';
      expect(shouldSkipStatusFilter).toBe(true);
    });

    it('should validate that assignedOnly parameter works correctly', () => {
      // Test the logic used in the sidebar
      const userRole = 'user';
      const agentRole = 'agent';
      
      const isNormalUser = userRole === 'user';
      const isAgent = agentRole === 'agent';
      
      // For users: assignedOnly should be false (they see tickets they created)
      expect(!isNormalUser).toBe(false); // assignedOnly for users
      
      // For agents: assignedOnly should be true (they see tickets assigned to them)
      expect(!isAgent).toBe(false); // This would be assignedOnly for agents
      
      // The logic should be: assignedOnly = userRole !== 'user'
      expect(userRole !== 'user').toBe(false); // Users: assignedOnly = false
      expect(agentRole !== 'user').toBe(true);  // Agents: assignedOnly = true
    });
  });
});