-- Fix ticket types
DO $$
BEGIN
  -- Create ticket status type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'in_progress', 'resolved', 'closed');
  END IF;

  -- Create ticket priority type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  -- Update the columns to use the ENUM types
  ALTER TABLE tickets_new 
    ALTER COLUMN status TYPE ticket_status USING status::ticket_status,
    ALTER COLUMN priority TYPE ticket_priority USING priority::ticket_priority;

  -- Set default values
  ALTER TABLE tickets_new 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status,
    ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;

  RAISE NOTICE 'Successfully fixed ticket types';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing ticket types: %', SQLERRM;
END;
$$; 