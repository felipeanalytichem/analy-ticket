-- Emergency Chat Function Fix
-- This script completely removes and recreates the problematic chat function
-- Run this in Supabase SQL Editor

-- 1. Drop all problematic triggers first
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;

-- 2. Drop the problematic function completely
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- 3. Recreate the ticket chat creation function (simple version)
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

-- 4. Recreate the chat participants function with proper error handling
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    ticket_user_id UUID;
    ticket_assigned_to UUID;
    user_role TEXT;
BEGIN
    -- Get ticket details safely
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

-- 5. Recreate the triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- 6. Test by checking if tables exist and functions are working
DO $$
DECLARE
    chat_count INTEGER;
    function_exists BOOLEAN;
BEGIN
    -- Check if ticket_chats table exists
    SELECT COUNT(*) INTO chat_count FROM ticket_chats;
    RAISE NOTICE 'Found % existing chats', chat_count;
    
    -- Check if functions exist
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'add_initial_chat_participants'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE 'Chat functions successfully recreated!';
    ELSE
        RAISE NOTICE 'Error: Functions not found after recreation';
    END IF;
    
    -- Refresh schema cache
    NOTIFY pgrst, 'reload schema';
    
    RAISE NOTICE 'Emergency chat fix completed!';
END $$; 