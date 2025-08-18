-- Add encryption support fields to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS encrypted_fields TEXT[],
ADD COLUMN IF NOT EXISTS encryption_data JSONB,
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS retention_policy VARCHAR(50);

-- Create index for archived notifications
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(archived);

-- Create index for retention policy
CREATE INDEX IF NOT EXISTS idx_notifications_retention_policy ON notifications(retention_policy);

-- Create index for created_at for retention queries
CREATE INDEX IF NOT EXISTS idx_notifications_created_at_type ON notifications(created_at, type);

-- Create notification retention policies table
CREATE TABLE IF NOT EXISTS notification_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type notification_type NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 90,
  archive_after_days INTEGER,
  delete_after_days INTEGER NOT NULL DEFAULT 365,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default retention policies
INSERT INTO notification_retention_policies (notification_type, retention_days, delete_after_days) VALUES
('ticket_created', 365, 1095),
('ticket_updated', 365, 1095),
('ticket_assigned', 180, 730),
('comment_added', 180, 730),
('status_changed', 180, 730),
('priority_changed', 90, 365),
('assignment_changed', 90, 365),
('sla_warning', 730, 2555),
('sla_breach', 730, 2555)
ON CONFLICT (notification_type) DO NOTHING;

-- Enable RLS on retention policies table
ALTER TABLE notification_retention_policies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for retention policies
-- Only admins can read retention policies
CREATE POLICY "Admins can read retention policies" ON notification_retention_policies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Only admins can modify retention policies
CREATE POLICY "Admins can modify retention policies" ON notification_retention_policies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create function to automatically apply retention policies
CREATE OR REPLACE FUNCTION apply_notification_retention_policies()
RETURNS TABLE(archived_count INTEGER, deleted_count INTEGER) AS $$
DECLARE
  policy_record RECORD;
  archive_count INTEGER := 0;
  delete_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- Loop through all retention policies
  FOR policy_record IN 
    SELECT notification_type, retention_days, archive_after_days, delete_after_days
    FROM notification_retention_policies
  LOOP
    -- Archive notifications if archive_after_days is set
    IF policy_record.archive_after_days IS NOT NULL THEN
      UPDATE notifications 
      SET archived = TRUE, updated_at = NOW()
      WHERE type = policy_record.notification_type
        AND created_at < (NOW() - INTERVAL '1 day' * policy_record.archive_after_days)
        AND archived = FALSE;
      
      GET DIAGNOSTICS temp_count = ROW_COUNT;
      archive_count := archive_count + temp_count;
    END IF;
    
    -- Delete old notifications
    DELETE FROM notifications
    WHERE type = policy_record.notification_type
      AND created_at < (NOW() - INTERVAL '1 day' * policy_record.delete_after_days);
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    delete_count := delete_count + temp_count;
  END LOOP;
  
  -- Return counts
  archived_count := archive_count;
  deleted_count := delete_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if notification contains sensitive data
CREATE OR REPLACE FUNCTION contains_sensitive_data(content TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check for credit card patterns
  IF content ~ '\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for SSN patterns
  IF content ~ '\b\d{3}-\d{2}-\d{4}\b' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for email patterns
  IF content ~ '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for phone patterns
  IF content ~ '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for password/token patterns
  IF content ~* '\b(?:password|pwd|pass|secret|token|key)\s*[:=]\s*\S+' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for API key patterns
  IF content ~* '\b(?:api[_-]?key|access[_-]?token|bearer)\s*[:=]\s*\S+' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comments for documentation
COMMENT ON COLUMN notifications.encrypted_fields IS 'Array of field names that are encrypted';
COMMENT ON COLUMN notifications.encryption_data IS 'JSON object containing encryption data for encrypted fields';
COMMENT ON COLUMN notifications.archived IS 'Whether the notification has been archived';
COMMENT ON COLUMN notifications.retention_policy IS 'Custom retention policy for this notification';

COMMENT ON TABLE notification_retention_policies IS 'Defines data retention policies for different notification types';
COMMENT ON FUNCTION apply_notification_retention_policies() IS 'Applies retention policies to archive and delete old notifications';
COMMENT ON FUNCTION contains_sensitive_data(TEXT) IS 'Checks if content contains patterns that might be sensitive data';