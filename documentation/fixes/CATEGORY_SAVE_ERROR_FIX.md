# Category Save Error Fix Guide

## Issue Summary
**Problem**: "Error saving category. Please try again." appears when trying to create/edit categories in the Category Management interface.

**Root Causes Identified**:
1. **RLS Policy Issue** (Main): Row-level security policies prevent admin users from creating categories
2. **Missing Table Issue**: `knowledge_categories` table doesn't exist, causing 404 errors in network logs

## Error Details
- **Error Message**: "new row violates row-level security policy for table 'categories'"
- **Network Error**: 404 for `knowledge_categories?select=*`
- **Impact**: Category Management functionality completely broken

## Solution: Manual SQL Execution Required

Since migrations are blocked by conflicts, these SQL commands must be run directly in the **Supabase SQL Editor**.

### Step 1: Fix RLS Policies for Categories ⚠️ CRITICAL

**Go to**: https://plbmgjqitlxedsmdqpld.supabase.co/project/plbmgjqitlxedsmdqpld/sql/new

**Run this SQL**:
```sql
-- CORRECTED: Fix Categories RLS Policies
DROP POLICY IF EXISTS "Admin can manage categories" ON categories;
DROP POLICY IF EXISTS "Everyone can view categories" ON categories;

CREATE POLICY "Everyone can view categories"
ON categories FOR SELECT
USING (true);

CREATE POLICY "Admin can manage categories"
ON categories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Fix Subcategories RLS Policies
DROP POLICY IF EXISTS "Admin can manage subcategories" ON subcategories;
DROP POLICY IF EXISTS "Everyone can view subcategories" ON subcategories;

CREATE POLICY "Everyone can view subcategories"
ON subcategories FOR SELECT
USING (true);

CREATE POLICY "Admin can manage subcategories"
ON subcategories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- CRITICAL: Fix Knowledge Categories RLS Policies (this is what's currently failing)
DROP POLICY IF EXISTS "Admin can manage knowledge categories" ON knowledge_categories;
DROP POLICY IF EXISTS "Everyone can view active knowledge categories" ON knowledge_categories;

CREATE POLICY "Everyone can view active knowledge categories"
ON knowledge_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin can manage knowledge categories"
ON knowledge_categories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

### Step 2: Create Missing Knowledge Categories Table

**Run this SQL** (in same or new SQL editor tab):
```sql
-- Create Missing Knowledge Categories Table
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  parent_id UUID REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_slug ON knowledge_categories(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_categories_is_active ON knowledge_categories(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Everyone can view active knowledge categories" ON knowledge_categories;
DROP POLICY IF EXISTS "Admin can manage knowledge categories" ON knowledge_categories;

CREATE POLICY "Everyone can view active knowledge categories"
ON knowledge_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin can manage knowledge categories"
ON knowledge_categories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Insert default categories
INSERT INTO knowledge_categories (name, slug, description, icon, sort_order) VALUES
('General', 'general', 'General knowledge and information', 'info', 1),
('Technical', 'technical', 'Technical documentation and guides', 'settings', 2),
('User Guides', 'user-guides', 'User guides and tutorials', 'book', 3)
ON CONFLICT (slug) DO NOTHING;
```

## Testing the Fix

After running both SQL scripts:

1. **Refresh the Category Management page**
2. **Try creating a new category**
3. **Check browser network tab** - no more 404 errors for `knowledge_categories`
4. **Verify category creation works** without RLS errors

## Expected Results

✅ **Before Fix**:
- ❌ "Error saving category. Please try again."
- ❌ Network: 404 error for `knowledge_categories`
- ❌ RLS policy violation error

✅ **After Fix**:
- ✅ Categories can be created/edited successfully
- ✅ No network errors
- ✅ Knowledge Base components work properly

## Technical Background

### Why RLS Policies Failed
The existing RLS policies were either missing or incorrectly configured to check admin permissions. The policies needed proper `USING` and `WITH CHECK` clauses for admin users.

### Why Knowledge Categories Missing
The `knowledge_categories` table was referenced by admin components but never created in the database schema, causing 404 errors when the frontend tried to load knowledge base categories.

## Files Affected
- **Database**: RLS policies for `categories` and `subcategories` tables
- **Database**: New `knowledge_categories` table created
- **Frontend**: No code changes required

## Status
🚧 **MANUAL ACTION REQUIRED**: Run the SQL scripts in Supabase SQL Editor to complete the fix.

**Supabase SQL Editor**: https://plbmgjqitlxedsmdqpld.supabase.co/project/plbmgjqitlxedsmdqpld/sql/new 