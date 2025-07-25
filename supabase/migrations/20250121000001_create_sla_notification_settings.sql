-- Create SLA notification settings table
CREATE TABLE IF NOT EXISTS sla_notification_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    breach_notifications_enabled BOOLEAN DEFAULT true,
    warning_notifications_enabled BOOLEAN DEFAULT true,
    summary_frequency TEXT DEFAULT 'hourly' CHECK (summary_frequency IN ('immediate', 'hourly', 'daily', 'disabled')),
    notification_threshold INTEGER DEFAULT 3 CHECK (notification_threshold > 0),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    priority_filter TEXT DEFAULT 'all' CHECK (priority_filter IN ('all', 'high_urgent', 'urgent_only')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sla_notification_settings_user_id ON sla_notification_settings(user_id);

-- Enable RLS
ALTER TABLE sla_notification_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own SLA notification settings" ON sla_notification_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SLA notification settings" ON sla_notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SLA notification settings" ON sla_notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SLA notification settings" ON sla_notification_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can manage all SLA notification settings
CREATE POLICY "Admins can manage all SLA notification settings" ON sla_notification_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sla_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_sla_notification_settings_updated_at
    BEFORE UPDATE ON sla_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_sla_notification_settings_updated_at();

-- Insert default settings for existing admin users
INSERT INTO sla_notification_settings (user_id, breach_notifications_enabled, warning_notifications_enabled, summary_frequency, notification_threshold, priority_filter)
SELECT 
    id,
    true,
    true,
    'hourly',
    3,
    'all'
FROM profiles 
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE sla_notification_settings IS 'Stores user preferences for SLA breach and warning notifications';