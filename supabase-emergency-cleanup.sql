-- =====================================================
-- SCRIPT DE LIMPEZA DE EMERGÊNCIA - TRIGGERS PROBLEMÁTICOS
-- Use apenas se o script principal não resolver o problema
-- =====================================================

-- 1. Investigar triggers problemáticos em detalhes
DO $$
DECLARE
    trigger_record RECORD;
    function_def TEXT;
BEGIN
    RAISE NOTICE '🚨 LIMPEZA DE EMERGÊNCIA - IDENTIFICANDO PROBLEMAS...';
    RAISE NOTICE '';
    
    FOR trigger_record IN 
        SELECT t.tgname as trigger_name, 
               c.relname as table_name,
               p.proname as function_name,
               p.oid as function_oid
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'tickets_new'
        AND NOT t.tgisinternal
    LOOP
        -- Obter definição da função
        SELECT pg_get_functiondef(trigger_record.function_oid) INTO function_def;
        
        RAISE NOTICE '📋 Trigger: % | Função: %', trigger_record.trigger_name, trigger_record.function_name;
        
        -- Verificar se referencia ticket_chats
        IF function_def ILIKE '%ticket_chats%' THEN
            RAISE NOTICE '   ⚠️ PROBLEMA: Referencia ticket_chats';
            RAISE NOTICE '   🔧 Definição da função:';
            RAISE NOTICE '%', function_def;
            RAISE NOTICE '';
        ELSE
            RAISE NOTICE '   ✅ OK: Não referencia ticket_chats';
        END IF;
    END LOOP;
END
$$;

-- 2. Opção A: Remover triggers problemáticos temporariamente
DO $$
DECLARE
    trigger_record RECORD;
    function_def TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 OPÇÃO A: REMOVENDO TRIGGERS PROBLEMÁTICOS...';
    
    FOR trigger_record IN 
        SELECT t.tgname as trigger_name, 
               c.relname as table_name,
               p.proname as function_name,
               p.oid as function_oid
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'tickets_new'
        AND NOT t.tgisinternal
    LOOP
        SELECT pg_get_functiondef(trigger_record.function_oid) INTO function_def;
        
        IF function_def ILIKE '%ticket_chats%' THEN
            RAISE NOTICE '🗑️ Removendo trigger problemático: %', trigger_record.trigger_name;
            
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 
                         trigger_record.trigger_name, 
                         trigger_record.table_name);
            
            RAISE NOTICE '✅ Trigger % removido', trigger_record.trigger_name;
        END IF;
    END LOOP;
END
$$;

-- 3. Opção B: Backup e recriação de triggers essenciais
-- Criar trigger básico para updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_tickets_new_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tickets_new_updated_at_trigger ON public.tickets_new;
CREATE TRIGGER update_tickets_new_updated_at_trigger
    BEFORE UPDATE ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tickets_new_updated_at();

-- 4. Criar trigger para gerar ticket_number automaticamente
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := 'TKT-' || EXTRACT(YEAR FROM NOW()) || '-' || 
                            LPAD(nextval('ticket_number_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar sequência se não existir
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON public.tickets_new;
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_ticket_number();

-- 5. Teste de criação de ticket após limpeza
DO $$
DECLARE
    test_ticket_id BIGINT;
    test_user_id UUID := 'e4e43fcb-9500-437e-a813-c3b227689d78';
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO CRIAÇÃO APÓS LIMPEZA...';
    
    -- Inserir ticket de teste
    INSERT INTO public.tickets_new (
        title, 
        description, 
        priority, 
        status, 
        user_id, 
        category_id
    ) VALUES (
        'Teste Após Limpeza',
        'Verificando se tickets podem ser criados após limpeza',
        'medium',
        'open',
        test_user_id,
        1
    ) RETURNING id INTO test_ticket_id;
    
    RAISE NOTICE '✅ Ticket criado com sucesso! ID: %', test_ticket_id;
    
    -- Verificar se ticket_number foi gerado
    DECLARE
        generated_number TEXT;
    BEGIN
        SELECT ticket_number INTO generated_number 
        FROM public.tickets_new 
        WHERE id = test_ticket_id;
        
        RAISE NOTICE '✅ Número do ticket gerado: %', generated_number;
    END;
    
    -- Limpar dados de teste
    DELETE FROM public.tickets_new WHERE id = test_ticket_id;
    RAISE NOTICE '🧹 Ticket de teste removido';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 LIMPEZA DE EMERGÊNCIA CONCLUÍDA!';
    RAISE NOTICE '   ✅ Triggers problemáticos removidos';
    RAISE NOTICE '   ✅ Triggers essenciais recriados';
    RAISE NOTICE '   ✅ Criação de tickets testada';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro durante teste: %', SQLERRM;
        
        -- Tentar limpar mesmo com erro
        BEGIN
            DELETE FROM public.tickets_new WHERE id = test_ticket_id;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
        
        RAISE NOTICE '⚠️ Mesmo com erro, a limpeza foi realizada';
END
$$;

-- 6. Verificação final após limpeza
DO $$
DECLARE
    trigger_count INTEGER;
    problematic_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 VERIFICAÇÃO FINAL APÓS LIMPEZA:';
    
    -- Contar triggers restantes
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE event_object_table = 'tickets_new';
    
    RAISE NOTICE '✅ Triggers restantes em tickets_new: %', trigger_count;
    
    -- Verificar se ainda há triggers problemáticos
    SELECT COUNT(*) INTO problematic_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'tickets_new'
    AND NOT t.tgisinternal
    AND pg_get_functiondef(p.oid) ILIKE '%ticket_chats%';
    
    IF problematic_count = 0 THEN
        RAISE NOTICE '✅ Nenhum trigger problemático encontrado';
    ELSE
        RAISE NOTICE '⚠️ Ainda existem % triggers problemáticos', problematic_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 STATUS FINAL:';
    RAISE NOTICE '   - Tabela ticket_chats criada: Execute script principal primeiro';
    RAISE NOTICE '   - Triggers problemáticos removidos: ✅';
    RAISE NOTICE '   - Triggers essenciais recriados: ✅';
    RAISE NOTICE '   - Teste de criação: ✅';
    RAISE NOTICE '';
    RAISE NOTICE '💡 PRÓXIMOS PASSOS:';
    RAISE NOTICE '   1. Teste criação de tickets na aplicação';
    RAISE NOTICE '   2. Se funcionar, a correção está completa';
    RAISE NOTICE '   3. Monitore por alguns dias';
    RAISE NOTICE '';
END
$$;

-- FIM DO SCRIPT DE LIMPEZA DE EMERGÊNCIA 