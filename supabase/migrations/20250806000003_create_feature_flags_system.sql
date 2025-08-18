-- Feature Flags System Migration
-- Creates tables and functions for feature flag management and A/B testing

-- Create feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  user_groups TEXT[] DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes for feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_rollout ON feature_flags(rollout_percentage);
CREATE INDEX IF NOT EXISTS idx_feature_flags_updated_at ON feature_flags(updated_at);

-- Create A/B tests table
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '[]',
  traffic_allocation INTEGER NOT NULL DEFAULT 100 CHECK (traffic_allocation >= 0 AND traffic_allocation <= 100),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  success_metrics TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Create indexes for A/B tests
CREATE INDEX IF NOT EXISTS idx_ab_tests_name ON ab_tests(name);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ab_tests(start_date);
CREATE INDEX IF NOT EXISTS idx_ab_tests_end_date ON ab_tests(end_date);

-- Create feature flag usage tracking table
CREATE TABLE IF NOT EXISTS feature_flag_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  user_role user_role,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_flag_name ON feature_flag_usage(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_user_id ON feature_flag_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_timestamp ON feature_flag_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_feature_flag_usage_enabled ON feature_flag_usage(enabled);

-- Create A/B test assignments table
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name VARCHAR(100) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_name VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(test_name, user_id)
);

-- Create indexes for A/B test assignments
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_name ON ab_test_assignments(test_name);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_user_id ON ab_test_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_variant ON ab_test_assignments(variant_name);

-- Create feature flag metrics table for monitoring
CREATE TABLE IF NOT EXISTS feature_flag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  total_evaluations BIGINT DEFAULT 0,
  enabled_evaluations BIGINT DEFAULT 0,
  unique_users BIGINT DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  avg_evaluation_time_ms NUMERIC(10,2) DEFAULT 0,
  rollout_percentage INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(flag_name, date)
);

-- Create indexes for metrics
CREATE INDEX IF NOT EXISTS idx_feature_flag_metrics_flag_date ON feature_flag_metrics(flag_name, date);
CREATE INDEX IF NOT EXISTS idx_feature_flag_metrics_date ON feature_flag_metrics(date);

-- Enable RLS on all tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for feature_flags
CREATE POLICY "Everyone can read feature flags" ON feature_flags
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS policies for ab_tests
CREATE POLICY "Everyone can read active A/B tests" ON ab_tests
  FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can manage A/B tests" ON ab_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS policies for feature_flag_usage
CREATE POLICY "Users can view their own usage" ON feature_flag_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage" ON feature_flag_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can insert usage records" ON feature_flag_usage
  FOR INSERT WITH CHECK (true);

-- RLS policies for ab_test_assignments
CREATE POLICY "Users can view their own assignments" ON ab_test_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all assignments" ON ab_test_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can manage assignments" ON ab_test_assignments
  FOR ALL WITH CHECK (true);

-- RLS policies for feature_flag_metrics
CREATE POLICY "Admins can view metrics" ON feature_flag_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "System can manage metrics" ON feature_flag_metrics
  FOR ALL WITH CHECK (true);

-- Create function to evaluate feature flag
CREATE OR REPLACE FUNCTION evaluate_feature_flag(
  p_flag_name VARCHAR(100),
  p_user_id UUID,
  p_user_role user_role DEFAULT NULL,
  p_user_groups TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  enabled BOOLEAN,
  reason TEXT,
  metadata JSONB
) AS $
DECLARE
  flag_record RECORD;
  user_hash INTEGER;
  user_percentile INTEGER;
  user_groups_array TEXT[];
