-- ==============================================================================================
-- MIGRATION: Create Missing chat_message_reactions Table
-- This script creates the table, foreign keys, and policies that were missing from the database.
-- This is the definitive fix for the reaction system errors.
--
-- Please run this script in your Supabase SQL Editor.
-- ==============================================================================================

DO $$
BEGIN
    RAISE NOTICE 'Step 1: Creating "chat_message_reactions" table...';

    -- Create the table only if it does not exist
    CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL,
        user_id UUID NOT NULL,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT chat_message_reactions_message_id_fkey FOREIGN KEY (message_id)
            REFERENCES public.chat_messages(id) ON DELETE CASCADE,
        
        CONSTRAINT chat_message_reactions_user_id_fkey FOREIGN KEY (user_id)
            REFERENCES public.users(id) ON DELETE CASCADE,
            
        UNIQUE(message_id, user_id, emoji)
    );

    RAISE NOTICE '-> Table "chat_message_reactions" created or already exists.';

    RAISE NOTICE 'Step 2: Enabling Row Level Security...';
    ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '-> RLS Enabled.';

    RAISE NOTICE 'Step 3: Creating RLS policies...';

    -- Drop existing policies to ensure a clean slate
    DROP POLICY IF EXISTS "Users can view reactions in chats they are part of" ON public.chat_message_reactions;
    DROP POLICY IF EXISTS "Users can manage their own reactions" ON public.chat_message_reactions;

    -- Policy for viewing reactions
    CREATE POLICY "Users can view reactions in chats they are part of"
    ON public.chat_message_reactions
    FOR SELECT USING (
        (EXISTS (
            SELECT 1
            FROM public.chat_messages cm
            JOIN public.chat_participants cp ON cm.chat_id = cp.chat_id
            WHERE cm.id = chat_message_reactions.message_id AND cp.user_id = auth.uid()
        ))
        OR
        (EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid() AND u.role IN ('admin', 'agent')
        ))
    );

    -- Policy for creating/deleting own reactions
    CREATE POLICY "Users can manage their own reactions"
    ON public.chat_message_reactions
    FOR ALL USING (
        user_id = auth.uid()
    );

    RAISE NOTICE '-> RLS Policies created.';

END $$;

-- Step 4: Force API schema cache reload
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: chat_message_reactions table and policies created successfully.' as result; 