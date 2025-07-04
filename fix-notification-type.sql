-- Quick fix to add 'closed' notification type
-- This can be run directly in Supabase SQL Editor

DO $$
BEGIN
    -- Check if 'closed' value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'closed' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'notification_type'
        )
    ) THEN
        -- Add 'closed' to the notification_type enum
        ALTER TYPE notification_type ADD VALUE 'closed';
        RAISE NOTICE 'Added "closed" to notification_type enum';
    ELSE
        RAISE NOTICE '"closed" already exists in notification_type enum';
    END IF;
END
$$; 