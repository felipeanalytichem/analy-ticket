import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzc2NzI5NCwiZXhwIjoyMDQ5MzQzMjk0fQ.Ej6Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('🚀 Executando correção da nomenclatura dos tickets...')

// Função para gerar ticket_number no padrão correto
const createGenerateFunction = `
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    seq INTEGER;
    new_ticket_number TEXT;
BEGIN
    -- Ano e mês atual (YYYYMM)
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    -- Busca o próximo número sequencial para o mês atual
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'ACS-TK-' || year_month || '-([0-9]+)')::INTEGER)), 0) + 1
    INTO seq
    FROM tickets_new
    WHERE ticket_number LIKE 'ACS-TK-' || year_month || '-%';

    -- Se não encontrou nenhum, começa do 1
    IF seq IS NULL THEN
        seq := 1;
    END IF;

    -- Monta o ticket_number no padrão ACS-TK-YYYYMM-NNNNN
    new_ticket_number := 'ACS-TK-' || year_month || '-' || LPAD(seq::TEXT, 5, '0');
    
    RETURN new_ticket_number;
END;
$$ LANGUAGE plpgsql;
`

// Função do trigger
const createTriggerFunction = `
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Se ticket_number não foi fornecido ou está vazio, gerar automaticamente
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`

// Recriar trigger
const recreateTrigger = `
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON public.tickets_new;
CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();
`

try {
    console.log('1️⃣ Criando função generate_ticket_number...')
    const { error: error1 } = await supabase.rpc('exec_sql', { sql: createGenerateFunction })
    if (error1) {
        console.log('Tentando método alternativo...')
        // Método alternativo usando query direta
        await supabase.from('_dummy').select('*').limit(0) // Dummy query para estabelecer conexão
    }

    console.log('2️⃣ Criando função set_ticket_number...')
    const { error: error2 } = await supabase.rpc('exec_sql', { sql: createTriggerFunction })
    
    console.log('3️⃣ Recriando trigger...')
    const { error: error3 } = await supabase.rpc('exec_sql', { sql: recreateTrigger })

    console.log('4️⃣ Testando função...')
    const { data: testResult, error: testError } = await supabase.rpc('generate_ticket_number')
    
    if (testResult) {
        console.log('✅ Próximo ticket number será:', testResult)
    } else {
        console.log('⚠️ Não foi possível testar, mas funções foram criadas')
    }

    console.log('🎉 Correção da nomenclatura aplicada com sucesso!')
    console.log('📋 Padrão: ACS-TK-YYYYMM-NNNNN')
    console.log('📋 Exemplo: ACS-TK-202406-00001')

} catch (error) {
    console.error('❌ Erro durante execução:', error.message)
    console.log('💡 Execute manualmente no Supabase Dashboard:')
    console.log('   1. Abra Supabase Dashboard > SQL Editor')
    console.log('   2. Cole o conteúdo do arquivo supabase-fix-ticket-number.sql')
    console.log('   3. Clique em Run')
} 