-- Add parent_id column to knowledge_categories table
DO $$ 
BEGIN
    -- Add parent_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_categories' 
        AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE public.knowledge_categories 
        ADD COLUMN parent_id UUID REFERENCES public.knowledge_categories(id);
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_id 
        ON public.knowledge_categories(parent_id);
    END IF;

    -- Add slug column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_categories' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE public.knowledge_categories 
        ADD COLUMN slug TEXT;
        
        -- Update existing records with generated slugs
        UPDATE public.knowledge_categories
        SET slug = LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            )
        )
        WHERE slug IS NULL;
        
        -- Add unique constraint
        ALTER TABLE public.knowledge_categories
        ADD CONSTRAINT knowledge_categories_slug_unique UNIQUE (slug);
    END IF;

    -- Add sort_order column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_categories' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE public.knowledge_categories 
        ADD COLUMN sort_order INTEGER DEFAULT 0;
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_knowledge_categories_sort_order 
        ON public.knowledge_categories(sort_order);
    END IF;

    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_categories' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.knowledge_categories 
        ADD COLUMN is_active BOOLEAN DEFAULT true;
        
        -- Create index for better performance
        CREATE INDEX IF NOT EXISTS idx_knowledge_categories_is_active 
        ON public.knowledge_categories(is_active);
    END IF;

    -- Add icon column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'knowledge_categories' 
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE public.knowledge_categories 
        ADD COLUMN icon TEXT DEFAULT 'book';
    END IF;
END $$; 