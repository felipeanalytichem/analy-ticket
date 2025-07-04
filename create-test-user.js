import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestUser() {
  console.log('👤 Criando usuário de teste...');
  
  const testEmail = 'test.auth@example.com';
  const testPassword = 'Test123!@#';
  
  try {
    // Try to sign up a new user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    });
    
    if (error) {
      console.error('❌ Erro ao criar usuário:', error.message);
      
      // If user already exists, try to sign in
      if (error.message.includes('already registered')) {
        console.log('🔄 Usuário já existe, tentando fazer login...');
        
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });
        
        if (signInError) {
          console.error('❌ Erro no login:', signInError.message);
        } else {
          console.log('✅ Login realizado com sucesso!');
          console.log('📧 Email:', signInData.user?.email);
          console.log('🔑 ID:', signInData.user?.id);
          console.log('📅 Criado em:', signInData.user?.created_at);
          
          // Check if token is stored
          setTimeout(() => {
            const token = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
            console.log('💾 Token no localStorage:', token ? 'EXISTE' : 'NÃO EXISTE');
          }, 100);
        }
      }
    } else {
      console.log('✅ Usuário criado com sucesso!');
      console.log('📧 Email:', data.user?.email);
      console.log('🔑 ID:', data.user?.id);
      console.log('📅 Criado em:', data.user?.created_at);
      console.log('📨 Confirmação necessária:', !data.user?.email_confirmed_at);
      
      if (data.session) {
        console.log('🎯 Sessão criada automaticamente!');
        
        // Check if token is stored
        setTimeout(() => {
          const token = localStorage.getItem('sb-plbmgjqitlxedsmdqpld-auth-token');
          console.log('💾 Token no localStorage:', token ? 'EXISTE' : 'NÃO EXISTE');
        }, 100);
      }
    }
    
  } catch (error) {
    console.error('💥 Erro inesperado:', error);
  }
}

createTestUser(); 