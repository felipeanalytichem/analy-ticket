-- Final Knowledge Base Migration
-- This migration consolidates all knowledge base tables, functions, and policies

BEGIN;

-- Create knowledge categories table
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

-- Create knowledge articles table
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

-- Create article versions table
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

-- Create article attachments table
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

-- Create article feedback table
CREATE TABLE IF NOT EXISTS public.knowledge_article_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  rating INTEGER CHECK (rating IN (1, -1)),
  feedback_text TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  user_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, user_id) -- Prevent duplicate feedback from same user
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_parent_id ON public.knowledge_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_sort_order ON public.knowledge_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_is_active ON public.knowledge_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_slug ON public.knowledge_categories(slug);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON public.knowledge_articles(knowledge_category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON public.knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON public.knowledge_articles(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_featured ON public.knowledge_articles(featured);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_created_at ON public.knowledge_articles(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tags ON public.knowledge_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_view_count ON public.knowledge_articles(view_count);

CREATE INDEX IF NOT EXISTS idx_article_versions_article_id ON public.knowledge_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_article_attachments_article_id ON public.knowledge_article_attachments(article_id);
CREATE INDEX IF NOT EXISTS idx_article_feedback_article_id ON public.knowledge_article_feedback(article_id);

-- Function to generate slugs
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Convert to lowercase and replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  
  -- Try the base slug first
  final_slug := base_slug;
  
  -- If slug exists, append a number until we find a unique one
  WHILE EXISTS (
    SELECT 1 FROM knowledge_articles WHERE slug = final_slug
    UNION
    SELECT 1 FROM knowledge_categories WHERE slug = final_slug
  ) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate reading time
CREATE OR REPLACE FUNCTION calculate_reading_time(content TEXT)
RETURNS INTEGER AS $$
DECLARE
  words_per_minute INTEGER := 200;
  word_count INTEGER;
BEGIN
  -- Remove HTML tags and count words
  word_count := array_length(
    regexp_split_to_array(
      regexp_replace(content, '<[^>]*>', '', 'g'),
      '\s+'
    ),
    1
  );
  
  -- Return reading time in minutes, minimum 1 minute
  RETURN GREATEST(1, CEIL(word_count::FLOAT / words_per_minute));
END;
$$ LANGUAGE plpgsql;

-- Function to update article statistics
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

-- Function to get article statistics
CREATE OR REPLACE FUNCTION get_article_stats(article_id UUID)
RETURNS TABLE (
  total_views INTEGER,
  helpful_votes INTEGER,
  not_helpful_votes INTEGER,
  total_feedback INTEGER,
  helpfulness_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(ka.view_count, 0) as total_views,
    COALESCE(ka.helpful_count, 0) as helpful_votes,
    COALESCE(ka.not_helpful_count, 0) as not_helpful_votes,
    COALESCE(ka.helpful_count, 0) + COALESCE(ka.not_helpful_count, 0) as total_feedback,
    CASE 
      WHEN COALESCE(ka.helpful_count, 0) + COALESCE(ka.not_helpful_count, 0) = 0 THEN 0
      ELSE ROUND(
        COALESCE(ka.helpful_count, 0)::NUMERIC / 
        (COALESCE(ka.helpful_count, 0) + COALESCE(ka.not_helpful_count, 0))::NUMERIC * 100, 
        1
      )
    END as helpfulness_ratio
  FROM knowledge_articles ka
  WHERE ka.id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_category_slug_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_categories
  FOR EACH ROW
  EXECUTE FUNCTION generate_slug(NEW.name);

CREATE TRIGGER set_article_slug_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION generate_slug(NEW.title);

CREATE TRIGGER calculate_reading_time_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION calculate_reading_time(NEW.content);

CREATE TRIGGER update_article_stats_trigger
  AFTER INSERT OR UPDATE ON public.knowledge_article_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_article_stats();

-- Enable RLS on all tables
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_article_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_article_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_categories
CREATE POLICY "Categories are viewable by everyone" ON public.knowledge_categories
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage categories" ON public.knowledge_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for knowledge_articles
CREATE POLICY "Published articles are viewable by everyone" ON public.knowledge_articles
  FOR SELECT USING (
    status = 'published' OR
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('agent', 'admin')
    )
  );

CREATE POLICY "Authors can manage their own articles" ON public.knowledge_articles
  FOR ALL USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('agent', 'admin')
    )
  );

-- RLS Policies for knowledge_article_versions
CREATE POLICY "Everyone can view published article versions" ON public.knowledge_article_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_articles 
      WHERE id = article_id AND status = 'published'
    )
  );

CREATE POLICY "Authors and admins can manage versions" ON public.knowledge_article_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'agent')
    ) OR
    EXISTS (
      SELECT 1 FROM knowledge_articles 
      WHERE id = article_id AND author_id = auth.uid()
    )
  );

-- RLS Policies for knowledge_article_attachments
CREATE POLICY "Everyone can view attachments for published articles" ON public.knowledge_article_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_articles 
      WHERE id = article_id AND status = 'published'
    )
  );

CREATE POLICY "Authors and admins can manage attachments" ON public.knowledge_article_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role IN ('admin', 'agent')
    ) OR
    EXISTS (
      SELECT 1 FROM knowledge_articles 
      WHERE id = article_id AND author_id = auth.uid()
    )
  );

-- RLS Policies for knowledge_article_feedback
CREATE POLICY "Everyone can view feedback" ON public.knowledge_article_feedback
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit feedback" ON public.knowledge_article_feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can only update their own feedback" ON public.knowledge_article_feedback
  FOR UPDATE USING (user_id = auth.uid());

-- Insert default categories
INSERT INTO knowledge_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Getting Started', 'getting-started', 'Basic guides and tutorials for new users', 'BookOpen', '#3B82F6', 1),
  ('Account Management', 'account-management', 'User accounts, passwords, and profile settings', 'User', '#10B981', 2),
  ('Technical Support', 'technical-support', 'Technical issues and troubleshooting', 'Wrench', '#F59E0B', 3),
  ('Policies & Procedures', 'policies-procedures', 'Company policies and standard procedures', 'FileText', '#8B5CF6', 4),
  ('FAQ', 'faq', 'Frequently asked questions', 'HelpCircle', '#EF4444', 5)
ON CONFLICT (slug) DO NOTHING;

COMMIT; 