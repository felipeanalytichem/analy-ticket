-- Add is_enabled column to subcategories table
-- Migration: Add subcategory enable/disable functionality

-- Add the is_enabled column to subcategories table
ALTER TABLE subcategories 
ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Add index for performance on subcategories is_enabled column
CREATE INDEX IF NOT EXISTS idx_subcategories_is_enabled ON subcategories(is_enabled);

-- Update existing subcategories to be enabled by default
UPDATE subcategories 
SET is_enabled = true 
WHERE is_enabled IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'subcategories' 
AND column_name = 'is_enabled';

-- Display current subcategories with their enabled status
SELECT id, category_id, name, is_enabled 
FROM subcategories 
ORDER BY category_id, sort_order; 