import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjuafgoklmvgckkkrnft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdWFmZ29rbG12Z2Nra2tybmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTA4NTUsImV4cCI6MjA2NDc4Njg1NX0.iqGSfeY3XZ-4nhCeDn9QVt1H2ke6APNS4pDGn_YYWUg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceCleanup() {
  try {
    console.log('🧹 Forçando limpeza completa da tabela users...');
    
    // First, let's see what's in the table
    const { data: allUsers, error: selectError } = await supabase
      .from('users')
      .select('*');
    
    if (selectError) {
      console.error('❌ Erro ao buscar usuários:', selectError);
      return;
    }
    
    console.log(`📊 Encontrados ${allUsers?.length || 0} usuários na tabela:`);
    allUsers?.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });
    
    if (!allUsers || allUsers.length === 0) {
      console.log('✅ Tabela já está vazia!');
      return;
    }
    
    // Try different deletion strategies
    console.log('\n🗑️ Tentativa 1: Deletar todos com condição gt');
    const { error: deleteError1 } = await supabase
      .from('users')
      .delete()
      .gt('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError1) {
      console.error('❌ Erro na tentativa 1:', deleteError1);
      
      console.log('\n🗑️ Tentativa 2: Deletar todos com condição lt');
      const { error: deleteError2 } = await supabase
        .from('users')
        .delete()
        .lt('created_at', '2030-01-01');
      
      if (deleteError2) {
        console.error('❌ Erro na tentativa 2:', deleteError2);
        
        console.log('\n🗑️ Tentativa 3: Deletar um por um');
        for (const user of allUsers) {
          console.log(`Deletando ${user.email}...`);
          const { error: deleteError3 } = await supabase
            .from('users')
            .delete()
            .eq('id', user.id);
          
          if (deleteError3) {
            console.error(`❌ Erro ao deletar ${user.email}:`, deleteError3);
          } else {
            console.log(`✅ ${user.email} deletado com sucesso`);
          }
        }
      } else {
        console.log('✅ Tentativa 2 bem-sucedida!');
      }
    } else {
      console.log('✅ Tentativa 1 bem-sucedida!');
    }
    
    // Verify the cleanup
    const { data: remainingUsers, error: verifyError } = await supabase
      .from('users')
      .select('*');
    
    if (verifyError) {
      console.error('❌ Erro ao verificar limpeza:', verifyError);
      return;
    }
    
    console.log(`\n📊 Usuários restantes: ${remainingUsers?.length || 0}`);
    
    if (remainingUsers && remainingUsers.length > 0) {
      console.log('⚠️ Ainda existem usuários:');
      remainingUsers.forEach(user => {
        console.log(`  - ${user.email} (ID: ${user.id})`);
      });
    } else {
      console.log('✅ Tabela users está completamente limpa!');
    }
    
  } catch (error) {
    console.error('❌ Erro durante a limpeza forçada:', error);
  }
}

forceCleanup(); 