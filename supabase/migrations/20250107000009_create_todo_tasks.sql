-- Create Todo Tasks table
CREATE TABLE IF NOT EXISTS public.todo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE,
    time_tracking_total INTEGER DEFAULT 0, -- in minutes
    time_tracking_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.todo_tasks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own tasks and admins can view all" ON public.todo_tasks
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create tasks assigned to themselves, agents can create for tickets, admins can create any" ON public.todo_tasks
    FOR INSERT WITH CHECK (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('agent', 'admin')
        )
    );

CREATE POLICY "Users can update their own tasks and admins can update all" ON public.todo_tasks
    FOR UPDATE USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can delete their own tasks and admins can delete all" ON public.todo_tasks
    FOR DELETE USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON public.todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_ticket_id ON public.todo_tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON public.todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_priority ON public.todo_tasks(priority);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_todo_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set completed_at when status changes to completed
    IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_todo_tasks_updated_at_trigger
    BEFORE UPDATE ON public.todo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_tasks_updated_at(); 