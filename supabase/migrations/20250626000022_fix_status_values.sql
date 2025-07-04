-- Fix status values to match ENUM
DO $$
BEGIN
  -- First update status values to match our ENUM
  UPDATE tickets_new 
  SET status = CASE 
    WHEN status = 'new' THEN 'open'::ticket_status
    WHEN status = 'in-progress' THEN 'in_progress'::ticket_status
    WHEN status NOT IN ('open', 'pending', 'in_progress', 'resolved', 'closed') THEN 'open'::ticket_status
    ELSE status::ticket_status
  END
  WHERE status IS NOT NULL;

  -- Then update priority values to match our ENUM
  UPDATE tickets_new 
  SET priority = CASE 
    WHEN priority = 'low' THEN 'low'::ticket_priority
    WHEN priority = 'medium' THEN 'medium'::ticket_priority
    WHEN priority = 'high' THEN 'high'::ticket_priority
    WHEN priority = 'urgent' THEN 'urgent'::ticket_priority
    ELSE 'medium'::ticket_priority -- Default to medium if invalid
  END
  WHERE priority IS NOT NULL;

  -- Ensure all remaining null values have defaults
  UPDATE tickets_new 
  SET 
    status = COALESCE(status, 'open'::ticket_status),
    priority = COALESCE(priority, 'medium'::ticket_priority);
END $$; 