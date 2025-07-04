-- Add chat_type column if it doesn't exist
ALTER TABLE public.ticket_chats 
ADD COLUMN IF NOT EXISTS chat_type VARCHAR(20) DEFAULT 'ticket' CHECK (chat_type IN ('ticket', 'direct'));

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_chats_chat_type ON public.ticket_chats(chat_type);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.ticket_chats TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.ticket_chats ENABLE ROW LEVEL SECURITY; 