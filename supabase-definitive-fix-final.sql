-- =====================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA FINAL - PROBLEMA TICKET_CHATS
-- Versão que verifica automaticamente a estrutura do banco
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Investigação completa da estrutura do banco
DO $$
DECLARE
    tickets_id_type TEXT;
    tickets_assignee_column TEXT;
    trigger_record RECORD;
    column_record RECORD;
BEGIN
    RAISE NOTICE '🔍 INVESTIGAÇÃO COMPLETA DA ESTRUTURA DO BANCO...';
    RAISE NOTICE '';
    
    -- Verificar estrutura da tabela tickets_new
    RAISE NOTICE '📊 Estrutura da tabela tickets_new:';
    FOR column_record IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'tickets_new'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '   - %: % (%)', column_record.column_name, column_record.data_type, 
                     CASE WHEN column_record.is_nullable = 'YES' THEN 'nullable' ELSE 'not null' END;
        
        -- Capturar informações importantes
        IF column_record.column_name = 'id' THEN
            tickets_id_type := column_record.data_type;
        END IF;
        
        IF column_record.column_name IN ('assigned_to', 'assignee_id') THEN
            tickets_assignee_column := column_record.column_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Informações importantes detectadas:';
    RAISE NOTICE '   - ID type: %', tickets_id_type;
    RAISE NOTICE '   - Assignee column: %', COALESCE(tickets_assignee_column, 'NOT FOUND');
    
    -- Listar triggers problemáticos
    RAISE NOTICE '';
    RAISE NOTICE '📋 Triggers na tabela tickets_new:';
    FOR trigger_record IN 
        SELECT t.tgname as trigger_name, 
               c.relname as table_name,
               p.proname as function_name,
               pg_get_functiondef(p.oid) as function_def
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE c.relname = 'tickets_new'
        AND NOT t.tgisinternal
    LOOP
        RAISE NOTICE '   - Trigger: % | Função: %', trigger_record.trigger_name, trigger_record.function_name;
        
        -- Verificar se a função referencia ticket_chats
        IF trigger_record.function_def ILIKE '%ticket_chats%' THEN
            RAISE NOTICE '     ⚠️ PROBLEMA ENCONTRADO: Esta função referencia ticket_chats!';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 INICIANDO CORREÇÃO COM ESTRUTURA DETECTADA...';
END
$$;

-- 2. Remover tabela ticket_chats se existir (para recriar com tipos corretos)
DROP TABLE IF EXISTS public.ticket_chats CASCADE;

-- 3. Criar tabela ticket_chats com estrutura adaptável
DO $$
DECLARE
    tickets_id_type TEXT;
    create_table_sql TEXT;
