-- Remove foreign key constraint from users table to allow independent user creation
-- Migration: 20250107000020_remove_users_auth_constraint.sql

-- First, let's check if the constraint exists and remove it
DO $$ 
BEGIN
    -- Drop the foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' 
        AND table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
        RAISE NOTICE 'Foreign key constraint users_id_fkey removed successfully';
    ELSE
        RAISE NOTICE 'Foreign key constraint users_id_fkey does not exist';
    END IF;
END $$;

-- Ensure the id column is still a UUID primary key but without the foreign key constraint
ALTER TABLE public.users 
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Update RLS policies to handle users who may not have auth records
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create new policies that work with or without auth
CREATE POLICY "Users can view all profiles" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (
        -- Allow if authenticated user matches OR if user is admin
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can insert profiles" ON public.users
    FOR INSERT WITH CHECK (
        -- Allow if authenticated user matches OR if user is admin
        auth.uid() = id OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add a policy for admin user creation (without auth requirement)
CREATE POLICY "Admins can manage all users" ON public.users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create a function to handle user registration for existing email records
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
    -- If a user record with this email already exists, update its ID and details
    IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email) THEN
        UPDATE public.users 
        SET 
            id = NEW.id,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
            role = COALESCE((NEW.raw_user_meta_data->>'role')::text, role, 'user'),
            updated_at = NOW()
        WHERE email = NEW.email;
    ELSE
        -- Otherwise, insert a new record
        INSERT INTO public.users (id, email, full_name, role)
        VALUES (
            NEW.id,
            NEW.email,
            NEW.raw_user_meta_data->>'full_name',
            COALESCE((NEW.raw_user_meta_data->>'role')::text, 'user')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_registration();

-- Migration complete: Remove foreign key constraint from users table to allow independent user creation and add proper RLS policies for admin management 