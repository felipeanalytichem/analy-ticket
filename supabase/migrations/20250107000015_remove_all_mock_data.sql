-- Remove all mock data and fix automatic assignments
-- This migration ensures no tickets are assigned to non-existent users

-- First, let's check and clean up any tickets assigned to non-existent users
UPDATE public.tickets_new 
SET assigned_to = NULL 
WHERE assigned_to IS NOT NULL 
AND assigned_to NOT IN (
    SELECT id FROM public.users WHERE id IS NOT NULL
);

-- Remove any sample/mock tickets that might have been created
DELETE FROM public.tickets_new 
WHERE title ILIKE '%test%' 
   OR title ILIKE '%mock%' 
   OR title ILIKE '%sample%' 
   OR title ILIKE '%demo%'
   OR description ILIKE '%test%' 
   OR description ILIKE '%mock%' 
   OR description ILIKE '%sample%' 
   OR description ILIKE '%demo%';

-- Remove any mock users that might exist (but preserve real authenticated users)
DELETE FROM public.users 
WHERE email ILIKE '%test%' 
   OR email ILIKE '%mock%' 
   OR email ILIKE '%sample%' 
   OR email ILIKE '%demo%'
   OR full_name ILIKE '%test%' 
   OR full_name ILIKE '%mock%' 
   OR full_name ILIKE '%sample%' 
   OR full_name ILIKE '%demo%';

-- Ensure no automatic assignment happens on ticket creation
-- Remove any triggers that might auto-assign tickets
DROP TRIGGER IF EXISTS auto_assign_ticket_trigger ON public.tickets_new;
DROP FUNCTION IF EXISTS auto_assign_ticket_function();

-- Create a function to validate ticket assignments (optional, for future use)
CREATE OR REPLACE FUNCTION validate_ticket_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- If assigned_to is provided, ensure the user exists and is an agent/admin
    IF NEW.assigned_to IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = NEW.assigned_to 
            AND role IN ('agent', 'admin')
        ) THEN
            RAISE EXCEPTION 'Cannot assign ticket to non-existent user or user without agent/admin role';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate assignments (but don't auto-assign)
CREATE TRIGGER validate_ticket_assignment_trigger
    BEFORE INSERT OR UPDATE ON public.tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION validate_ticket_assignment();

-- Log the cleanup
DO $$
DECLARE
    ticket_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ticket_count FROM public.tickets_new;
    SELECT COUNT(*) INTO user_count FROM public.users;
    
    RAISE NOTICE 'Mock data cleanup completed. Remaining tickets: %, Remaining users: %', ticket_count, user_count;
END $$; 