import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DatabaseService } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';

interface UserStats {
  totalCreated: number;
  totalAssigned: number;
  avgResolutionTime: string;
  statusBreakdown: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'created' | 'updated' | 'resolved';
  ticket_number: string;
  title: string;
  created_at: string;
}

interface ProfileData {
  stats: UserStats;
  recentActivities: RecentActivity[];
}

/**
 * React Query hook for user profile data
 * Handles loading user statistics and recent activities
 */
export function useProfile() {
  const { user, userProfile, loading: authLoading, isInitialized } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ['profile', user?.id];

  const queryFn = useCallback(async (): Promise<ProfileData> => {
    if (!user || !userProfile) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 Fetching profile data...');

    // Load real user statistics
    const realStats = await DatabaseService.getDashboardStats(user.id, userProfile.role);
    
    const stats: UserStats = {
      totalCreated: realStats.myTickets,
      totalAssigned: realStats.assignedToMe,
      avgResolutionTime: '0h 0m', // TODO: Calculate real average resolution time
      statusBreakdown: {
        open: realStats.openTickets,
        in_progress: 0, // TODO: Get in_progress count
        resolved: realStats.resolvedTickets,
        closed: realStats.closedTickets
      }
    };

    // Load recent activities from tickets
    let recentActivities: RecentActivity[] = [];
    try {
      const userTickets = await DatabaseService.getTickets({
        userId: user.id,
        limit: 5
      });
      
      recentActivities = userTickets.map(ticket => ({
        id: ticket.id,
        type: 'created' as const,
        ticket_number: ticket.ticket_number || 'N/A',
        title: ticket.title,
        created_at: ticket.created_at
      }));
    } catch (error) {
      console.error('Error loading recent activities:', error);
      recentActivities = [];
    }

    console.log('✅ Profile data fetched successfully');
    
    return {
      stats,
      recentActivities
    };
  }, [user?.id, userProfile?.role]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: isInitialized && !authLoading && !!user?.id && !!userProfile,
    staleTime: 2 * 60 * 1000, // 2 minutes - profile data doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: (failureCount, error) => {
      if (failureCount >= 2) return false;
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      return true;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000)
  });

  const forceRefresh = useCallback(async () => {
    console.log('🔄 Force refreshing profile data...');
    await queryClient.cancelQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey });
    return query.refetch();
  }, [queryClient, queryKey, query]);

  const handleStuckLoading = useCallback(() => {
    console.log('🚨 Handling stuck loading for profile...');
    queryClient.cancelQueries({ queryKey });
    return forceRefresh();
  }, [queryClient, queryKey, forceRefresh]);

  return {
    data: query.data,
    stats: query.data?.stats || {
      totalCreated: 0,
      totalAssigned: 0,
      avgResolutionTime: '0h 0m',
      statusBreakdown: { open: 0, in_progress: 0, resolved: 0, closed: 0 }
    },
    recentActivities: query.data?.recentActivities || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    isFetching: query.isFetching,
    refetch: forceRefresh,
    handleStuckLoading
  };
}
