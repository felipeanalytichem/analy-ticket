-- Create notification access logs table for audit purposes
CREATE TABLE IF NOT EXISTS notification_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  notification_type notification_type,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets_new(id) ON DELETE SET NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_access_logs_user_id ON notification_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_access_logs_created_at ON notification_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_access_logs_action ON notification_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_notification_access_logs_allowed ON notification_access_logs(allowed);
CREATE INDEX IF NOT EXISTS idx_notification_access_logs_notification_id ON notification_access_logs(notification_id);

-- Enable RLS (Row Level Security)
ALTER TABLE notification_access_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can read all access logs
CREATE POLICY "Admins can read all access logs" ON notification_access_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Users can read their own access logs
CREATE POLICY "Users can read their own access logs" ON notification_access_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- System can insert access logs (no user restriction for logging)
CREATE POLICY "System can insert access logs" ON notification_access_logs
  FOR INSERT
  WITH CHECK (true);

-- Only admins can update/delete access logs
CREATE POLICY "Admins can modify access logs" ON notification_access_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE notification_access_logs IS 'Audit log for notification access and operations';
COMMENT ON COLUMN notification_access_logs.action IS 'Type of action performed: create, read, update, delete';
COMMENT ON COLUMN notification_access_logs.allowed IS 'Whether the action was allowed or denied';
COMMENT ON COLUMN notification_access_logs.reason IS 'Reason for allowing or denying the action';
COMMENT ON COLUMN notification_access_logs.ip_address IS 'IP address of the user (if available)';
COMMENT ON COLUMN notification_access_logs.user_agent IS 'User agent string (if available)';