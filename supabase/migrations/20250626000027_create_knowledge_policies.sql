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