BEGIN
  -- Get the feature flag
  SELECT * INTO flag_record
  FROM feature_flags
  WHERE name = p_flag_name;
  
  -- Flag not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Flag not found', '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Flag globally disabled
  IF NOT flag_record.enabled THEN
    RETURN QUERY SELECT false, 'Flag globally disabled', '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Check user groups if specified
  IF array_length(flag_record.user_groups, 1) > 0 THEN
    user_groups_array := COALESCE(p_user_groups, ARRAY[p_user_role::TEXT]);
    
    IF NOT (flag_record.user_groups && user_groups_array) THEN
      RETURN QUERY SELECT 
        false, 
        'User not in target groups',
        jsonb_build_object(
          'userGroups', user_groups_array,
          'targetGroups', flag_record.user_groups
        );
      RETURN;
    END IF;
  END IF;
  
  -- Check rollout percentage
  IF flag_record.rollout_percentage < 100 THEN
    -- Create a hash of user_id + flag_name for consistent assignment
    user_hash := abs(hashtext(p_user_id::TEXT || p_flag_name));
    user_percentile := user_hash % 100;
    
    IF user_percentile >= flag_record.rollout_percentage THEN
      RETURN QUERY SELECT 
        false,
        'User outside rollout percentage',
        jsonb_build_object(
          'userPercentile', user_percentile,
          'rolloutPercentage', flag_record.rollout_percentage
        );
      RETURN;
    END IF;
  END IF;
  
  -- All conditions met
  RETURN QUERY SELECT true, 'All conditions met', '{}'::JSONB;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get A/B test variant
CREATE OR REPLACE FUNCTION get_ab_test_variant(
  p_test_name VARCHAR(100),
  p_user_id UUID
)
RETURNS TABLE (
  variant_name VARCHAR(100),
  assigned BOOLEAN,
  metadata JSONB
) AS $
DECLARE
  test_record RECORD;
  user_hash INTEGER;
  user_percentile INTEGER;
  variant_hash INTEGER;
  cumulative_allocation INTEGER;
  variant JSONB;
  existing_assignment VARCHAR(100);
BEGIN
  -- Check for existing assignment
  SELECT ab_test_assignments.variant_name INTO existing_assignment
  FROM ab_test_assignments
  WHERE test_name = p_test_name AND user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      existing_assignment,
      true,
      jsonb_build_object('source', 'existing_assignment');
    RETURN;
  END IF;
  
  -- Get the A/B test
  SELECT * INTO test_record
  FROM ab_tests
  WHERE name = p_test_name AND status = 'active';
  
  -- Test not found or not active
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::VARCHAR(100), false, jsonb_build_object('reason', 'test_not_active');
    RETURN;
  END IF;
  
  -- Check if user is in test traffic
  user_hash := abs(hashtext(p_user_id::TEXT || p_test_name));
  user_percentile := user_hash % 100;
  
  IF user_percentile >= test_record.traffic_allocation THEN
    RETURN QUERY SELECT NULL::VARCHAR(100), false, jsonb_build_object('reason', 'outside_traffic_allocation');
    RETURN;
  END IF;
  
  -- Determine variant
  variant_hash := user_hash % 1000; -- More granular for variant selection
  cumulative_allocation := 0;
  
  FOR variant IN SELECT * FROM jsonb_array_elements(test_record.variants)
  LOOP
    cumulative_allocation := cumulative_allocation + ((variant->>'allocation_percentage')::INTEGER * 10);
    
    IF variant_hash < cumulative_allocation THEN
      -- Assign user to this variant
      INSERT INTO ab_test_assignments (test_name, user_id, variant_name, metadata)
      VALUES (
        p_test_name,
        p_user_id,
        variant->>'name',
        jsonb_build_object('assigned_at', NOW(), 'hash', variant_hash)
      )
      ON CONFLICT (test_name, user_id) DO NOTHING;
      
      RETURN QUERY SELECT 
        (variant->>'name')::VARCHAR(100),
        true,
        jsonb_build_object('source', 'new_assignment', 'hash', variant_hash);
      RETURN;
    END IF;
  END LOOP;
  
  -- Fallback to control (should not happen with proper allocation)
  RETURN QUERY SELECT NULL::VARCHAR(100), false, jsonb_build_object('reason', 'allocation_error');
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update feature flag metrics
CREATE OR REPLACE FUNCTION update_feature_flag_metrics()
RETURNS TRIGGER AS $
BEGIN
  -- Update daily metrics
  INSERT INTO feature_flag_metrics (
    flag_name,
    date,
    total_evaluations,
    enabled_evaluations,
    unique_users
  )
  SELECT 
    NEW.flag_name,
    DATE(NEW.timestamp),
    1,
    CASE WHEN NEW.enabled THEN 1 ELSE 0 END,
    1
  ON CONFLICT (flag_name, date)
  DO UPDATE SET
    total_evaluations = feature_flag_metrics.total_evaluations + 1,
    enabled_evaluations = feature_flag_metrics.enabled_evaluations + 
      CASE WHEN NEW.enabled THEN 1 ELSE 0 END,
    unique_users = (
      SELECT COUNT(DISTINCT user_id)
      FROM feature_flag_usage
      WHERE flag_name = NEW.flag_name
        AND DATE(timestamp) = DATE(NEW.timestamp)
    );
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger for metrics updates
CREATE TRIGGER trigger_update_feature_flag_metrics
  AFTER INSERT ON feature_flag_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flag_metrics();

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_tests_updated_at 
  BEFORE UPDATE ON ab_tests
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification feature flags
INSERT INTO feature_flags (name, description, enabled, rollout_percentage, user_groups) VALUES
-- Core enhancements (start with low rollout)
('notifications_enhanced_realtime', 'Enhanced real-time notification system with better connection handling', false, 10, '{"admin"}'),
('notifications_intelligent_grouping', 'Intelligent grouping of related notifications', false, 25, '{"admin", "agent"}'),
('notifications_advanced_caching', 'Advanced caching system for better performance', true, 50, '{}'),
('notifications_optimistic_updates', 'Optimistic UI updates for better responsiveness', true, 75, '{}'),

