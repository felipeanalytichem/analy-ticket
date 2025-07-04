-- Fix status casting issues
DO $$
BEGIN
  -- First ensure we have the correct types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'in_progress', 'resolved', 'closed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  -- Temporarily convert status to text to handle invalid values
  ALTER TABLE tickets_new 
    ALTER COLUMN status TYPE text,
    ALTER COLUMN priority TYPE text;

  -- Update invalid status values
  UPDATE tickets_new 
  SET status = CASE 
    WHEN status = 'new' THEN 'open'
    WHEN status = 'in-progress' THEN 'in_progress'
    WHEN status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN 'open'
    ELSE status
  END;

  -- Update invalid priority values
  UPDATE tickets_new 
  SET priority = CASE 
    WHEN priority NOT IN ('low', 'medium', 'high', 'urgent') THEN 'medium'
    ELSE priority
  END;

  -- Convert back to ENUM types
  ALTER TABLE tickets_new 
    ALTER COLUMN status TYPE ticket_status USING status::ticket_status,
    ALTER COLUMN priority TYPE ticket_priority USING priority::ticket_priority;

  -- Set default values
  ALTER TABLE tickets_new 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status,
    ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;

  RAISE NOTICE 'Successfully fixed status and priority casting';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing status casting: %', SQLERRM;
    -- Ensure we don't leave the table in an invalid state
    ALTER TABLE tickets_new 
      ALTER COLUMN status TYPE ticket_status USING 'open'::ticket_status,
      ALTER COLUMN priority TYPE ticket_priority USING 'medium'::ticket_priority;
END;
$$; 