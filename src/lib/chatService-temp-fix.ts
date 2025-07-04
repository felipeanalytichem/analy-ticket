// Temporary fix to prevent direct_chats 400 errors
import { supabase } from '@/lib/supabase';

export class ChatServiceFix {
  static async getAllChats() {
    try {
      console.log('💬 Using temporary chat fix - only ticket chats');
      
      // Only get tickets, skip direct chats entirely 
      const { data: tickets } = await supabase
        .from('tickets_new')
        .select('id, ticket_number, title, user:users!tickets_new_user_id_fkey(id, full_name, email)')
        .order('updated_at', { ascending: false });

      return (tickets || []).map(ticket => ({
        id: `chat-${ticket.id}`,
        ticket_id: ticket.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        ticket: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          user: ticket.user ? {
            id: ticket.user.id,
            name: ticket.user.full_name,
            email: ticket.user.email
          } : undefined
        },
        unread_count: 0
      }));
    } catch (error) {
      console.error('Error in chat fix:', error);
      return [];
    }
  }

  static async getUnreadCount() {
    // Return 0 for now to prevent errors
    return 0;
  }
} 