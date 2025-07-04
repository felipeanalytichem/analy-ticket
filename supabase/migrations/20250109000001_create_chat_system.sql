-- Migration for Chat System
-- This script creates the complete chat infrastructure for the Request Resolve System

-- Create ticket_chats table
CREATE TABLE IF NOT EXISTS ticket_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets_new(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    chat_type VARCHAR(20) DEFAULT 'ticket' CHECK (chat_type IN ('ticket', 'direct'))
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES ticket_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    file_path TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_internal BOOLEAN DEFAULT FALSE,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system', 'image')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed'))
);

-- Create chat_participants table
CREATE TABLE IF NOT EXISTS chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES ticket_chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    can_write BOOLEAN DEFAULT TRUE,
    UNIQUE(chat_id, user_id)
);

-- Create chat_message_mentions table
CREATE TABLE IF NOT EXISTS chat_message_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, mentioned_user_id)
);

-- Create chat_message_reactions table
CREATE TABLE IF NOT EXISTS chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Create indexes (safely)
DO $$
BEGIN
    -- ticket_chats indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ticket_chats_ticket_id') THEN
        CREATE INDEX idx_ticket_chats_ticket_id ON ticket_chats(ticket_id);
    END IF;
    
    -- chat_messages indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_messages_chat_id') THEN
        CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_messages_sender_id') THEN
        CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_messages_created_at') THEN
        CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
    END IF;
    
    -- chat_participants indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_participants_chat_id') THEN
        CREATE INDEX idx_chat_participants_chat_id ON chat_participants(chat_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_participants_user_id') THEN
        CREATE INDEX idx_chat_participants_user_id ON chat_participants(user_id);
    END IF;
    
    -- chat_message_mentions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_message_mentions_message_id') THEN
        CREATE INDEX idx_chat_message_mentions_message_id ON chat_message_mentions(message_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_message_mentions_user_id') THEN
        CREATE INDEX idx_chat_message_mentions_user_id ON chat_message_mentions(mentioned_user_id);
    END IF;

    -- chat_message_reactions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_message_reactions_message_id') THEN
        CREATE INDEX idx_chat_message_reactions_message_id ON chat_message_reactions(message_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chat_message_reactions_user_id') THEN
        CREATE INDEX idx_chat_message_reactions_user_id ON chat_message_reactions(user_id);
    END IF;
END
$$;

-- Enable Row Level Security
ALTER TABLE ticket_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- DROP existing policies if they exist to avoid conflicts
DO $$
BEGIN
    -- ticket_chats policies
    DROP POLICY IF EXISTS "Users can view chats for tickets they have access to" ON ticket_chats;
    DROP POLICY IF EXISTS "Agents and admins can create chats" ON ticket_chats;
    DROP POLICY IF EXISTS "Agents and admins can update chats" ON ticket_chats;
    
    -- chat_messages policies
    DROP POLICY IF EXISTS "Users can view messages in chats they participate in" ON chat_messages;
    DROP POLICY IF EXISTS "Users can send messages in chats they participate in with write access" ON chat_messages;
    DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
    
    -- chat_participants policies
    DROP POLICY IF EXISTS "Users can view chat participants if they are participants themselves" ON chat_participants;
    DROP POLICY IF EXISTS "Agents and admins can manage chat participants" ON chat_participants;
    
    -- chat_message_mentions policies
    DROP POLICY IF EXISTS "Users can view mentions they are part of" ON chat_message_mentions;
    DROP POLICY IF EXISTS "Users can create mentions in messages they send" ON chat_message_mentions;

    -- chat_message_reactions policies
    DROP POLICY IF EXISTS "Users can view reactions in chats they participate in" ON chat_message_reactions;
    DROP POLICY IF EXISTS "Users can manage their own reactions" ON chat_message_reactions;
EXCEPTION
    WHEN others THEN
        -- Ignore errors if policies don't exist
        NULL;
END
$$;

-- Create RLS policies for ticket_chats
CREATE POLICY "Users can view chats for tickets they have access to" ON ticket_chats
    FOR SELECT USING (
        ticket_id IN (
            SELECT id FROM tickets_new 
            WHERE user_id = auth.uid() 
            OR assigned_to = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Agents and admins can create chats" ON ticket_chats
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Agents and admins can update chats" ON ticket_chats
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

-- Create RLS policies for chat_messages
CREATE POLICY "Users can view messages in chats they participate in" ON chat_messages
    FOR SELECT USING (
        chat_id IN (
            SELECT cp.chat_id FROM chat_participants cp
            WHERE cp.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Users can send messages in chats they participate in with write access" ON chat_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND (
            chat_id IN (
                SELECT cp.chat_id FROM chat_participants cp
                WHERE cp.user_id = auth.uid() 
                AND cp.can_write = TRUE
            )
            OR EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() 
                AND role IN ('admin', 'agent')
            )
        )
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

-- Create RLS policies for chat_participants
CREATE POLICY "Users can view chat participants if they are participants themselves" ON chat_participants
    FOR SELECT USING (
        chat_id IN (
            SELECT cp.chat_id FROM chat_participants cp
            WHERE cp.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Agents and admins can manage chat participants" ON chat_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

-- Create RLS policies for chat_message_mentions
CREATE POLICY "Users can view mentions they are part of" ON chat_message_mentions
    FOR SELECT USING (
        mentioned_user_id = auth.uid()
        OR message_id IN (
            SELECT cm.id FROM chat_messages cm
            WHERE cm.sender_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Users can create mentions in messages they send" ON chat_message_mentions
    FOR INSERT WITH CHECK (
        message_id IN (
            SELECT cm.id FROM chat_messages cm
            WHERE cm.sender_id = auth.uid()
        )
    );

-- Create RLS policies for chat_message_reactions
CREATE POLICY "Users can view reactions in chats they participate in" ON chat_message_reactions
    FOR SELECT USING (
        message_id IN (
            SELECT cm.id FROM chat_messages cm
            WHERE cm.chat_id IN (
                SELECT cp.chat_id FROM chat_participants cp
                WHERE cp.user_id = auth.uid()
            )
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'agent')
        )
    );

CREATE POLICY "Users can manage their own reactions" ON chat_message_reactions
    FOR ALL USING (user_id = auth.uid());

-- Helper functions

-- Function to create ticket chat automatically
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

-- Function to add initial participants when chat is created
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_creator_id uuid;
    v_ticket_assigned_to uuid;
    v_creator_role text;
BEGIN
    -- Get ticket details directly without using RECORD
    SELECT user_id, assigned_to
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

-- Function to mark chat as read
CREATE OR REPLACE FUNCTION mark_chat_as_read(chat_uuid UUID, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE chat_participants
    SET last_read_at = NOW()
    WHERE chat_id = chat_uuid
    AND user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread messages count
CREATE OR REPLACE FUNCTION get_unread_chat_messages_count(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO unread_count
    FROM chat_messages cm
    JOIN chat_participants cp ON cm.chat_id = cp.chat_id
    WHERE cp.user_id = user_uuid
    AND (cp.last_read_at IS NULL OR cm.created_at > cp.last_read_at)
    AND cm.sender_id != user_uuid;
    
    RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
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

CREATE TRIGGER update_ticket_chats_updated_at 
    BEFORE UPDATE ON ticket_chats
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 