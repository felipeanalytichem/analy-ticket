-- Fix missing subcategory_id column in tickets_new table
ALTER TABLE public.tickets_new 
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON public.tickets_new(subcategory_id);

-- Grant necessary permissions
GRANT ALL ON public.tickets_new TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 