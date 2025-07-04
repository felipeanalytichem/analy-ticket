// 🔍 Debug Script SLA - Detecção Primeira Resposta
// Execute este script no console do browser (F12) após enviar uma mensagem no chat

// SUBSTITUA AQUI O ID DO SEU TICKET DE TESTE
const TICKET_ID = 'SEU_TICKET_ID_AQUI';

console.log('🚀 Iniciando debug SLA...');

// 1. Verificar dados do ticket
console.log('📋 1. Verificando dados do ticket...');
fetch('/api/supabase/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      SELECT t.id, t.status, t.user_id, t.created_at,
             u.full_name as creator_name, u.role as creator_role
      FROM tickets_new t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = '${TICKET_ID}'
    `
  })
}).then(r => r.json()).then(data => {
  console.log('📋 Dados do ticket:', data);
}).catch(e => console.error('❌ Erro ticket:', e));

// 2. Verificar logs de primeira resposta
console.log('📝 2. Verificando activity logs...');
fetch('/api/supabase/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      SELECT id, action_type, new_value, created_at, user_id
      FROM ticket_activity_logs
      WHERE ticket_id = '${TICKET_ID}'
      AND action_type = 'first_response'
      ORDER BY created_at ASC
    `
  })
}).then(r => r.json()).then(data => {
  console.log('📝 Activity logs (first_response):', data);
}).catch(e => console.error('❌ Erro logs:', e));

// 3. Verificar comentários
console.log('💬 3. Verificando comentários...');
fetch('/api/supabase/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      SELECT c.id, c.content, c.created_at, c.user_id,
             u.full_name, u.role
      FROM ticket_comments_new c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = '${TICKET_ID}'
      ORDER BY c.created_at ASC
    `
  })
}).then(r => r.json()).then(data => {
  console.log('💬 Comentários:', data);
}).catch(e => console.error('❌ Erro comentários:', e));

// 4. Testar função detectFirstAgentResponse
console.log('🎯 4. Testando detectFirstAgentResponse...');
setTimeout(() => {
  // Simular chamada da função (se DatabaseService estiver disponível)
  if (window.DatabaseService || window.db) {
    const db = window.DatabaseService || window.db;
    db.detectFirstAgentResponse(TICKET_ID).then(result => {
      console.log('🎯 detectFirstAgentResponse resultado:', result);
    }).catch(e => console.error('❌ Erro detectFirstAgentResponse:', e));
  } else {
    console.log('❌ DatabaseService não disponível no window');
  }
}, 2000);

console.log(`
🔍 INSTRUÇÕES:
1. Substitua TICKET_ID pelo ID do seu ticket de teste
2. Abra o ticket no browser
3. Envie uma mensagem no chat como admin/agent
4. Execute este script no console
5. Verifique os resultados de cada seção

📝 O que procurar:
- Activity logs devem mostrar entrada com action_type: 'first_response'
- Comentários devem mostrar mensagem do agent/admin
- detectFirstAgentResponse deve retornar uma data
`); 