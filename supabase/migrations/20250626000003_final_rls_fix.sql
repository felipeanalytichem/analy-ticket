-- Final RLS Fix - Remove all recursion completely
-- This migration completely eliminates RLS recursion by avoiding auth.users lookups

-- Step 1: Drop ALL existing policies on users table
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "agents_view_users" ON public.users;
DROP POLICY IF EXISTS "admins_manage_users" ON public.users;

-- Step 2: Create simple policies that don't reference auth.users metadata
CREATE POLICY "users_basic_select" ON public.users
    FOR SELECT USING (auth.uid() = id OR auth.uid() IS NOT NULL);

CREATE POLICY "users_basic_update" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_basic_insert" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 3: Fix tickets policies to avoid user table joins
DROP POLICY IF EXISTS "tickets_select_own" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_select_assigned" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_select_agents" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_insert_own" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_update_own" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_update_assigned" ON public.tickets_new;
DROP POLICY IF EXISTS "tickets_update_agents" ON public.tickets_new;

-- Create simple ticket policies
CREATE POLICY "tickets_basic_select" ON public.tickets_new
    FOR SELECT USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR 
        auth.uid() IS NOT NULL
    );

CREATE POLICY "tickets_basic_insert" ON public.tickets_new
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tickets_basic_update" ON public.tickets_new
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR 
        auth.uid() IS NOT NULL
    );

-- Step 4: Simplify categories policies
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
DROP POLICY IF EXISTS "categories_admin_manage" ON public.categories;

CREATE POLICY "categories_open_select" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY "categories_auth_manage" ON public.categories
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Step 5: Ensure notifications work properly
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;

CREATE POLICY "notifications_basic_select" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_basic_update" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_basic_insert" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Step 6: Fix ticket comments policies
DROP POLICY IF EXISTS "Users can view comments for their tickets" ON public.ticket_comments_new;
DROP POLICY IF EXISTS "Users can create comments on their tickets" ON public.ticket_comments_new;
DROP POLICY IF EXISTS "Agents can view all comments" ON public.ticket_comments_new;
DROP POLICY IF EXISTS "Agents can create comments on assigned tickets" ON public.ticket_comments_new;

CREATE POLICY "comments_basic_access" ON public.ticket_comments_new
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Step 7: Update admin user metadata one more time
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
    'role', 'admin',
    'full_name', 'Admin AnalytiChem'
)
WHERE email = 'admin@analytichem.com';

-- Step 8: Ensure admin user exists in public.users
INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    'Admin AnalytiChem',
    'admin',
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'admin@analytichem.com'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    full_name = 'Admin AnalytiChem',
    updated_at = NOW();

COMMENT ON SCHEMA public IS 'Final RLS fix applied - all recursion eliminated'; 