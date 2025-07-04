-- Fix RLS policies to allow admins to create users
-- This migration adds the necessary policies for admins to create new users

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view own temporary password status" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create comprehensive RLS policies for users table

-- Policy for SELECT (read access)
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (
        -- Users can see their own profile
        auth.uid() = id 
        OR 
        -- Admins can see all users
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for INSERT (create new users)
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (
        -- Admins can create new users
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        -- Allow self-registration (when id matches auth.uid())
        auth.uid() = id
    );

-- Policy for UPDATE (modify existing users)
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        -- Users can update their own profile
        auth.uid() = id 
        OR 
        -- Admins can update any user
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    ) WITH CHECK (
        -- Same conditions for WITH CHECK
        auth.uid() = id 
        OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for DELETE (remove users)
CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        -- Only admins can delete users (and not themselves)
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
        AND auth.uid() != users.id
    );

-- Ensure RLS is enabled on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT DELETE ON public.users TO authenticated;

-- Create a function to help with user creation by admins
CREATE OR REPLACE FUNCTION create_user_by_admin(
    user_email TEXT,
    user_name TEXT,
    user_role TEXT DEFAULT 'user'
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Check if current user is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
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

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_user_by_admin IS 'Helper function for admins to create new users without auth.uid() conflicts'; 