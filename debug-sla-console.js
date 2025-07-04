// 🔍 Debug SLA - Console Simples
// SUBSTITUA 'YOUR_TICKET_ID' pelo ID do seu ticket de teste
const ticketId = 'YOUR_TICKET_ID'; 

console.log('🔍 Debug SLA iniciado para ticket:', ticketId);

// Verificar se já existem logs de primeira resposta
console.log('📝 Verificando activity logs...');

// Buscar no banco diretamente via DevTools (se Supabase client estiver disponível)
if (window.supabase) {
  console.log('✅ Supabase client encontrado');
  
  // Verificar activity logs
  window.supabase
    .from('ticket_activity_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('action_type', 'first_response')
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Erro activity logs:', error);
      } else {
        console.log('📝 Activity logs encontrados:', data);
        if (data && data.length > 0) {
          console.log('✅ PRIMEIRA RESPOSTA JÁ REGISTRADA!');
        } else {
          console.log('❌ Nenhuma primeira resposta registrada ainda');
        }
      }
    });

  // Verificar comentários do ticket
  window.supabase
    .from('ticket_comments_new')
    .select(`
      id, content, created_at, user_id,
      users:user_id(full_name, role)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Erro comentários:', error);
      } else {
        console.log('💬 Comentários encontrados:', data);
        
        // Verificar ticket info
        return window.supabase
          .from('tickets_new')
          .select('user_id')
          .eq('id', ticketId)
          .single();
      }
    })
    .then(({ data: ticket, error }) => {
      if (error) {
        console.error('❌ Erro ticket info:', error);
      } else {
        console.log('📋 Ticket criado por user_id:', ticket.user_id);
      }
    });

} else {
  console.log('❌ Supabase client não encontrado no window');
  console.log('🔧 Tentando outras abordagens...');
  
  // Verificar se DatabaseService está disponível
  if (window.DatabaseService) {
    console.log('✅ DatabaseService encontrado');
    window.DatabaseService.detectFirstAgentResponse(ticketId)
      .then(result => {
        console.log('🎯 detectFirstAgentResponse resultado:', result);
      })
      .catch(e => console.error('❌ Erro:', e));
  } else {
    console.log('❌ DatabaseService também não encontrado');
  }
}

console.log(`
🔍 COMO USAR:
1. Substitua 'YOUR_TICKET_ID' pelo ID real do ticket
2. Envie uma mensagem no chat como admin/agent
3. Execute este script no console
4. Aguarde os resultados

✅ SE FUNCIONAR: Você verá "PRIMEIRA RESPOSTA JÁ REGISTRADA!"
❌ SE NÃO FUNCIONAR: Verá "Nenhuma primeira resposta registrada ainda"
`); 