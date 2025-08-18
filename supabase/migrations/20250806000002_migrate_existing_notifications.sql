-- Data Migration Script for Existing Notifications
-- This script migrates existing notification data to the new enhanced structure

-- Create temporary function to migrate existing notifications
CREATE OR REPLACE FUNCTION migrate_existing_notifications()
RETURNS TABLE (
  migrated_notifications INTEGER,
  created_groups INTEGER,
  updated_preferences INTEGER
) AS $
DECLARE
  notification_count INTEGER := 0;
  group_count INTEGER := 0;
  preference_count INTEGER := 0;
  notification_record RECORD;
  group_id UUID;
BEGIN
  -- Migrate existing notifications to new structure
  RAISE NOTICE 'Starting migration of existing notifications...';
  
  -- Update delivery status for existing notifications
  UPDATE notifications 
  SET delivery_status = 'delivered',
      metadata = '{}',
      read_at = CASE WHEN read = true THEN updated_at ELSE NULL END
  WHERE delivery_status IS NULL;
  
  GET DIAGNOSTICS notification_count = ROW_COUNT;
  RAISE NOTICE 'Updated % existing notifications with new fields', notification_count;
  
  -- Create notification groups for existing notifications
  RAISE NOTICE 'Creating notification groups for existing notifications...';
  
  FOR notification_record IN 
    SELECT DISTINCT user_id, ticket_id, type
    FROM notifications 
    WHERE grouped_id IS NULL
    ORDER BY user_id, ticket_id, type
  LOOP
    -- Create group for this combination
    SELECT group_notification(
      notification_record.user_id,
      (SELECT id FROM notifications 
       WHERE user_id = notification_record.user_id 
         AND COALESCE(ticket_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(notification_record.ticket_id, '00000000-0000-0000-0000-000000000000'::UUID)
         AND type = notification_record.type 
         AND grouped_id IS NULL 
       ORDER BY created_at DESC 
       LIMIT 1),
      notification_record.ticket_id,
      notification_record.type
    ) INTO group_id;
    
    -- Update all matching notifications with the group ID
    UPDATE notifications 
    SET grouped_id = group_id
    WHERE user_id = notification_record.user_id 
      AND COALESCE(ticket_id, '00000000-0000-0000-0000-000000000000'::UUID) = COALESCE(notification_record.ticket_id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND type = notification_record.type 
      AND grouped_id IS NULL;
    
    group_count := group_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Created % notification groups', group_count;
  
  -- Update group counts to reflect actual notification counts
  UPDATE notification_groups 
  SET notification_count = (
    SELECT COUNT(*) 
    FROM notifications 
    WHERE grouped_id = notification_groups.id
  ),
  unread_count = (
    SELECT COUNT(*) 
    FROM notifications 
    WHERE grouped_id = notification_groups.id 
      AND read = false
  ),
  latest_notification_id = (
    SELECT id 
    FROM notifications 
    WHERE grouped_id = notification_groups.id 
    ORDER BY created_at DESC 
    LIMIT 1
  );
  
  RAISE NOTICE 'Updated group counts for all groups';
  
  -- Create default notification preferences for existing users who don't have them
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
  )
  SELECT 
    u.id,
    true,  -- email_notifications
    true,  -- toast_notifications
    false, -- sound_notifications
    false, -- quiet_hours_enabled
    '22:00'::TIME, -- quiet_hours_start
    '08:00'::TIME, -- quiet_hours_end
    jsonb_build_object(
      'ticket_created', jsonb_build_object('enabled', true, 'priority', 'medium', 'delivery', 'instant'),
      'ticket_updated', jsonb_build_object('enabled', true, 'priority', 'medium', 'delivery', 'instant'),
      'ticket_assigned', jsonb_build_object('enabled', true, 'priority', 'high', 'delivery', 'instant'),
      'comment_added', jsonb_build_object('enabled', true, 'priority', 'medium', 'delivery', 'instant'),
      'status_changed', jsonb_build_object('enabled', true, 'priority', 'medium', 'delivery', 'instant'),
      'priority_changed', jsonb_build_object('enabled', true, 'priority', 'medium', 'delivery', 'instant'),
      'assignment_changed', jsonb_build_object('enabled', true, 'priority', 'high', 'delivery', 'instant'),
      'sla_warning', jsonb_build_object('enabled', true, 'priority', 'high', 'delivery', 'instant'),
      'sla_breach', jsonb_build_object('enabled', true, 'priority', 'high', 'delivery', 'instant')
    ), -- type_preferences
    'en', -- language (default to English)
    'UTC' -- timezone (default to UTC)
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np 
    WHERE np.user_id = u.id
  );
  
  GET DIAGNOSTICS preference_count = ROW_COUNT;
  RAISE NOTICE 'Created default preferences for % users', preference_count;
  
  -- Create initial analytics entries for existing notifications
  INSERT INTO notification_analytics (
    user_id,
    notification_id,
    event_type,
    timestamp,
    metadata
  )
  SELECT 
    user_id,
    id,
    'sent',
    created_at,
    jsonb_build_object('migrated', true)
  FROM notifications
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_analytics na 
    WHERE na.notification_id = notifications.id 
      AND na.event_type = 'sent'
  );
  
  -- Create read events for notifications that are already read
  INSERT INTO notification_analytics (
    user_id,
    notification_id,
    event_type,
    timestamp,
    metadata
  )
  SELECT 
    user_id,
    id,
    'read',
    COALESCE(read_at, updated_at),
    jsonb_build_object('migrated', true)
  FROM notifications
  WHERE read = true
    AND NOT EXISTS (
      SELECT 1 FROM notification_analytics na 
      WHERE na.notification_id = notifications.id 
        AND na.event_type = 'read'
    );
  
  RAISE NOTICE 'Created analytics entries for existing notifications';
  
  -- Return migration statistics
  migrated_notifications := notification_count;
  created_groups := group_count;
  updated_preferences := preference_count;
  RETURN NEXT;
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Summary: % notifications migrated, % groups created, % preferences updated', 
    notification_count, group_count, preference_count;
