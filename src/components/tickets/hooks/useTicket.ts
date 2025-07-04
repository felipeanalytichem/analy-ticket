import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category_id: string | null;
  user_id: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

/**
 * Fetch a single ticket by id.
 * Uses React Query for caching and loading states.
 */
export function useTicket(id?: string) {
  return useQuery<Ticket | null, Error>({
    queryKey: ['ticket', id],
    enabled: Boolean(id),
    staleTime: 1000 * 60, // 1 min
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('tickets_new')
        .select(
          `id, ticket_number, title, description, status, priority, category_id, user_id, assigned_to, created_at, updated_at, resolved_at, closed_at`
        )
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      return data as unknown as Ticket;
    },
  });
} 