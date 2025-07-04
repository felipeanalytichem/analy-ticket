import { supabase } from './supabase';

export class AutoCloseService {
  /**
   * Executa o processo de fechamento automático de tickets resolved há mais de 2 dias
   */
  static async processAutoClose(): Promise<{ success: boolean; closedCount: number; error?: string }> {
    try {
      console.log('🔄 Iniciando processo de fechamento automático...');
      
      // Chamar a função SQL que processa os agendamentos
      const { data, error } = await supabase.rpc('process_auto_close_schedule');
      
      if (error) {
        console.error('❌ Erro ao processar fechamento automático:', error);
        return { success: false, closedCount: 0, error: error.message };
      }
      
      const closedCount = data || 0;
      console.log(`✅ Processo concluído. ${closedCount} tickets fechados automaticamente.`);
      
      return { success: true, closedCount };
    } catch (error) {
      console.error('💥 Erro inesperado no fechamento automático:', error);
      return { 
        success: false, 
        closedCount: 0, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }

  /**
   * Verifica se há tickets agendados para fechamento
   */
  static async getScheduledTickets(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('auto_close_schedule')
        .select(`
          *,
          tickets_new:ticket_id (
            id,
            ticket_number,
            title,
            status,
            resolved_at
          )
        `)
        .order('scheduled_close_at', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar tickets agendados:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Erro inesperado ao buscar tickets agendados:', error);
      return [];
    }
  }

  /**
   * Cancela o agendamento de fechamento automático de um ticket
   */
  static async cancelAutoClose(ticketId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('auto_close_schedule')
        .delete()
        .eq('ticket_id', ticketId);
      
      if (error) {
        console.error('Erro ao cancelar fechamento automático:', error);
        return false;
      }
      
      console.log(`✅ Fechamento automático cancelado para ticket ${ticketId}`);
      return true;
    } catch (error) {
      console.error('Erro inesperado ao cancelar fechamento automático:', error);
      return false;
    }
  }

  /**
   * Agenda um ticket para fechamento automático (usado quando um ticket é marcado como resolved)
   */
  static async scheduleAutoClose(ticketId: string): Promise<boolean> {
    try {
      const scheduledCloseAt = new Date();
      scheduledCloseAt.setDate(scheduledCloseAt.getDate() + 2); // 2 dias a partir de agora
      
      const { error } = await supabase
        .from('auto_close_schedule')
        .upsert({
          ticket_id: ticketId,
          scheduled_close_at: scheduledCloseAt.toISOString(),
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Erro ao agendar fechamento automático:', error);
        return false;
      }
      
      console.log(`✅ Ticket ${ticketId} agendado para fechamento automático em ${scheduledCloseAt.toLocaleString()}`);
      return true;
    } catch (error) {
      console.error('Erro inesperado ao agendar fechamento automático:', error);
      return false;
    }
  }

  /**
   * Inicia um processo periódico de verificação (para desenvolvimento/teste)
   * Em produção, isso seria feito via cron job ou similar
   */
  static startPeriodicCheck(intervalMinutes: number = 60): NodeJS.Timeout {
    console.log(`🕐 Iniciando verificação periódica a cada ${intervalMinutes} minutos`);
    
    return setInterval(async () => {
      console.log('🔍 Executando verificação periódica de fechamento automático...');
      await this.processAutoClose();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Para o processo periódico de verificação
   */
  static stopPeriodicCheck(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
    console.log('⏹️ Verificação periódica interrompida');
  }
} 