-- 🚨 URGENT: Category Enable/Disable Database Fix
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- Step 1: Add the is_enabled column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;

-- Step 2: Update all existing categories to be enabled by default
UPDATE categories SET is_enabled = true WHERE is_enabled IS NULL;

-- Step 3: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_enabled ON categories(is_enabled);

-- Step 4: Verify the column was added successfully
SELECT 
    id,
    name,
    is_enabled,
    sort_order
FROM categories 
ORDER BY sort_order;

-- Step 5: Test the filtering functionality
SELECT 
    'Total categories:' as info,
    COUNT(*) as count
FROM categories
UNION ALL
SELECT 
    'Enabled categories:' as info,
    COUNT(*) as count
FROM categories 
WHERE is_enabled = true
UNION ALL
SELECT 
    'Disabled categories:' as info,
    COUNT(*) as count
FROM categories 
WHERE is_enabled = false;

-- 🎉 After running this script:
-- 1. All existing categories will be enabled by default
-- 2. You can now disable categories in the Category Management interface
-- 3. Disabled categories won't appear in the Create Ticket dropdown
-- 4. The changes will sync in real-time between Category Management and Ticket Creation 