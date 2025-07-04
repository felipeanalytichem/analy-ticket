# Fix for Ticket Creation Not Respecting Disabled Categories

## Problem
When disabling categories in the new Category Management feature, the changes are not reflected in the Ticket Creation popup. Disabled categories still appear in the dropdown.

## Root Cause
1. The `TicketDialog.tsx` component was using the old `DatabaseService.getCategories()` method
2. This method returns ALL categories without filtering by enabled status
3. The database might be missing the `is_enabled` column

## Solution Applied

### 1. Updated TicketDialog.tsx
- **Before**: Used `DatabaseService.getCategories()` and local state
- **After**: Uses `useCategoryManagement()` hook with real-time sync
- **Benefit**: Real-time synchronization between Category Management and Ticket Creation

### 2. Code Changes Made

#### Import addition:
```typescript
import { useCategoryManagement } from "@/hooks/useCategoryManagement";
```

#### Replaced category fetching:
```typescript
// OLD: Local state and manual fetching
const [categories, setCategories] = useState<Category[]>([]);
useEffect(() => {
  const loadCategories = async () => {
    const data = await DatabaseService.getCategories(); // Gets ALL categories
    setCategories(data);
  };
  loadCategories();
}, [open, toast]);

// NEW: Real-time hook
const { getEnabledCategories } = useCategoryManagement();
```

#### Updated category mapping:
```typescript
// OLD: Used local state
{categories.map((category) => (...))}

// NEW: Uses enabled categories only
{getEnabledCategories().map((category) => (...))}
```

### 3. Database Requirements

The fix requires the `is_enabled` column in the `categories` table. If you encounter any errors, run this SQL in your Supabase SQL Editor:

```sql
-- Add required columns to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS dynamic_form_schema JSONB;

-- Update all existing categories to be enabled by default
UPDATE categories SET is_enabled = true WHERE is_enabled IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_enabled ON categories(is_enabled);
```

## Benefits of This Fix

1. **Real-time Sync**: Changes in Category Management instantly reflect in Ticket Creation
2. **Consistent UI**: Both components use the same data source
3. **Performance**: Uses existing caching from `useCategoryManagement` hook
4. **Future-proof**: Automatically works with any new category management features

## Testing the Fix

1. Open Category Management in admin panel
2. Disable a category using the toggle switch
3. Open Ticket Creation popup
4. Verify the disabled category no longer appears in the dropdown
5. Re-enable the category and verify it appears again

## Files Modified

- `src/components/tickets/TicketDialog.tsx` - Updated to use category management hook
- Database schema - Requires `is_enabled` column (manual SQL if needed)

The fix ensures that the Ticket Creation form only shows enabled categories and automatically updates when categories are toggled in the Category Management interface. 