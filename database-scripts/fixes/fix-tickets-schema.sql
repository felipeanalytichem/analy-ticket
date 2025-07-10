-- Fix tickets_new table schema
BEGIN;

-- Ensure subcategory_id column exists with proper foreign key
ALTER TABLE public.tickets_new 
DROP COLUMN IF EXISTS subcategory_id CASCADE;

ALTER TABLE public.tickets_new 
ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON public.tickets_new(subcategory_id);

-- Grant necessary permissions
GRANT ALL ON public.tickets_new TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    col_description(table_name::regclass, ordinal_position) as description
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'tickets_new'
    AND column_name = 'subcategory_id'; 