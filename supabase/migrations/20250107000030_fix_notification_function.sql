-- Create or replace the notification function
CREATE OR REPLACE FUNCTION public.create_ticket_notification(
  p_ticket_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_priority text DEFAULT 'medium'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (
    ticket_id,
    user_id,
    type,
    title,
    message,
    priority,
    read,
    created_at,
    updated_at
  )
  VALUES (
    p_ticket_id,
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_priority,
    false,
    NOW(),
    NOW()
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_ticket_notification(uuid, uuid, text, text, text, text) TO authenticated;

-- Notify the connection to refresh its schema cache
NOTIFY pgrst, 'reload schema'; 