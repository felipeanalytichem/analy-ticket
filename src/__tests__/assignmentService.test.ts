import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignmentService } from '@/lib/assignmentService';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          data: [
            {
              id: 'agent1',
              full_name: 'John Agent',
              email: 'john@example.com',
              role: 'agent',
              avatar_url: null
            },
            {
              id: 'agent2',
              full_name: 'Jane Admin',
              email: 'jane@example.com',
              role: 'admin',
              avatar_url: null
            }
          ],
          error: null
        }))
      })),
      eq: vi.fn(() => ({
        in: vi.fn(() => ({
          data: [
            {
              id: 'ticket1',
              priority: 'high',
              created_at: new Date().toISOString()
            }
          ],
          error: null
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          error: null
        }))
      }))
    }))
  }
}));

// Mock NotificationService
vi.mock('@/lib/notificationService', () => ({
  NotificationService: {
    createNotification: vi.fn()
  }
}));

describe('AssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAvailableAgents', () => {
    it('should return available agents with metrics', async () => {
      const agents = await assignmentService.getAvailableAgents();
      
      expect(agents).toHaveLength(2);
      expect(agents[0]).toHaveProperty('id');
      expect(agents[0]).toHaveProperty('full_name');
      expect(agents[0]).toHaveProperty('currentWorkload');
      expect(agents[0]).toHaveProperty('availability');
    });
  });

  describe('findBestAgent', () => {
    it('should find the best agent for a ticket', async () => {
      const ticketData = {
        priority: 'high' as const,
        category_id: 'cat1',
        title: 'Test Ticket',
        description: 'Test Description'
      };

      const result = await assignmentService.findBestAgent(ticketData);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('confidence');
      
      if (result.success) {
        expect(result.assignedAgent).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    it('should handle case when no agents are available', async () => {
      // Mock empty agents response
      vi.mocked(assignmentService.getAvailableAgents).mockResolvedValueOnce([]);

      const ticketData = {
        priority: 'low' as const,
        title: 'Test Ticket',
        description: 'Test Description'
      };

      const result = await assignmentService.findBestAgent(ticketData);
      
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No available agents');
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket to specified agent', async () => {
      const result = await assignmentService.assignTicket('ticket1', 'agent1');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reason');
    });

    it('should use intelligent assignment when no agent specified', async () => {
      const result = await assignmentService.assignTicket('ticket1');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('rebalanceWorkload', () => {
    it('should rebalance workload across agents', async () => {
      const result = await assignmentService.rebalanceWorkload();
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reassignments');
      expect(result).toHaveProperty('message');
      expect(typeof result.reassignments).toBe('number');
    });
  });
});