-- Add 'urgent' to notification_priority enum (if it doesn't exist)
DO $$
BEGIN
    -- Check if 'urgent' value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_priority') 
        AND enumlabel = 'urgent'
    ) THEN
        ALTER TYPE notification_priority ADD VALUE 'urgent';
        RAISE NOTICE 'Added urgent value to notification_priority enum';
    ELSE
        RAISE NOTICE 'urgent value already exists in notification_priority enum';
    END IF;
END $$; 