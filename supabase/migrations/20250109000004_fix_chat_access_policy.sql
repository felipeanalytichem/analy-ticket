-- Drop existing policies
DROP POLICY IF EXISTS "chat_access_policy_v3" ON ticket_chats;
DROP POLICY IF EXISTS "Users can view chats for tickets they have access to" ON ticket_chats;
DROP POLICY IF EXISTS "Agents and admins can create chats" ON ticket_chats;

-- Create a simpler, more direct policy for SELECT, INSERT, UPDATE
CREATE POLICY "ticket_chats_access_policy" ON ticket_chats
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM tickets_new t
        WHERE t.id = ticket_chats.ticket_id
        AND (
            -- User is the ticket creator
            t.user_id = auth.uid()
            -- Or user is assigned to the ticket
            OR t.assigned_to = auth.uid()
            -- Or user is an admin
            OR EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid()
                AND role = 'admin'
            )
            -- Or user is an agent
            OR EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid()
                AND role = 'agent'
            )
        )
    )
);

-- Ensure RLS is enabled
ALTER TABLE public.ticket_chats ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.ticket_chats TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 