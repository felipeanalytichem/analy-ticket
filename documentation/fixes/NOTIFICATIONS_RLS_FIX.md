# Notifications RLS Policy Fix

## Issue Summary
When reviewing and approving/rejecting ticket reopen requests, the following error was occurring:

```
POST https://plbmgjqitlxedsmdqpld.supabase.co/rest/v1/notifications?select=* 403 (Forbidden)

Error creating notification: 
{code: '42501', details: null, hint: null, message: 'new row violates row-level security policy for table "notifications"'}
```

This error indicates that the current user doesn't have permission to insert new rows into the `notifications` table due to Row-Level Security (RLS) policy restrictions.

## Root Cause
The existing RLS policies on the `notifications` table were too restrictive, preventing users (even admins and agents) from creating notifications when reviewing reopen requests. The policies were likely missing or improperly configured for:

1. Admin/agent permissions to create notifications for any user
2. Service role permissions to manage notifications

## Implemented Fix

### 1. Created New RLS Policies
The fix involves creating a comprehensive set of RLS policies for the `notifications` table:

1. **View Policy**: Users can only view their own notifications
2. **Update Policy**: Users can only update their own notifications (e.g., marking as read)
3. **Insert Policy for Admins/Agents**: Admins and agents can create notifications for any user
4. **Service Role Policy**: Service role has full access to manage all notifications

### 2. Migration Files
Created two SQL files to implement the fix:

1. `supabase/migrations/20250626000013_fix_notifications_rls.sql` - For proper versioning
2. `fix-notifications-rls.sql` - For direct execution in Supabase SQL Editor

### 3. Updated Migration Runner
Updated `run-migration.js` to include the new RLS policy fix.

## How to Apply the Fix

### Option 1: Run the Migration Script
```bash
node run-migration.js
```

### Option 2: Manual SQL Execution
1. Open the Supabase SQL Editor
2. Copy and paste the contents of `fix-notifications-rls.sql`
3. Execute the SQL

## Verification
After applying the fix, the following functionality should work without errors:
1. Admins and agents should be able to approve/reject reopen requests
2. Notifications should be created successfully when reopen requests are processed
3. Users should still only see their own notifications

## Security Considerations
This fix maintains proper security by:
1. Ensuring users can only see and update their own notifications
2. Allowing only admins and agents to create notifications for any user
3. Providing appropriate access for service roles for system operations 