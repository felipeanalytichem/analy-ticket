-- Fix all functions that use RECORD variables
-- This migration replaces all RECORD usage with explicit variable declarations

-- Fix notify_feedback_received function
CREATE OR REPLACE FUNCTION notify_feedback_received()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_number text;
    v_ticket_id uuid;
    v_assigned_to uuid;
    v_admin_id uuid;
BEGIN
    -- Get ticket information
    SELECT id, ticket_number, assigned_to 
    INTO v_ticket_id, v_ticket_number, v_assigned_to
    FROM public.tickets_new 
    WHERE id = NEW.ticket_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Notify the assigned agent (if exists)
    IF v_assigned_to IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            priority,
            ticket_id,
            read,
            created_at
        ) VALUES (
            v_assigned_to,
            'feedback_received',
            'Feedback recebido',
            'Você recebeu uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::text) || '. Clique para ver os detalhes.',
            'medium',
            NEW.ticket_id,
            FALSE,
            NOW()
        );
    END IF;
    
    -- Notify all admins
    FOR v_admin_id IN 
        SELECT id FROM public.users WHERE role = 'admin'
    LOOP
        -- Don't duplicate notification if admin is also the assigned agent
        IF v_admin_id != v_assigned_to THEN
            INSERT INTO public.notifications (
                user_id,
                type,
                title,
                message,
                priority,
                ticket_id,
                read,
                created_at
            ) VALUES (
                v_admin_id,
                'feedback_received',
                'Feedback recebido',
                'Foi recebida uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::text) || '. Clique para ver os detalhes.',
                'low',
                NEW.ticket_id,
                FALSE,
                NOW()
            );
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Feedback received notifications sent for ticket %', NEW.ticket_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix create_feedback_request_notification function
CREATE OR REPLACE FUNCTION create_feedback_request_notification(
    p_ticket_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket_number text;
    v_title text;
    notification_id UUID;
BEGIN
    -- Get ticket information
    SELECT ticket_number, title 
    INTO v_ticket_number, v_title
    FROM public.tickets_new
    WHERE id = p_ticket_id;
    
    -- Create notification using the generic function
    SELECT create_notification(
        p_user_id,
        'status_changed',
        'Avalie seu atendimento',
        'Seu chamado #' || COALESCE(v_ticket_number, p_ticket_id::text) || ' foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.',
        'medium',
        p_ticket_id
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Drop and recreate triggers to ensure they use the new functions
DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON public.ticket_feedback;
CREATE TRIGGER trigger_notify_feedback_received
    AFTER INSERT ON public.ticket_feedback
    FOR EACH ROW
    EXECUTE FUNCTION notify_feedback_received();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 