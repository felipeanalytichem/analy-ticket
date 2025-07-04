import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pjuafgoklmvgckkkrnft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdWFmZ29rbG12Z2Nra2tybmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMTA4NTUsImV4cCI6MjA2NDc4Njg1NX0.iqGSfeY3XZ-4nhCeDn9QVt1H2ke6APNS4pDGn_YYWUg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUsers() {
  try {
    console.log('🔍 Debugando tabela users...');
    
    // Check with different methods
    console.log('\n1️⃣ Verificando com select simples:');
    const { data: users1, error: error1, count: count1 } = await supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    console.log(`   Resultado: ${users1?.length || 0} usuários`);
    console.log(`   Count: ${count1}`);
    if (error1) console.log(`   Erro: ${error1.message}`);
    
    console.log('\n2️⃣ Verificando com select específico:');
    const { data: users2, error: error2 } = await supabase
      .from('users')
      .select('id, email, name, role, created_at');
    
    console.log(`   Resultado: ${users2?.length || 0} usuários`);
    if (error2) console.log(`   Erro: ${error2.message}`);
    
    console.log('\n3️⃣ Verificando com RPC (se existir):');
    try {
      const { data: users3, error: error3 } = await supabase
        .rpc('get_all_users');
      
      console.log(`   Resultado: ${users3?.length || 0} usuários`);
      if (error3) console.log(`   Erro: ${error3.message}`);
    } catch (e) {
      console.log('   RPC não existe (normal)');
    }
    
    console.log('\n4️⃣ Verificando IDs específicos da imagem:');
    const specificIds = [
      '2825d8d1-8bab-4916-9416-f97dc4d81c0f',
      '6bd471bb-f318-4bfc-9e68-25ea7688292b',
      'bec1a531-0038-4441-ba9a-90944ddc66e9'
    ];
    
    for (const id of specificIds) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      console.log(`   ID ${id}: ${user ? 'EXISTE' : 'NÃO EXISTE'}`);
      if (user) {
        console.log(`     Email: ${user.email}`);
        console.log(`     Nome: ${user.name}`);
      }
      if (error) console.log(`     Erro: ${error.message}`);
    }
    
    console.log('\n5️⃣ Verificando emails específicos:');
    const specificEmails = [
      'eumesmo.felipe@outlook.com',
      'felipe.henrique_6bd471bb@analytichem.com',
      'felipe.henrique@analytichem.com'
    ];
    
    for (const email of specificEmails) {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      
      console.log(`   Email ${email}: ${user ? 'EXISTE' : 'NÃO EXISTE'}`);
      if (user) {
        console.log(`     ID: ${user.id}`);
        console.log(`     Nome: ${user.name}`);
      }
      if (error) console.log(`     Erro: ${error.message}`);
    }
    
    console.log('\n6️⃣ Tentando deletar IDs específicos:');
    for (const id of specificIds) {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.log(`   ❌ Erro ao deletar ${id}: ${error.message}`);
      } else {
        console.log(`   ✅ Deletado ${id} (se existia)`);
      }
    }
    
    console.log('\n7️⃣ Verificação final:');
    const { data: finalUsers, error: finalError } = await supabase
      .from('users')
      .select('*');
    
    console.log(`   Usuários restantes: ${finalUsers?.length || 0}`);
    if (finalUsers && finalUsers.length > 0) {
      finalUsers.forEach(user => {
        console.log(`     - ${user.email} (${user.id})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro durante debug:', error);
  }
}

debugUsers(); 