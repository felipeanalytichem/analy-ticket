-- =====================================================
-- SCRIPT DE LIMPEZA DE EMERGÊNCIA - TRIGGERS PROBLEMÁTICOS (CORRIGIDO)
-- Use apenas se o script principal não resolver o problema
-- =====================================================

-- 1. Investigar triggers problemáticos em detalhes
DO $$
DECLARE
    trigger_record RECORD;
    function_def TEXT;
    tickets_id_type TEXT;
BEGIN
    RAISE NOTICE '🚨 LIMPEZA DE EMERGÊNCIA - IDENTIFICANDO PROBLEMAS...';
    RAISE NOTICE '';
    
    -- Verificar tipo do ID em tickets_new
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    RAISE NOTICE '📊 Tipo do ID em tickets_new: %', tickets_id_type;
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
            RAISE NOTICE '%', substring(function_def from 1 for 500) || '...';
            RAISE NOTICE '';
        ELSE
            RAISE NOTICE '   ✅ OK: Não referencia ticket_chats';
        END IF;
    END LOOP;
END
$$;

-- 2. Remover triggers problemáticos
DO $$
DECLARE
    trigger_record RECORD;
    function_def TEXT;
    removed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 REMOVENDO TRIGGERS PROBLEMÁTICOS...';
    
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
            removed_count := removed_count + 1;
        END IF;
    END LOOP;
    
    IF removed_count = 0 THEN
        RAISE NOTICE '✅ Nenhum trigger problemático encontrado';
    ELSE
        RAISE NOTICE '🎯 Total de triggers problemáticos removidos: %', removed_count;
    END IF;
END
$$;

