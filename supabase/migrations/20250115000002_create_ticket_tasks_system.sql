-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ticket_tasks table
CREATE TABLE ticket_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets_new(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'blocked')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create ticket_task_comments table
CREATE TABLE ticket_task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES ticket_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id);
CREATE INDEX idx_ticket_tasks_assigned_to ON ticket_tasks(assigned_to);
CREATE INDEX idx_ticket_tasks_status ON ticket_tasks(status);
CREATE INDEX idx_ticket_tasks_due_date ON ticket_tasks(due_date);
CREATE INDEX idx_ticket_task_comments_task_id ON ticket_task_comments(task_id);

-- Create function to update updated_at timestamp (only if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ticket_tasks_updated_at 
    BEFORE UPDATE ON ticket_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_task_comments_updated_at 
    BEFORE UPDATE ON ticket_task_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE ticket_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_task_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_tasks
-- Agents and admins can see tasks for tickets they have access to
CREATE POLICY "ticket_tasks_select_policy" ON ticket_tasks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('agent', 'admin')
    )
    AND (
      ticket_id IN (
        SELECT id FROM tickets_new 
        WHERE user_id = auth.uid() 
           OR assigned_to = auth.uid()
           OR auth.uid() IN (SELECT id FROM users WHERE role IN ('agent', 'admin'))
      )
    )
  );

-- Agents (L2+) and admins can create tasks
CREATE POLICY "ticket_tasks_insert_policy" ON ticket_tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE role IN ('admin') 
         OR (role = 'agent' AND (agent_level >= 2 OR agent_level IS NULL))
    )
  );

-- Agents can update tasks they created or are assigned to, admins can update all
CREATE POLICY "ticket_tasks_update_policy" ON ticket_tasks
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR auth.uid() IN (
      SELECT id FROM users 
      WHERE role = 'agent' AND (agent_level >= 2 OR agent_level IS NULL)
    )
  );

-- Agents can delete tasks they created, admins can delete all
CREATE POLICY "ticket_tasks_delete_policy" ON ticket_tasks
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
    OR created_by = auth.uid()
  );

-- RLS Policies for ticket_task_comments
-- Users can see comments for tasks they have access to
CREATE POLICY "ticket_task_comments_select_policy" ON ticket_task_comments
  FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM ticket_tasks
      WHERE ticket_id IN (
        SELECT id FROM tickets_new 
        WHERE user_id = auth.uid() 
           OR assigned_to = auth.uid()
           OR auth.uid() IN (SELECT id FROM users WHERE role IN ('agent', 'admin'))
      )
    )
  );

-- Users can create comments on tasks they have access to
CREATE POLICY "ticket_task_comments_insert_policy" ON ticket_task_comments
  FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT id FROM ticket_tasks
      WHERE ticket_id IN (
        SELECT id FROM tickets_new 
        WHERE user_id = auth.uid() 
           OR assigned_to = auth.uid()
           OR auth.uid() IN (SELECT id FROM users WHERE role IN ('agent', 'admin'))
      )
    )
  );

-- Users can update their own comments, admins can update all
CREATE POLICY "ticket_task_comments_update_policy" ON ticket_task_comments
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Users can delete their own comments, admins can delete all
CREATE POLICY "ticket_task_comments_delete_policy" ON ticket_task_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM users WHERE role = 'admin')
  );

-- Create function to automatically set completed_at when task status changes to 'done'
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed to 'done', set completed_at
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        NEW.completed_at = NOW();
    -- If status changed from 'done' to something else, clear completed_at
    ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for task completion
CREATE TRIGGER handle_task_completion_trigger
    BEFORE UPDATE ON ticket_tasks
    FOR EACH ROW EXECUTE FUNCTION handle_task_completion();

-- Create function to send notifications when tasks are assigned
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification when a task is assigned to someone
    IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            ticket_id,
            priority,
            created_at
        ) VALUES (
            NEW.assigned_to,
            'task_assigned',
            'New Task Assigned',
            'You have been assigned a new task: "' || NEW.title || '" on ticket #' || 
            (SELECT ticket_number FROM tickets_new WHERE id = NEW.ticket_id),
            NEW.ticket_id,
            'medium',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for task assignment notifications
CREATE TRIGGER notify_task_assignment_trigger
    AFTER INSERT OR UPDATE ON ticket_tasks
    FOR EACH ROW EXECUTE FUNCTION notify_task_assignment();

-- Create function to check for overdue tasks and send notifications
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
DECLARE
    task_record RECORD;
BEGIN
    -- Find overdue tasks that haven't been completed
    FOR task_record IN 
        SELECT t.*, u.id as assigned_user_id, tn.ticket_number
        FROM ticket_tasks t
        JOIN users u ON t.assigned_to = u.id
        JOIN tickets_new tn ON t.ticket_id = tn.id
        WHERE t.due_date < NOW() 
          AND t.status != 'done' 
          AND t.assigned_to IS NOT NULL
    LOOP
        -- Check if we already sent an overdue notification today
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE user_id = task_record.assigned_user_id 
              AND type = 'task_overdue'
              AND message LIKE '%' || task_record.title || '%'
              AND created_at > NOW() - INTERVAL '1 day'
        ) THEN
            -- Send overdue notification
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                ticket_id,
                priority,
                created_at
            ) VALUES (
                task_record.assigned_user_id,
                'task_overdue',
                'Task Overdue',
                'Task "' || task_record.title || '" on ticket #' || task_record.ticket_number || ' is overdue.',
                task_record.ticket_id,
                'high',
                NOW()
            );
        END IF;
    END LOOP;
END;
$$ language 'plpgsql';

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_task_comments; 