-- Function to create knowledge categories table
CREATE OR REPLACE FUNCTION create_knowledge_categories_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'book',
    color TEXT DEFAULT '#6B7280',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    parent_id UUID REFERENCES public.knowledge_categories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create knowledge articles table
CREATE OR REPLACE FUNCTION create_knowledge_articles_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.knowledge_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    knowledge_category_id UUID REFERENCES public.knowledge_categories(id),
    author_id UUID REFERENCES public.users(id) NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    is_published BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    featured BOOLEAN DEFAULT false,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    reading_time_minutes INTEGER,
    version INTEGER DEFAULT 1,
    meta_description TEXT,
    last_reviewed_at TIMESTAMP WITH TIME ZONE,
    last_reviewed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create article versions table
CREATE OR REPLACE FUNCTION create_knowledge_article_versions_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.knowledge_article_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    version INTEGER NOT NULL,
    changes_description TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create article attachments table
CREATE OR REPLACE FUNCTION create_knowledge_article_attachments_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.knowledge_article_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    alt_text TEXT,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    uploaded_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create article feedback table
CREATE OR REPLACE FUNCTION create_knowledge_article_feedback_table()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS public.knowledge_article_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    rating INTEGER CHECK (rating IN (1, -1)),
    feedback_text TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    user_ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create all knowledge base functions and triggers
CREATE OR REPLACE FUNCTION create_knowledge_base_functions()
RETURNS void AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create all knowledge base RLS policies
CREATE OR REPLACE FUNCTION create_knowledge_base_policies()
RETURNS void AS $$
BEGIN
  -- Enable RLS on all tables
  ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.knowledge_article_versions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.knowledge_article_attachments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.knowledge_article_feedback ENABLE ROW LEVEL SECURITY;

  -- Categories policies
  DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.knowledge_categories;
  CREATE POLICY "Categories are viewable by everyone" ON public.knowledge_categories
    FOR SELECT USING (true);

  DROP POLICY IF EXISTS "Only admins can manage categories" ON public.knowledge_categories;
  CREATE POLICY "Only admins can manage categories" ON public.knowledge_categories
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
      )
    );

  -- Articles policies
  DROP POLICY IF EXISTS "Published articles are viewable by everyone" ON public.knowledge_articles;
  CREATE POLICY "Published articles are viewable by everyone" ON public.knowledge_articles
    FOR SELECT USING (
      status = 'published' OR
      author_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('agent', 'admin')
      )
    );

  DROP POLICY IF EXISTS "Authors and admins can manage articles" ON public.knowledge_articles;
  CREATE POLICY "Authors and admins can manage articles" ON public.knowledge_articles
    FOR ALL USING (
      author_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
      )
    );

  -- Article versions policies
  DROP POLICY IF EXISTS "Article versions viewable by article authors and admins" ON public.knowledge_article_versions;
  CREATE POLICY "Article versions viewable by article authors and admins" ON public.knowledge_article_versions
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.knowledge_articles
        WHERE id = article_id AND (
          author_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
      )
    );

  -- Attachments policies
  DROP POLICY IF EXISTS "Attachments viewable by everyone for published articles" ON public.knowledge_article_attachments;
  CREATE POLICY "Attachments viewable by everyone for published articles" ON public.knowledge_article_attachments
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.knowledge_articles
        WHERE id = article_id AND (
          status = 'published' OR
          author_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('agent', 'admin')
          )
        )
      )
    );

  -- Feedback policies
  DROP POLICY IF EXISTS "Feedback submittable by authenticated users" ON public.knowledge_article_feedback;
  CREATE POLICY "Feedback submittable by authenticated users" ON public.knowledge_article_feedback
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

  DROP POLICY IF EXISTS "Feedback viewable by article authors and admins" ON public.knowledge_article_feedback;
  CREATE POLICY "Feedback viewable by article authors and admins" ON public.knowledge_article_feedback
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.knowledge_articles
        WHERE id = article_id AND (
          author_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 