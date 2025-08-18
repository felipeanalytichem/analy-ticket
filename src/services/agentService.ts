import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/database';

export interface Agent {
  id: string;
  email: string;
  full_name: string;
  role: 'agent' | 'admin';
  is_active: boolean;
  last_seen?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentCacheEntry {
  data: Agent[];
  timestamp: number;
  expiresAt: number;
}

/**
 * AgentService provides comprehensive agent data management with caching and real-time updates
 * Implements requirements 3.1, 3.2, and 3.4 from the system stability spec
 */
export class AgentService {
  private static instance: AgentService;
  private cache: Map<string, AgentCacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private subscribers: Map<string, ((agents: Agent[]) => void)[]> = new Map();
  private realtimeSubscription: any = null;

  private constructor() {
    this.setupRealtimeSubscription();
  }

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Get all active agents with role-based filtering
   * Implements caching for better performance
   */
  public async getAllActiveAgents(): Promise<Agent[]> {
    const cacheKey = 'all_active_agents';
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          avatar_url,
          created_at,
          updated_at
        `)
        .in('role', ['agent', 'admin'])
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching active agents:', error);
        throw new Error(`Failed to fetch active agents: ${error.message}`);
      }

      // Transform data to include is_active status
      // For now, we consider all agents as active since we don't have a specific is_active column
      const agents: Agent[] = (data || []).map(user => ({
        ...user,
        is_active: true, // Default to active for all fetched agents
        full_name: user.full_name || user.email || 'Unknown User'
      }));

      // Cache the results
      this.setCachedData(cacheKey, agents);

      // Notify subscribers
      this.notifySubscribers(cacheKey, agents);

      return agents;
    } catch (error) {
      console.error('AgentService.getAllActiveAgents error:', error);
      throw error;
    }
  }

  /**
   * Get agents filtered by specific roles
   */
  public async getAgentsByRole(roles: ('agent' | 'admin')[]): Promise<Agent[]> {
    const cacheKey = `agents_by_role_${roles.sort().join('_')}`;
    const cached = this.getCachedData(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          avatar_url,
          created_at,
          updated_at
        `)
        .in('role', roles)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching agents by role:', error);
        throw new Error(`Failed to fetch agents by role: ${error.message}`);
      }

      const agents: Agent[] = (data || []).map(user => ({
        ...user,
        is_active: true,
        full_name: user.full_name || user.email || 'Unknown User'
      }));

      // Cache the results
      this.setCachedData(cacheKey, agents);

      // Notify subscribers
      this.notifySubscribers(cacheKey, agents);

      return agents;
    } catch (error) {
      console.error('AgentService.getAgentsByRole error:', error);
      throw error;
    }
  }

  /**
   * Get a specific agent by ID
   */
  public async getAgentById(agentId: string): Promise<Agent | null> {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          avatar_url,
          created_at,
          updated_at
        `)
        .eq('id', agentId)
        .in('role', ['agent', 'admin'])
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Agent not found
        }
        console.error('Error fetching agent by ID:', error);
        throw new Error(`Failed to fetch agent: ${error.message}`);
      }

      return {
        ...data,
        is_active: true,
        full_name: data.full_name || data.email || 'Unknown User'
      };
    } catch (error) {
      console.error('AgentService.getAgentById error:', error);
      throw error;
    }
  }

  /**
   * Refresh agent cache manually
   */
  public async refreshAgentCache(): Promise<void> {
    try {
      // Clear all cached data
      this.cache.clear();

      // Refresh all active agents
      await this.getAllActiveAgents();

      console.log('Agent cache refreshed successfully');
    } catch (error) {
      console.error('Error refreshing agent cache:', error);
      throw error;
    }
  }

  /**
   * Subscribe to agent updates for real-time notifications
   */
  public subscribeToAgentUpdates(
    callback: (agents: Agent[]) => void,
    cacheKey: string = 'all_active_agents'
  ): () => void {
    if (!this.subscribers.has(cacheKey)) {
      this.subscribers.set(cacheKey, []);
    }

    this.subscribers.get(cacheKey)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(cacheKey);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
        
        // Clean up empty subscriber arrays
        if (callbacks.length === 0) {
          this.subscribers.delete(cacheKey);
        }
      }
    };
  }

  /**
   * Get cached data if it's still valid
   */
  private getCachedData(cacheKey: string): Agent[] | null {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data with expiration
   */
  private setCachedData(cacheKey: string, data: Agent[]): void {
    const now = Date.now();
    this.cache.set(cacheKey, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL
    });
  }

  /**
   * Notify all subscribers of data updates
   */
  private notifySubscribers(cacheKey: string, agents: Agent[]): void {
    const callbacks = this.subscribers.get(cacheKey);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(agents);
        } catch (error) {
          console.error('Error in agent update callback:', error);
        }
      });
    }
  }

  /**
   * Setup real-time subscription for user changes
   */
  private setupRealtimeSubscription(): void {
    try {
      this.realtimeSubscription = supabase
        .channel('agent_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: 'role=in.(agent,admin)'
          },
          (payload) => {
            console.log('Agent data changed:', payload);
            // Invalidate cache when agent data changes
            this.handleRealtimeUpdate(payload);
          }
        )
        .subscribe((status) => {
          console.log('Agent realtime subscription status:', status);
        });
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }
  }

  /**
   * Handle real-time updates from Supabase
   */
  private handleRealtimeUpdate(payload: any): void {
    try {
      // Clear cache to force fresh data on next request
      this.cache.clear();

      // Refresh data and notify subscribers
      this.getAllActiveAgents().catch(error => {
        console.error('Error refreshing agents after realtime update:', error);
      });
    } catch (error) {
      console.error('Error handling realtime update:', error);
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.realtimeSubscription) {
      supabase.removeChannel(this.realtimeSubscription);
      this.realtimeSubscription = null;
    }
    
    this.cache.clear();
    this.subscribers.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats(): {
    cacheSize: number;
    subscriberCount: number;
    cacheKeys: string[];
  } {
    return {
      cacheSize: this.cache.size,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, callbacks) => sum + callbacks.length, 0),
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const agentService = AgentService.getInstance();