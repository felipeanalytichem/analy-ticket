# Ticket Creation Feature Fixes

## Issue Summary
The ticket creation feature was encountering database errors due to missing columns in the `tickets_new` table. The errors appeared when trying to create tickets with employee onboarding information.

## Root Cause
The frontend code was attempting to save employee onboarding fields to the database, but the corresponding columns didn't exist in the `tickets_new` table. The specific errors were:

1. `Could not find the 'attachments' column of 'tickets_new' in the schema cache`
2. `Could not find the 'business_phone' column of 'tickets_new' in the schema cache`
3. `Could not find the 'companyName' column of 'tickets_new' in the schema cache`

Additionally, there was a camelCase vs. snake_case naming mismatch between the frontend and database.

## Implemented Fixes

### 1. Database Schema Updates
Created migration files to add all missing columns to the `tickets_new` table:

- `first_name`
- `last_name`
- `username`
- `display_name`
- `job_title`
- `manager`
- `company_name`
- `department`
- `office_location`
- `business_phone`
- `mobile_phone`
- `start_date`
- `signature_group`
- `usage_location`
- `country_distribution_list`
- `license_type`
- `mfa_setup`
- `attached_form`
- `attachments` (JSONB type)

### 2. Frontend Code Updates
Modified the `TicketDialog.tsx` component to:

- Convert all camelCase field names to snake_case for database compatibility
- Properly handle all employee onboarding fields
- Handle file attachments separately through the `createAttachment` method

### 3. Migration Scripts
Created two SQL scripts for applying the changes:

1. `supabase/migrations/20250626000012_add_employee_onboarding_columns.sql` - For proper versioning
2. `add-employee-onboarding-columns.sql` - For direct execution in Supabase SQL Editor

Also updated `run-migration.js` to include all necessary migrations.

## How to Apply the Fix

### Option 1: Run the Migration Script
```bash
node run-migration.js
```

### Option 2: Manual SQL Execution
1. Open the Supabase SQL Editor
2. Copy and paste the contents of `add-employee-onboarding-columns.sql`
3. Execute the SQL

## Verification
After applying the fix, ticket creation should work without errors, including all employee onboarding fields.

## Preventive Measures
To prevent similar issues in the future:

1. Always ensure database schema changes are properly versioned and documented
2. Implement a strict naming convention (snake_case for database, camelCase for frontend)
3. Add validation to prevent submitting fields that don't exist in the database
4. Consider implementing a data access layer that automatically handles the conversion between camelCase and snake_case 