-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  toast_notifications BOOLEAN NOT NULL DEFAULT true,
  sound_notifications BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '08:00',
  type_preferences JSONB NOT NULL DEFAULT '{}',
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Create index on language for analytics
CREATE INDEX IF NOT EXISTS idx_notification_preferences_language ON notification_preferences(language);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Row Level Security (RLS) policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only view and modify their own preferences
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all preferences for analytics
CREATE POLICY "Admins can view all notification preferences"
  ON notification_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Function to get user preferences with defaults
CREATE OR REPLACE FUNCTION get_user_notification_preferences(user_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  email_notifications BOOLEAN,
  toast_notifications BOOLEAN,
  sound_notifications BOOLEAN,
  quiet_hours_enabled BOOLEAN,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  type_preferences JSONB,
  language VARCHAR(5),
  timezone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Try to get existing preferences
  RETURN QUERY
  SELECT 
    np.user_id,
    np.email_notifications,
    np.toast_notifications,
    np.sound_notifications,
    np.quiet_hours_enabled,
    np.quiet_hours_start,
    np.quiet_hours_end,
    np.type_preferences,
    np.language,
    np.timezone,
    np.created_at,
    np.updated_at
  FROM notification_preferences np
  WHERE np.user_id = user_uuid;

  -- If no preferences exist, return defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      user_uuid,
      true::BOOLEAN,  -- email_notifications
      true::BOOLEAN,  -- toast_notifications
      false::BOOLEAN, -- sound_notifications
      false::BOOLEAN, -- quiet_hours_enabled
      '22:00'::TIME,  -- quiet_hours_start
      '08:00'::TIME,  -- quiet_hours_end
      '{}'::JSONB,    -- type_preferences (empty, will be populated by application)
      'en'::VARCHAR(5), -- language
      'UTC'::VARCHAR(50), -- timezone
      NOW(),          -- created_at
      NOW();          -- updated_at
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert user preferences
CREATE OR REPLACE FUNCTION upsert_user_notification_preferences(
  user_uuid UUID,
  p_email_notifications BOOLEAN DEFAULT NULL,
  p_toast_notifications BOOLEAN DEFAULT NULL,
  p_sound_notifications BOOLEAN DEFAULT NULL,
  p_quiet_hours_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL,
  p_type_preferences JSONB DEFAULT NULL,
  p_language VARCHAR(5) DEFAULT NULL,
  p_timezone VARCHAR(50) DEFAULT NULL
)
RETURNS notification_preferences AS $$
DECLARE
  result notification_preferences;
BEGIN
  INSERT INTO notification_preferences (
    user_id,
    email_notifications,
    toast_notifications,
    sound_notifications,
    quiet_hours_enabled,
    quiet_hours_start,
    quiet_hours_end,
    type_preferences,
    language,
    timezone
  ) VALUES (
    user_uuid,
    COALESCE(p_email_notifications, true),
    COALESCE(p_toast_notifications, true),
    COALESCE(p_sound_notifications, false),
    COALESCE(p_quiet_hours_enabled, false),
    COALESCE(p_quiet_hours_start, '22:00'::TIME),
    COALESCE(p_quiet_hours_end, '08:00'::TIME),
    COALESCE(p_type_preferences, '{}'::JSONB),
    COALESCE(p_language, 'en'),
    COALESCE(p_timezone, 'UTC')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_notifications = COALESCE(p_email_notifications, notification_preferences.email_notifications),
    toast_notifications = COALESCE(p_toast_notifications, notification_preferences.toast_notifications),
    sound_notifications = COALESCE(p_sound_notifications, notification_preferences.sound_notifications),
    quiet_hours_enabled = COALESCE(p_quiet_hours_enabled, notification_preferences.quiet_hours_enabled),
    quiet_hours_start = COALESCE(p_quiet_hours_start, notification_preferences.quiet_hours_start),
    quiet_hours_end = COALESCE(p_quiet_hours_end, notification_preferences.quiet_hours_end),
    type_preferences = COALESCE(p_type_preferences, notification_preferences.type_preferences),
    language = COALESCE(p_language, notification_preferences.language),
    timezone = COALESCE(p_timezone, notification_preferences.timezone),
    updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notification_preferences(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_notification_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIME, TIME, JSONB, VARCHAR(5), VARCHAR(50)) TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE notification_preferences IS 'Stores user notification preferences including delivery methods, quiet hours, and per-type settings';
COMMENT ON COLUMN notification_preferences.type_preferences IS 'JSONB object containing preferences for each notification type with enabled, priority, and delivery settings';
COMMENT ON FUNCTION get_user_notification_preferences(UUID) IS 'Returns user notification preferences with defaults if none exist';
COMMENT ON FUNCTION upsert_user_notification_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TIME, TIME, JSONB, VARCHAR(5), VARCHAR(50)) IS 'Creates or updates user notification preferences';