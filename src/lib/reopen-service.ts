import { supabase } from "@/lib/supabase";

export interface ReopenRequest {
  id: string;
  ticket_id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  ticket?: {
    id: string;
    title: string;
    status: string;
    ticket_number?: string;
  };
  requested_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  reviewed_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export class ReopenService {
  static async getReopenRequests(options: {
    ticketId?: string;
    status?: string;
    requestedBy?: string;
  } = {}): Promise<ReopenRequest[]> {
    let query = supabase
      .from('reopen_requests')
      .select('*');

    if (options.ticketId) {
      query = query.eq('ticket_id', options.ticketId);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.requestedBy) {
      query = query.eq('user_id', options.requestedBy);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    
    if (error) throw error;

    // Enriquecer dados com informações relacionadas
    if (data && data.length > 0) {
      const enrichedData = await Promise.all(data.map(async (request) => {
        // Buscar informações do ticket
        const { data: ticket } = await supabase
          .from('tickets_new')
          .select('id, title, status, ticket_number')
          .eq('id', request.ticket_id)
          .single();

        // Buscar informações do solicitante
        const { data: requestedByUser } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', request.user_id)
          .single();

        // Buscar informações do revisor se existir
        let reviewedByUser = null;
        if (request.reviewed_by) {
          const { data: reviewedBy } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', request.reviewed_by)
            .single();
          reviewedByUser = reviewedBy;
        }

        return {
          ...request,
          status: request.status as 'pending' | 'approved' | 'rejected',
          ticket,
          requested_by_user: requestedByUser,
          reviewed_by_user: reviewedByUser
        } as ReopenRequest;
      }));

      return enrichedData;
    }
    
    return (data || []).map(request => ({
      ...request,
      status: request.status as 'pending' | 'approved' | 'rejected'
    })) as ReopenRequest[];
  }

  static async createReopenRequest(ticketId: string, userId: string, reason: string): Promise<ReopenRequest> {
    try {
      // 1. Verificar se o ticket existe e está fechado
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets_new')
        .select('id, status, user_id, title')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error('Ticket não encontrado');
      }

      if (ticket.status !== 'closed') {
        throw new Error('Apenas tickets fechados podem ser reabertos');
      }

      // 2. Verificar se o usuário pode solicitar reabertura (apenas o criador do ticket)
      if (ticket.user_id !== userId) {
        throw new Error('Apenas o criador do ticket pode solicitar reabertura');
      }

      // 3. Verificar se já existe uma solicitação pendente
      const { data: existingRequest, error: existingError } = await supabase
        .from('reopen_requests')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        throw new Error('Já existe uma solicitação de reabertura pendente para este ticket');
      }

      // 4. Criar a solicitação
      const { data, error } = await supabase
        .from('reopen_requests')
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          reason: reason.trim(),
          status: 'pending'
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // 5. Notificar agentes/admins sobre a solicitação
      try {
        await this.notifyAgentsAboutReopenRequest(ticketId, userId);
      } catch (notificationError) {
        console.warn('⚠️ Failed to notify agents about reopen request:', notificationError);
      }

      return {
        ...data,
        status: data.status as 'pending' | 'approved' | 'rejected'
      } as ReopenRequest;
    } catch (error) {
      console.error('Error creating reopen request:', error);
      throw error;
    }
  }

  static async reviewReopenRequest(
    requestId: string, 
    status: 'approved' | 'rejected', 
    reviewedBy: string
  ): Promise<any> {
    const { data, error } = await supabase
      .from('reopen_requests')
      .update({
        status: status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  static async reopenTicket(ticketId: string): Promise<any> {
    const { data, error } = await supabase
      .from('tickets_new')
      .update({
        status: 'open',
        resolution: null,
        resolved_at: null,
        closed_at: null,
        resolved_by: null,
        closed_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createComment(ticketId: string, userId: string, content: string): Promise<any> {
    const { data, error } = await supabase
      .from('ticket_comments_new')
      .insert({
        ticket_id: ticketId,
        user_id: userId,
        content: content,
        is_internal: false
      })
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createNotification(userId: string, title: string, content: string, type: string): Promise<any> {
    try {
      // Ensure we're using a valid notification type
      const validType = type === 'ticket_created' || 
                       type === 'ticket_updated' || 
                       type === 'ticket_assigned' || 
                       type === 'comment_added' || 
                       type === 'status_changed' || 
                       type === 'priority_changed' 
                       ? type 
                       : 'ticket_updated'; // Default to ticket_updated if invalid type
      
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: title,
          message: content,  // Using 'message' instead of 'content' to match the schema
          type: validType,
          priority: 'medium', // Add default priority
          read: false,
          created_at: new Date().toISOString()
      })
      .select('*')
      .single();
    
      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }
      
      // Return data directly, don't attempt to call it as a function
      console.log('Notification created successfully:', data);
    return data;
    } catch (error) {
      console.error('Error in createNotification:', error);
      throw error;
    }
  }

  static async getAgents(): Promise<any[]> {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .in('role', ['agent', 'admin']);
    
    if (error) throw error;
    return data || [];
  }

  private static async notifyAgentsAboutReopenRequest(ticketId: string, userId: string): Promise<void> {
    // Buscar todos os agentes e admins
    const { data: agents } = await supabase
      .from('users')
      .select('id')
      .in('role', ['agent', 'admin']);

    if (agents) {
      const notifications = agents.map(agent => ({
        user_id: agent.id,
        type: 'ticket_updated' as const,
        title: 'Nova Solicitação de Reabertura',
        message: 'Um usuário solicitou a reabertura de um ticket fechado.',
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    }
  }

  private static async notifyUserAboutReopenDecision(ticketId: string, userId: string, decision: 'approved' | 'rejected'): Promise<void> {
    const title = decision === 'approved' ? 'Solicitação de Reabertura Aprovada' : 'Solicitação de Reabertura Rejeitada';
    const message = decision === 'approved' 
      ? 'Sua solicitação de reabertura foi aprovada. O ticket foi reaberto.'
      : 'Sua solicitação de reabertura foi rejeitada. Entre em contato se precisar de mais informações.';

    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'ticket_updated' as const,
        title,
        message,
        priority: 'medium' as const,
        ticket_id: ticketId,
        read: false
      });
  }

  static async canRequestReopen(ticketId: string, userId: string): Promise<boolean> {
    try {
      const { data: ticket, error } = await supabase
        .from('tickets_new')
        .select('status, user_id')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return false;
      }

      // Apenas tickets fechados podem ser reabertos
      if (ticket.status !== 'closed') {
        return false;
      }

      // Apenas o criador do ticket pode solicitar reabertura
      if (ticket.user_id !== userId) {
        return false;
      }

      // Verificar se não há solicitação pendente
      const { data: existingRequest } = await supabase
        .from('reopen_requests')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('status', 'pending')
        .single();

      return !existingRequest;
    } catch (error) {
      console.error('Error checking reopen permissions:', error);
      return false;
    }
  }
} 
 
 
 
 