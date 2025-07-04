-- Add missing attached_form column to tickets_new table

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    -- Add attached_form column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'attached_form') THEN
        ALTER TABLE public.tickets_new ADD COLUMN attached_form TEXT;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.tickets_new.attached_form IS 'Attached form information for onboarding tickets';
        
        RAISE NOTICE 'Successfully added attached_form column to tickets_new table';
    ELSE
        RAISE NOTICE 'Column attached_form already exists in tickets_new table';
    END IF;
END $$; 