END;
$ LANGUAGE plpgsql;

-- Execute the migration
SELECT * FROM migrate_existing_notifications();

-- Drop the temporary migration function
DROP FUNCTION migrate_existing_notifications();

-- Create function to validate migration results
CREATE OR REPLACE FUNCTION validate_notification_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $
BEGIN
  -- Check 1: All notifications have delivery status
  RETURN QUERY
  SELECT 
    'Delivery Status Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    'Notifications without delivery status: ' || COUNT(*)::TEXT
  FROM notifications 
  WHERE delivery_status IS NULL;
  
  -- Check 2: All notifications have metadata
  RETURN QUERY
  SELECT 
    'Metadata Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    'Notifications without metadata: ' || COUNT(*)::TEXT
  FROM notifications 
  WHERE metadata IS NULL;
  
  -- Check 3: Group counts are accurate
  RETURN QUERY
  SELECT 
    'Group Count Accuracy'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    'Groups with incorrect counts: ' || COUNT(*)::TEXT
  FROM notification_groups ng
  WHERE ng.notification_count != (
    SELECT COUNT(*) 
    FROM notifications n 
    WHERE n.grouped_id = ng.id
  );
  
  -- Check 4: All users have notification preferences
  RETURN QUERY
  SELECT 
    'User Preferences Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    'Users without preferences: ' || COUNT(*)::TEXT
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_preferences np 
    WHERE np.user_id = u.id
  );
  
  -- Check 5: Analytics entries exist for notifications
  RETURN QUERY
  SELECT 
    'Analytics Coverage Check'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END,
    'Notifications without analytics: ' || COUNT(*)::TEXT
  FROM notifications n
  WHERE NOT EXISTS (
    SELECT 1 FROM notification_analytics na 
    WHERE na.notification_id = n.id
  );
  
  -- Summary statistics
  RETURN QUERY
  SELECT 
    'Migration Summary'::TEXT,
    'INFO'::TEXT,
    'Total notifications: ' || (SELECT COUNT(*) FROM notifications)::TEXT ||
    ', Total groups: ' || (SELECT COUNT(*) FROM notification_groups)::TEXT ||
    ', Total preferences: ' || (SELECT COUNT(*) FROM notification_preferences)::TEXT ||
    ', Total analytics: ' || (SELECT COUNT(*) FROM notification_analytics)::TEXT;
END;
$ LANGUAGE plpgsql;

-- Run validation
SELECT * FROM validate_notification_migration();

-- Create indexes for better performance after migration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read_created 
  ON notifications(user_id, read, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_groups_user_updated 
  ON notification_groups(user_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_analytics_user_timestamp 
  ON notification_analytics(user_id, timestamp DESC);

-- Update table statistics for better query planning
ANALYZE notifications;
ANALYZE notification_groups;
ANALYZE notification_preferences;
ANALYZE notification_analytics;

-- Add comments about the migration
COMMENT ON FUNCTION validate_notification_migration() IS 'Validates that the notification system migration completed successfully';

-- Log migration completion
DO $
BEGIN
  RAISE NOTICE 'Notification system migration completed at %', NOW();
  RAISE NOTICE 'All existing notifications have been migrated to the new enhanced structure';
  RAISE NOTICE 'Notification groups have been created for better organization';
  RAISE NOTICE 'Default preferences have been set for all users';
  RAISE NOTICE 'Analytics tracking has been initialized for existing data';
END;
$;