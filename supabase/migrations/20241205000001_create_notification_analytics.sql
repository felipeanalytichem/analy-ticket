-- Create notification analytics table for tracking notification interactions
CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  session_id VARCHAR(255),
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_event_type ON notification_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_timestamp ON notification_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_created_at ON notification_analytics(created_at);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_event ON notification_analytics(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_user_timestamp ON notification_analytics(user_id, timestamp);

-- Create notification analytics summary table for aggregated data
CREATE TABLE IF NOT EXISTS notification_analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_deleted INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  average_read_time_seconds INTEGER DEFAULT 0,
  type_breakdown JSONB DEFAULT '{}',
  delivery_stats JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for summary table
CREATE INDEX IF NOT EXISTS idx_notification_analytics_summary_user_id ON notification_analytics_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_summary_date ON notification_analytics_summary(date);
CREATE INDEX IF NOT EXISTS idx_notification_analytics_summary_user_date ON notification_analytics_summary(user_id, date);

-- Enable RLS on analytics tables
ALTER TABLE notification_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_analytics_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notification_analytics
CREATE POLICY "Users can view their own analytics" ON notification_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics" ON notification_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert analytics" ON notification_analytics
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for notification_analytics_summary
CREATE POLICY "Users can view their own analytics summary" ON notification_analytics_summary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics summaries" ON notification_analytics_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can manage analytics summaries" ON notification_analytics_summary
  FOR ALL WITH CHECK (true);

-- Create function to update analytics summary
CREATE OR REPLACE FUNCTION update_notification_analytics_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert daily summary for the user
  INSERT INTO notification_analytics_summary (
    user_id, 
    date,
    total_sent,
    total_read,
    total_deleted,
    total_clicked,
    updated_at
  )
  SELECT 
    NEW.user_id,
    DATE(NEW.timestamp),
    COUNT(CASE WHEN event_type = 'sent' THEN 1 END),
    COUNT(CASE WHEN event_type = 'read' THEN 1 END),
    COUNT(CASE WHEN event_type = 'deleted' THEN 1 END),
    COUNT(CASE WHEN event_type = 'clicked' THEN 1 END),
    NOW()
  FROM notification_analytics 
  WHERE user_id = NEW.user_id 
    AND DATE(timestamp) = DATE(NEW.timestamp)
  GROUP BY user_id
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_read = EXCLUDED.total_read,
    total_deleted = EXCLUDED.total_deleted,
    total_clicked = EXCLUDED.total_clicked,
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update summary
CREATE TRIGGER trigger_update_notification_analytics_summary
  AFTER INSERT ON notification_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_analytics_summary();

-- Grant necessary permissions
GRANT SELECT, INSERT ON notification_analytics TO authenticated;
GRANT SELECT ON notification_analytics_summary TO authenticated;