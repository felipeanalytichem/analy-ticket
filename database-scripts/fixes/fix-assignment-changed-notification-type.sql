-- Fix for "invalid input value for enum notification_type: assignment_changed"
-- This script adds the missing 'assignment_changed' value to the notification_type enum

-- Add 'assignment_changed' to notification_type enum
DO $$
BEGIN
    -- Check if 'assignment_changed' value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type') 
        AND enumlabel = 'assignment_changed'
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'assignment_changed';
        RAISE NOTICE 'Added assignment_changed value to notification_type enum';
    ELSE
        RAISE NOTICE 'assignment_changed value already exists in notification_type enum';
    END IF;
END $$;

-- Verify the change
SELECT 'Current notification_type enum values:' as status;
SELECT enumlabel as notification_types
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
ORDER BY enumlabel;

-- Test the new enum value (optional - will create and immediately delete a test notification)
DO $$
DECLARE
    test_notification_id uuid;
BEGIN
    -- Create a test notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        priority,
        read,
        created_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        'assignment_changed',
        'Test Notification',
        'Testing assignment_changed notification type',
        'medium',
        false,
        NOW()
    ) RETURNING id INTO test_notification_id;
    
    RAISE NOTICE 'Test notification created with ID: %', test_notification_id;
    
    -- Immediately delete the test notification
    DELETE FROM notifications WHERE id = test_notification_id;
    
    RAISE NOTICE 'Test notification deleted - assignment_changed type is working!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test failed: %', SQLERRM;
END $$; 