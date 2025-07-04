-- Fix missing subcategory_id column in tickets_new table
DO $$
BEGIN
    -- Drop the column if it exists (to ensure clean state)
    BEGIN
        ALTER TABLE public.tickets_new DROP COLUMN IF EXISTS subcategory_id CASCADE;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Add the column with proper foreign key
    ALTER TABLE public.tickets_new 
    ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id);

    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON public.tickets_new(subcategory_id);

    -- Grant necessary permissions
    GRANT ALL ON public.tickets_new TO authenticated;

    -- Refresh PostgREST schema cache
    NOTIFY pgrst, 'reload schema';

    -- Log success
    RAISE NOTICE 'Successfully fixed tickets_new table schema';
    RAISE NOTICE '- Added subcategory_id column';
    RAISE NOTICE '- Created index';
    RAISE NOTICE '- Granted permissions';
    RAISE NOTICE '- Refreshed schema cache';
END $$; 