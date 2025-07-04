-- Drop the existing function
DROP FUNCTION IF EXISTS public.log_ticket_activity CASCADE;

-- Create the function with explicit type handling
CREATE OR REPLACE FUNCTION public.log_ticket_activity(
  p_ticket_id    uuid,
  p_user_id      uuid,
  p_action_type  text,
  p_field_name   text,
  p_old_value    text,
  p_new_value    text,
  p_description  text DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_value text;
  v_new_value text;
BEGIN
  -- Handle type conversion
  v_old_value := CASE 
    WHEN p_old_value IS NULL THEN NULL
    ELSE p_old_value::text
  END;

  v_new_value := CASE 
    WHEN p_new_value IS NULL THEN NULL
    ELSE p_new_value::text
  END;

  -- Insert the log entry
  INSERT INTO public.ticket_activity_logs(
    ticket_id,
    user_id,
    action_type,
    field_name,
    old_value,
    new_value,
    description,
    metadata,
    created_at
  )
  VALUES (
    p_ticket_id,
    p_user_id,
    p_action_type,
    p_field_name,
    v_old_value,
    v_new_value,
    COALESCE(p_description, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.log_ticket_activity(uuid, uuid, text, text, text, text, text, jsonb) TO authenticated;

-- Notify the connection to refresh its schema cache
NOTIFY pgrst, 'reload schema'; 