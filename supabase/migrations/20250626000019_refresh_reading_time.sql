-- Add version and reading_time_minutes columns if they don't exist
DO $$ 
BEGIN
    -- Add version column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'version'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN version INTEGER DEFAULT 1;
    END IF;

    -- Add reading_time_minutes column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'reading_time_minutes'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN reading_time_minutes INTEGER DEFAULT 1;
    END IF;
END $$;

-- Create the reading time calculation function
CREATE OR REPLACE FUNCTION public.calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.reading_time_minutes := GREATEST(1, CEIL(
        (SELECT COUNT(*)::float / 200 FROM regexp_matches(NEW.content, '\S+', 'g'))
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS calculate_reading_time_trigger ON public.knowledge_articles;
CREATE TRIGGER calculate_reading_time_trigger
    BEFORE INSERT OR UPDATE ON public.knowledge_articles
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_reading_time();

-- Update existing articles
UPDATE public.knowledge_articles
SET reading_time_minutes = GREATEST(1, CEIL(
    (SELECT COUNT(*)::float / 200 FROM regexp_matches(content, '\S+', 'g'))
))
WHERE reading_time_minutes IS NULL OR reading_time_minutes = 0;

-- Force schema cache refresh
ALTER TABLE public.knowledge_articles REPLICA IDENTITY FULL;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema'); 