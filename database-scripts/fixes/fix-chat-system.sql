-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Simple function to create chat
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$;

-- Simple function to add participants
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
    v_assigned_to uuid;
BEGIN
    -- Get creator and assigned agent IDs
    SELECT user_id, assigned_to
    INTO v_user_id, v_assigned_to
    FROM tickets_new
    WHERE id = NEW.ticket_id;

    -- Add creator
    IF v_user_id IS NOT NULL THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, v_user_id, true);
    END IF;

    -- Add assigned agent
    IF v_assigned_to IS NOT NULL AND v_assigned_to != v_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, v_assigned_to, true);
    END IF;

    RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Fix any existing chats without participants
INSERT INTO chat_participants (chat_id, user_id, can_write)
SELECT DISTINCT tc.id, t.user_id, true
FROM ticket_chats tc
JOIN tickets_new t ON tc.ticket_id = t.id
WHERE NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = tc.id 
    AND cp.user_id = t.user_id
);

-- Add missing assigned agents
INSERT INTO chat_participants (chat_id, user_id, can_write)
SELECT DISTINCT tc.id, t.assigned_to, true
FROM ticket_chats tc
JOIN tickets_new t ON tc.ticket_id = t.id
WHERE t.assigned_to IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = tc.id 
    AND cp.user_id = t.assigned_to
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 