-- ==============================================================================================
-- MIGRATION: DEFINITIVELY FIX chat_message_reactions foreign key
-- This script drops any existing, unpredictable foreign key and creates a new one
-- with a stable, predictable name. This is the final fix for this database issue.
-- ==============================================================================================

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    RAISE NOTICE 'Step 1: Finding and dropping existing user_id foreign key...';

    -- Find the dynamically generated foreign key name
    SELECT con.conname INTO constraint_name_var
    FROM pg_constraint con
    JOIN pg_class tbl ON con.conrelid = tbl.oid
    WHERE tbl.relname = 'chat_message_reactions' AND con.conname LIKE '%user_id_fkey';

    -- If it exists, drop it
    IF constraint_name_var IS NOT NULL THEN
        RAISE NOTICE '-> Dropping existing constraint: %', constraint_name_var;
        EXECUTE 'ALTER TABLE public.chat_message_reactions DROP CONSTRAINT ' || quote_ident(constraint_name_var);
    ELSE
        RAISE NOTICE '-> No existing user_id foreign key found to drop.';
    END IF;

    RAISE NOTICE 'Step 2: Creating new, stable foreign key...';

    -- Create a new foreign key with a known, stable name
    ALTER TABLE public.chat_message_reactions
    ADD CONSTRAINT chat_message_reactions_user_id_fkey_stable
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;

    RAISE NOTICE '-> New stable foreign key created.';

END $$;

-- Step 3: Force API schema cache reload
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: chat_message_reactions foreign key has been stabilized.' as result; 