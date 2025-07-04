-- Fix tickets table and types
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

  -- Create tickets_new table if it doesn't exist
  CREATE TABLE IF NOT EXISTS tickets_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    category_id UUID REFERENCES categories(id),
    subcategory_id UUID REFERENCES subcategories(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution TEXT,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES auth.users(id),
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    display_name TEXT,
    job_title TEXT,
    manager TEXT,
    company_name TEXT,
    department TEXT,
    office_location TEXT,
    business_phone TEXT,
    mobile_phone TEXT,
    start_date DATE,
    signature_group TEXT,
    usage_location TEXT,
    country_distribution_list TEXT,
    license_type TEXT,
    mfa_setup TEXT,
    attached_form TEXT,
    feedback_received BOOLEAN DEFAULT FALSE
  );

  -- Update existing status values to match ENUM values
  UPDATE tickets_new 
  SET status = CASE 
    WHEN status = 'new' THEN 'open'
    WHEN status = 'in-progress' THEN 'in_progress'
    WHEN status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN 'open'
    ELSE status
  END
  WHERE status IS NOT NULL;

  -- Update existing priority values to match ENUM values
  UPDATE tickets_new 
  SET priority = CASE 
    WHEN priority = 'critical' THEN 'urgent'
    WHEN priority NOT IN ('low', 'medium', 'high', 'urgent') THEN 'medium'
    ELSE priority
  END
  WHERE priority IS NOT NULL;

  -- Alter the columns to use ENUM types
  ALTER TABLE tickets_new 
    ALTER COLUMN status TYPE ticket_status USING status::ticket_status,
    ALTER COLUMN priority TYPE ticket_priority USING priority::ticket_priority;

  -- Set default values
  ALTER TABLE tickets_new 
    ALTER COLUMN status SET DEFAULT 'open'::ticket_status,
    ALTER COLUMN priority SET DEFAULT 'medium'::ticket_priority;

  -- Add RLS policies if they don't exist
  DO $policies$
  BEGIN
    -- View policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'tickets_new' AND policyname = 'View tickets'
    ) THEN
      CREATE POLICY "View tickets" ON tickets_new
        FOR SELECT
        USING (
          auth.uid() = user_id OR 
          auth.uid() = assigned_to OR
          EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
          )
        );
    END IF;

    -- Insert policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'tickets_new' AND policyname = 'Create tickets'
    ) THEN
      CREATE POLICY "Create tickets" ON tickets_new
        FOR INSERT
        WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    -- Update policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'tickets_new' AND policyname = 'Update tickets'
    ) THEN
      CREATE POLICY "Update tickets" ON tickets_new
        FOR UPDATE
        USING (
          auth.uid() = user_id OR 
          auth.uid() = assigned_to OR
          EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('admin', 'agent')
          )
        );
    END IF;

    -- Delete policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'tickets_new' AND policyname = 'Delete tickets'
    ) THEN
      CREATE POLICY "Delete tickets" ON tickets_new
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
          )
        );
    END IF;
  END;
  $policies$;

  -- Enable RLS
  ALTER TABLE tickets_new ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'Successfully fixed tickets table and types';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing tickets table and types: %', SQLERRM;
    RAISE;
END;
$$; 