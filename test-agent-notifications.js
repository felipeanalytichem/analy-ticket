import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cWpxanFqcWpxanFqcWpxanFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNjI4NzQsImV4cCI6MjA1MTgzODg3NH0.example';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAgentNotifications() {
  try {
    console.log('🔔 Testing Agent Notifications System...');

    // 1. Buscar um agente
    const { data: agents, error: agentsError } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'agent')
      .limit(1);

    if (agentsError || !agents || agents.length === 0) {
      console.error('❌ No agents found:', agentsError);
      return;
    }

    const agent = agents[0];
    console.log('👤 Found agent:', agent.full_name, agent.email);

    // 2. Buscar um ticket atribuído ao agente
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets_new')
      .select('id, ticket_number, title, status')
      .eq('assigned_to', agent.id)
      .limit(1);

    if (ticketsError) {
      console.error('❌ Error fetching tickets:', ticketsError);
      return;
    }

    let ticketId;
    if (tickets && tickets.length > 0) {
      ticketId = tickets[0].id;
      console.log('🎫 Found assigned ticket:', tickets[0].ticket_number || tickets[0].id);
    } else {
      // Criar um ticket de teste se não houver nenhum
      const { data: newTicket, error: createError } = await supabase
        .from('tickets_new')
        .insert({
          title: 'Teste de Notificação para Agente',
          description: 'Este é um ticket de teste para verificar as notificações do agente.',
          status: 'open',
          priority: 'medium',
          user_id: agent.id, // Usando o próprio agente como usuário para teste
          assigned_to: agent.id
        })
        .select('id, ticket_number')
        .single();

      if (createError) {
        console.error('❌ Error creating test ticket:', createError);
        return;
      }

      ticketId = newTicket.id;
      console.log('🎫 Created test ticket:', newTicket.ticket_number || newTicket.id);
    }

    // 3. Criar notificações de teste
    const testNotifications = [
      {
        user_id: agent.id,
        type: 'ticket_assigned',
        title: 'Novo Ticket Atribuído',
        message: `Ticket foi atribuído para você`,
        ticket_id: ticketId,
        read: false,
        priority: 'medium'
      },
      {
        user_id: agent.id,
        type: 'comment_added',
        title: 'Nova Resposta do Cliente',
        message: `Cliente respondeu no ticket`,
        ticket_id: ticketId,
        read: false,
        priority: 'medium'
      },
      {
        user_id: agent.id,
        type: 'ticket_updated',
        title: 'Ticket Atualizado',
        message: `Ticket foi atualizado`,
        ticket_id: ticketId,
        read: false,
        priority: 'low'
      }
    ];

    console.log('📝 Creating test notifications...');
    const { data: createdNotifications, error: notificationError } = await supabase
      .from('notifications')
      .insert(testNotifications)
      .select('*');

    if (notificationError) {
      console.error('❌ Error creating notifications:', notificationError);
      return;
    }

    console.log('✅ Created', createdNotifications.length, 'test notifications');

    // 4. Verificar se as notificações foram criadas
    const { data: agentNotifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      return;
    }

    console.log('📋 Agent notifications:');
    agentNotifications.forEach((notification, index) => {
      console.log(`  ${index + 1}. ${notification.title} - ${notification.read ? 'READ' : 'UNREAD'}`);
    });

    // 5. Testar marcar como lida
    if (createdNotifications.length > 0) {
      const firstNotification = createdNotifications[0];
      console.log('📖 Marking first notification as read...');
      
      const { error: markReadError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', firstNotification.id);

      if (markReadError) {
        console.error('❌ Error marking notification as read:', markReadError);
      } else {
        console.log('✅ Notification marked as read successfully');
      }
    }

    console.log('🎉 Agent notifications test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Executar o teste
testAgentNotifications(); 