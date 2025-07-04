-- Add versioning trigger and view count function

-- Ensure all required columns exist
DO $$ 
BEGIN
    -- Add slug column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN slug TEXT;
        
        -- Add unique constraint
        ALTER TABLE public.knowledge_articles
        ADD CONSTRAINT knowledge_articles_slug_key UNIQUE (slug);
    END IF;
END $$;

-- Create or replace the slug generation function
CREATE OR REPLACE FUNCTION public.generate_article_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER;
BEGIN
    -- Convert to lowercase and replace spaces and special chars with hyphens
    base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    
    -- Try the base slug first
    final_slug := base_slug;
    counter := 1;
    
    -- If slug exists, append numbers until we find a unique one
    WHILE EXISTS (
        SELECT 1 FROM public.knowledge_articles WHERE slug = final_slug
    ) LOOP
        final_slug := base_slug || '-' || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger function for automatic slug generation
CREATE OR REPLACE FUNCTION public.set_article_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.generate_article_slug(NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for slug generation
DROP TRIGGER IF EXISTS set_article_slug_trigger ON public.knowledge_articles;
CREATE TRIGGER set_article_slug_trigger
    BEFORE INSERT OR UPDATE ON public.knowledge_articles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_article_slug();

-- Create function to handle article versioning
CREATE OR REPLACE FUNCTION public.create_article_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version for published articles
    IF NEW.status = 'published' AND (
        OLD.status != 'published' OR
        OLD.title != NEW.title OR
        OLD.content != NEW.content OR
        OLD.excerpt != NEW.excerpt
    ) THEN
        INSERT INTO public.knowledge_article_versions (
            article_id,
            title,
            content,
            excerpt,
            version,
            changes_description,
            created_by
        ) VALUES (
            NEW.id,
            NEW.title,
            NEW.content,
            NEW.excerpt,
            NEW.version,
            'Article published or updated',
            auth.uid()
        );
        
        -- Increment version number
        NEW.version := NEW.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for versioning
DROP TRIGGER IF EXISTS article_version_trigger ON public.knowledge_articles;
CREATE TRIGGER article_version_trigger
    BEFORE UPDATE ON public.knowledge_articles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_article_version();

-- Create function to increment view count
CREATE OR REPLACE FUNCTION public.increment_article_view_count(article_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.knowledge_articles
    SET view_count = view_count + 1
    WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.increment_article_view_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_article_version() TO authenticated;

-- Ensure version column has default value
DO $$ 
BEGIN
    ALTER TABLE public.knowledge_articles 
    ALTER COLUMN version SET DEFAULT 1;
EXCEPTION
    WHEN others THEN 
        NULL;
END $$;

-- Force schema cache refresh
ALTER TABLE public.knowledge_articles REPLICA IDENTITY FULL;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema'); 