-- =====================================================
-- SCRIPT DE EMERGÊNCIA - DESABILITAR TRIGGER PROBLEMÁTICO
-- Execute este script IMEDIATAMENTE no Supabase Dashboard > SQL Editor
-- Isso permitirá criar tickets enquanto corrigimos o problema
-- =====================================================

-- 1. Desabilitar TODOS os triggers na tabela tickets_new temporariamente
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    RAISE NOTICE 'DESABILITANDO TRIGGERS PROBLEMÁTICOS...';
    
    -- Listar e desabilitar todos os triggers na tabela tickets_new
    FOR trigger_record IN 
        SELECT t.tgname as trigger_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'tickets_new'
        AND NOT t.tgisinternal
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.tickets_new DISABLE TRIGGER ' || trigger_record.trigger_name;
            RAISE NOTICE 'Trigger desabilitado: %', trigger_record.trigger_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao desabilitar trigger %: %', trigger_record.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'TODOS OS TRIGGERS DESABILITADOS TEMPORARIAMENTE';
    RAISE NOTICE 'Agora você pode criar tickets normalmente';
END
$$;

-- 2. Verificar se triggers foram desabilitados
SELECT 
    t.tgname as trigger_name,
    CASE t.tgenabled 
        WHEN 'O' THEN 'DISABLED' 
        WHEN 'D' THEN 'ENABLED' 
        ELSE 'OTHER'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'tickets_new'
AND NOT t.tgisinternal; 