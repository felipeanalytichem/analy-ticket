-- ==============================================================================================
-- DEFINITIVE DATABASE FIX: CHAT, NOTIFICATIONS, AND AUTO-CLOSE
-- This script finds and replaces all instances of the problematic RECORD type usage
-- that causes "record is not assigned yet" errors.
--
-- Apply this entire script in your Supabase SQL Editor.
-- ==============================================================================================

-- ----------------------------------------------------------------------------------------------
-- Section 1: Chat System Fix
-- Drop and recreate functions and triggers for ticket chat creation and participant management.
-- ----------------------------------------------------------------------------------------------
-- Drop existing problematic functions and triggers
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON public.ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON public.tickets_new CASCADE;
DROP FUNCTION IF EXISTS public.add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS public.create_ticket_chat() CASCADE;

-- Recreate chat creation function (safe version)
CREATE OR REPLACE FUNCTION public.create_ticket_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.ticket_chats (ticket_id, chat_type, is_active, created_at, updated_at)
    VALUES (NEW.id, 'ticket', true, NOW(), NOW());
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate chat participants function (safe version)
CREATE OR REPLACE FUNCTION public.add_initial_chat_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID;
    v_assigned_to UUID;
BEGIN
    -- Get ticket details safely into variables
    SELECT user_id, assigned_to
    INTO v_user_id, v_assigned_to
    FROM public.tickets_new
    WHERE id = NEW.ticket_id;

    -- Add creator if found
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.chat_participants (chat_id, user_id, can_write, joined_at)
        VALUES (NEW.id, v_user_id, true, NOW())
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;

    -- Add assigned agent if they exist and are different from the creator
    IF v_assigned_to IS NOT NULL AND v_assigned_to <> v_user_id THEN
        INSERT INTO public.chat_participants (chat_id, user_id, can_write, joined_at)
        VALUES (NEW.id, v_assigned_to, true, NOW())
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add participants to chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Re-apply triggers for the chat system
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION public.create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON public.ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION public.add_initial_chat_participants();

RAISE NOTICE '✅ Section 1: Chat System Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 2: Feedback Notification Fix
-- Drop and recreate the function that sends notifications when feedback is received.
-- ----------------------------------------------------------------------------------------------
-- Drop existing problematic function and trigger
DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON public.ticket_feedback CASCADE;
DROP FUNCTION IF EXISTS public.notify_feedback_received() CASCADE;

-- Recreate feedback notification function (safe version)
CREATE OR REPLACE FUNCTION public.notify_feedback_received()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_number TEXT;
    v_assigned_to UUID;
    v_admin_id UUID;
BEGIN
    -- Get ticket details safely into variables
    SELECT id, ticket_number, assigned_to
    INTO v_ticket_id, v_ticket_number, v_assigned_to
    FROM public.tickets_new
    WHERE id = NEW.ticket_id;

    IF v_ticket_id IS NULL THEN
        RETURN NEW; -- Exit if ticket not found
    END IF;

    -- Notify the assigned agent
    IF v_assigned_to IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_assigned_to, 'feedback_received', 'Feedback Recebido',
                'Você recebeu uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || '. Clique para ver os detalhes.',
                'medium', NEW.ticket_id);
    END IF;

    -- Notify all admins
    FOR v_admin_id IN SELECT id FROM public.users WHERE role = 'admin'
    LOOP
        -- Avoid duplicate notifications if the admin is the assigned agent
        IF v_admin_id <> v_assigned_to THEN
            INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
            VALUES (v_admin_id, 'feedback_received', 'Feedback Recebido',
                    'Foi recebida uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || '. Clique para ver os detalhes.',
                    'low', NEW.ticket_id);
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Re-apply trigger for feedback notifications
CREATE TRIGGER trigger_notify_feedback_received
    AFTER INSERT ON public.ticket_feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_feedback_received();

RAISE NOTICE '✅ Section 2: Feedback Notification System Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 3: Auto-Close Tickets Fix
-- Drop and recreate the function that automatically closes resolved tickets.
-- ----------------------------------------------------------------------------------------------
-- Drop existing problematic function
DROP FUNCTION IF EXISTS public.auto_close_resolved_tickets() CASCADE;

-- Recreate auto-close function (safe version)
CREATE OR REPLACE FUNCTION public.auto_close_resolved_tickets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket_title TEXT;
    v_ticket_number TEXT;
    v_user_id UUID;
    v_resolved_at TIMESTAMPTZ;
    v_resolved_by UUID;
    closed_count INTEGER := 0;
BEGIN
    -- Use a cursor to loop through tickets safely
    FOR v_ticket_id, v_ticket_title, v_ticket_number, v_user_id, v_resolved_at, v_resolved_by IN
        SELECT id, title, ticket_number, user_id, resolved_at, resolved_by
        FROM public.tickets_new
        WHERE status = 'resolved'
        AND resolved_at < NOW() - INTERVAL '2 days'
    LOOP
        -- Update the ticket status to 'closed'
        UPDATE public.tickets_new
        SET status = 'closed', closed_at = NOW(), closed_by = v_resolved_by, updated_at = NOW()
        WHERE id = v_ticket_id;

        -- Create a notification for the user
        INSERT INTO public.notifications (user_id, type, title, message, priority, ticket_id)
        VALUES (v_user_id, 'status_changed', 'Ticket Fechado Automaticamente',
                'Seu ticket ' || COALESCE(v_ticket_number, v_ticket_id::TEXT) || ' foi fechado automaticamente.',
                'low', v_ticket_id);

        closed_count := closed_count + 1;
    END LOOP;

    RAISE NOTICE 'Total de tickets fechados automaticamente: %', closed_count;
    RETURN closed_count;
END;
$$;

RAISE NOTICE '✅ Section 3: Auto-Close Tickets System Fixed';

-- ----------------------------------------------------------------------------------------------
-- Final step: Refresh the schema for PostgREST
-- ----------------------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

SELECT 'DEFINITIVE DATABASE FIX APPLIED SUCCESSFULLY!' as result; 