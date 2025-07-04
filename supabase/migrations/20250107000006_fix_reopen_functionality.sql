-- Add missing fields for ticket reopen functionality

-- Add reopen-related columns to tickets_new table
ALTER TABLE public.tickets_new 
ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES public.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tickets_reopened_at ON public.tickets_new(reopened_at); 