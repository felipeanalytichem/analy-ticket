-- =============================================================================
-- COMPREHENSIVE DATABASE FIX
-- This script fixes all known database issues:
-- 1. Chat system "ticket_record" error
-- 2. Missing knowledge_categories table
-- 3. Missing knowledge_articles table 
-- 4. Missing ticket_attachments table
-- 5. Adds proper indexes and permissions
-- =============================================================================

-- Step 1: Emergency Chat Function Fix
-- =============================================================================

-- Drop all problematic triggers first
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;

-- Drop the problematic functions completely
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Recreate the ticket chat creation function (simple version)
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create ticket chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the chat participants function with proper error handling
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    ticket_user_id UUID;
    ticket_assigned_to UUID;
    user_role TEXT;
BEGIN
    -- Get ticket details safely
    SELECT user_id, assigned_to 
    INTO ticket_user_id, ticket_assigned_to 
    FROM tickets_new 
    WHERE id = NEW.ticket_id;
    
    -- Skip if ticket not found
    IF ticket_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Add ticket creator as participant
    SELECT role INTO user_role FROM users WHERE id = ticket_user_id;
    
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (NEW.id, ticket_user_id, COALESCE(user_role IN ('admin', 'agent'), false))
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    -- Add assigned agent if exists
    IF ticket_assigned_to IS NOT NULL AND ticket_assigned_to != ticket_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, ticket_assigned_to, true)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add chat participants for chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Step 2: Knowledge Base Tables
-- =============================================================================

-- Create missing knowledge_categories table
CREATE TABLE IF NOT EXISTS public.knowledge_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT 'BookOpen',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge_categories
DROP POLICY IF EXISTS "Anyone can view active knowledge categories" ON public.knowledge_categories;
CREATE POLICY "Anyone can view active knowledge categories" ON public.knowledge_categories
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage knowledge categories" ON public.knowledge_categories;
CREATE POLICY "Admins can manage knowledge categories" ON public.knowledge_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create knowledge_articles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    tags TEXT[],
    meta_title TEXT,
    meta_description TEXT,
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    knowledge_category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(slug)
);

-- Enable RLS for knowledge_articles
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge_articles
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.knowledge_articles;
CREATE POLICY "Anyone can view published articles" ON public.knowledge_articles
    FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Authors can manage their own articles" ON public.knowledge_articles;
CREATE POLICY "Authors can manage their own articles" ON public.knowledge_articles
    FOR ALL USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all articles" ON public.knowledge_articles;
CREATE POLICY "Admins can manage all articles" ON public.knowledge_articles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 3: Insert Default Knowledge Categories
-- =============================================================================

INSERT INTO public.knowledge_categories (name, slug, description, color, icon, sort_order) VALUES
('Getting Started', 'getting-started', 'Basic guides and tutorials', '#3B82F6', 'Rocket', 1),
('Technical Support', 'technical-support', 'Technical troubleshooting guides', '#EF4444', 'Settings', 2),
('Account Management', 'account-management', 'Account and user management guides', '#10B981', 'User', 3),
('Billing & Payments', 'billing-payments', 'Billing and payment information', '#F59E0B', 'CreditCard', 4),
('FAQ', 'faq', 'Common questions and answers', '#8B5CF6', 'HelpCircle', 5)
ON CONFLICT (slug) DO NOTHING;

-- Step 4: Ticket Attachments Table
-- =============================================================================

-- Create ticket_attachments table if missing
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view attachments for accessible tickets" ON public.ticket_attachments;
CREATE POLICY "Users can view attachments for accessible tickets" ON public.ticket_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can upload attachments to accessible tickets" ON public.ticket_attachments;
CREATE POLICY "Users can upload attachments to accessible tickets" ON public.ticket_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

-- Step 5: Create Performance Indexes
-- =============================================================================

-- Knowledge categories indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_slug ON public.knowledge_categories(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_active ON public.knowledge_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_sort ON public.knowledge_categories(sort_order);

-- Knowledge articles indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_slug ON public.knowledge_articles(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON public.knowledge_articles(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON public.knowledge_articles(knowledge_category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_author ON public.knowledge_articles(author_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_published ON public.knowledge_articles(published_at);

-- Ticket attachments indexes
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_at ON public.ticket_attachments(uploaded_at);

-- Step 6: Create Update Triggers for Timestamp Columns
-- =============================================================================

-- Knowledge categories update trigger
DROP TRIGGER IF EXISTS update_knowledge_categories_updated_at ON public.knowledge_categories;
CREATE TRIGGER update_knowledge_categories_updated_at
    BEFORE UPDATE ON public.knowledge_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Knowledge articles update trigger
DROP TRIGGER IF EXISTS update_knowledge_articles_updated_at ON public.knowledge_articles;
CREATE TRIGGER update_knowledge_articles_updated_at
    BEFORE UPDATE ON public.knowledge_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Grant Permissions
-- =============================================================================

-- Grant necessary permissions
GRANT ALL ON public.knowledge_categories TO authenticated;
GRANT ALL ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.ticket_attachments TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 8: Add missing subcategory_id column to tickets_new if it doesn't exist
-- =============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets_new' 
        AND column_name = 'subcategory_id'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tickets_new 
        ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_tickets_new_subcategory_id ON public.tickets_new(subcategory_id);
    END IF;
END $$;

-- Step 9: Refresh PostgREST Schema Cache
-- =============================================================================

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- FIX COMPLETE
-- =============================================================================

-- This comprehensive fix addresses:
-- ✅ Chat system "ticket_record" error (fixed problematic functions)
-- ✅ Missing knowledge_categories table (created with RLS)
-- ✅ Missing knowledge_articles table (created with RLS)  
-- ✅ Missing ticket_attachments table (created with RLS)
-- ✅ Missing subcategory_id column (added if needed)
-- ✅ Performance indexes (added for all new tables)
-- ✅ Update triggers (for timestamp columns)
-- ✅ Proper permissions (granted to authenticated users)
-- ✅ Schema cache refresh (PostgREST)

-- Next steps:
-- 1. Execute this script in Supabase SQL Editor
-- 2. Refresh your application
-- 3. Test all functionality (tickets, chat, knowledge base) 