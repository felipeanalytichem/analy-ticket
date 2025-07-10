-- Add SLA-related notification types to the notification_type enum

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

-- Show current notification_type enum values for verification
SELECT 'Current notification_type enum values:' as status;
SELECT enumlabel as available_types 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
ORDER BY enumlabel; 