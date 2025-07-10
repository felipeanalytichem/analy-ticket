# Fix: Missing is_enabled Column in Subcategories Table

## Issue Found 🔍
The console logs show this error when trying to toggle subcategory enable/disable:
```
"Could not find the 'is_enabled' column of 'subcategories' in the schema cache"
```

## Quick Fix Steps 🚀

### 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New query"**

### 2. Copy and Paste This SQL
```sql
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
```

### 3. Execute the SQL
1. Click **"Run"** button in Supabase SQL Editor
2. You should see:
   - Confirmation that the column was added
   - A list of all subcategories with their `is_enabled` status

### 4. Verify the Fix
1. Go back to your application at `http://localhost:8081`
2. Navigate to **Category Management**
3. Click **"View All"** on any category
4. Try toggling the enable/disable switch on subcategories
5. Check the browser console - the errors should be gone!

## Expected Results ✅

After running the SQL:
- All existing subcategories will have `is_enabled = true`
- The toggle functionality will work without errors
- Console logs will be clean
- Subcategories can be individually enabled/disabled

## Alternative: If SQL Editor Doesn't Work

If you can't access SQL Editor, you can also:

1. **Use the Table Editor:**
   - Go to **Table Editor** → **subcategories**
   - Click the **"+"** next to columns
   - Add column: `is_enabled`, type: `bool`, default: `true`

2. **Use the CLI:**
   ```bash
   npx supabase db diff --use-migra
   ```

## Files Created 📄
- `add-subcategory-is-enabled-column.sql` - The SQL migration
- `apply-subcategory-migration.mjs` - Node.js script (requires service role key)
- `FIX_SUBCATEGORY_ENABLE_COLUMN.md` - This guide

## What This Fixes 🔧
- ✅ Removes console errors about missing `is_enabled` column
- ✅ Enables subcategory toggle functionality
- ✅ Adds proper database indexing for performance
- ✅ Sets all existing subcategories to enabled by default

Run the SQL in Supabase SQL Editor and the subcategory enable/disable feature will work perfectly! 