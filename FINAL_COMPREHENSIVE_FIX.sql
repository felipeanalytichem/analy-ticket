-- Disable triggers temporarily
ALTER TABLE ticket_chats DISABLE TRIGGER ALL;
ALTER TABLE tickets_new DISABLE TRIGGER ALL;
ALTER TABLE chat_messages DISABLE TRIGGER ALL;
ALTER TABLE chat_participants DISABLE TRIGGER ALL;
ALTER TABLE ticket_feedback DISABLE TRIGGER ALL;

-- Drop all potentially problematic functions and triggers
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;
DROP TRIGGER IF EXISTS trigger_notify_feedback_received ON ticket_feedback CASCADE;
DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON chat_messages CASCADE;
DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;
DROP FUNCTION IF EXISTS notify_feedback_received() CASCADE;
DROP FUNCTION IF EXISTS update_chat_timestamp() CASCADE;
DROP FUNCTION IF EXISTS create_feedback_request_notification(UUID, UUID) CASCADE;

-- Create chat creation function
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Create the chat
    INSERT INTO ticket_chats (
        ticket_id,
        chat_type,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        'ticket',
        true,
        NOW(),
        NOW()
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create participants function
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    v_creator_id uuid;
    v_assigned_to uuid;
BEGIN
    -- Get ticket details
    SELECT creator_id, assigned_to
    INTO v_creator_id, v_assigned_to
    FROM tickets_new
    WHERE id = NEW.ticket_id;

    -- Add ticket creator
    IF v_creator_id IS NOT NULL THEN
        INSERT INTO chat_participants (
            chat_id,
            user_id,
            can_write,
            joined_at
        ) VALUES (
            NEW.id,
            v_creator_id,
            true,
            NOW()
        );
    END IF;

    -- Add assigned agent if exists and different from creator
    IF v_assigned_to IS NOT NULL AND v_assigned_to != v_creator_id THEN
        INSERT INTO chat_participants (
            chat_id,
            user_id,
            can_write,
            joined_at
        ) VALUES (
            NEW.id,
            v_assigned_to,
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

-- Create feedback notification function
CREATE OR REPLACE FUNCTION notify_feedback_received()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_number text;
    v_ticket_id uuid;
    v_assigned_to uuid;
    v_admin_id uuid;
BEGIN
    -- Get ticket information
    SELECT id, ticket_number, assigned_to 
    INTO v_ticket_id, v_ticket_number, v_assigned_to
    FROM tickets_new 
    WHERE id = NEW.ticket_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Notify the assigned agent if exists
    IF v_assigned_to IS NOT NULL THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            priority,
            ticket_id,
            read,
            created_at
        ) VALUES (
            v_assigned_to,
            'feedback_received',
            'Feedback recebido',
            'Você recebeu uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::text) || '. Clique para ver os detalhes.',
            'medium',
            NEW.ticket_id,
            FALSE,
            NOW()
        );
    END IF;
    
    -- Notify all admins except the assigned agent
    FOR v_admin_id IN 
        SELECT id FROM users WHERE role = 'admin'
    LOOP
        IF v_admin_id != v_assigned_to THEN
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                priority,
                ticket_id,
                read,
                created_at
            ) VALUES (
                v_admin_id,
                'feedback_received',
                'Feedback recebido',
                'Foi recebida uma avaliação para o chamado ' || COALESCE(v_ticket_number, v_ticket_id::text) || '. Clique para ver os detalhes.',
                'low',
                NEW.ticket_id,
                FALSE,
                NOW()
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create feedback notifications for ticket %: %', NEW.ticket_id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create feedback request function
CREATE OR REPLACE FUNCTION create_feedback_request_notification(
    p_ticket_id UUID,
    p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ticket_number text;
    v_notification_id UUID;
BEGIN
    -- Get ticket information
    SELECT ticket_number 
    INTO v_ticket_number
    FROM tickets_new
    WHERE id = p_ticket_id;
    
    -- Create notification
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        priority,
        ticket_id,
        read,
        created_at
    ) VALUES (
        p_user_id,
        'feedback_request',
        'Avalie seu atendimento',
        'Seu chamado #' || COALESCE(v_ticket_number, p_ticket_id::text) || ' foi resolvido! Que tal avaliar o atendimento recebido? Sua opinião é muito importante para nós.',
        'medium',
        p_ticket_id,
        FALSE,
        NOW()
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create feedback request notification for ticket %: %', p_ticket_id, SQLERRM;
        RETURN NULL;
END;
$$;

-- Create timestamp update function
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ticket_chats
    SET updated_at = NOW()
    WHERE id = NEW.chat_id;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to update chat timestamp for chat %: %', NEW.chat_id, SQLERRM;
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

CREATE TRIGGER trigger_notify_feedback_received
    AFTER INSERT ON ticket_feedback
    FOR EACH ROW
    EXECUTE FUNCTION notify_feedback_received();

CREATE TRIGGER trigger_update_chat_timestamp
    AFTER INSERT OR UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();

-- Re-enable triggers
ALTER TABLE ticket_chats ENABLE TRIGGER ALL;
ALTER TABLE tickets_new ENABLE TRIGGER ALL;
ALTER TABLE chat_messages ENABLE TRIGGER ALL;
ALTER TABLE chat_participants ENABLE TRIGGER ALL;
ALTER TABLE ticket_feedback ENABLE TRIGGER ALL;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 