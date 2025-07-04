-- Enhance Category Management System

-- Add missing columns to categories table
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dynamic_form_schema JSONB;

-- Create index for better performance on commonly queried columns
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_is_enabled ON categories(is_enabled);

-- Update RLS policies for better security
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
CREATE POLICY "Categories are viewable by everyone" ON categories
    FOR SELECT USING (
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM users 
                WHERE id = auth.uid() AND role IN ('agent', 'admin')
            ) THEN true
            ELSE is_enabled = true
        END
    );

DROP POLICY IF EXISTS "Only admins can manage categories" ON categories;
CREATE POLICY "Only admins can manage categories" ON categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add RLS policies for subcategories
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories are viewable by everyone" ON subcategories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM categories c
            WHERE c.id = category_id AND (
                c.is_enabled = true OR
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

CREATE POLICY "Only admins can manage subcategories" ON subcategories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to update sort order
CREATE OR REPLACE FUNCTION update_category_sort_order(
    category_id UUID,
    new_sort_order INTEGER
) RETURNS void AS $$
BEGIN
    -- Update the target category
    UPDATE categories
    SET sort_order = new_sort_order,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update subcategory sort order
CREATE OR REPLACE FUNCTION update_subcategory_sort_order(
    subcategory_id UUID,
    new_sort_order INTEGER
) RETURNS void AS $$
BEGIN
    -- Update the target subcategory
    UPDATE subcategories
    SET sort_order = new_sort_order,
        updated_at = NOW()
    WHERE id = subcategory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to toggle category enabled status
CREATE OR REPLACE FUNCTION toggle_category_enabled(
    category_id UUID,
    new_status BOOLEAN
) RETURNS void AS $$
BEGIN
    UPDATE categories
    SET is_enabled = new_status,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update category form schema
CREATE OR REPLACE FUNCTION update_category_form_schema(
    category_id UUID,
    new_schema JSONB
) RETURNS void AS $$
BEGIN
    UPDATE categories
    SET dynamic_form_schema = new_schema,
        updated_at = NOW()
    WHERE id = category_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; 