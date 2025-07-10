import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjI1NzI5NCwiZXhwIjoyMDUxODMzMjk0fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeAutoCloseScript() {
  try {
    console.log('🔄 Executando script de fechamento automático...');
    
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('supabase-auto-close-resolved-tickets.sql', 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('SELECT \'Sistema'));
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);
          const { data, error } = await supabase.rpc('exec_sql', { sql_query: command });
          
          if (error) {
            console.error(`❌ Erro no comando ${i + 1}:`, error);
          } else {
            console.log(`✅ Comando ${i + 1} executado com sucesso`);
          }
        } catch (err) {
          console.error(`💥 Erro inesperado no comando ${i + 1}:`, err);
        }
      }
    }
    
    console.log('🎉 Script executado com sucesso!');
    
  } catch (error) {
    console.error('💥 Erro ao executar script:', error);
  }
}

executeAutoCloseScript(); 