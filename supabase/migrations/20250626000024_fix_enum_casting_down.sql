-- Rollback ENUM casting changes
DO $$
DECLARE
  trigger_definition text;
BEGIN
  -- Store trigger definition
  SELECT pg_get_triggerdef(oid) INTO trigger_definition
  FROM pg_trigger 
  WHERE tgname = 'update_sla_status';

  -- Drop the trigger
  DROP TRIGGER IF EXISTS update_sla_status ON tickets_new;

  -- Drop constraints
  ALTER TABLE tickets_new 
    DROP CONSTRAINT IF EXISTS tickets_new_status_check,
    DROP CONSTRAINT IF EXISTS tickets_new_priority_check;

  -- Convert to text type
  ALTER TABLE tickets_new 
    ALTER COLUMN status TYPE text USING status::text,
    ALTER COLUMN priority TYPE text USING priority::text;

  -- Set defaults
  ALTER TABLE tickets_new 
    ALTER COLUMN status SET DEFAULT 'open',
    ALTER COLUMN priority SET DEFAULT 'medium';

  -- Recreate the trigger
  IF trigger_definition IS NOT NULL THEN
    EXECUTE trigger_definition;
  END IF;

  RAISE NOTICE 'Successfully rolled back ENUM casting changes';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error rolling back ENUM casting: %', SQLERRM;
    -- Try to restore the trigger if it exists
    IF trigger_definition IS NOT NULL THEN
      EXECUTE trigger_definition;
    END IF;
END;
$$; 