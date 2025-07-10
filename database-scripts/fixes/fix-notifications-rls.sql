-- Drop existing RLS policies for the notifications table to start fresh
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins and agents can create notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can manage all notifications" ON notifications;

-- Enable RLS on the notifications table if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own notifications
CREATE POLICY "Users can view their own notifications" 
ON notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy for users to update their own notifications (e.g., marking as read)
CREATE POLICY "Users can update their own notifications" 
ON notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policy for admins and agents to create notifications for any user
CREATE POLICY "Admins and agents can create notifications" 
ON notifications 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND (users.role = 'admin' OR users.role = 'agent')
  )
);

-- Create policy for service role to have full access to notifications
CREATE POLICY "Service role can manage all notifications" 
ON notifications 
USING (true)
WITH CHECK (true);

-- Add comment to explain the policies
COMMENT ON TABLE notifications IS 'Table for storing user notifications with RLS policies to control access'; 