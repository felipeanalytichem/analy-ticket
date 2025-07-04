-- Clear All Tickets - Safe Version
-- This script removes all existing tickets from the database
-- It checks if tables exist before trying to delete from them
-- Run this script in your Supabase SQL editor to clear all ticket data

-- Delete all tickets from the main table (only if it exists)
DO $$
BEGIN
    -- Check if tickets_new table exists and delete from it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets_new') THEN
        DELETE FROM tickets_new;
        RAISE NOTICE 'Deleted all records from tickets_new table';
    ELSE
        RAISE NOTICE 'tickets_new table does not exist';
    END IF;

    -- Check if tickets table exists and delete from it (alternative table name)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        DELETE FROM tickets;
        RAISE NOTICE 'Deleted all records from tickets table';
    ELSE
        RAISE NOTICE 'tickets table does not exist';
    END IF;

    -- Check if ticket_comments table exists and delete from it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_comments') THEN
        DELETE FROM ticket_comments;
        RAISE NOTICE 'Deleted all records from ticket_comments table';
    ELSE
        RAISE NOTICE 'ticket_comments table does not exist';
    END IF;

    -- Check if comments table exists and delete from it (alternative table name)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
        DELETE FROM comments;
        RAISE NOTICE 'Deleted all records from comments table';
    ELSE
        RAISE NOTICE 'comments table does not exist';
    END IF;

    -- Check if ticket_attachments table exists and delete from it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_attachments') THEN
        DELETE FROM ticket_attachments;
        RAISE NOTICE 'Deleted all records from ticket_attachments table';
    ELSE
        RAISE NOTICE 'ticket_attachments table does not exist';
    END IF;

    -- Check if attachments table exists and delete from it (alternative table name)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attachments') THEN
        DELETE FROM attachments;
        RAISE NOTICE 'Deleted all records from attachments table';
    ELSE
        RAISE NOTICE 'attachments table does not exist';
    END IF;

END $$;

-- Reset sequences if they exist
DO $$
BEGIN
    -- Reset ticket number sequence if it exists
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'tickets_new_ticket_number_seq') THEN
        ALTER SEQUENCE tickets_new_ticket_number_seq RESTART WITH 1;
        RAISE NOTICE 'Reset tickets_new_ticket_number_seq sequence';
    END IF;

    -- Reset ID sequence if it exists
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tickets_new_id_seq') THEN
        SELECT setval('tickets_new_id_seq', 1, false);
        RAISE NOTICE 'Reset tickets_new_id_seq sequence';
    END IF;

END $$;

-- Show what tables exist and their record counts
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'tickets_new' THEN (SELECT COUNT(*) FROM tickets_new)
        WHEN table_name = 'tickets' THEN (SELECT COUNT(*) FROM tickets)
        WHEN table_name = 'ticket_comments' THEN (SELECT COUNT(*) FROM ticket_comments)
        WHEN table_name = 'comments' THEN (SELECT COUNT(*) FROM comments)
        WHEN table_name = 'ticket_attachments' THEN (SELECT COUNT(*) FROM ticket_attachments)
        WHEN table_name = 'attachments' THEN (SELECT COUNT(*) FROM attachments)
        ELSE 0
    END as record_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tickets_new', 'tickets', 'ticket_comments', 'comments', 'ticket_attachments', 'attachments')
ORDER BY table_name;

-- Success message
SELECT 'Database cleanup completed successfully. Check the record counts above.' as status; 