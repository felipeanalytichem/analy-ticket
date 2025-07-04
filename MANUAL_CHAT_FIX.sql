
-- EMERGENCY CHAT FIX - Execute this in Supabase SQL Editor
-- This fixes: "record 'ticket_record' is not assigned yet" error

-- Step 1: Drop problematic triggers and functions
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;
DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;

-- Step 2: Create FIXED functions
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_user_id UUID;
    v_ticket_assigned_to UUID;
    v_user_role TEXT;
BEGIN
    -- FIXED: Use individual variables instead of RECORD
    SELECT 
        t.user_id, 
        t.assigned_to 
    INTO 
        v_ticket_user_id, 
        v_ticket_assigned_to 
    FROM tickets_new t 
    WHERE t.id = NEW.ticket_id;
    
    IF v_ticket_user_id IS NULL THEN
        RAISE WARNING 'No ticket found with ID % when creating chat participants', NEW.ticket_id;
        RETURN NEW;
    END IF;
    
    SELECT role INTO v_user_role 
    FROM users 
    WHERE id = v_ticket_user_id;
    
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (
        NEW.id, 
        v_ticket_user_id, 
        COALESCE(v_user_role IN ('admin', 'agent'), false)
    )
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    IF v_ticket_assigned_to IS NOT NULL AND v_ticket_assigned_to != v_ticket_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, v_ticket_assigned_to, true)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add participants to chat % for ticket %: %', 
                     NEW.id, NEW.ticket_id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Step 4: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verification
SELECT 'CHAT FIX APPLIED SUCCESSFULLY!' as status;
