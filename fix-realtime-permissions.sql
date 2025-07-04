-- Fix real-time permissions for chat system
-- This script ensures that real-time subscriptions work properly

-- Enable real-time for chat tables
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE ticket_chats REPLICA IDENTITY FULL;
ALTER TABLE direct_chats REPLICA IDENTITY FULL;

-- Grant necessary permissions for real-time
GRANT SELECT, INSERT, UPDATE ON chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ticket_chats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON direct_chats TO authenticated;

-- Ensure RLS policies allow real-time access
-- Drop and recreate policies if needed

-- For chat_messages
DROP POLICY IF EXISTS "Users can view messages from chats they participate in" ON chat_messages;
CREATE POLICY "Users can view messages from chats they participate in" ON chat_messages
FOR ALL USING (
  -- Allow access to ticket chat messages
  EXISTS (
    SELECT 1 FROM ticket_chats tc
    JOIN tickets_new t ON tc.ticket_id = t.id
    WHERE tc.id = chat_messages.chat_id
    AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid())
  ) OR
  -- Allow access to direct chat messages
  EXISTS (
    SELECT 1 FROM direct_chats dc
    WHERE dc.id = chat_messages.chat_id
    AND (dc.participant_1_id = auth.uid() OR dc.participant_2_id = auth.uid())
  )
);

-- For ticket_chats
DROP POLICY IF EXISTS "Users can view ticket chats for their tickets" ON ticket_chats;
CREATE POLICY "Users can view ticket chats for their tickets" ON ticket_chats
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tickets_new t
    WHERE t.id = ticket_chats.ticket_id
    AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid())
  )
);

-- For direct_chats
DROP POLICY IF EXISTS "Users can view their direct chats" ON direct_chats;
CREATE POLICY "Users can view their direct chats" ON direct_chats
FOR ALL USING (
  participant_1_id = auth.uid() OR participant_2_id = auth.uid()
);

-- Ensure users table has proper permissions for joins
GRANT SELECT ON users TO authenticated;

-- Add a test function to verify real-time is working
CREATE OR REPLACE FUNCTION test_realtime_chat()
RETURNS TEXT AS $$
BEGIN
  -- Insert a test message to trigger real-time
  INSERT INTO chat_messages (
    chat_id,
    sender_id,
    message,
    is_internal,
    message_type
  ) VALUES (
    (SELECT id FROM ticket_chats LIMIT 1),
    auth.uid(),
    'Real-time test message at ' || now(),
    false,
    'text'
  );
  
  RETURN 'Test message sent - check for real-time updates';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_realtime_chat() TO authenticated;

-- Re-enable real-time for all relevant tables
SELECT pg_notify('realtime', 'refresh');

-- Log completion
SELECT 'Real-time permissions configured successfully' as status; 