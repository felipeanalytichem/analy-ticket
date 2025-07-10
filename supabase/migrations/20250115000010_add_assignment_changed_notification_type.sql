-- Add 'assignment_changed' to notification_type enum
-- This fixes the error: invalid input value for enum notification_type: "assignment_changed"

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