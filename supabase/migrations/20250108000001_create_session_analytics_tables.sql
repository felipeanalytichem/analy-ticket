-- Create session analytics events table
CREATE TABLE IF NOT EXISTS session_analytics_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'session_start', 'session_end', 'session_refresh', 'session_warning', 
        'session_expired', 'token_refresh', 'connection_lost', 'connection_restored', 
        'offline_mode', 'sync_completed', 'error_occurred'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    user_agent TEXT,
    tab_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create session performance metrics table
CREATE TABLE IF NOT EXISTS session_performance_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'session_duration', 'connection_latency', 'sync_time', 
        'error_recovery_time', 'offline_duration'
    )),
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('ms', 'seconds', 'minutes', 'count')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user behavior analytics table
CREATE TABLE IF NOT EXISTS user_behavior_analytics (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_view', 'form_interaction', 'offline_action', 'manual_sync', 
        'session_extension', 'error_recovery_attempt'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    page TEXT,
    action TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_analytics_events_timestamp ON session_analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_analytics_events_user_id ON session_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_events_session_id ON session_analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_events_type ON session_analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_session_performance_metrics_timestamp ON session_performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_session_performance_metrics_user_id ON session_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_performance_metrics_session_id ON session_performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_performance_metrics_type ON session_performance_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_user_behavior_analytics_timestamp ON user_behavior_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_behavior_analytics_user_id ON user_behavior_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_analytics_session_id ON user_behavior_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_analytics_type ON user_behavior_analytics(event_type);

-- Enable Row Level Security
ALTER TABLE session_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for session analytics events
CREATE POLICY "Users can view their own session analytics events" ON session_analytics_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session analytics events" ON session_analytics_events
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all session analytics events" ON session_analytics_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create RLS policies for session performance metrics
CREATE POLICY "Users can view their own performance metrics" ON session_performance_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own performance metrics" ON session_performance_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all performance metrics" ON session_performance_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create RLS policies for user behavior analytics
CREATE POLICY "Users can view their own behavior analytics" ON user_behavior_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own behavior analytics" ON user_behavior_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all behavior analytics" ON user_behavior_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Create a function to clean up old analytics data (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    DELETE FROM session_analytics_events 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM session_performance_metrics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM user_behavior_analytics 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup weekly (requires pg_cron extension)
-- This would typically be set up separately in production
-- SELECT cron.schedule('cleanup-analytics', '0 2 * * 0', 'SELECT cleanup_old_analytics_data();');