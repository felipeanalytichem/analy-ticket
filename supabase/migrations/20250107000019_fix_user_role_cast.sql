-- Fix user role type casting in create_user_by_admin function
-- This migration fixes the type mismatch between text and user_role enum

-- Update the create_user_by_admin function to properly cast the role
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
    
    -- Validate role parameter
    IF user_role NOT IN ('user', 'agent', 'admin') THEN
        RAISE EXCEPTION 'Invalid role. Must be one of: user, agent, admin';
    END IF;
    
    -- Generate a new UUID for the user
    new_user_id := gen_random_uuid();
    
    -- Insert the new user with proper role casting
    INSERT INTO public.users (id, email, full_name, role, created_at, updated_at)
    VALUES (
        new_user_id, 
        user_email, 
        user_name, 
        user_role::user_role,  -- Cast text to user_role enum
        NOW(), 
        NOW()
    );
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search_path for security
ALTER FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_user_by_admin(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_user_by_admin IS 'Helper function for admins to create new users with proper role type casting'; 