import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'agent' | 'admin';
}

export function useUser(userId?: string) {
  return useQuery<UserProfile | null, Error>({
    queryKey: ['user', userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5, // 5 mins
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return data as unknown as UserProfile;
    },
  });
} 