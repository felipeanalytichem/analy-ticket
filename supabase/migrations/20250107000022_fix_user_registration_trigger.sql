-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_registration();

-- Recreate the function with proper security context
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    default_role user_role;
BEGIN
    -- Set default role
    default_role := 'user'::user_role;

    -- Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        default_role,
        NOW(),
        NOW()
    );

    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- If email already exists, update the record
        UPDATE public.users
        SET
            id = NEW.id,
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            updated_at = NOW()
        WHERE email = NEW.email;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user_registration: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_registration();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON public.users TO postgres;
GRANT ALL ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Ensure the function can be executed
GRANT EXECUTE ON FUNCTION handle_new_user_registration() TO postgres;
GRANT EXECUTE ON FUNCTION handle_new_user_registration() TO service_role;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema'; 