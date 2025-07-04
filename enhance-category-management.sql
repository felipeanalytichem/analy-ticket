-- Enhanced Category Management Migration
-- This script adds new columns to support the enhanced category management features

-- Add new columns to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS dynamic_form_schema JSONB DEFAULT NULL;

-- Add index for performance on is_enabled column
CREATE INDEX IF NOT EXISTS idx_categories_is_enabled ON categories(is_enabled);

-- Add new columns to subcategories table if needed for future enhancements
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS additional_config JSONB DEFAULT NULL;

-- Add index for performance on subcategories is_enabled column
CREATE INDEX IF NOT EXISTS idx_subcategories_is_enabled ON subcategories(is_enabled);

-- Create a view for enabled categories with their subcategories (useful for ticket forms)
CREATE OR REPLACE VIEW enabled_categories_with_subcategories AS
SELECT 
    c.id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.dynamic_form_schema,
    json_agg(
        json_build_object(
            'id', s.id,
            'name', s.name,
            'description', s.description,
            'response_time_hours', s.response_time_hours,
            'resolution_time_hours', s.resolution_time_hours,
            'sort_order', s.sort_order,
            'specialized_agents', s.specialized_agents
        ) ORDER BY s.sort_order
    ) FILTER (WHERE s.id IS NOT NULL AND s.is_enabled = true) as subcategories
FROM categories c
LEFT JOIN subcategories s ON c.id = s.category_id AND s.is_enabled = true
WHERE c.is_enabled = true
GROUP BY c.id, c.name, c.description, c.color, c.icon, c.sort_order, c.dynamic_form_schema
ORDER BY c.sort_order;

-- Function to get categories for ticket creation form
CREATE OR REPLACE FUNCTION get_categories_for_ticket_form()
RETURNS TABLE (
    id UUID,
    name TEXT,
    subcategories JSONB
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', s.id,
                    'name', s.name
                ) ORDER BY s.sort_order
            ) FILTER (WHERE s.id IS NOT NULL AND s.is_enabled = true),
            '[]'::json
        ) as subcategories
    FROM categories c
    LEFT JOIN subcategories s ON c.id = s.category_id AND s.is_enabled = true
    WHERE c.is_enabled = true
    GROUP BY c.id, c.name, c.sort_order
    ORDER BY c.sort_order;
END;
$$;

-- Function to reorder categories (useful for drag & drop)
CREATE OR REPLACE FUNCTION reorder_categories(category_orders JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    category_order JSONB;
BEGIN
    -- Iterate through the array of category orders
    FOR category_order IN SELECT * FROM jsonb_array_elements(category_orders)
    LOOP
        UPDATE categories 
        SET sort_order = (category_order->>'sort_order')::INTEGER
        WHERE id = (category_order->>'id')::UUID;
    END LOOP;
END;
$$;

-- Function to reorder subcategories
CREATE OR REPLACE FUNCTION reorder_subcategories(subcategory_orders JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    subcategory_order JSONB;
BEGIN
    -- Iterate through the array of subcategory orders
    FOR subcategory_order IN SELECT * FROM jsonb_array_elements(subcategory_orders)
    LOOP
        UPDATE subcategories 
        SET sort_order = (subcategory_order->>'sort_order')::INTEGER
        WHERE id = (subcategory_order->>'id')::UUID;
    END LOOP;
END;
$$;

-- Function to validate dynamic form schema
CREATE OR REPLACE FUNCTION validate_dynamic_form_schema(schema_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Basic validation for form schema structure
    IF schema_data IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check if it has a 'fields' array
    IF NOT (schema_data ? 'fields') THEN
        RETURN false;
    END IF;
    
    -- Additional validation can be added here
    RETURN true;
END;
$$;

-- Add constraint to validate form schema
ALTER TABLE categories ADD CONSTRAINT check_valid_form_schema 
CHECK (validate_dynamic_form_schema(dynamic_form_schema));

-- Create audit table for category changes (optional)
CREATE TABLE IF NOT EXISTS category_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'enabled', 'disabled', 'reordered'
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trigger function for category audit
CREATE OR REPLACE FUNCTION audit_category_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO category_audit_log (category_id, action, new_values)
        VALUES (NEW.id, 'created', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO category_audit_log (category_id, action, old_values, new_values)
        VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO category_audit_log (category_id, action, old_values)
        VALUES (OLD.id, 'deleted', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- Create triggers for audit logging (optional)
CREATE TRIGGER category_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_category_changes();

-- Grant necessary permissions (adjust as needed for your setup)
GRANT SELECT ON enabled_categories_with_subcategories TO authenticated;
GRANT EXECUTE ON FUNCTION get_categories_for_ticket_form() TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_categories(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_subcategories(JSONB) TO authenticated;

-- Insert some sample data if tables are empty (optional)
INSERT INTO categories (name, description, color, icon, sort_order, is_enabled, dynamic_form_schema)
SELECT 
    'Sample Category',
    'This is a sample category for testing',
    '#3B82F6',
    'folder',
    1,
    true,
    '{"fields": [{"id": "1", "type": "text", "label": "Sample Field", "required": true}]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Enhanced Category Management migration completed successfully!';
    RAISE NOTICE 'New features available:';
    RAISE NOTICE '- Enable/disable categories and subcategories';
    RAISE NOTICE '- Dynamic form schemas for categories';
    RAISE NOTICE '- Optimized views for ticket creation';
    RAISE NOTICE '- Bulk reordering functions';
    RAISE NOTICE '- Audit logging for changes';
END $$; 