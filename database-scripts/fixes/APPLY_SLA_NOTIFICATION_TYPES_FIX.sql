-- URGENT FIX: Add missing SLA notification types to resolve the enum constraint violation
-- Run this SQL in your Supabase SQL editor to fix the immediate SLA breach notification error

-- Add 'sla_warning' to notification_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sla_warning' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')) THEN
        ALTER TYPE notification_type ADD VALUE 'sla_warning';
        RAISE NOTICE 'Added sla_warning value to notification_type enum';
    ELSE
        RAISE NOTICE 'sla_warning value already exists in notification_type enum';
    END IF;
END $$;

-- Add 'sla_breach' to notification_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sla_breach' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')) THEN
        ALTER TYPE notification_type ADD VALUE 'sla_breach';
        RAISE NOTICE 'Added sla_breach value to notification_type enum';
    ELSE
        RAISE NOTICE 'sla_breach value already exists in notification_type enum';
    END IF;
END $$;

-- Verify the fix by showing current notification_type enum values
SELECT 'VERIFICATION: Current notification_type enum values:' as status;
SELECT enumlabel as available_notification_types 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
ORDER BY enumlabel;

-- Test notification creation with new types (this will show success message if working)
DO $$
DECLARE
    test_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Test sla_warning type
    BEGIN
        INSERT INTO notifications (user_id, type, title, message, priority, read, created_at)
        VALUES (test_user_id, 'sla_warning', 'Test SLA Warning', 'Test message for SLA warning', 'high', false, NOW());
        
        DELETE FROM notifications WHERE user_id = test_user_id AND title = 'Test SLA Warning';
        RAISE NOTICE 'SUCCESS: sla_warning notification type is working correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR testing sla_warning: %', SQLERRM;
    END;
    
    -- Test sla_breach type
    BEGIN
        INSERT INTO notifications (user_id, type, title, message, priority, read, created_at)
        VALUES (test_user_id, 'sla_breach', 'Test SLA Breach', 'Test message for SLA breach', 'high', false, NOW());
        
        DELETE FROM notifications WHERE user_id = test_user_id AND title = 'Test SLA Breach';
        RAISE NOTICE 'SUCCESS: sla_breach notification type is working correctly';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR testing sla_breach: %', SQLERRM;
    END;
END $$;

SELECT 'FIX COMPLETED: SLA notification types have been added successfully!' as final_status; 