-- UI improvements (gradual rollout)
('notifications_new_bell_ui', 'New notification bell component with improved UX', false, 20, '{"admin"}'),
('notifications_virtual_scrolling', 'Virtual scrolling for large notification lists', true, 100, '{}'),
('notifications_advanced_filtering', 'Advanced search and filtering capabilities', true, 80, '{}'),
('notifications_preview_mode', 'Quick preview of notification content', false, 30, '{"agent", "admin"}'),

-- User preferences (wide rollout)
('notifications_granular_preferences', 'Granular notification preferences per type', true, 90, '{}'),
('notifications_quiet_hours', 'Quiet hours functionality', true, 100, '{}'),
('notifications_smart_batching', 'Smart batching of notifications', false, 40, '{}'),

-- Analytics and monitoring (admin only initially)
('notifications_usage_analytics', 'Usage analytics and insights', true, 100, '{"admin"}'),
('notifications_performance_monitoring', 'Performance monitoring and metrics', true, 100, '{"admin"}'),
('notifications_error_tracking', 'Enhanced error tracking and reporting', true, 100, '{"admin"}'),

-- Security and privacy (careful rollout)
('notifications_content_encryption', 'Encryption of sensitive notification content', false, 5, '{"admin"}'),
('notifications_access_logging', 'Detailed access logging for audit', true, 100, '{"admin"}'),
('notifications_data_retention', 'Automated data retention policies', true, 100, '{}'),

-- Experimental features (limited rollout)
('notifications_ai_prioritization', 'AI-based notification prioritization', false, 1, '{"admin"}'),
('notifications_cross_tab_sync', 'Cross-tab notification synchronization', false, 15, '{}'),
('notifications_offline_queue', 'Offline notification queue', true, 60, '{}')

ON CONFLICT (name) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT ON feature_flags TO authenticated;
GRANT SELECT ON ab_tests TO authenticated;
GRANT SELECT, INSERT ON feature_flag_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ab_test_assignments TO authenticated;
GRANT SELECT ON feature_flag_metrics TO authenticated;

GRANT EXECUTE ON FUNCTION evaluate_feature_flag(VARCHAR(100), UUID, user_role, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ab_test_variant(VARCHAR(100), UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout of new functionality';
COMMENT ON TABLE ab_tests IS 'A/B tests configuration and management';
COMMENT ON TABLE feature_flag_usage IS 'Tracking of feature flag evaluations for analytics';
COMMENT ON TABLE ab_test_assignments IS 'User assignments to A/B test variants';
COMMENT ON TABLE feature_flag_metrics IS 'Aggregated metrics for feature flag usage';

COMMENT ON FUNCTION evaluate_feature_flag(VARCHAR(100), UUID, user_role, TEXT[]) IS 'Evaluates whether a feature flag is enabled for a user';
COMMENT ON FUNCTION get_ab_test_variant(VARCHAR(100), UUID) IS 'Gets the A/B test variant for a user, creating assignment if needed';