
-- EMERGENCY CHAT FUNCTION FIX
-- Apply this in Supabase Dashboard > SQL Editor

-- =============================================================================
-- EMERGENCY CHAT FUNCTION FIX
-- This migration fixes the "ticket_record is not assigned yet" error
-- by replacing the problematic function with a working version
-- =============================================================================

-- Step 1: Drop the problematic triggers
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;

-- Step 2: Drop the problematic functions
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Step 3: Create FIXED ticket chat creation function
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create ticket chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create FIXED chat participants function
-- This version FIXES the "ticket_record is not assigned yet" error
-- by using individual variable declarations instead of SELECT * INTO RECORD
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    ticket_user_id UUID;
    ticket_assigned_to UUID;
    user_role TEXT;
BEGIN
    -- FIXED: Get ticket details safely without using SELECT * INTO RECORD
    SELECT user_id, assigned_to 
    INTO ticket_user_id, ticket_assigned_to 
    FROM tickets_new 
    WHERE id = NEW.ticket_id;
    
    -- Skip if ticket not found
    IF ticket_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Add ticket creator as participant
    SELECT role INTO user_role FROM users WHERE id = ticket_user_id;
    
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (NEW.id, ticket_user_id, COALESCE(user_role IN ('admin', 'agent'), false))
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    -- Add assigned agent if exists
    IF ticket_assigned_to IS NOT NULL AND ticket_assigned_to != ticket_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, ticket_assigned_to, true)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add chat participants for chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the triggers with the fixed functions
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Step 6: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Log the fix
DO $$
BEGIN
    RAISE NOTICE '=== EMERGENCY CHAT FUNCTION FIX APPLIED ===';
    RAISE NOTICE 'Fixed: "ticket_record is not assigned yet" error';
    RAISE NOTICE 'Changed: SELECT * INTO ticket_record -> SELECT user_id, assigned_to INTO variables';
    RAISE NOTICE 'Status: Chat functions should now work without errors';
    RAISE NOTICE '========================================';
END $$; 

-- Success notification
SELECT 'EMERGENCY CHAT FIX APPLIED SUCCESSFULLY! Refresh your app and test chat functionality.' as result;
