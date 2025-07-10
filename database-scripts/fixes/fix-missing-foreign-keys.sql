-- ==============================================================================================
-- MIGRATION: Add Missing Foreign Keys to chat_message_reactions
-- This script adds the foreign key constraints that are missing from the live database,
-- which is the root cause of the "Bad Request" error.
--
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================================

DO $$
BEGIN
    RAISE NOTICE 'Step 1: Adding foreign key for user_id -> users(id)';
    -- Add the foreign key constraint from chat_message_reactions.user_id to users.id
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_message_reactions_user_id_fkey' AND conrelid = 'public.chat_message_reactions'::regclass
    ) THEN
        ALTER TABLE public.chat_message_reactions
        ADD CONSTRAINT chat_message_reactions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE;
        RAISE NOTICE '-> Foreign key "chat_message_reactions_user_id_fkey" created.';
    ELSE
        RAISE NOTICE '-> Foreign key "chat_message_reactions_user_id_fkey" already exists.';
    END IF;

    RAISE NOTICE 'Step 2: Adding foreign key for message_id -> chat_messages(id)';
    -- Add the foreign key constraint from chat_message_reactions.message_id to chat_messages.id
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_message_reactions_message_id_fkey' AND conrelid = 'public.chat_message_reactions'::regclass
    ) THEN
        ALTER TABLE public.chat_message_reactions
        ADD CONSTRAINT chat_message_reactions_message_id_fkey
        FOREIGN KEY (message_id)
        REFERENCES public.chat_messages(id)
        ON DELETE CASCADE;
        RAISE NOTICE '-> Foreign key "chat_message_reactions_message_id_fkey" created.';
    ELSE
        RAISE NOTICE '-> Foreign key "chat_message_reactions_message_id_fkey" already exists.';
    END IF;

END $$;

-- Step 3: Force API schema cache reload
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: Missing foreign keys have been added to chat_message_reactions.' as result; 