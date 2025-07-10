-- Add dynamic form fields column to subcategories
ALTER TABLE subcategories 
ADD COLUMN dynamic_form_fields JSONB DEFAULT NULL;

-- Add comment to document the column structure
COMMENT ON COLUMN subcategories.dynamic_form_fields IS 'JSON array of dynamic form field definitions with structure: [{"id": "string", "type": "text|textarea|select|checkbox|date|number", "label": "string", "required": boolean, "options": ["string"], "enabled": boolean}]';

-- Create index for better performance when querying form fields
CREATE INDEX IF NOT EXISTS idx_subcategories_form_fields ON subcategories USING gin(dynamic_form_fields);

-- Update existing subcategories to have enabled form fields (if any)
UPDATE subcategories 
SET dynamic_form_fields = '[]'::jsonb 
WHERE dynamic_form_fields IS NULL; 