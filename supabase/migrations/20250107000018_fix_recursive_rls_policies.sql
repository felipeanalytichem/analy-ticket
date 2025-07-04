-- Fix infinite recursion in RLS policies for users table
-- This migration fixes the recursive policy issue by simplifying the admin check

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- Create a secure view for admin checks to avoid recursion
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Use a direct query without going through RLS
    RETURN (
        SELECT role = 'admin' 
        FROM public.users 
        WHERE id = user_id
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search_path to prevent injection attacks
ALTER FUNCTION is_admin_user(UUID) SET search_path = public;

-- Create simplified RLS policies without recursion

-- SELECT policy: Users can see their own profile, admins can see all
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        id = auth.uid() 
        OR 
        is_admin_user(auth.uid())
    );

-- INSERT policy: Allow self-registration and admin creation
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (
        id = auth.uid() 
        OR 
        is_admin_user(auth.uid())
    );

-- UPDATE policy: Users can update themselves, admins can update anyone
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        id = auth.uid() 
        OR 
        is_admin_user(auth.uid())
    ) WITH CHECK (
        id = auth.uid() 
        OR 
        is_admin_user(auth.uid())
    );

-- DELETE policy: Only admins can delete (but not themselves)
CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        is_admin_user(auth.uid()) 
        AND 
        id != auth.uid()
    );

-- Update the create_user_by_admin function to use the new helper
CREATE OR REPLACE FUNCTION create_user_by_admin(
    user_email TEXT,
    user_name TEXT,
    user_role TEXT DEFAULT 'user'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if current user is admin using the helper function
    IF NOT is_admin_user(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Insert the new user
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (new_user_id, user_email, user_name, user_role, NOW(), NOW());
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search_path for security
ALTER FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) SET search_path = public;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON FUNCTION is_admin_user IS 'Check if a user ID belongs to an admin without causing RLS recursion';
COMMENT ON FUNCTION create_user_by_admin IS 'Helper function for admins to create new users safely'; 