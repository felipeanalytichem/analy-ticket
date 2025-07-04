-- Create direct chats table for one-on-one conversations between users
CREATE TABLE IF NOT EXISTS public.direct_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participant_1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    participant_2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Ensure no duplicate chats between same participants
    CONSTRAINT unique_participants CHECK (participant_1_id < participant_2_id),
    CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_direct_chats_participants ON public.direct_chats(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_direct_chats_participant_1 ON public.direct_chats(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_direct_chats_participant_2 ON public.direct_chats(participant_2_id);

-- Enable RLS
ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for direct_chats
CREATE POLICY "direct_chats_select_policy" ON public.direct_chats
    FOR SELECT USING (
        participant_1_id = auth.uid() OR 
        participant_2_id = auth.uid()
    );

CREATE POLICY "direct_chats_insert_policy" ON public.direct_chats
    FOR INSERT WITH CHECK (
        participant_1_id = auth.uid() OR 
        participant_2_id = auth.uid()
    );

CREATE POLICY "direct_chats_update_policy" ON public.direct_chats
    FOR UPDATE USING (
        participant_1_id = auth.uid() OR 
        participant_2_id = auth.uid()
    );

-- Update chat_messages table to support direct chats
-- Add a type column to distinguish between ticket chats and direct chats
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS chat_type VARCHAR(20) DEFAULT 'ticket' CHECK (chat_type IN ('ticket', 'direct'));

-- Create a function to get direct chat between two users or create one if it doesn't exist
CREATE OR REPLACE FUNCTION get_or_create_direct_chat(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    chat_id UUID;
    user1_id UUID := auth.uid();
    user2_id UUID := other_user_id;
    temp_id UUID;
BEGIN
    -- Ensure user1_id < user2_id for consistent ordering
    IF user1_id > user2_id THEN
        temp_id := user1_id;
        user1_id := user2_id;
        user2_id := temp_id;
    END IF;
    
    -- Try to find existing chat
    SELECT id INTO chat_id
    FROM public.direct_chats
    WHERE participant_1_id = user1_id AND participant_2_id = user2_id
    AND is_active = true;
    
    -- If not found, create new chat
    IF chat_id IS NULL THEN
        INSERT INTO public.direct_chats (participant_1_id, participant_2_id)
        VALUES (user1_id, user2_id)
        RETURNING id INTO chat_id;
    END IF;
    
    RETURN chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to send direct chat message
CREATE OR REPLACE FUNCTION send_direct_message(
    other_user_id UUID,
    message_content TEXT,
    is_internal_msg BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    chat_id UUID;
    message_id UUID;
BEGIN
    -- Get or create direct chat
    chat_id := get_or_create_direct_chat(other_user_id);
    
    -- Insert message
    INSERT INTO public.chat_messages (
        chat_id,
        sender_id,
        content,
        is_internal,
        chat_type,
        message_type
    ) VALUES (
        chat_id,
        auth.uid(),
        message_content,
        is_internal_msg,
        'direct',
        'text'
    ) RETURNING id INTO message_id;
    
    -- Update direct chat timestamp
    UPDATE public.direct_chats 
    SET updated_at = NOW() 
    WHERE id = chat_id;
    
    RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_direct_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.chat_type = 'direct' THEN
        -- Update the direct chat's timestamp when a new message is added
        UPDATE public.direct_chats 
        SET updated_at = NOW() 
        WHERE id = NEW.chat_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_direct_chat_timestamp
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_direct_chat_timestamp();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.direct_chats TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_direct_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_direct_message(UUID, TEXT, BOOLEAN) TO authenticated; 