-- Add attachments column to tickets_new table
ALTER TABLE tickets_new 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN tickets_new.attachments IS 'JSON array containing attachment information for the ticket'; 