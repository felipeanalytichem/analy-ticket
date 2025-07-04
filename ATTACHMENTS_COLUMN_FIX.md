# Attachments Column Fix

## Issue
The application was encountering an error when creating tickets:
```
Could not find the 'attachments' column of 'tickets_new' in the schema cache
```

## Root Cause
The code was trying to include an `attachments` field in the ticket data being sent to the database, but this column doesn't exist in the `tickets_new` table.

## Fix Implementation

### 1. Modified TicketDialog.tsx
- Removed the `attachments` field from the ticket data object
- Updated the code to handle attachments separately after ticket creation using the `createAttachment` method
- Fixed return value handling from database functions

### 2. Created Database Migration
- Created a migration file: `supabase/migrations/20250626000011_add_attachments_column.sql`
- Added a direct SQL script: `add-attachments-column.sql` (for manual execution in Supabase SQL Editor)
- The migration adds an `attachments` JSONB column to the `tickets_new` table

### 3. Updated Migration Script
- Enhanced `run-migration.js` to handle multiple migrations including the new attachments column

## How to Apply the Fix

### Option 1: Run the Migration Script
```bash
node run-migration.js
```

### Option 2: Manual SQL Execution
1. Open the Supabase SQL Editor
2. Copy and paste the contents of `add-attachments-column.sql`
3. Execute the SQL

## Verification
After applying the fix, ticket creation should work without errors related to the `attachments` column. 