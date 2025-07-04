-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;
DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;

-- Create the chat creation function without using RECORD type
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_chats (
        ticket_id,
        chat_type,
        is_active
    ) VALUES (
        NEW.id,
        'ticket',
        true
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the participants function without using RECORD type
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_creator_id uuid;
    v_ticket_assigned_to uuid;
    v_creator_role text;
BEGIN
    -- Get ticket details directly without using RECORD
    SELECT creator_id, assigned_to
    INTO v_ticket_creator_id, v_ticket_assigned_to
    FROM tickets_new
    WHERE id = NEW.ticket_id;

    -- Get creator's role
    SELECT role INTO v_creator_role 
    FROM users 
    WHERE id = v_ticket_creator_id;

    -- Add ticket creator
    INSERT INTO chat_participants (
        chat_id,
        user_id,
        can_write,
        joined_at
    ) VALUES (
        NEW.id,
        v_ticket_creator_id,
        true,
        NOW()
    );

    -- Add assigned agent if exists and different from creator
    IF v_ticket_assigned_to IS NOT NULL AND v_ticket_assigned_to != v_ticket_creator_id THEN
        INSERT INTO chat_participants (
            chat_id,
            user_id,
            can_write,
            joined_at
        ) VALUES (
            NEW.id,
            v_ticket_assigned_to,
            true,
            NOW()
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add participants to chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 