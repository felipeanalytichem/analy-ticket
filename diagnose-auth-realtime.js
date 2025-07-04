// Diagnóstico de Autenticação e Real-time
// Execute este script no console do navegador para diagnosticar problemas

const diagnoseAuthAndRealtime = async () => {
  console.log('🔍 Iniciando diagnóstico de autenticação e real-time...\n');

  try {
    // 1. Verificar variáveis de ambiente
    console.log('📋 1. Verificando variáveis de ambiente:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Definida' : '❌ Não definida');
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Definida' : '❌ Não definida');
    console.log('');

    // 2. Verificar conexão com Supabase
    console.log('🔌 2. Verificando conexão com Supabase:');
    const { supabase } = await import('./src/lib/supabase.ts');
    console.log('Cliente Supabase:', supabase ? '✅ Criado' : '❌ Falha na criação');
    console.log('');

    // 3. Verificar autenticação atual
    console.log('🔐 3. Verificando estado de autenticação:');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('❌ Erro ao obter sessão:', sessionError);
      return;
    }

    if (session) {
      console.log('✅ Usuário autenticado:', session.user.email);
      console.log('🕐 Sessão expira em:', new Date(session.expires_at * 1000));
      console.log('🔑 Token válido:', session.access_token ? 'Sim' : 'Não');
      
      // Verificar se o token está expirado
      const now = Math.floor(Date.now() / 1000);
      const isExpired = session.expires_at < now;
      console.log('⏰ Token expirado:', isExpired ? '❌ Sim' : '✅ Não');
      
      if (isExpired) {
        console.log('🔄 Tentando renovar token...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        console.log('Renovação:', refreshError ? '❌ Falhou' : '✅ Sucesso');
      }
    } else {
      console.log('❌ Nenhuma sessão ativa');
      return;
    }
    console.log('');

    // 4. Verificar perfil do usuário
    console.log('👤 4. Verificando perfil do usuário:');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.log('❌ Erro ao carregar perfil:', profileError);
      
      // Verificar se é erro de permissão
      if (profileError.code === 'PGRST301' || profileError.message?.includes('Not Acceptable')) {
        console.log('⚠️ Possível conflito de autenticação detectado');
        console.log('💡 Tente fazer logout e login novamente');
      }
    } else {
      console.log('✅ Perfil carregado:', profile.email);
      console.log('🏷️ Role:', profile.role);
    }
    console.log('');

    // 5. Verificar conexão real-time
    console.log('📡 5. Verificando conexão real-time:');
    
    // Verificar estado da conexão real-time
    const realtimeStatus = supabase.realtime.isConnected();
    console.log('Status da conexão real-time:', realtimeStatus ? '✅ Conectado' : '❌ Desconectado');
    
    // Testar subscription simples
    console.log('🧪 Testando subscription real-time...');
    const testChannel = supabase
      .channel('test-subscription')
      .subscribe((status) => {
        console.log('📡 Status da subscription de teste:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time funcionando corretamente');
          testChannel.unsubscribe();
        } else if (status === 'CLOSED') {
          console.log('❌ Subscription fechada inesperadamente');
          console.log('💡 Possível problema de permissões ou configuração');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Erro na subscription');
          console.log('💡 Verifique as políticas RLS no Supabase');
        }
      });

    // 6. Verificar armazenamento local
    console.log('💾 6. Verificando armazenamento local:');
    const localStorage_session = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
    console.log('Sessão no localStorage:', localStorage_session ? '✅ Encontrada' : '❌ Não encontrada');
    
    // 7. Verificar configurações do AuthContext
    console.log('🔧 7. Verificando configurações de autenticação:');
    console.log('autoRefreshToken: Habilitado');
    console.log('persistSession: Habilitado');
    console.log('sessionTimeout: 24 horas');
    console.log('');

    // 8. Recomendações
    console.log('💡 8. Recomendações:');
    if (!session) {
      console.log('- Faça login novamente');
    } else if (profileError) {
      console.log('- Execute o script de limpeza de conflitos');
      console.log('- Verifique as políticas RLS no Supabase');
    } else if (!realtimeStatus) {
      console.log('- Verifique a conexão com a internet');
      console.log('- Verifique as configurações de real-time no Supabase');
    } else {
      console.log('✅ Tudo parece estar funcionando corretamente');
    }

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
  }
};

// Auto-executar se estiver no console
if (typeof window !== 'undefined') {
  console.log('🔧 Script de diagnóstico carregado. Execute: diagnoseAuthAndRealtime()');
  window.diagnoseAuthAndRealtime = diagnoseAuthAndRealtime;
}

export { diagnoseAuthAndRealtime }; 