-- Fix Database Issues After Migration
-- 1. Fix infinite recursion in users table RLS policies
-- 2. Recreate admin user

-- First, let's disable RLS temporarily to fix the policies
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create simple, non-recursive policies
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Now create the admin user
-- First, check if admin user already exists and delete if found
DELETE FROM public.users WHERE email = 'admin@analytichem.com';

-- Insert admin user with a known ID
INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@analytichem.com',
    'Admin AnalytiChem',
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Create a function to create the auth user (this will need to be run separately)
CREATE OR REPLACE FUNCTION create_admin_auth_user()
RETURNS text AS $$
BEGIN
    -- This function documents the steps needed
    -- The actual auth user creation needs to be done via the Supabase dashboard or API
    RETURN 'Admin user created in public.users. Please create auth user with email: admin@analytichem.com, password: AnalytiChem2024!, user_id: 00000000-0000-0000-0000-000000000001';
END;
$$ LANGUAGE plpgsql;

-- Call the function to get instructions
SELECT create_admin_auth_user();

-- Verify the user was created
SELECT id, email, full_name, role, created_at FROM public.users WHERE email = 'admin@analytichem.com'; 