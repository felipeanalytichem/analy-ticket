import { useQuery } from '@tanstack/react-query';
import DatabaseService, { Category } from '@/lib/database';

/**
 * Fetches the list of categories.
 * Returned data stays fresh for 2 minutes.
 */
export function useCategories() {
  return useQuery<Category[], Error>({
    queryKey: ['categories'],
    staleTime: 1000 * 60 * 2, // 2 minutes
    queryFn: async () => {
      const data = await DatabaseService.getCategories();
      return data;
    },
  });
} 