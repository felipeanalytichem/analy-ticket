-- Drop existing function and type if they exist
DROP FUNCTION IF EXISTS public.log_ticket_activity CASCADE;
DROP TYPE IF EXISTS public.ticket_status CASCADE;

-- Create ticket status type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'cancelled');
  END IF;
END $$;

-- Create the function with text parameters
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
AS $$
BEGIN
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
    p_old_value,
    p_new_value,
    COALESCE(p_description, ''),
    COALESCE(p_metadata, '{}'::jsonb),
    NOW()
  );
END;
$$;

-- Reset and regrant permissions
REVOKE ALL ON FUNCTION public.log_ticket_activity FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ticket_activity TO authenticated;

-- Ensure the function is available in the API
COMMENT ON FUNCTION public.log_ticket_activity IS 'Logs ticket activity with proper type handling for status values';

-- Notify the connection to refresh its schema cache
NOTIFY pgrst, 'reload schema'; 