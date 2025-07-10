-- =====================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA - PROBLEMA TICKET_CHATS
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Primeiro, vamos investigar o problema
DO $$
DECLARE
    trigger_record RECORD;
    function_record RECORD;
BEGIN
    RAISE NOTICE '🔍 INVESTIGANDO TRIGGERS E FUNÇÕES...';
    RAISE NOTICE '';
    
    -- Listar todos os triggers na tabela tickets_new
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
    RAISE NOTICE '🔧 INICIANDO CORREÇÃO...';
END
$$;

-- 2. Criar tabela ticket_chats se não existir
CREATE TABLE IF NOT EXISTS public.ticket_chats (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES public.tickets_new(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'user_message' 
        CHECK (message_type IN ('user_message', 'system_message', 'status_change')),
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ticket_chats_ticket_id ON public.ticket_chats(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_user_id ON public.ticket_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_chats_created_at ON public.ticket_chats(created_at DESC);

-- 4. Habilitar RLS
ALTER TABLE public.ticket_chats ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS
DROP POLICY IF EXISTS "Users can view ticket chats for accessible tickets" ON public.ticket_chats;
CREATE POLICY "Users can view ticket chats for accessible tickets" ON public.ticket_chats
    FOR SELECT USING (
        ticket_id IN (
            SELECT id FROM public.tickets_new 
            WHERE user_id = auth.uid() OR assignee_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert ticket chats for accessible tickets" ON public.ticket_chats;
CREATE POLICY "Users can insert ticket chats for accessible tickets" ON public.ticket_chats
    FOR INSERT WITH CHECK (
        ticket_id IN (
            SELECT id FROM public.tickets_new 
            WHERE user_id = auth.uid() OR assignee_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update ticket chats for accessible tickets" ON public.ticket_chats;
CREATE POLICY "Users can update ticket chats for accessible tickets" ON public.ticket_chats
    FOR UPDATE USING (
        ticket_id IN (
            SELECT id FROM public.tickets_new 
            WHERE user_id = auth.uid() OR assignee_id = auth.uid()
        )
    );

-- 6. Criar função de trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_ticket_chats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_ticket_chats_updated_at_trigger ON public.ticket_chats;
CREATE TRIGGER update_ticket_chats_updated_at_trigger
    BEFORE UPDATE ON public.ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ticket_chats_updated_at();

-- 8. Migrar dados existentes de ticket_comments_new (se existir)
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

-- 9. Verificar quantos registros foram migrados
DO $$
DECLARE
    migrated_count INTEGER;
    total_comments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_comments FROM public.ticket_comments_new;
    SELECT COUNT(*) INTO migrated_count FROM public.ticket_chats;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 MIGRAÇÃO DE DADOS:';
    RAISE NOTICE '   - Comentários em ticket_comments_new: %', total_comments;
    RAISE NOTICE '   - Registros migrados para ticket_chats: %', migrated_count;
    RAISE NOTICE '';
END
$$;

-- 10. Criar função para automatically criar chat quando ticket é criado
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

-- 12. Testar a correção
DO $$
DECLARE
    test_ticket_id BIGINT;
    test_user_id UUID := 'e4e43fcb-9500-437e-a813-c3b227689d78';
    chat_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO CORREÇÃO...';
    
    -- Inserir ticket de teste
    INSERT INTO public.tickets_new (
        title, 
        description, 
        priority, 
        status, 
        user_id, 
        category_id,
        ticket_number
    ) VALUES (
        'Teste Correção Definitiva',
        'Ticket de teste para verificar se a correção funcionou',
        'medium',
        'open',
        test_user_id,
        1,
        'TEST-CORRECTION-' || EXTRACT(EPOCH FROM NOW())::BIGINT
    ) RETURNING id INTO test_ticket_id;
    
    RAISE NOTICE '✅ Ticket de teste criado com ID: %', test_ticket_id;
    
    -- Verificar se o chat inicial foi criado
    SELECT COUNT(*) INTO chat_count 
    FROM public.ticket_chats 
    WHERE ticket_id = test_ticket_id;
    
    RAISE NOTICE '✅ Chats criados automaticamente: %', chat_count;
    
    -- Inserir mensagem de teste manual
    INSERT INTO public.ticket_chats (ticket_id, user_id, message)
    VALUES (test_ticket_id, test_user_id, 'Mensagem de teste manual');
    
    RAISE NOTICE '✅ Mensagem de teste criada manualmente';
    
    -- Verificar total de chats
    SELECT COUNT(*) INTO chat_count 
    FROM public.ticket_chats 
    WHERE ticket_id = test_ticket_id;
    
    RAISE NOTICE '✅ Total de chats para o ticket: %', chat_count;
    
    -- Limpar dados de teste
    DELETE FROM public.ticket_chats WHERE ticket_id = test_ticket_id;
    DELETE FROM public.tickets_new WHERE id = test_ticket_id;
    
    RAISE NOTICE '🧹 Dados de teste removidos';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '';
    
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
                RAISE NOTICE '⚠️ Não foi possível limpar dados de teste';
        END;
END
$$;

-- 13. Verificação final
DO $$
DECLARE
    table_exists BOOLEAN;
    index_count INTEGER;
    policy_count INTEGER;
    trigger_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 VERIFICAÇÃO FINAL:';
    
    -- Verificar se tabela existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ticket_chats'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Tabela ticket_chats criada';
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
    
    RAISE NOTICE '✅ Triggers criados: %', trigger_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 PRÓXIMOS PASSOS:';
    RAISE NOTICE '   1. Teste a criação de tickets na aplicação';
    RAISE NOTICE '   2. Verifique se o chat funciona corretamente';
    RAISE NOTICE '   3. Monitore logs por alguns dias';
    RAISE NOTICE '   4. Se houver problemas, verifique as funções de trigger existentes';
    RAISE NOTICE '';
    RAISE NOTICE '💡 DICA: Se ainda houver erros, execute:';
    RAISE NOTICE '   SELECT * FROM information_schema.triggers WHERE event_object_table = ''tickets_new'';';
    RAISE NOTICE '   para identificar triggers problemáticos específicos.';
    RAISE NOTICE '';
END
$$;

-- FIM DO SCRIPT DE CORREÇÃO DEFINITIVA 