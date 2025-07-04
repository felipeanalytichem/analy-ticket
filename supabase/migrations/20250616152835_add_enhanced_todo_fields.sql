-- Add enhanced fields to todo_tasks table
-- These fields support the advanced task creation UI

-- Add due_date column for task deadlines
ALTER TABLE public.todo_tasks 
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add estimated_hours column for time tracking
ALTER TABLE public.todo_tasks 
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2);

-- Add tags column as JSONB array for flexible tagging
ALTER TABLE public.todo_tasks 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON public.todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_estimated_hours ON public.todo_tasks(estimated_hours);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_tags ON public.todo_tasks USING GIN(tags);

-- Add comments for documentation
COMMENT ON COLUMN public.todo_tasks.due_date IS 'Target completion date for the task';
COMMENT ON COLUMN public.todo_tasks.estimated_hours IS 'Estimated time to complete the task in hours (supports decimals like 2.5)';
COMMENT ON COLUMN public.todo_tasks.tags IS 'JSON array of tags for categorizing and filtering tasks';

-- Update the trigger function to handle due_date logic if needed
-- This could be extended in the future for overdue notifications
