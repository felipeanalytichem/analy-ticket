-- Create function to update article statistics
CREATE OR REPLACE FUNCTION update_article_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.knowledge_articles
  SET 
    helpful_count = (
      SELECT COUNT(*) 
      FROM public.knowledge_article_feedback 
      WHERE article_id = NEW.article_id AND rating = 1
    ),
    not_helpful_count = (
      SELECT COUNT(*) 
      FROM public.knowledge_article_feedback 
      WHERE article_id = NEW.article_id AND rating = -1
    )
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for article stats
DROP TRIGGER IF EXISTS update_article_stats_on_feedback ON public.knowledge_article_feedback;
CREATE TRIGGER update_article_stats_on_feedback
  AFTER INSERT OR UPDATE OR DELETE ON public.knowledge_article_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_article_stats();

-- Create function to generate slugs
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to set category slug
CREATE OR REPLACE FUNCTION set_category_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for category slug
DROP TRIGGER IF EXISTS set_category_slug_trigger ON public.knowledge_categories;
CREATE TRIGGER set_category_slug_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_category_slug();

-- Create function to set article slug
CREATE OR REPLACE FUNCTION set_article_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for article slug
DROP TRIGGER IF EXISTS set_article_slug_trigger ON public.knowledge_articles;
CREATE TRIGGER set_article_slug_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_article_slug();

-- Create function to calculate reading time
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reading_time_minutes := GREATEST(1,
    CEIL(
      ARRAY_LENGTH(
        REGEXP_SPLIT_TO_ARRAY(
          REGEXP_REPLACE(NEW.content, '<[^>]*>', '', 'g'),
          '\s+'
        ),
        1
      )::FLOAT / 200
    )::INTEGER
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reading time calculation
DROP TRIGGER IF EXISTS calculate_reading_time_trigger ON public.knowledge_articles;
CREATE TRIGGER calculate_reading_time_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_reading_time(); 