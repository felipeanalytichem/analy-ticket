-- Simple query to find problematic functions
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    l.lanname as language,
    CASE WHEN l.lanname = 'internal' THEN ''
         ELSE pg_get_functiondef(p.oid)
    END as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
AND l.lanname != 'internal'  -- Skip internal functions
AND (
    pg_get_functiondef(p.oid) ~ 'ticket_record'
    OR pg_get_functiondef(p.oid) ~ '\mRECORD[;)]'
); 