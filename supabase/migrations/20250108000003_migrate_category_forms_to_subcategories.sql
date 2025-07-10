-- Migration: Move dynamic form schemas from categories to subcategories
-- This handles the transition from category-level forms to subcategory-level forms

-- First, let's see what we have in categories
DO $$
DECLARE
    cat_record RECORD;
    sub_record RECORD;
    form_fields JSONB;
BEGIN
    -- Iterate through categories that have form schemas
    FOR cat_record IN 
        SELECT id, name, dynamic_form_schema 
        FROM categories 
        WHERE dynamic_form_schema IS NOT NULL 
        AND dynamic_form_schema != 'null'::jsonb
        AND jsonb_array_length(COALESCE(dynamic_form_schema->'fields', '[]'::jsonb)) > 0
    LOOP
        RAISE NOTICE 'Processing category: % with form schema', cat_record.name;
        
        -- Extract the fields array from the schema
        form_fields := cat_record.dynamic_form_schema->'fields';
        
        -- If no fields array, try to use the schema directly if it's an array
        IF form_fields IS NULL AND jsonb_typeof(cat_record.dynamic_form_schema) = 'array' THEN
            form_fields := cat_record.dynamic_form_schema;
        END IF;
        
        -- Apply to all subcategories of this category
        FOR sub_record IN 
            SELECT id, name 
            FROM subcategories 
            WHERE category_id = cat_record.id
        LOOP
            RAISE NOTICE '  -> Migrating to subcategory: %', sub_record.name;
            
            -- Update subcategory with the form fields
            UPDATE subcategories 
            SET dynamic_form_fields = form_fields
            WHERE id = sub_record.id;
        END LOOP;
        
        -- Clear the category form schema since it's now moved to subcategories
        UPDATE categories 
        SET dynamic_form_schema = NULL 
        WHERE id = cat_record.id;
        
        RAISE NOTICE 'Completed migration for category: %', cat_record.name;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END $$; 