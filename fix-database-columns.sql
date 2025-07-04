-- Fix Database Columns for Category Management
-- Run this in your Supabase SQL Editor

-- Add is_enabled column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Add dynamic_form_schema column for future features
ALTER TABLE categories ADD COLUMN IF NOT EXISTS dynamic_form_schema JSONB;

-- Update all existing categories to be enabled by default
UPDATE categories SET is_enabled = true WHERE is_enabled IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_enabled ON categories(is_enabled);

-- Verify the changes
SELECT 
  name, 
  is_enabled,
  CASE 
    WHEN is_enabled IS NULL THEN 'NULL (needs fixing)'
    WHEN is_enabled = true THEN 'ENABLED'
    WHEN is_enabled = false THEN 'DISABLED'
  END as status
FROM categories 
ORDER BY sort_order; 