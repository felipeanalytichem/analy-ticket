-- =====================================================
-- CORREÇÃO COMPLETA DA TABELA TICKET_CHATS - TODAS AS COLUNAS FALTANTES
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Verificar se a tabela ticket_chats existe e adicionar todas as colunas faltantes
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

    -- Verificar se a coluna disabled_reason existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'disabled_reason'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN disabled_reason TEXT;
        RAISE NOTICE 'Coluna disabled_reason adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna disabled_reason já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna disabled_by existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'disabled_by'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN disabled_by UUID REFERENCES public.users(id);
        RAISE NOTICE 'Coluna disabled_by adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna disabled_by já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna disabled_at existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'disabled_at'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN disabled_at TIMESTAMPTZ;
        RAISE NOTICE 'Coluna disabled_at adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna disabled_at já existe na tabela ticket_chats';
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

    -- Verificar se a coluna participant_count existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'participant_count'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN participant_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna participant_count adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna participant_count já existe na tabela ticket_chats';
    END IF;

    -- Verificar se a coluna message_count existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ticket_chats' 
        AND column_name = 'message_count'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.ticket_chats ADD COLUMN message_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna message_count adicionada à tabela ticket_chats';
    ELSE
        RAISE NOTICE 'Coluna message_count já existe na tabela ticket_chats';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao modificar tabela ticket_chats: %', SQLERRM;
END $$;

-- 2. Atualizar dados existentes se necessário
UPDATE public.ticket_chats 
SET 
    is_disabled = COALESCE(is_disabled, FALSE),
    is_active = COALESCE(is_active, TRUE),
    status = COALESCE(status, 'active'),
    last_activity_at = COALESCE(last_activity_at, updated_at, created_at, NOW()),
    participant_count = COALESCE(participant_count, 0),
    message_count = COALESCE(message_count, 0)
WHERE 
    is_disabled IS NULL OR 
    is_active IS NULL OR 
    status IS NULL OR 
    last_activity_at IS NULL OR
    participant_count IS NULL OR
    message_count IS NULL;

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
SELECT 'Tabela ticket_chats corrigida completamente com todas as colunas!' as status; 