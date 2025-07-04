-- =====================================================
-- CORREÇÃO DA TABELA TICKET_CHATS - ADICIONAR COLUNAS FALTANTES
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Verificar se a tabela ticket_chats existe e adicionar colunas faltantes
DO $$
BEGIN
    -- Verificar se a coluna is_disabled existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'is_disabled'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN is_disabled BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna is_disabled adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna is_disabled já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna is_active existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Coluna is_active adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna is_active já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna status existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN status TEXT DEFAULT 'active';
        RAISE NOTICE 'Coluna status adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna status já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna last_activity_at existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'last_activity_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Coluna last_activity_at adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna last_activity_at já existe na tabela ticket_chats';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao modificar tabela ticket_chats: %', SQLERRM;
END $$;

-- 2. Atualizar dados existentes se necessário
UPDATE public.ticket_chats 
SET 
    is_disabled = FALSE,
    is_active = TRUE,
    status = 'active',
    last_activity_at = COALESCE(updated_at, created_at, NOW())
WHERE is_disabled IS NULL OR is_active IS NULL OR status IS NULL OR last_activity_at IS NULL;

-- 3. Verificar estrutura final da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'ticket_chats' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Mensagem de sucesso
SELECT 'Tabela ticket_chats corrigida com sucesso!' as status; 