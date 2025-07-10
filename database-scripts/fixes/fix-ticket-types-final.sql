-- Fix ticket types and casting issues
BEGIN;

-- Create ENUM types if they don't exist
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
END;
$$;

-- Temporarily disable RLS
ALTER TABLE tickets_new DISABLE ROW LEVEL SECURITY;

-- Add SLA columns if they don't exist
DO $$
BEGIN
    -- Add sla_response_due column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'sla_response_due') THEN
        ALTER TABLE tickets_new ADD COLUMN sla_response_due timestamp with time zone;
    END IF;

    -- Add sla_resolution_due column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'sla_resolution_due') THEN
        ALTER TABLE tickets_new ADD COLUMN sla_resolution_due timestamp with time zone;
    END IF;

    -- Add first_response_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'first_response_at') THEN
        ALTER TABLE tickets_new ADD COLUMN first_response_at timestamp with time zone;
    END IF;

    -- Add sla_response_met column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'sla_response_met') THEN
        ALTER TABLE tickets_new ADD COLUMN sla_response_met boolean;
    END IF;

    -- Add sla_resolution_met column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'sla_resolution_met') THEN
        ALTER TABLE tickets_new ADD COLUMN sla_resolution_met boolean;
    END IF;
END;
$$;

-- Save all trigger definitions
CREATE TEMP TABLE trigger_defs AS
SELECT 
    t.tgname as trigger_name,
    pg_get_triggerdef(t.oid) as trigger_definition,
    p.prosrc as function_definition,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'tickets_new';

-- Drop all triggers on tickets_new
DO $$
DECLARE
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN (
        SELECT trigger_name 
        FROM trigger_defs
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_rec.trigger_name || ' ON tickets_new';
    END LOOP;
END;
$$;

-- Drop existing functions
DROP FUNCTION IF EXISTS calculate_ticket_sla(uuid);
DROP FUNCTION IF EXISTS update_ticket_sla_status();
DROP FUNCTION IF EXISTS disable_chat_on_ticket_closure();
DROP FUNCTION IF EXISTS ticket_status_to_text(ticket_status);
DROP FUNCTION IF EXISTS ticket_priority_to_text(ticket_priority);

-- Update any invalid status values to 'open'
UPDATE tickets_new 
SET status = 'open' 
WHERE status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed');

-- Update any invalid priority values to 'medium'
UPDATE tickets_new 
SET priority = 'medium' 
WHERE priority NOT IN ('low', 'medium', 'high', 'urgent');

-- Update the columns to use the ENUM types
ALTER TABLE tickets_new 
  ALTER COLUMN status TYPE ticket_status USING status::ticket_status,
  ALTER COLUMN priority TYPE ticket_priority USING priority::ticket_priority;

-- Set default values
ALTER TABLE tickets_new 
  ALTER COLUMN status SET DEFAULT 'open'::ticket_status,
  ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;

-- Fix activity log casting
ALTER TABLE ticket_activity_logs
  ALTER COLUMN old_value TYPE text,
  ALTER COLUMN new_value TYPE text;

-- Create casting functions
CREATE OR REPLACE FUNCTION ticket_status_to_text(v ticket_status) RETURNS text
  LANGUAGE plpgsql IMMUTABLE AS
$$
BEGIN
  RETURN v::text;
END;
$$;

CREATE OR REPLACE FUNCTION ticket_priority_to_text(v ticket_priority) RETURNS text
  LANGUAGE plpgsql IMMUTABLE AS
$$
BEGIN
  RETURN v::text;
END;
$$;

-- Create SLA calculation function
CREATE OR REPLACE FUNCTION calculate_ticket_sla(p_ticket_id uuid)
RETURNS void AS $$
DECLARE
    v_priority text;
    v_created_at timestamp with time zone;
    v_response_time interval;
    v_resolution_time interval;
    v_first_response timestamp with time zone;
    v_status text;
BEGIN
    -- Get ticket details
    SELECT 
        priority::text,
        created_at,
        status::text
    INTO 
        v_priority,
        v_created_at,
        v_status
    FROM tickets_new 
    WHERE id = p_ticket_id;

    -- Set SLA times based on priority
    CASE v_priority
        WHEN 'urgent' THEN
            v_response_time := interval '1 hour';
            v_resolution_time := interval '4 hours';
        WHEN 'high' THEN
            v_response_time := interval '2 hours';
            v_resolution_time := interval '8 hours';
        WHEN 'medium' THEN
            v_response_time := interval '4 hours';
            v_resolution_time := interval '24 hours';
        ELSE -- low
            v_response_time := interval '8 hours';
            v_resolution_time := interval '48 hours';
    END CASE;

    -- Get first response time
    SELECT MIN(tal.created_at)
    INTO v_first_response
    FROM ticket_activity_logs tal
    JOIN users u ON u.id = tal.user_id
    WHERE tal.ticket_id = p_ticket_id
    AND tal.action_type IN ('comment', 'status_change')
    AND u.role IN ('agent', 'admin');

    -- Update SLA status
    UPDATE tickets_new
    SET 
        sla_response_due = v_created_at + v_response_time,
        sla_resolution_due = v_created_at + v_resolution_time,
        first_response_at = v_first_response,
        sla_response_met = CASE 
            WHEN v_first_response IS NOT NULL THEN
                v_first_response <= (v_created_at + v_response_time)
            ELSE NULL
        END,
        sla_resolution_met = CASE 
            WHEN v_status = 'resolved' OR v_status = 'closed' THEN
                NOW() <= (v_created_at + v_resolution_time)
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE id = p_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger functions with proper type handling
CREATE OR REPLACE FUNCTION update_ticket_sla_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update SLA status on status changes or new tickets
  IF (TG_OP = 'UPDATE' AND OLD.status::text != NEW.status::text) OR TG_OP = 'INSERT' THEN
    -- Calculate SLA times
    PERFORM calculate_ticket_sla(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to disable chat on ticket closure
CREATE OR REPLACE FUNCTION disable_chat_on_ticket_closure()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if status changed to closed
  IF NEW.status::text = 'closed' AND (OLD.status IS NULL OR OLD.status::text != 'closed') THEN
    -- Disable chat for this ticket
    UPDATE ticket_chats tc
    SET is_active = false,
        updated_at = NOW()
    WHERE tc.ticket_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER update_sla_status
  AFTER INSERT OR UPDATE ON tickets_new
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_sla_status();

CREATE TRIGGER trigger_disable_chat_on_closure
  AFTER UPDATE ON tickets_new
  FOR EACH ROW
  EXECUTE FUNCTION disable_chat_on_ticket_closure();

-- Re-enable RLS
ALTER TABLE tickets_new ENABLE ROW LEVEL SECURITY;

COMMIT; 