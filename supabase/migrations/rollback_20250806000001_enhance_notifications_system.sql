-- Rollback Script for Enhanced Notifications System
-- This script safely rolls back the notification system enhancements

-- WARNING: This rollback will remove enhanced notification features
-- Make sure to backup data before running this script

-- Create rollback validation function
CREATE OR REPLACE FUNCTION validate_rollback_safety()
RETURNS TABLE (
  check_name TEXT,
  safe_to_rollback BOOLEAN,
  reason TEXT,
  affected_records BIGINT
) AS $
BEGIN
  -- Check 1: Count notifications that would lose grouping data
  RETURN QUERY
  SELECT 
    'Grouped Notifications'::TEXT,
    true::BOOLEAN,
    'Notifications will lose grouping but core data preserved'::TEXT,
    COUNT(*)
  FROM notifications 
  WHERE grouped_id IS NOT NULL;
  
  -- Check 2: Count notification queue entries
  RETURN QUERY
  SELECT 
    'Notification Queue'::TEXT,
    (SELECT COUNT(*) FROM notification_queue WHERE attempts > 0) = 0,
    CASE 
      WHEN (SELECT COUNT(*) FROM notification_queue WHERE attempts > 0) > 0 
      THEN 'Active queue entries will be lost'
      ELSE 'No active queue entries'
    END,
    (SELECT COUNT(*) FROM notification_queue);
  
  -- Check 3: Count notification groups
  RETURN QUERY
  SELECT 
    'Notification Groups'::TEXT,
    true::BOOLEAN,
    'Groups will be removed but notifications preserved'::TEXT,
    (SELECT COUNT(*) FROM notification_groups);
  
  -- Check 4: Count custom templates
  RETURN QUERY
  SELECT 
    'Custom Templates'::TEXT,
    (SELECT COUNT(*) FROM notification_templates WHERE created_at > NOW() - INTERVAL '1 day') = 0,
    CASE 
      WHEN (SELECT COUNT(*) FROM notification_templates WHERE created_at > NOW() - INTERVAL '1 day') > 0 
      THEN 'Recently created templates will be lost'
      ELSE 'Only default templates will be removed'
    END,
    (SELECT COUNT(*) FROM notification_templates);
  
  -- Check 5: Count delivery logs
  RETURN QUERY
  SELECT 
    'Delivery Logs'::TEXT,
    true::BOOLEAN,
    'Delivery history will be lost'::TEXT,
    (SELECT COUNT(*) FROM notification_delivery_log);
END;
$ LANGUAGE plpgsql;

-- Run rollback safety validation
SELECT * FROM validate_rollback_safety();

-- Create backup tables before rollback
CREATE TABLE IF NOT EXISTS notification_groups_backup AS 
SELECT * FROM notification_groups;

CREATE TABLE IF NOT EXISTS notification_queue_backup AS 
SELECT * FROM notification_queue;

CREATE TABLE IF NOT EXISTS notification_templates_backup AS 
SELECT * FROM notification_templates;

CREATE TABLE IF NOT EXISTS notification_delivery_log_backup AS 
SELECT * FROM notification_delivery_log;

-- Create backup of enhanced notification data
CREATE TABLE IF NOT EXISTS notifications_enhanced_backup AS 
SELECT 
  id,
  grouped_id,
  delivery_status,
  retry_count,
  scheduled_for,
  metadata,
  source_ip,
  user_agent,
  read_at,
  clicked_at,
  dismissed_at,
  expires_at
FROM notifications 
WHERE grouped_id IS NOT NULL 
   OR delivery_status != 'delivered' 
   OR retry_count > 0 
   OR scheduled_for IS NOT NULL 
   OR metadata != '{}'
   OR source_ip IS NOT NULL 
   OR user_agent IS NOT NULL 
   OR read_at IS NOT NULL 
   OR clicked_at IS NOT NULL 
   OR dismissed_at IS NOT NULL 
   OR expires_at IS NOT NULL;

-- Log backup creation
DO $
BEGIN
  RAISE NOTICE 'Created backup tables:';
  RAISE NOTICE '- notification_groups_backup: % records', (SELECT COUNT(*) FROM notification_groups_backup);
  RAISE NOTICE '- notification_queue_backup: % records', (SELECT COUNT(*) FROM notification_queue_backup);
  RAISE NOTICE '- notification_templates_backup: % records', (SELECT COUNT(*) FROM notification_templates_backup);
  RAISE NOTICE '- notification_delivery_log_backup: % records', (SELECT COUNT(*) FROM notification_delivery_log_backup);
  RAISE NOTICE '- notifications_enhanced_backup: % records', (SELECT COUNT(*) FROM notifications_enhanced_backup);
