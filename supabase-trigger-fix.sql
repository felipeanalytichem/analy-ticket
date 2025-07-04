-- =====================================================
-- CORREÇÃO DO TRIGGER TICKET_CHATS - USER_ID NULL
-- Execute este script no Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. Corrigir a função do trigger para validar user_id
CREATE OR REPLACE FUNCTION public.create_initial_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Só criar chat inicial se user_id não for null
    IF NEW.user_id IS NOT NULL THEN
        INSERT INTO public.ticket_chats (ticket_id, user_id, message, message_type)
        VALUES (
            NEW.id,
            NEW.user_id,
            'Ticket criado: ' || COALESCE(NEW.title, 'Sem título'),
            'system_message'
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Se der erro, não interromper a criação do ticket
        RAISE WARNING 'Erro ao criar chat inicial: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Verificar se o trigger existe e recriar se necessário
DROP TRIGGER IF EXISTS create_initial_chat_trigger ON public.tickets_new;
CREATE TRIGGER create_initial_chat_trigger
    AFTER INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION public.create_initial_ticket_chat();

-- 3. Alternativa: Desabilitar temporariamente o trigger automático
-- Descomente as linhas abaixo se quiser desabilitar o trigger completamente:
-- DROP TRIGGER IF EXISTS create_initial_chat_trigger ON public.tickets_new;
-- RAISE NOTICE 'Trigger automático desabilitado. Chats devem ser criados manualmente.';

RAISE NOTICE 'Trigger corrigido para validar user_id antes de criar chat inicial'; 