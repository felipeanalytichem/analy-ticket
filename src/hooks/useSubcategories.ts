import { useQuery } from '@tanstack/react-query';
import DatabaseService, { Subcategory } from '@/lib/database';

/**
 * Fetch subcategories. Cached for 2 minutes.
 */
export function useSubcategories() {
  return useQuery<Subcategory[], Error>({
    queryKey: ['subcategories'],
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const data = await DatabaseService.getSubcategories();
      return data;
    },
  });
} 