END;
$;

-- Drop triggers first to prevent cascading issues
DROP TRIGGER IF EXISTS trigger_auto_group_notifications ON notifications;
DROP TRIGGER IF EXISTS trigger_update_group_read_count ON notifications;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_group_notification();
DROP FUNCTION IF EXISTS trigger_update_group_read_count();
DROP FUNCTION IF EXISTS group_notification(UUID, UUID, UUID, notification_type);
DROP FUNCTION IF EXISTS mark_notification_group_read(UUID, UUID);
DROP FUNCTION IF EXISTS get_notification_stats(UUID);
DROP FUNCTION IF EXISTS cleanup_expired_notifications();

-- Drop new tables (in reverse dependency order)
DROP TABLE IF EXISTS notification_delivery_log;
DROP TABLE IF EXISTS notification_templates;
DROP TABLE IF EXISTS notification_groups;
DROP TABLE IF EXISTS notification_queue;

-- Remove new columns from notifications table
ALTER TABLE notifications 
DROP COLUMN IF EXISTS grouped_id,
DROP COLUMN IF EXISTS delivery_status,
DROP COLUMN IF EXISTS retry_count,
DROP COLUMN IF EXISTS scheduled_for,
DROP COLUMN IF EXISTS metadata,
DROP COLUMN IF EXISTS source_ip,
DROP COLUMN IF EXISTS user_agent,
DROP COLUMN IF EXISTS read_at,
DROP COLUMN IF EXISTS clicked_at,
DROP COLUMN IF EXISTS dismissed_at,
DROP COLUMN IF EXISTS expires_at;

-- Drop new indexes
DROP INDEX IF EXISTS idx_notifications_grouped_id;
DROP INDEX IF EXISTS idx_notifications_delivery_status;
DROP INDEX IF EXISTS idx_notifications_scheduled_for;
DROP INDEX IF EXISTS idx_notifications_expires_at;
DROP INDEX IF EXISTS idx_notifications_read_at;
DROP INDEX IF EXISTS idx_notifications_type_user;
DROP INDEX IF EXISTS idx_notifications_ticket_type;
DROP INDEX IF EXISTS idx_notifications_user_read_created;
DROP INDEX IF EXISTS idx_notification_groups_user_updated;

-- Note: We keep the notification_preferences table and related analytics tables
-- as they are part of earlier migrations and may be used independently

-- Create function to restore from backup if needed
CREATE OR REPLACE FUNCTION restore_from_backup()
RETURNS TEXT AS $
DECLARE
  result TEXT := '';
BEGIN
  -- This function can be used to restore data from backup tables
  -- It should be run manually after careful consideration
  
  result := 'Backup tables available for manual restoration:' || E'\n';
  result := result || '- notification_groups_backup' || E'\n';
  result := result || '- notification_queue_backup' || E'\n';
  result := result || '- notification_templates_backup' || E'\n';
  result := result || '- notification_delivery_log_backup' || E'\n';
  result := result || '- notifications_enhanced_backup' || E'\n';
  result := result || E'\nTo restore, manually recreate tables and copy data from backup tables.';
  
  RETURN result;
END;
$ LANGUAGE plpgsql;

-- Create function to clean up backup tables (run manually when safe)
CREATE OR REPLACE FUNCTION cleanup_rollback_backups()
RETURNS TEXT AS $
BEGIN
  DROP TABLE IF EXISTS notification_groups_backup;
  DROP TABLE IF EXISTS notification_queue_backup;
  DROP TABLE IF EXISTS notification_templates_backup;
  DROP TABLE IF EXISTS notification_delivery_log_backup;
  DROP TABLE IF EXISTS notifications_enhanced_backup;
  
  RETURN 'Backup tables cleaned up successfully';
END;
$ LANGUAGE plpgsql;

-- Drop the rollback validation function
DROP FUNCTION IF EXISTS validate_rollback_safety();

-- Log rollback completion
DO $
BEGIN
  RAISE NOTICE 'Notification system rollback completed at %', NOW();
  RAISE NOTICE 'Enhanced features have been removed';
  RAISE NOTICE 'Core notification functionality preserved';
  RAISE NOTICE 'Backup tables created for data recovery if needed';
  RAISE NOTICE 'Run SELECT restore_from_backup(); for restoration instructions';
  RAISE NOTICE 'Run SELECT cleanup_rollback_backups(); to clean up backup tables when safe';
END;
$;

-- Add comments
COMMENT ON FUNCTION restore_from_backup() IS 'Provides instructions for restoring data from rollback backup tables';
COMMENT ON FUNCTION cleanup_rollback_backups() IS 'Removes rollback backup tables - use only when certain rollback is permanent';