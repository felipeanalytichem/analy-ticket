-- FORM MIGRATION FIX
-- This migrates existing form schemas from categories.dynamic_form_schema to subcategories.dynamic_form_fields
-- Run this in Supabase SQL Editor to fix the missing form fields issue

-- Step 1: Check what categories have form schemas
SELECT 
    id, 
    name, 
    dynamic_form_schema,
    jsonb_array_length(COALESCE(dynamic_form_schema->'fields', '[]'::jsonb)) as field_count
FROM categories 
WHERE dynamic_form_schema IS NOT NULL 
    AND dynamic_form_schema != 'null'::jsonb;

-- Step 2: Migrate form schemas from categories to their subcategories
DO $$
DECLARE
    cat_record RECORD;
    sub_record RECORD;
    form_fields JSONB;
    total_migrated INTEGER := 0;
BEGIN
    RAISE NOTICE '=== STARTING FORM MIGRATION ===';
    
    -- Iterate through categories that have form schemas
    FOR cat_record IN 
        SELECT id, name, dynamic_form_schema 
        FROM categories 
        WHERE dynamic_form_schema IS NOT NULL 
        AND dynamic_form_schema != 'null'::jsonb
        AND (
            jsonb_array_length(COALESCE(dynamic_form_schema->'fields', '[]'::jsonb)) > 0
            OR (jsonb_typeof(dynamic_form_schema) = 'array' AND jsonb_array_length(dynamic_form_schema) > 0)
        )
    LOOP
        RAISE NOTICE 'Processing category: % (ID: %)', cat_record.name, cat_record.id;
        
        -- Extract the fields array from the schema
        form_fields := cat_record.dynamic_form_schema->'fields';
        
        -- If no fields array, try to use the schema directly if it's an array
        IF form_fields IS NULL AND jsonb_typeof(cat_record.dynamic_form_schema) = 'array' THEN
            form_fields := cat_record.dynamic_form_schema;
        END IF;
        
        IF form_fields IS NOT NULL AND jsonb_array_length(form_fields) > 0 THEN
            RAISE NOTICE '  Found % form fields to migrate', jsonb_array_length(form_fields);
            
            -- Apply to all subcategories of this category
            FOR sub_record IN 
                SELECT id, name 
                FROM subcategories 
                WHERE category_id = cat_record.id
            LOOP
                RAISE NOTICE '    -> Migrating to subcategory: % (ID: %)', sub_record.name, sub_record.id;
                
                -- Update subcategory with the form fields
                UPDATE subcategories 
                SET dynamic_form_fields = form_fields
                WHERE id = sub_record.id;
                
                total_migrated := total_migrated + 1;
            END LOOP;
            
            -- Clear the category form schema since it's now moved to subcategories
            UPDATE categories 
            SET dynamic_form_schema = NULL 
            WHERE id = cat_record.id;
            
            RAISE NOTICE '  ✓ Completed migration for category: %', cat_record.name;
        ELSE
            RAISE NOTICE '  ⚠ No valid form fields found in category: %', cat_record.name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== MIGRATION COMPLETED ===';
    RAISE NOTICE 'Total subcategories updated: %', total_migrated;
END $$;

-- Step 3: Verify the migration results
SELECT 
    'CATEGORIES WITH REMAINING FORM SCHEMAS' as check_type,
    COUNT(*) as count
FROM categories 
WHERE dynamic_form_schema IS NOT NULL 
    AND dynamic_form_schema != 'null'::jsonb
    
UNION ALL

SELECT 
    'SUBCATEGORIES WITH MIGRATED FORMS' as check_type,
    COUNT(*) as count
FROM subcategories 
WHERE dynamic_form_fields IS NOT NULL 
    AND jsonb_array_length(dynamic_form_fields) > 0;

-- Step 4: Show detailed results
SELECT 
    c.name as category_name,
    s.name as subcategory_name,
    s.id as subcategory_id,
    jsonb_array_length(s.dynamic_form_fields) as field_count,
    s.dynamic_form_fields
FROM subcategories s
JOIN categories c ON s.category_id = c.id
WHERE s.dynamic_form_fields IS NOT NULL 
    AND jsonb_array_length(s.dynamic_form_fields) > 0
ORDER BY c.name, s.name; 