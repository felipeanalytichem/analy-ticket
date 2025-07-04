-- Fix ENUM casting issues
DO $$
BEGIN
  -- First ensure we have the correct types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'in_progress', 'resolved', 'closed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;

  -- Create a new table with the correct types
  CREATE TABLE tickets_new_fixed (LIKE tickets_new);

  -- Alter the new table to use ENUM types
  ALTER TABLE tickets_new_fixed
    ALTER COLUMN status TYPE ticket_status USING 
      CASE 
        WHEN status::text = 'new' THEN 'open'::ticket_status
        WHEN status::text = 'in-progress' THEN 'in_progress'::ticket_status
        WHEN status::text NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN 'open'::ticket_status
        ELSE status::text::ticket_status
      END,
    ALTER COLUMN priority TYPE ticket_priority USING 
      CASE 
        WHEN priority::text NOT IN ('low', 'medium', 'high', 'urgent') THEN 'medium'::ticket_priority
        ELSE priority::text::ticket_priority
      END;

  -- Add constraints and defaults to the new table
  ALTER TABLE tickets_new_fixed 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status,
    ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority,
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN priority SET NOT NULL;

  -- Add check constraints to the new table
  ALTER TABLE tickets_new_fixed 
    ADD CONSTRAINT tickets_new_status_check CHECK (status::text = ANY(ARRAY['open', 'pending', 'in_progress', 'resolved', 'closed'])),
    ADD CONSTRAINT tickets_new_priority_check CHECK (priority::text = ANY(ARRAY['low', 'medium', 'high', 'urgent']));

  -- Copy data from old table to new table
  INSERT INTO tickets_new_fixed 
  SELECT * FROM tickets_new;

  -- Drop the old table and rename the new one
  DROP TABLE tickets_new CASCADE;
  ALTER TABLE tickets_new_fixed RENAME TO tickets_new;

  -- Recreate the SLA status trigger
  CREATE TRIGGER update_sla_status
    AFTER INSERT OR UPDATE OF status, priority, first_response_at
    ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION check_and_update_sla_status();

  -- Recreate foreign key constraints
  ALTER TABLE ticket_comments_new
    ADD CONSTRAINT ticket_comments_new_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets_new(id) 
    ON DELETE CASCADE;

  ALTER TABLE ticket_attachments_new
    ADD CONSTRAINT ticket_attachments_new_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets_new(id) 
    ON DELETE CASCADE;

  ALTER TABLE ticket_activity_log
    ADD CONSTRAINT ticket_activity_log_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets_new(id) 
    ON DELETE CASCADE;

  ALTER TABLE ticket_tasks
    ADD CONSTRAINT ticket_tasks_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets_new(id) 
    ON DELETE CASCADE;

  ALTER TABLE ticket_feedback
    ADD CONSTRAINT ticket_feedback_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets_new(id) 
    ON DELETE CASCADE;

  -- Recreate RLS policies
  ALTER TABLE tickets_new ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Enable read access for all users" ON tickets_new
    FOR SELECT
    USING (true);

  CREATE POLICY "Enable insert for authenticated users only" ON tickets_new
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

  CREATE POLICY "Enable update for users based on role" ON tickets_new
    FOR UPDATE
    USING (
      CASE 
        WHEN auth.role() = 'admin' THEN true
        WHEN auth.role() = 'agent' AND assigned_to = auth.uid() THEN true
        WHEN auth.role() = 'user' AND user_id = auth.uid() AND status = 'open' THEN true
        ELSE false
      END
    );

  RAISE NOTICE 'Successfully fixed ENUM casting and constraints';
EXCEPTION
  WHEN OTHERS THEN
    -- Clean up in case of error
    DROP TABLE IF EXISTS tickets_new_fixed;
    RAISE NOTICE 'Error fixing ENUM casting: %', SQLERRM;
END;
$$;