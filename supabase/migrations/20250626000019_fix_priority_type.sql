-- Fix priority type comparison issue
DO $$
BEGIN
  -- Create the ENUM type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  -- Update the column type to use the ENUM
  ALTER TABLE tickets_new 
    ALTER COLUMN priority TYPE ticket_priority 
    USING priority::ticket_priority;

  -- Set default value
  ALTER TABLE tickets_new 
    ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;

  RAISE NOTICE 'Successfully fixed priority type';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing priority type: %', SQLERRM;
END;
$$; 