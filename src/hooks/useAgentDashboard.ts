import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DatabaseService, TicketWithDetails } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';

interface AgentStats {
  totalAssigned: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResponseTime: number;
  slaCompliance: number;
}

interface AgentDashboardData {
  tickets: TicketWithDetails[];
  stats: AgentStats;
}

/**
 * React Query hook for Agent Dashboard data
 * Provides automatic caching, refetching, and error handling
 */
export function useAgentDashboard() {
  const { userProfile, loading: authLoading, isInitialized } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['agent-dashboard', userProfile?.id];

  const queryFn = useCallback(async (): Promise<AgentDashboardData> => {
    if (!userProfile?.id) {
      throw new Error('User profile not available');
    }

    console.log('🔄 Fetching agent dashboard data...');

    // Fetch tickets with timeout
    const allTickets = await DatabaseService.getTickets({
      userRole: userProfile.role,
      showAll: true
    });

    // Filter tickets relevant to the agent
    const relevantTickets = allTickets.filter(ticket => {
      // Include tickets assigned to the agent
      if (ticket.assigned_to === userProfile.id) return true;
      
      // Include unassigned tickets (for agent to pick up)
      if (!ticket.assigned_to) return true;
      
      return false;
    });

    // Remove duplicates based on ID
    const uniqueTickets = relevantTickets.filter((ticket, index, self) => 
      index === self.findIndex(t => t.id === ticket.id)
    );

    // Calculate statistics
    const assignedTickets = uniqueTickets.filter(t => t.assigned_to === userProfile.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: AgentStats = {
      totalAssigned: assignedTickets.length,
      openTickets: assignedTickets.filter(t => t.status === 'open').length,
      inProgressTickets: assignedTickets.filter(t => t.status === 'in_progress').length,
      resolvedToday: assignedTickets.filter(t => 
        t.status === 'resolved' && 
        t.resolved_at && 
        new Date(t.resolved_at) >= today
      ).length,
      avgResponseTime: 2.5, // Mock - would be calculated from real data
      slaCompliance: 95 // Mock - would be calculated from real SLA data
    };

    console.log('✅ Agent dashboard data fetched successfully', { 
      ticketCount: uniqueTickets.length, 
      stats 
    });

    return {
      tickets: uniqueTickets,
      stats
    };
  }, [userProfile?.id, userProfile?.role]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: isInitialized && !authLoading && !!userProfile?.id && (userProfile.role === 'agent' || userProfile.role === 'admin'),
    staleTime: 1 * 60 * 1000, // 1 minute - short stale time for fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnWindowFocus: true, // Always refetch when window gains focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refetch on network reconnect
    retry: (failureCount, error) => {
      // Retry up to 2 times
      if (failureCount >= 2) return false;
      
      // Don't retry on auth errors
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000)
  });

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing agent dashboard...');
    
    // Cancel any ongoing queries
    await queryClient.cancelQueries({ queryKey });
    
    // Invalidate and refetch
    await queryClient.invalidateQueries({ queryKey });
    
    return query.refetch();
  }, [queryClient, queryKey, query]);

  const handleStuckLoading = useCallback(() => {
    console.log('🚨 Handling stuck loading for agent dashboard...');
    
    // Cancel ongoing queries
    queryClient.cancelQueries({ queryKey });
    
    // Force refetch
    return forceRefresh();
  }, [queryClient, queryKey, forceRefresh]);

  return {
    data: query.data,
    tickets: query.data?.tickets || [],
    stats: query.data?.stats || {
      totalAssigned: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedToday: 0,
      avgResponseTime: 0,
      slaCompliance: 0
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
    refetch: forceRefresh,
    handleStuckLoading
  };
}

/**
 * Utility to force refresh agent dashboard from anywhere in the app
 */
export function useAgentDashboardActions() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  
  const forceRefreshAgentDashboard = useCallback(() => {
    const queryKey = ['agent-dashboard', userProfile?.id];
    queryClient.invalidateQueries({ queryKey });
    queryClient.refetchQueries({ queryKey });
  }, [queryClient, userProfile?.id]);

  return {
    forceRefreshAgentDashboard
  };
}
