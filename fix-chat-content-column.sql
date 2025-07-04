-- ==============================================================================================
-- MIGRATION: Fix chat_messages 'content' column
-- This script renames the 'message' column to 'content' or creates it if it doesn't exist.
-- This resolves the "Could not find column" error when sending messages.
--
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================================

DO $$
BEGIN
    -- Check if 'content' column does NOT exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'chat_messages' AND column_name = 'content'
    ) THEN
        -- If 'message' column EXISTS, rename it to 'content'
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'chat_messages' AND column_name = 'message'
        ) THEN
            RAISE NOTICE 'Column "message" found. Renaming to "content".';
            ALTER TABLE public.chat_messages RENAME COLUMN message TO content;
        ELSE
            -- Otherwise, create the 'content' column
            RAISE NOTICE 'Column "content" not found. Creating it.';
            ALTER TABLE public.chat_messages ADD COLUMN content TEXT;
        END IF;
    ELSE
        RAISE NOTICE 'Column "content" already exists. No action taken.';
    END IF;
END $$;

-- Refresh the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: chat_messages table has been corrected.' as result; 