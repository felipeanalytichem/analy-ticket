# Admin Role Setup Guide

## Method 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Login to your account
   - Select your project: `plbmgjqitlxedsmdqpld`

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Admin Setup SQL**
   ```sql
   -- Set felipe.henrique@analytichem.com as administrator
   UPDATE users 
   SET 
     role = 'admin',
     updated_at = NOW()
   WHERE email = 'felipe.henrique@analytichem.com';
   
   -- Verify the update
   SELECT 
     id,
     email,
     full_name,
     role,
     created_at,
     updated_at
   FROM users 
   WHERE email = 'felipe.henrique@analytichem.com';
   ```

4. **Execute the Query**
   - Click "Run" button
   - Check the results to confirm the role is now 'admin'

## Method 2: Using Table Editor

1. **Go to Table Editor**
   - In Supabase dashboard, click "Table Editor"
   - Select the "users" table

2. **Find Your User**
   - Look for the row with email: `felipe.henrique@analytichem.com`
   - Or use the filter: `email = felipe.henrique@analytichem.com`

3. **Edit the Role**
   - Click on the "role" cell for your user
   - Change the value from "user" to "admin"
   - Press Enter to save

## Verification

After completing either method:

1. **Check in Application**
   - Logout and login again in your application
   - You should now see admin features in the sidebar
   - You should have access to user management, SLA configuration, etc.

2. **Check User Profile**
   - Go to your profile page
   - The role should display as "Administrator"

## Current User Details

- **Email**: felipe.henrique@analytichem.com
- **User ID**: cc4ed50d-5ba6-4d98-b58a-ee74e14d89e3
- **Current Role**: user (needs to be changed to admin)
- **Name**: felipe.henrique

## Admin Features You'll Get Access To

Once you have admin role, you'll be able to:

- ✅ View all tickets (not just your own)
- ✅ Assign tickets to agents
- ✅ Manage user accounts and roles
- ✅ Configure SLA policies
- ✅ Access advanced analytics and reports
- ✅ Manage system settings
- ✅ View and manage reopen requests
- ✅ Access admin-only features in the sidebar

## Troubleshooting

If the role update doesn't work:

1. **Clear Browser Cache**
   - Clear your browser cache and cookies
   - Try logging out and back in

2. **Check RLS Policies**
   - The Row Level Security policies might be preventing the update
   - Running the SQL directly in Supabase dashboard bypasses RLS

3. **Contact Support**
   - If issues persist, you may need to contact Supabase support
   - Or check the RLS policies in the database

## Files Created for This Setup

- `update-admin-role.js` - Node.js script (didn't work due to RLS)
- `verify-admin-role.js` - Verification script
- `set-admin-via-app.js` - Alternative approach script
- `set-admin-role.sql` - SQL script for manual execution
- `ADMIN_SETUP_GUIDE.md` - This guide

You can delete these files after successfully setting up the admin role. 