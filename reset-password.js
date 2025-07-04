import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE1MjIyNiwiZXhwIjoyMDY0NzI4MjI2fQ.lPSTZzWlHXVOKUNeBIGkqFKvJ0j-eMXgE_L3gvWzuQo";

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetUserPassword() {
  console.log('🔑 Tentando redefinir senha do usuário...');
  
  try {
    // Try to update user password using admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      '8f0f4e4f-e6b9-4c94-b67f-c3574ee4bb15',
      { password: '123456' }
    );
    
    if (error) {
      console.error('❌ Erro ao redefinir senha:', error);
    } else {
      console.log('✅ Senha redefinida com sucesso para: 123456');
      console.log('Data:', data);
    }
  } catch (error) {
    console.error('❌ Erro na operação:', error);
  }
  
  // Also try to check user details
  try {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      '8f0f4e4f-e6b9-4c94-b67f-c3574ee4bb15'
    );
    
    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
    } else {
      console.log('👤 Detalhes do usuário:');
      console.log('  Email:', userData.user?.email);
      console.log('  Confirmado:', userData.user?.email_confirmed_at ? 'SIM' : 'NÃO');
      console.log('  Criado em:', userData.user?.created_at);
      console.log('  Último login:', userData.user?.last_sign_in_at || 'NUNCA');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar detalhes:', error);
  }
}

resetUserPassword(); 