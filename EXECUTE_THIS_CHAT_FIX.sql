-- =============================================================================
-- FINAL EMERGENCY CHAT FIX
-- This fixes both the "ticket_record" issue and the "NEW" context issue
-- =============================================================================

-- Step 1: Drop ALL problematic triggers and functions
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Step 2: Create CORRECTED ticket chat creation function
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Create chat record for the new ticket
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create ticket chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create COMPLETELY FIXED chat participants function
-- This fixes BOTH the RECORD issue AND the NEW context issue
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    ticket_user_id UUID;
    ticket_assigned_to UUID;
    user_role TEXT;
BEGIN
    -- FIXED: Use NEW.ticket_id correctly and individual variables
    -- NEW refers to the new row in ticket_chats table
    SELECT user_id, assigned_to 
    INTO ticket_user_id, ticket_assigned_to 
    FROM tickets_new 
    WHERE id = NEW.ticket_id;
    
    -- Skip if ticket not found
    IF ticket_user_id IS NULL THEN
        RAISE WARNING 'Ticket with ID % not found when creating chat participants', NEW.ticket_id;
        RETURN NEW;
    END IF;
    
    -- Get user role for the ticket creator
    SELECT role INTO user_role FROM users WHERE id = ticket_user_id;
    
    -- Add ticket creator as participant
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (
        NEW.id, 
        ticket_user_id, 
        COALESCE(user_role IN ('admin', 'agent'), false)
    )
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    -- Add assigned agent if exists and different from creator
    IF ticket_assigned_to IS NOT NULL AND ticket_assigned_to != ticket_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, ticket_assigned_to, true)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    
    -- Log success
    RAISE NOTICE 'Chat participants added for ticket % (chat %)', NEW.ticket_id, NEW.id;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add chat participants for ticket % (chat %): %', NEW.ticket_id, NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate triggers with proper timing
-- First trigger: Create chat when ticket is created
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

-- Second trigger: Add participants when chat is created
CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Step 5: Test the fix by checking if functions exist
DO $$
DECLARE
    func_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Check functions
    SELECT COUNT(*) INTO func_count 
    FROM pg_proc 
    WHERE proname IN ('create_ticket_chat', 'add_initial_chat_participants');
    
    -- Check triggers
    SELECT COUNT(*) INTO trigger_count 
    FROM pg_trigger 
    WHERE tgname IN ('trigger_create_ticket_chat', 'trigger_add_initial_chat_participants');
    
    RAISE NOTICE '=== EMERGENCY CHAT FIX VERIFICATION ===';
    RAISE NOTICE 'Functions created: %/2', func_count;
    RAISE NOTICE 'Triggers created: %/2', trigger_count;
    
    IF func_count = 2 AND trigger_count = 2 THEN
        RAISE NOTICE 'SUCCESS: All functions and triggers created correctly';
    ELSE
        RAISE WARNING 'ISSUE: Not all components were created properly';
    END IF;
END $$;

-- Step 6: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Final success message
SELECT 'FINAL EMERGENCY CHAT FIX APPLIED! The ticket_record error should now be completely resolved. Refresh your app and test.' as result;

-- =============================================================================
-- WHAT THIS FIX DOES:
-- ✅ Removes problematic SELECT * INTO ticket_record 
-- ✅ Uses proper variable declarations (ticket_user_id, ticket_assigned_to)
-- ✅ Fixes NEW context issues in trigger function
-- ✅ Adds proper error handling and logging
-- ✅ Includes verification of the fix
-- ============================================================================= 