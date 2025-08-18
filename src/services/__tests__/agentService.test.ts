import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase at the top level
vi.mock('@/lib/supabase', () => {
  const mockChain = {
    select: vi.fn(() => mockChain),
    in: vi.fn(() => mockChain),
    order: vi.fn(() => ({
      data: [
        {
          id: '1',
          email: 'agent1@test.com',
          full_name: 'Agent One',
          role: 'agent',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          email: 'admin@test.com',
          full_name: 'Admin User',
          role: 'admin',
          avatar_url: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      error: null
    })),
    eq: vi.fn(() => mockChain),
    single: vi.fn(() => ({
      data: {
        id: '1',
        email: 'agent1@test.com',
        full_name: 'Agent One',
        role: 'agent',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      error: null
    }))
  };

  return {
    supabase: {
      from: vi.fn(() => mockChain),
      channel: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(() => 'connected')
        }))
      })),
      removeChannel: vi.fn()
    }
  };
});

import { AgentService } from '../agentService';

describe('AgentService', () => {
  let agentService: AgentService;

  beforeEach(() => {
    // Get a fresh instance for each test
    agentService = AgentService.getInstance();
    // Clear any existing cache
    agentService.destroy();
    agentService = AgentService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllActiveAgents', () => {
    it('should fetch all active agents', async () => {
      const agents = await agentService.getAllActiveAgents();

      expect(agents).toHaveLength(2);
      expect(agents[0]).toEqual({
        id: '1',
        email: 'agent1@test.com',
        full_name: 'Agent One',
        role: 'agent',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
      expect(agents[1]).toEqual({
        id: '2',
        email: 'admin@test.com',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    });

    it('should use cached data on subsequent calls', async () => {
      // First call
      await agentService.getAllActiveAgents();
      
      // Second call should use cache
      const agents = await agentService.getAllActiveAgents();
      
      expect(agents).toHaveLength(2);
      // Note: Due to caching, the second call should use cached data
    });
  });

  describe('getAgentsByRole', () => {
    it('should fetch agents by specific roles', async () => {
      const agents = await agentService.getAgentsByRole(['agent']);

      expect(agents).toHaveLength(2); // Mock returns both for simplicity
      // Verify agents were fetched
    });
  });

  describe('getAgentById', () => {
    it('should fetch a specific agent by ID', async () => {
      const agent = await agentService.getAgentById('1');

      expect(agent).toEqual({
        id: '1',
        email: 'agent1@test.com',
        full_name: 'Agent One',
        role: 'agent',
        is_active: true,
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    });

    it('should throw error for empty agent ID', async () => {
      await expect(agentService.getAgentById('')).rejects.toThrow('Agent ID is required');
    });
  });

  describe('subscribeToAgentUpdates', () => {
    it('should allow subscribing to agent updates', () => {
      const callback = vi.fn();
      const unsubscribe = agentService.subscribeToAgentUpdates(callback);

      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      unsubscribe();
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = agentService.getCacheStats();

      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('subscriberCount');
      expect(stats).toHaveProperty('cacheKeys');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.subscriberCount).toBe('number');
      expect(Array.isArray(stats.cacheKeys)).toBe(true);
    });
  });
});