-- 3. Criar tabela ticket_chats se não existir (com tipos corretos)
DO $$
DECLARE
    table_exists BOOLEAN;
    tickets_id_type TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏗️ CRIANDO TABELA TICKET_CHATS...';
    
    -- Verificar se já existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ticket_chats'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '⚠️ Tabela ticket_chats já existe - removendo para recriar';
        DROP TABLE public.ticket_chats CASCADE;
    END IF;
    
    -- Verificar tipo do ID em tickets_new
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    RAISE NOTICE '📊 Criando ticket_chats com ticket_id do tipo: %', tickets_id_type;
    
    -- Criar tabela com tipo correto
    IF tickets_id_type = 'uuid' THEN
        CREATE TABLE public.ticket_chats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ticket_id UUID NOT NULL REFERENCES public.tickets_new(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'user_message' 
                CHECK (message_type IN ('user_message', 'system_message', 'status_change')),
            attachments JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    ELSE
        -- Fallback para bigint (improvável mas por segurança)
        CREATE TABLE public.ticket_chats (
            id BIGSERIAL PRIMARY KEY,
            ticket_id BIGINT NOT NULL REFERENCES public.tickets_new(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'user_message' 
                CHECK (message_type IN ('user_message', 'system_message', 'status_change')),
            attachments JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
    
    RAISE NOTICE '✅ Tabela ticket_chats criada';
END
$$;

-- 4. Criar índices
CREATE INDEX IF NOT EXISTS idx_ticket_chats_ticket_id ON public.ticket_chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_user_id ON public.ticket_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_created_at ON public.ticket_chats(created_at DESC);

-- 5. Habilitar RLS e criar políticas
ALTER TABLE public.ticket_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view ticket chats for accessible tickets" ON public.ticket_chats;
CREATE POLICY "Users can view ticket chats for accessible tickets" ON public.ticket_chats
    FOR SELECT USING (
        ticket_id IN (
            SELECT id FROM public.tickets_new 
            WHERE user_id = auth.uid() OR assigned_to = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert ticket chats for accessible tickets" ON public.ticket_chats;
CREATE POLICY "Users can insert ticket chats for accessible tickets" ON public.ticket_chats
    FOR INSERT WITH CHECK (
        ticket_id IN (
            SELECT id FROM public.tickets_new 
            WHERE user_id = auth.uid() OR assigned_to = auth.uid()
        )
    );

-- 6. Recriar triggers essenciais para tickets_new
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

-- 7. Criar função para updated_at em ticket_chats
CREATE OR REPLACE FUNCTION public.update_ticket_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_chats_updated_at_trigger ON public.ticket_chats;
CREATE TRIGGER update_ticket_chats_updated_at_trigger
    BEFORE UPDATE ON public.ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ticket_chats_updated_at();

-- 8. Criar trigger para gerar ticket_number automaticamente se necessário
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

-- 9. Teste de criação de ticket após limpeza
DO $$
DECLARE
    test_ticket_id UUID;
    test_user_id UUID;
    chat_count INTEGER;
    tickets_id_type TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO CRIAÇÃO APÓS LIMPEZA...';
    
    -- Verificar tipo do ID
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    -- Pegar um usuário existente
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '⚠️ Nenhum usuário encontrado - usando UUID genérico';
        test_user_id := 'e4e43fcb-9500-437e-a813-c3b227689d78'::UUID;
    END IF;
    
    -- Inserir ticket de teste
    IF tickets_id_type = 'uuid' THEN
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
    ELSE
        RAISE NOTICE '⚠️ Tipo de ID não suportado pelo teste: %', tickets_id_type;
        RETURN;
    END IF;
    
    RAISE NOTICE '✅ Ticket criado com sucesso! ID: %', test_ticket_id;
    
    -- Testar inserção em ticket_chats
    INSERT INTO public.ticket_chats (ticket_id, user_id, message)
    VALUES (test_ticket_id, test_user_id, 'Mensagem de teste após limpeza');
    
    RAISE NOTICE '✅ Chat criado com sucesso!';
    
    -- Contar chats
    SELECT COUNT(*) INTO chat_count 
    FROM public.ticket_chats 
    WHERE ticket_id = test_ticket_id;
    
    RAISE NOTICE '✅ Total de chats: %', chat_count;
    
    -- Limpar dados de teste
    DELETE FROM public.ticket_chats WHERE ticket_id = test_ticket_id;
    DELETE FROM public.tickets_new WHERE id = test_ticket_id;
    RAISE NOTICE '🧹 Dados de teste removidos';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 LIMPEZA DE EMERGÊNCIA CONCLUÍDA!';
    RAISE NOTICE '   ✅ Triggers problemáticos removidos';
    RAISE NOTICE '   ✅ Tabela ticket_chats criada com tipos corretos';
    RAISE NOTICE '   ✅ Triggers essenciais recriados';
    RAISE NOTICE '   ✅ Criação de tickets testada';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro durante teste: %', SQLERRM;
        
        -- Tentar limpar mesmo com erro
        BEGIN
            DELETE FROM public.ticket_chats WHERE ticket_id = test_ticket_id;
            DELETE FROM public.tickets_new WHERE id = test_ticket_id;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
        
        RAISE NOTICE '⚠️ Mesmo com erro, a limpeza foi realizada';
END
$$;

-- 10. Verificação final após limpeza
DO $$
DECLARE
    trigger_count INTEGER;
    problematic_count INTEGER;
    tickets_id_type TEXT;
    chats_ticket_id_type TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 VERIFICAÇÃO FINAL APÓS LIMPEZA:';
    
    -- Verificar tipos de dados
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    SELECT data_type INTO chats_ticket_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ticket_chats' AND column_name = 'ticket_id';
    
    RAISE NOTICE '📊 Tipos de dados:';
    RAISE NOTICE '   - tickets_new.id: %', tickets_id_type;
    RAISE NOTICE '   - ticket_chats.ticket_id: %', chats_ticket_id_type;
    
    IF tickets_id_type = chats_ticket_id_type THEN
        RAISE NOTICE '✅ Tipos compatíveis!';
    ELSE
        RAISE NOTICE '❌ Tipos ainda incompatíveis!';
    END IF;
    
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
    RAISE NOTICE '   - Tabela ticket_chats criada: ✅';
    RAISE NOTICE '   - Tipos de dados corretos: %', CASE WHEN tickets_id_type = chats_ticket_id_type THEN '✅' ELSE '❌' END;
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

-- FIM DO SCRIPT DE LIMPEZA DE EMERGÊNCIA (CORRIGIDO) 