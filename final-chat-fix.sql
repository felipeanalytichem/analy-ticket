
-- Emergency Chat Function Fix - FINAL
-- Drop all problematic triggers first
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;

-- Drop the problematic functions completely
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Recreate the ticket chat creation function (simple version)
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

-- Recreate the chat participants function with proper error handling
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

-- Recreate the triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Add default knowledge categories if they don't exist
INSERT INTO public.knowledge_categories (name, slug, description, color, icon, sort_order) VALUES
('Getting Started', 'getting-started', 'Basic guides and tutorials', '#3B82F6', 'Rocket', 1),
('Technical Support', 'technical-support', 'Technical troubleshooting guides', '#EF4444', 'Settings', 2),
('Account Management', 'account-management', 'Account and user management guides', '#10B981', 'User', 3),
('Billing & Payments', 'billing-payments', 'Billing and payment information', '#F59E0B', 'CreditCard', 4),
('FAQ', 'faq', 'Common questions and answers', '#8B5CF6', 'HelpCircle', 5)
ON CONFLICT (slug) DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
