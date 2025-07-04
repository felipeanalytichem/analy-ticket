-- Drop existing function
DROP FUNCTION IF EXISTS log_ticket_activity(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);

-- Recreate with proper type handling
CREATE OR REPLACE FUNCTION log_ticket_activity(
    p_ticket_id UUID,
    p_user_id UUID,
    p_action_type TEXT,
    p_field_name TEXT DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    activity_id UUID;
    user_name TEXT;
    ticket_number TEXT;
BEGIN
    -- Get user name for description
    SELECT full_name INTO user_name FROM users WHERE id = p_user_id;
    IF user_name IS NULL THEN
        user_name := 'Sistema';
    END IF;
    
    -- Get ticket number for description
    SELECT tickets_new.ticket_number INTO ticket_number FROM tickets_new WHERE id = p_ticket_id;
    
    -- Generate description if not provided
    IF p_description IS NULL THEN
        CASE p_action_type
            WHEN 'created' THEN p_description := 'Ticket criado por ' || user_name;
            WHEN 'status_changed' THEN p_description := 'Status alterado de "' || COALESCE(p_old_value::TEXT, 'N/A') || '" para "' || COALESCE(p_new_value::TEXT, 'N/A') || '" por ' || user_name;
            WHEN 'priority_changed' THEN p_description := 'Prioridade alterada de "' || COALESCE(p_old_value::TEXT, 'N/A') || '" para "' || COALESCE(p_new_value::TEXT, 'N/A') || '" por ' || user_name;
            WHEN 'assigned' THEN p_description := 'Ticket atribuído para ' || COALESCE(p_new_value::TEXT, 'N/A') || ' por ' || user_name;
            WHEN 'unassigned' THEN p_description := 'Atribuição removida por ' || user_name;
            WHEN 'comment_added' THEN p_description := 'Comentário adicionado por ' || user_name;
            WHEN 'resolution_added' THEN p_description := 'Resolução adicionada por ' || user_name;
            WHEN 'reopened' THEN p_description := 'Ticket reaberto por ' || user_name;
            WHEN 'closed' THEN p_description := 'Ticket fechado por ' || user_name;
            WHEN 'feedback_received' THEN p_description := 'Feedback recebido de ' || user_name;
            WHEN 'first_response' THEN p_description := 'Primeira resposta do agente por ' || user_name;
            ELSE p_description := p_action_type || ' por ' || user_name;
        END CASE;
    END IF;
    
    -- Insert activity log
    INSERT INTO ticket_activity_logs (
        ticket_id, user_id, action_type, field_name, 
        old_value, new_value, description, metadata
    ) VALUES (
        p_ticket_id, p_user_id, p_action_type, p_field_name,
        p_old_value, p_new_value, p_description, p_metadata
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION log_ticket_activity(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_ticket_activity(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 