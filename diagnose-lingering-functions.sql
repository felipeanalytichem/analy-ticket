-- This is a simplified diagnostic script that lists ALL functions in the public schema.
-- It avoids the problematic search clause.
-- Please run this in your Supabase SQL Editor and paste the entire result back.

SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as function_args,
    pg_get_functiondef(p.oid) as function_definition
FROM
    pg_proc p
JOIN
    pg_namespace n ON p.pronamespace = n.oid
WHERE
    n.nspname = 'public'; 