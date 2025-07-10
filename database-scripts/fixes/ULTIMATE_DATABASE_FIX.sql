DO $$
BEGIN

-- ==============================================================================================
-- ULTIMATE DATABASE FIX (Based on Direct Database Analysis)
-- This script provides the definitive solution by fixing all functions that were
-- identified as using the unsafe RECORD type, which caused the persistent errors.
--
-- Please run this entire script in your Supabase SQL Editor one last time.
-- ==============================================================================================

-- ----------------------------------------------------------------------------------------------
-- Section 1: Chat and Security Functions
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 1: Fixing Chat Permission and Accessibility Functions ---';

DROP FUNCTION IF EXISTS public.has_chat_permission(uuid, text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_accessible_chats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.silence_chat_participant(uuid, uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_mention(uuid, uuid) CASCADE;

-- Recreate has_chat_permission (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.has_chat_permission(
    p_chat_id uuid,
    p_chat_type text,
    p_user_id uuid,
    p_permission_type text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_user_role text;
    v_agent_level int;
    v_is_disabled boolean;
    v_ticket_user_id uuid;
    v_ticket_assigned_to uuid;
    v_ticket_status text;
BEGIN
    SELECT role, agent_level INTO v_user_role, v_agent_level FROM public.users WHERE id = p_user_id;
    IF v_user_role IS NULL THEN RETURN FALSE; END IF;

    IF p_chat_type = 'ticket' THEN
        SELECT tc.is_disabled, t.user_id, t.assigned_to, t.status
        INTO v_is_disabled, v_ticket_user_id, v_ticket_assigned_to, v_ticket_status
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE tc.id = p_chat_id;

        IF v_is_disabled AND v_user_role <> 'admin' THEN RETURN FALSE; END IF;
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
        IF v_user_role = 'user' THEN
            RETURN v_ticket_user_id = p_user_id AND p_permission_type IN ('read', 'write');
        END IF;
        IF v_user_role = 'agent' THEN
            IF v_ticket_assigned_to = p_user_id THEN RETURN TRUE; END IF;
            IF v_agent_level = 2 AND EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id) THEN
                RETURN TRUE;
            END IF;
        END IF;
    END IF;

    IF p_chat_type = 'direct' THEN
        IF v_user_role = 'admin' THEN RETURN TRUE; END IF;
        RETURN EXISTS (SELECT 1 FROM public.chat_participants WHERE chat_id = p_chat_id AND user_id = p_user_id);
    END IF;

    RETURN FALSE;
END;
$func$;

-- Recreate get_user_accessible_chats (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.get_user_accessible_chats(p_user_id uuid)
RETURNS TABLE(chat_id uuid, chat_type text, ticket_id uuid, ticket_number text, ticket_title text, other_participant_name text, last_message_at timestamp with time zone, unread_count integer, is_disabled boolean)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_user_role text;
    v_agent_level int;
BEGIN
    SELECT role, agent_level INTO v_user_role, v_agent_level FROM public.users WHERE id = p_user_id;

    IF v_user_role = 'user' THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.user_id = p_user_id ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'agent' AND v_agent_level = 1 THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = p_user_id ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'agent' AND v_agent_level = 2 THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        WHERE t.assigned_to = p_user_id OR EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = tc.id AND cp.user_id = p_user_id)
        ORDER BY tc.updated_at DESC;
    ELSIF v_user_role = 'admin' THEN
        RETURN QUERY SELECT tc.id, 'ticket'::text, tc.ticket_id, t.ticket_number, t.title, NULL::text, tc.updated_at, 0, COALESCE(tc.is_disabled, FALSE)
        FROM public.ticket_chats tc JOIN public.tickets_new t ON tc.ticket_id = t.id
        ORDER BY tc.updated_at DESC;
    END IF;
END;
$func$;

-- Recreate silence_chat_participant (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.silence_chat_participant(p_chat_id uuid, p_user_id uuid, p_duration_minutes integer DEFAULT 60)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_moderator_id uuid := auth.uid();
    v_moderator_role text;
    v_moderator_agent_level int;
BEGIN
    SELECT role, agent_level INTO v_moderator_role, v_moderator_agent_level FROM public.users WHERE id = v_moderator_id;

    IF NOT ((v_moderator_role = 'agent' AND v_moderator_agent_level = 2) OR v_moderator_role = 'admin') THEN
        RAISE EXCEPTION 'Permission denied to silence users.';
    END IF;
    IF NOT public.has_chat_permission(p_chat_id, 'ticket', v_moderator_id, 'moderate') THEN
        RAISE EXCEPTION 'No moderation permission in this chat.';
    END IF;

    UPDATE public.chat_participants
    SET is_silenced = TRUE, silenced_until = NOW() + (p_duration_minutes || ' minutes')::interval, silenced_by = v_moderator_id
    WHERE chat_id = p_chat_id AND user_id = p_user_id;
    RETURN TRUE;
END;
$func$;

-- Recreate create_user_mention (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.create_user_mention(p_message_id uuid, p_mentioned_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    v_sender_id uuid;
    v_mentioned_user_exists boolean;
BEGIN
    SELECT sender_id INTO v_sender_id FROM public.chat_messages WHERE id = p_message_id;
    IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Message not found.'; END IF;

    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_mentioned_user_id) INTO v_mentioned_user_exists;
    IF NOT v_mentioned_user_exists THEN RAISE EXCEPTION 'Mentioned user not found.'; END IF;

    INSERT INTO public.chat_message_mentions (message_id, mentioned_user_id)
    VALUES (p_message_id, p_mentioned_user_id) ON CONFLICT (message_id, mentioned_user_id) DO NOTHING;
    RETURN TRUE;
END;
$func$;

RAISE NOTICE '✅ Section 1: Chat and Security Functions Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 2: Activity Log Functions
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 2: Fixing Activity Log Functions ---';

DROP FUNCTION IF EXISTS public.log_comment_activity(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.log_feedback_activity(uuid) CASCADE;

-- Recreate log_comment_activity (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.log_comment_activity(p_comment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
    v_ticket_id uuid;
    v_user_id uuid;
    v_is_internal boolean;
BEGIN
    SELECT ticket_id, user_id, is_internal INTO v_ticket_id, v_user_id, v_is_internal
    FROM public.ticket_comments_new WHERE id = p_comment_id;

    IF FOUND THEN
        PERFORM public.log_ticket_activity(v_ticket_id, v_user_id, 'comment_added', NULL, NULL, NULL, NULL,
            jsonb_build_object('comment_id', p_comment_id, 'is_internal', v_is_internal));
    END IF;
END;
$func$;

-- Recreate log_feedback_activity (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.log_feedback_activity(p_feedback_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
    v_ticket_id uuid;
    v_user_id uuid;
    v_rating int;
    v_satisfaction text;
BEGIN
    SELECT ticket_id, user_id, rating, satisfaction INTO v_ticket_id, v_user_id, v_rating, v_satisfaction
    FROM public.ticket_feedback WHERE id = p_feedback_id;

    IF FOUND THEN
        PERFORM public.log_ticket_activity(v_ticket_id, v_user_id, 'feedback_received', NULL, NULL,
            v_rating || ' estrelas (' || v_satisfaction || ')', NULL,
            jsonb_build_object('feedback_id', p_feedback_id, 'rating', v_rating, 'satisfaction', v_satisfaction));
    END IF;
END;
$func$;

RAISE NOTICE '✅ Section 2: Activity Log Functions Fixed';

-- ----------------------------------------------------------------------------------------------
-- Section 3: Task Management Functions
-- ----------------------------------------------------------------------------------------------
RAISE NOTICE '--- Section 3: Fixing Task Management Functions ---';

DROP FUNCTION IF EXISTS public.check_overdue_tasks() CASCADE;

-- Recreate check_overdue_tasks (SAFE VERSION)
CREATE OR REPLACE FUNCTION public.check_overdue_tasks()
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
    v_task_id uuid;
    v_task_title text;
    v_assigned_user_id uuid;
    v_ticket_id uuid;
    v_ticket_number text;
BEGIN
    FOR v_task_id, v_task_title, v_assigned_user_id, v_ticket_id, v_ticket_number IN
        SELECT t.id, t.title, t.assigned_to, t.ticket_id, tn.ticket_number
        FROM public.ticket_tasks t JOIN public.tickets_new tn ON t.ticket_id = tn.id
        WHERE t.due_date < NOW() AND t.status <> 'done' AND t.assigned_to IS NOT NULL
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications
            WHERE user_id = v_assigned_user_id
              AND type = 'task_overdue'
              AND ticket_id = v_ticket_id
              AND created_at > NOW() - INTERVAL '1 day'
        ) THEN
            INSERT INTO public.notifications (user_id, type, title, message, ticket_id, priority)
            VALUES (v_assigned_user_id, 'task_overdue', 'Task Overdue',
                    'Task "' || v_task_title || '" on ticket #' || v_ticket_number || ' is overdue.',
                    v_ticket_id, 'high');
        END IF;
    END LOOP;
END;
$func$;

RAISE NOTICE '✅ Section 3: Task Management Functions Fixed';

-- ----------------------------------------------------------------------------------------------
-- Finalization
-- ----------------------------------------------------------------------------------------------
-- This is intentionally left out, as NOTIFY cannot be run inside a DO block.
-- The schema will reload automatically when functions are changed.
-- NOTIFY pgrst, 'reload schema';

END $$; 