import { useQuery } from '@tanstack/react-query';
import { DatabaseService, type TicketWithDetails } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';

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
 * Enhanced ticket fetching hook with proper access validation.
 * Uses the DatabaseService.getTicketById method which includes:
 * - User permission validation
 * - Time-based filtering for closed tickets (7-day window)
 * - Security audit logging for unauthorized access attempts
 * - Proper error handling with 403 Forbidden responses
 */
export function useTicket(id?: string) {
  const { userProfile } = useAuth();
  
  return useQuery<TicketWithDetails | null, Error>({
    queryKey: ['ticket', id, userProfile?.id],
    enabled: Boolean(id && userProfile?.id),
    staleTime: 1000 * 60, // 1 min
    queryFn: async () => {
      if (!id || !userProfile?.id) return null;

      try {
        // Use the enhanced getTicketById method with user context for access validation
        const ticket = await DatabaseService.getTicketById(id, {
          userId: userProfile.id,
          userRole: (userProfile.role as 'user' | 'agent' | 'admin') || 'user',
          // Note: IP address and user agent would typically be available in a real browser environment
          // For now, we'll omit these optional parameters
        });

        return ticket;
      } catch (error) {
        // Enhanced error handling for different error types
        if (error instanceof Error) {
          // Handle specific error types from DatabaseService
          if (error.name === 'UnauthorizedAccess') {
            // Create a proper 403 error for unauthorized access
            const forbiddenError = new Error('Access denied: You can only view your own tickets');
            forbiddenError.name = 'ForbiddenError';
            (forbiddenError as any).status = 403;
            throw forbiddenError;
          }
          
          if (error.name === 'NotFound') {
            // Create a proper 404 error for not found tickets
            const notFoundError = new Error('Ticket not found');
            notFoundError.name = 'NotFoundError';
            (notFoundError as any).status = 404;
            throw notFoundError;
          }
          
          if (error.name === 'InvalidInput') {
            // Handle invalid input errors
            const badRequestError = new Error('Invalid ticket ID provided');
            badRequestError.name = 'BadRequestError';
            (badRequestError as any).status = 400;
            throw badRequestError;
          }
        }
        
        // Re-throw other errors as-is
        throw error;
      }
    },
  });
} 