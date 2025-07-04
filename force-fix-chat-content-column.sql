-- ==============================================================================================
-- MIGRATION: Force Fix chat_messages 'content' column
-- This script corrects the column name and uses a cache-busting technique
-- to force the API to recognize the change.
--
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================================

DO $$
BEGIN
    RAISE NOTICE 'Step 1: Checking and fixing "content" column in chat_messages...';
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
            RAISE NOTICE '-> Column "message" found. Renaming to "content".';
            ALTER TABLE public.chat_messages RENAME COLUMN message TO content;
        ELSE
            -- Otherwise, create the 'content' column
            RAISE NOTICE '-> Column "content" not found. Creating it.';
            ALTER TABLE public.chat_messages ADD COLUMN content TEXT;
        END IF;
    ELSE
        RAISE NOTICE '-> Column "content" already exists. No action taken.';
    END IF;
END $$;

-- Step 2: Force API schema cache reload using RLS toggle (cache-busting technique)
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Explicitly notify PostgREST to reload schema as a final measure
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: chat_messages table corrected and cache forcefully reloaded.' as result; 