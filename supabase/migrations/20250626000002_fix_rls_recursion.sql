-- Fix RLS Policy Recursion Issues
-- This migration resolves the infinite recursion in users table policies
-- that is causing ERR_INSUFFICIENT_RESOURCES errors

-- Step 1: Drop all existing problematic policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Agents can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- Step 2: Create simple, non-recursive policies
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 3: Allow agents and admins to view other users (non-recursive)
CREATE POLICY "agents_view_users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users au 
            WHERE au.id = auth.uid() 
            AND au.raw_user_meta_data->>'role' IN ('agent', 'admin')
        )
    );

-- Step 4: Allow admins to manage all users (non-recursive)
CREATE POLICY "admins_manage_users" ON public.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users au 
            WHERE au.id = auth.uid() 
            AND au.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Step 5: Fix categories table policies to avoid user table lookups
DROP POLICY IF EXISTS "Everyone can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admin can manage categories" ON public.categories;

CREATE POLICY "categories_select_all" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY "categories_admin_manage" ON public.categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users au 
            WHERE au.id = auth.uid() 
            AND au.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Step 6: Fix tickets policies to avoid recursive user lookups
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets_new;
DROP POLICY IF EXISTS "Agents can view all tickets" ON public.tickets_new;
DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.tickets_new;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.tickets_new;
DROP POLICY IF EXISTS "Agents can update assigned tickets" ON public.tickets_new;

CREATE POLICY "tickets_select_own" ON public.tickets_new
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tickets_select_assigned" ON public.tickets_new
    FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "tickets_select_agents" ON public.tickets_new
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users au 
            WHERE au.id = auth.uid() 
            AND au.raw_user_meta_data->>'role' IN ('agent', 'admin')
        )
    );

CREATE POLICY "tickets_insert_own" ON public.tickets_new
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tickets_update_own" ON public.tickets_new
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "tickets_update_assigned" ON public.tickets_new
    FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "tickets_update_agents" ON public.tickets_new
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users au 
            WHERE au.id = auth.uid() 
            AND au.raw_user_meta_data->>'role' IN ('agent', 'admin')
        )
    );

-- Step 7: Ensure notifications table has proper policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_auth" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Step 8: Update the admin user's metadata to ensure role is set correctly
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
    'role', 'admin',
    'full_name', 'Admin AnalytiChem'
)
WHERE email = 'admin@analytichem.com';

COMMENT ON SCHEMA public IS 'RLS policies fixed - no more recursion issues'; 