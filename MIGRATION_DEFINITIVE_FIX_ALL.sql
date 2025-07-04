-- ==============================================================================================
-- MIGRATION DEFINITIVE FIX ALL: CHAT, NOTIFICATIONS, POLICIES, AND AUTO-CLOSE
-- This script finds and replaces all instances of the problematic RECORD type usage
-- that causes "record is not assigned yet" errors.
--
-- Apply this entire script in your Supabase SQL Editor to permanently fix the issue.
-- ==============================================================================================

-- ----------------------------------------------------------------------------------------------
-- Section 1: Chat System Fix
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 1: Fixing Chat System ---';

DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON public.ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON public.tickets_new CASCADE;
DROP FUNCTION IF EXISTS public.add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS public.create_ticket_chat() CASCADE;

CREATE OR REPLACE FUNCTION public.create_ticket_chat()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO public.ticket_chats (ticket_id, chat_type, is_active, created_at, updated_at)
    VALUES (NEW.id, 'ticket', true, NOW(), NOW());
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[create_ticket_chat] Failed for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_initial_chat_participants()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
    v_assigned_to UUID;
BEGIN
    SELECT user_id, assigned_to INTO v_user_id, v_assigned_to
    FROM public.tickets_new WHERE id = NEW.ticket_id;

    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.chat_participants (chat_id, user_id, can_write, joined_at)
        VALUES (NEW.id, v_user_id, true, NOW()) ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;

    IF v_assigned_to IS NOT NULL AND v_assigned_to <> v_user_id THEN
        INSERT INTO public.chat_participants (chat_id, user_id, can_write, joined_at)
        VALUES (NEW.id, v_assigned_to, true, NOW()) ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '[add_initial_chat_participants] Failed for chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON public.tickets_new
    FOR EACH ROW EXECUTE FUNCTION public.create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON public.ticket_chats
    FOR EACH ROW EXECUTE FUNCTION public.add_initial_chat_participants();

RAISE NOTICE '✅ Chat System Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 2: Feedback and Notification Functions Fix
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 2: Fixing Notification Functions ---';

DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON public.ticket_feedback CASCADE;
DROP FUNCTION IF EXISTS public.notify_feedback_received() CASCADE;
DROP FUNCTION IF EXISTS public.create_feedback_request_notification(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.notify_feedback_received()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_number TEXT;
    v_assigned_to UUID;
    v_admin_id UUID;
BEGIN
    SELECT id, ticket_number, assigned_to INTO v_ticket_id, v_ticket_number, v_assigned_to
    FROM public.tickets_new WHERE id = NEW.ticket_id;

    IF v_ticket_id IS NULL THEN RETURN NEW; END IF;

    IF v_assigned_to IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_assigned_to, 'feedback_received', 'Feedback Recebido',
                'Você recebeu uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT), 'medium', NEW.ticket_id);
    END IF;

    FOR v_admin_id IN SELECT id FROM public.users WHERE role = 'admin'
    LOOP
        IF v_admin_id <> v_assigned_to THEN
            INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
            VALUES (v_admin_id, 'feedback_received', 'Feedback Recebido',
                    'Foi recebida uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT), 'low', NEW.ticket_id);
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_feedback_request_notification(p_ticket_id UUID, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_ticket_number TEXT;
    v_ticket_title TEXT;
    notification_id UUID;
BEGIN
    SELECT ticket_number, title INTO v_ticket_number, v_ticket_title
    FROM public.tickets_new WHERE id = p_ticket_id;
    
    SELECT create_notification(
        p_user_id, 'status_changed', 'Avalie seu atendimento',
        'Seu chamado #' || COALESCE(v_ticket_number, p_ticket_id::TEXT) || ' foi resolvido! Que tal avaliar o atendimento?',
        'medium', p_ticket_id
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$;

CREATE TRIGGER trigger_notify_feedback_received
    AFTER INSERT ON public.ticket_feedback
    FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_received();
    
GRANT EXECUTE ON FUNCTION public.create_feedback_request_notification TO authenticated;

RAISE NOTICE '✅ Notification Functions Fixed';


-- ----------------------------------------------------------------------------------------------
-- Section 3: Chat Permission Policy Function Fix
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 3: Fixing Chat Permission Logic ---';

DROP FUNCTION IF EXISTS public.has_chat_permission(UUID, TEXT, UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.has_chat_permission(
    chat_id_param UUID,
    chat_type_param TEXT,
    user_id_param UUID,
    permission_type TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_role TEXT;
    v_user_agent_level INT;
    v_ticket_user_id UUID;
    v_ticket_assigned_to UUID;
    v_ticket_status TEXT;
    v_chat_is_disabled BOOLEAN;
BEGIN
    SELECT role, agent_level INTO v_user_role, v_user_agent_level
    FROM public.users WHERE id = user_id_param;

    IF v_user_role IS NULL THEN RETURN FALSE; END IF;

    IF chat_type_param = 'ticket' THEN
        SELECT tc.is_disabled, t.user_id, t.assigned_to, t.status
        INTO v_chat_is_disabled, v_ticket_user_id, v_ticket_assigned_to, v_ticket_status
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE tc.id = chat_id_param;

        IF v_chat_is_disabled AND v_user_role <> 'admin' THEN RETURN FALSE; END IF;
        
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;

        IF v_user_role = 'user' THEN
            RETURN v_ticket_user_id = user_id_param AND permission_type IN ('read', 'write');
        END IF;

        IF v_user_role = 'agent' THEN
            IF v_ticket_assigned_to = user_id_param THEN RETURN TRUE; END IF;
            IF v_user_agent_level = 2 AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = chat_id_param AND user_id = user_id_param) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    IF chat_type_param = 'direct' THEN
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
        RETURN EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = chat_id_param AND user_id = user_id_param);
    END IF;

    RETURN FALSE;
END;
$$;

RAISE NOTICE '✅ Chat Permission Logic Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 4: Auto-Close Tickets Fix
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 4: Fixing Auto-Close Function ---';

DROP FUNCTION IF EXISTS public.auto_close_resolved_tickets() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_number TEXT;
    v_user_id UUID;
    v_resolved_by UUID;
    closed_count INTEGER := 0;
BEGIN
    FOR v_ticket_id, v_ticket_number, v_user_id, v_resolved_by IN
        SELECT id, ticket_number, user_id, resolved_by FROM public.tickets_new
        WHERE status = 'resolved' AND resolved_at < NOW() - INTERVAL '2 days'
    LOOP
        UPDATE public.tickets_new
        SET status = 'closed', closed_at = NOW(), closed_by = v_resolved_by, updated_at = NOW()
        WHERE id = v_ticket_id;

        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_user_id, 'status_changed', 'Ticket Fechado Automaticamente',
                'Seu ticket ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || ' foi fechado automaticamente.',
                'low', v_ticket_id);

        closed_count := closed_count + 1;
    END LOOP;
    RETURN closed_count;
END;
$$;

RAISE NOTICE '✅ Auto-Close Function Fixed';

-- ----------------------------------------------------------------------------------------------
-- Finalization
-- ----------------------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

SELECT 'DEFINITIVE DATABASE FIX APPLIED SUCCESSFULLY!' as result; 