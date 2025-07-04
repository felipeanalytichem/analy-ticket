-- Create secure functions for notification management
-- These functions will run with SECURITY DEFINER to bypass RLS issues

-- Function to create notifications (bypasses RLS)
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_priority TEXT DEFAULT 'medium',
    p_ticket_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Insert notification directly
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
        p_user_id,
        p_type::notification_type,
        p_title,
        p_message,
        p_priority::notification_priority,
        p_ticket_id,
        FALSE,
        NOW()
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Function to create feedback request notification specifically
CREATE OR REPLACE FUNCTION create_feedback_request_notification(
    p_ticket_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ticket_record RECORD;
    notification_id UUID;
BEGIN
    -- Get ticket information
    SELECT ticket_number, title INTO ticket_record
    FROM public.tickets_new
    WHERE id = p_ticket_id;
    
    -- Create notification using the generic function
    SELECT create_notification(
        p_user_id,
        'status_changed',
        'Avalie seu atendimento',
        'Seu chamado #' || COALESCE(ticket_record.ticket_number, p_ticket_id::text) || ' foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.',
        'medium',
        p_ticket_id
    ) INTO notification_id;
    
    RETURN notification_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_feedback_request_notification TO authenticated; 