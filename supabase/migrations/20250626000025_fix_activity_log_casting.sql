-- Fix type casting in log_ticket_activity function
CREATE OR REPLACE FUNCTION public.log_ticket_activity(
    p_ticket_id uuid,
    p_user_id uuid,
    p_action_type text,
    p_field_name text,
    p_old_value text,
    p_new_value text,
    p_description text,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Cast the old and new values to text to ensure compatibility
    INSERT INTO ticket_activity_log (
        ticket_id,
        user_id,
        action_type,
        field_name,
        old_value,
        new_value,
        description,
        metadata,
        created_at
    ) VALUES (
        p_ticket_id,
        p_user_id,
        p_action_type,
        p_field_name,
        CASE 
            WHEN p_field_name = 'status' THEN p_old_value::ticket_status::text
            WHEN p_field_name = 'priority' THEN p_old_value::ticket_priority::text
            ELSE p_old_value
        END,
        CASE 
            WHEN p_field_name = 'status' THEN p_new_value::ticket_status::text
            WHEN p_field_name = 'priority' THEN p_new_value::ticket_priority::text
            ELSE p_new_value
        END,
        p_description,
        p_metadata,
        NOW()
    );
END;
$function$; 