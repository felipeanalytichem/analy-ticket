-- Add dynamic form data column to tickets_new table
ALTER TABLE tickets_new 
ADD COLUMN dynamic_form_data JSONB DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN tickets_new.dynamic_form_data IS 'JSON object storing dynamic form field values from subcategory custom fields';

-- Create index for better performance when querying dynamic form data
CREATE INDEX IF NOT EXISTS idx_tickets_dynamic_form_data ON tickets_new USING gin(dynamic_form_data); 