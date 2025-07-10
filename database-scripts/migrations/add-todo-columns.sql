-- Add enhanced fields to todo_tasks table for advanced task management
-- Run this SQL in your Supabase SQL Editor

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

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'todo_tasks' 
  AND table_schema = 'public'
ORDER BY ordinal_position; 