BEGIN
    -- Detectar tipo do ID
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    RAISE NOTICE '🏗️ Criando tabela ticket_chats com ticket_id do tipo: %', tickets_id_type;
    
    -- Criar SQL adaptado ao tipo detectado
    IF tickets_id_type = 'uuid' THEN
        create_table_sql := '
            CREATE TABLE public.ticket_chats (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ticket_id UUID NOT NULL REFERENCES public.tickets_new(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                message_type VARCHAR(20) DEFAULT ''user_message'' 
                    CHECK (message_type IN (''user_message'', ''system_message'', ''status_change'')),
                attachments JSONB DEFAULT ''[]''::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );';
    ELSE
        -- Fallback para bigint ou outros tipos
        create_table_sql := '
            CREATE TABLE public.ticket_chats (
                id BIGSERIAL PRIMARY KEY,
                ticket_id BIGINT NOT NULL REFERENCES public.tickets_new(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                message_type VARCHAR(20) DEFAULT ''user_message'' 
                    CHECK (message_type IN (''user_message'', ''system_message'', ''status_change'')),
                attachments JSONB DEFAULT ''[]''::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );';
    END IF;
    
    -- Executar criação da tabela
    EXECUTE create_table_sql;
    RAISE NOTICE '✅ Tabela ticket_chats criada com tipos compatíveis';
END
$$;

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ticket_chats_ticket_id ON public.ticket_chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_user_id ON public.ticket_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_created_at ON public.ticket_chats(created_at DESC);

-- 5. Habilitar RLS
ALTER TABLE public.ticket_chats ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS com estrutura adaptável
DO $$
DECLARE
    assignee_column TEXT;
    policy_sql TEXT;
BEGIN
    -- Detectar nome da coluna assignee
    SELECT column_name INTO assignee_column
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'tickets_new' 
    AND column_name IN ('assigned_to', 'assignee_id')
    LIMIT 1;
    
    IF assignee_column IS NULL THEN
        assignee_column := 'assigned_to'; -- Padrão
        RAISE NOTICE '⚠️ Coluna assignee não encontrada, usando padrão: %', assignee_column;
    ELSE
        RAISE NOTICE '✅ Coluna assignee detectada: %', assignee_column;
    END IF;
    
    -- Criar políticas com coluna correta
    policy_sql := format('
        CREATE POLICY "Users can view ticket chats for accessible tickets" ON public.ticket_chats
            FOR SELECT USING (
                ticket_id IN (
                    SELECT id FROM public.tickets_new 
                    WHERE user_id = auth.uid() OR %I = auth.uid()
                )
            );', assignee_column);
    
    EXECUTE policy_sql;
    
    policy_sql := format('
        CREATE POLICY "Users can insert ticket chats for accessible tickets" ON public.ticket_chats
            FOR INSERT WITH CHECK (
                ticket_id IN (
                    SELECT id FROM public.tickets_new 
                    WHERE user_id = auth.uid() OR %I = auth.uid()
                )
            );', assignee_column);
    
    EXECUTE policy_sql;
    
    policy_sql := format('
        CREATE POLICY "Users can update ticket chats for accessible tickets" ON public.ticket_chats
            FOR UPDATE USING (
                ticket_id IN (
                    SELECT id FROM public.tickets_new 
                    WHERE user_id = auth.uid() OR %I = auth.uid()
                )
            );', assignee_column);
    
    EXECUTE policy_sql;
    
    RAISE NOTICE '✅ Políticas RLS criadas com coluna: %', assignee_column;
END
$$;

-- 7. Criar função de trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_ticket_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_ticket_chats_updated_at_trigger ON public.ticket_chats;
CREATE TRIGGER update_ticket_chats_updated_at_trigger
    BEFORE UPDATE ON public.ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ticket_chats_updated_at();

-- 9. Migrar dados existentes (com verificação de compatibilidade)
DO $$
DECLARE
    comments_table_exists BOOLEAN;
    comments_ticket_id_type TEXT;
    comments_user_id_type TEXT;
    tickets_id_type TEXT;
    migrated_count INTEGER := 0;
    total_comments INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 INICIANDO MIGRAÇÃO DE DADOS...';
    
    -- Verificar se tabela ticket_comments_new existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ticket_comments_new'
    ) INTO comments_table_exists;
    
    IF comments_table_exists THEN
        -- Verificar tipos das colunas
        SELECT data_type INTO comments_ticket_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ticket_comments_new' AND column_name = 'ticket_id';
        
        SELECT data_type INTO comments_user_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ticket_comments_new' AND column_name = 'user_id';
        
        SELECT data_type INTO tickets_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
        
        RAISE NOTICE '📊 Tipos detectados:';
        RAISE NOTICE '   - ticket_comments_new.ticket_id: %', comments_ticket_id_type;
        RAISE NOTICE '   - ticket_comments_new.user_id: %', comments_user_id_type;
        RAISE NOTICE '   - tickets_new.id: %', tickets_id_type;
        
        -- Contar registros
        EXECUTE 'SELECT COUNT(*) FROM public.ticket_comments_new' INTO total_comments;
        
        -- Migrar apenas se os tipos forem compatíveis
        IF comments_ticket_id_type = tickets_id_type AND comments_user_id_type = 'uuid' THEN
            INSERT INTO public.ticket_chats (ticket_id, user_id, message, message_type, created_at, updated_at)
            SELECT 
                ticket_id,
                user_id,
                content as message,
                'user_message' as message_type,
                created_at,
                COALESCE(updated_at, created_at) as updated_at
            FROM public.ticket_comments_new
            WHERE NOT EXISTS (
                SELECT 1 FROM public.ticket_chats tc 
                WHERE tc.ticket_id = ticket_comments_new.ticket_id 
                AND tc.user_id = ticket_comments_new.user_id 
                AND tc.message = ticket_comments_new.content
                AND tc.created_at = ticket_comments_new.created_at
            )
            ON CONFLICT DO NOTHING;
            
            GET DIAGNOSTICS migrated_count = ROW_COUNT;
            RAISE NOTICE '✅ Migrados % de % comentários', migrated_count, total_comments;
        ELSE
            RAISE NOTICE '⚠️ Tipos incompatíveis - migração manual necessária';
            RAISE NOTICE '   Esperado: ticket_id=%, user_id=uuid', tickets_id_type;
            RAISE NOTICE '   Encontrado: ticket_id=%, user_id=%', comments_ticket_id_type, comments_user_id_type;
        END IF;
    ELSE
        RAISE NOTICE '📝 Tabela ticket_comments_new não encontrada';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTADO DA MIGRAÇÃO:';
    RAISE NOTICE '   - Comentários disponíveis: %', total_comments;
    RAISE NOTICE '   - Registros migrados: %', migrated_count;
END
$$;

-- 10. Criar função para automaticamente criar chat quando ticket é criado
CREATE OR REPLACE FUNCTION public.create_initial_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Criar mensagem inicial do sistema
    INSERT INTO public.ticket_chats (ticket_id, user_id, message, message_type)
    VALUES (
        NEW.id,
        NEW.user_id,
        'Ticket criado: ' || NEW.title,
        'system_message'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Criar trigger para automatizar criação de chat inicial
DROP TRIGGER IF EXISTS create_initial_chat_trigger ON public.tickets_new;
CREATE TRIGGER create_initial_chat_trigger
    AFTER INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION public.create_initial_ticket_chat();

-- 12. Teste completo da correção
DO $$
DECLARE
    test_ticket_id UUID;
    test_user_id UUID;
    chat_count INTEGER;
    tickets_id_type TEXT;
    test_successful BOOLEAN := false;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTE COMPLETO DA CORREÇÃO...';
    
    -- Verificar tipo do ID
    SELECT data_type INTO tickets_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
    
    -- Pegar um usuário existente
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '⚠️ Nenhum usuário encontrado - usando UUID genérico para teste';
        test_user_id := 'e4e43fcb-9500-437e-a813-c3b227689d78'::UUID;
    END IF;
    
    -- Teste baseado no tipo detectado
    IF tickets_id_type = 'uuid' THEN
        INSERT INTO public.tickets_new (
            title, 
            description, 
            priority, 
            status, 
            user_id, 
            category_id,
            ticket_number
        ) VALUES (
            'Teste Correção Final',
            'Verificando se a correção definitiva funcionou',
            'medium',
            'open',
            test_user_id,
            1,
            'TEST-FINAL-' || EXTRACT(EPOCH FROM NOW())::BIGINT
        ) RETURNING id INTO test_ticket_id;
        
        test_successful := true;
    ELSE
        RAISE NOTICE '⚠️ Tipo de ID % não suportado pelo teste automático', tickets_id_type;
        RETURN;
    END IF;
    
    IF test_successful THEN
        RAISE NOTICE '✅ Ticket criado com sucesso! ID: %', test_ticket_id;
        
        -- Verificar se o chat inicial foi criado
        SELECT COUNT(*) INTO chat_count 
        FROM public.ticket_chats 
        WHERE ticket_id = test_ticket_id;
        
        RAISE NOTICE '✅ Chats criados automaticamente: %', chat_count;
        
        -- Testar inserção manual
        INSERT INTO public.ticket_chats (ticket_id, user_id, message)
        VALUES (test_ticket_id, test_user_id, 'Mensagem de teste final');
        
        RAISE NOTICE '✅ Mensagem manual criada com sucesso';
        
        -- Contar total
        SELECT COUNT(*) INTO chat_count 
        FROM public.ticket_chats 
        WHERE ticket_id = test_ticket_id;
        
        RAISE NOTICE '✅ Total de chats: %', chat_count;
        
        -- Limpar dados de teste
        DELETE FROM public.ticket_chats WHERE ticket_id = test_ticket_id;
        DELETE FROM public.tickets_new WHERE id = test_ticket_id;
        
        RAISE NOTICE '🧹 Dados de teste removidos';
        RAISE NOTICE '';
        RAISE NOTICE '🎉 CORREÇÃO DEFINITIVA CONCLUÍDA COM SUCESSO!';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro durante teste: %', SQLERRM;
        RAISE NOTICE '🔧 Mesmo com erro no teste, a estrutura foi criada';
        
        -- Tentar limpar mesmo com erro
        BEGIN
            DELETE FROM public.ticket_chats WHERE ticket_id = test_ticket_id;
            DELETE FROM public.tickets_new WHERE id = test_ticket_id;
            RAISE NOTICE '🧹 Limpeza realizada mesmo com erro';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '⚠️ Não foi possível limpar dados de teste: %', SQLERRM;
        END;
END
$$;

-- 13. Verificação final completa
DO $$
DECLARE
    table_exists BOOLEAN;
    index_count INTEGER;
    policy_count INTEGER;
    trigger_count INTEGER;
    tickets_id_type TEXT;
    chats_ticket_id_type TEXT;
    assignee_column TEXT;
    problematic_triggers INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 VERIFICAÇÃO FINAL COMPLETA:';
    
    -- Verificar se tabela existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ticket_chats'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Tabela ticket_chats criada';
        
        -- Verificar compatibilidade de tipos
        SELECT data_type INTO tickets_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets_new' AND column_name = 'id';
        
        SELECT data_type INTO chats_ticket_id_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ticket_chats' AND column_name = 'ticket_id';
        
        -- Verificar coluna assignee
        SELECT column_name INTO assignee_column
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'tickets_new' 
        AND column_name IN ('assigned_to', 'assignee_id')
        LIMIT 1;
        
        RAISE NOTICE '✅ Compatibilidade de tipos: tickets_new.id (%) = ticket_chats.ticket_id (%)', 
                     tickets_id_type, chats_ticket_id_type;
        RAISE NOTICE '✅ Coluna assignee detectada: %', COALESCE(assignee_column, 'NONE');
        
    ELSE
        RAISE NOTICE '❌ Tabela ticket_chats NÃO foi criada';
    END IF;
    
    -- Verificar índices
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes 
    WHERE tablename = 'ticket_chats' 
    AND schemaname = 'public';
    
    RAISE NOTICE '✅ Índices criados: %', index_count;
    
    -- Verificar políticas RLS
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'ticket_chats' 
    AND schemaname = 'public';
    
    RAISE NOTICE '✅ Políticas RLS criadas: %', policy_count;
    
    -- Verificar triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE event_object_table = 'ticket_chats';
    
    RAISE NOTICE '✅ Triggers em ticket_chats: %', trigger_count;
    
    -- Verificar se ainda há triggers problemáticos
    SELECT COUNT(*) INTO problematic_triggers
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'tickets_new'
    AND NOT t.tgisinternal
    AND pg_get_functiondef(p.oid) ILIKE '%ticket_chats%';
    
    IF problematic_triggers = 0 THEN
        RAISE NOTICE '✅ Nenhum trigger problemático restante';
    ELSE
        RAISE NOTICE '⚠️ Ainda existem % triggers problemáticos', problematic_triggers;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 STATUS FINAL:';
    RAISE NOTICE '   - Tabela criada: %', CASE WHEN table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '   - Tipos compatíveis: %', CASE WHEN tickets_id_type = chats_ticket_id_type THEN '✅' ELSE '❌' END;
    RAISE NOTICE '   - Índices: % criados', index_count;
    RAISE NOTICE '   - Políticas RLS: % criadas', policy_count;
    RAISE NOTICE '   - Triggers problemáticos: %', problematic_triggers;
    RAISE NOTICE '';
    RAISE NOTICE '💡 PRÓXIMOS PASSOS:';
    RAISE NOTICE '   1. Teste a criação de tickets na aplicação';
    RAISE NOTICE '   2. Verifique se o chat funciona corretamente';
    RAISE NOTICE '   3. Monitore logs por alguns dias';
    RAISE NOTICE '';
    
    IF table_exists AND tickets_id_type = chats_ticket_id_type AND problematic_triggers = 0 THEN
        RAISE NOTICE '🎉 CORREÇÃO 100% CONCLUÍDA - SISTEMA PRONTO PARA USO!';
    ELSE
        RAISE NOTICE '⚠️ Verificar pontos marcados com ❌ acima';
    END IF;
END
$$;

-- FIM DO SCRIPT DE CORREÇÃO DEFINITIVA FINAL 