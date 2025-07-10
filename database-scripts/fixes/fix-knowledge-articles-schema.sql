-- Fix Knowledge Articles Table Schema
-- This script ensures the knowledge_articles table has all required columns

-- Check and add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add is_published column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'is_published'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN is_published BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_published column to knowledge_articles table';
    END IF;

    -- Add other potentially missing columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'featured'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN featured BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added featured column to knowledge_articles table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'reading_time_minutes'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN reading_time_minutes INTEGER;
        RAISE NOTICE 'Added reading_time_minutes column to knowledge_articles table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_articles' 
        AND column_name = 'meta_description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.knowledge_articles 
        ADD COLUMN meta_description TEXT;
        RAISE NOTICE 'Added meta_description column to knowledge_articles table';
    END IF;

    RAISE NOTICE 'Knowledge articles table schema check completed!';
END $$; 