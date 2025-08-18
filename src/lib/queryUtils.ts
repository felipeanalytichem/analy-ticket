import { QueryClient } from '@tanstack/react-query';

export interface CacheInvalidationStrategy {
  // Invalidate queries based on patterns
  invalidateByPattern: (pattern: string) => void;
  
  // Invalidate related queries when data changes
  invalidateRelated: (changedEntity: string, entityId?: string) => void;
  
  // Clear stale data based on age
  clearStaleData: (maxAge?: number) => void;
  
  // Prefetch related data
  prefetchRelated: (entity: string, entityId: string) => Promise<void>;
}

export function createCacheInvalidationStrategy(queryClient: QueryClient): CacheInvalidationStrategy {
  
  const invalidateByPattern = (pattern: string) => {
    console.log(`🗑️ Invalidating queries matching pattern: ${pattern}`);
    
    // Get all query keys and filter by pattern
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    
    queries.forEach(query => {
      const queryKey = query.queryKey;
      const keyString = JSON.stringify(queryKey);
      
      if (keyString.includes(pattern)) {
        console.log(`🗑️ Invalidating query: ${keyString}`);
        queryClient.invalidateQueries({ queryKey });
      }
    });
  };
  
  const invalidateRelated = (changedEntity: string, entityId?: string) => {
    console.log(`🗑️ Invalidating queries related to ${changedEntity}${entityId ? ` (ID: ${entityId})` : ''}`);
    
    // Define relationships between entities
    const entityRelationships: Record<string, string[]> = {
      'ticket': ['tickets', 'ticket-counts', 'agent-tickets', 'user-tickets'],
      'user': ['users', 'agents', 'user-profile'],
      'category': ['categories', 'subcategories', 'tickets'],
      'subcategory': ['subcategories', 'tickets'],
      'chat': ['chats', 'ticket-chats'],
      'notification': ['notifications', 'unread-notifications'],
    };
    
    const relatedQueries = entityRelationships[changedEntity] || [changedEntity];
    
    relatedQueries.forEach(queryType => {
      if (entityId) {
        // Invalidate specific entity queries
        queryClient.invalidateQueries({ queryKey: [queryType, entityId] });
        queryClient.invalidateQueries({ queryKey: [queryType, { id: entityId }] });
      }
      
      // Invalidate general queries for this entity type
      queryClient.invalidateQueries({ queryKey: [queryType] });
    });
  };
  
  const clearStaleData = (maxAge: number = 30 * 60 * 1000) => { // Default 30 minutes
    console.log(`🧹 Clearing data older than ${maxAge / 1000 / 60} minutes`);
    
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    const now = Date.now();
    
    queries.forEach(query => {
      const dataUpdatedAt = query.state.dataUpdatedAt;
      const age = now - dataUpdatedAt;
      
      if (age > maxAge) {
        console.log(`🧹 Removing stale query: ${JSON.stringify(query.queryKey)} (age: ${Math.round(age / 1000 / 60)}min)`);
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  };
  
  const prefetchRelated = async (entity: string, entityId: string) => {
    console.log(`⚡ Prefetching related data for ${entity}:${entityId}`);
    
    try {
      // Define prefetch strategies for different entities
      switch (entity) {
        case 'ticket':
          // Prefetch ticket details, chats, and related user info
          await Promise.all([
            queryClient.prefetchQuery({
              queryKey: ['ticket', entityId],
              staleTime: 2 * 60 * 1000, // 2 minutes
            }),
            queryClient.prefetchQuery({
              queryKey: ['ticket-chats', entityId],
              staleTime: 1 * 60 * 1000, // 1 minute
            }),
          ]);
          break;
          
        case 'user':
          // Prefetch user profile and related tickets
          await queryClient.prefetchQuery({
            queryKey: ['user-profile', entityId],
            staleTime: 5 * 60 * 1000, // 5 minutes
          });
          break;
          
        default:
          console.log(`No prefetch strategy defined for entity: ${entity}`);
      }
    } catch (error) {
      console.error(`❌ Error prefetching data for ${entity}:${entityId}`, error);
    }
  };
  
  return {
    invalidateByPattern,
    invalidateRelated,
    clearStaleData,
    prefetchRelated,
  };
}

// Utility function to determine if data is stale based on context
export function isDataStale(lastUpdated: number, context: 'realtime' | 'frequent' | 'normal' | 'static' = 'normal'): boolean {
  const now = Date.now();
  const age = now - lastUpdated;
  
  const thresholds = {
    realtime: 30 * 1000,      // 30 seconds
    frequent: 2 * 60 * 1000,  // 2 minutes
    normal: 5 * 60 * 1000,    // 5 minutes
    static: 30 * 60 * 1000,   // 30 minutes
  };
  
  return age > thresholds[context];
}

// Utility to create optimistic updates
export function createOptimisticUpdate<T>(
  queryClient: QueryClient,
  queryKey: any[],
  updateFn: (oldData: T | undefined) => T
) {
  return {
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData<T>(queryKey);
      
      // Optimistically update
      queryClient.setQueryData<T>(queryKey, updateFn);
      
      return { previousData };
    },
    
    onError: (error: any, variables: any, context: any) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey });
    },
  };
}