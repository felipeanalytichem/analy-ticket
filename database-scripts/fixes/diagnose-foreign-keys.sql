-- This diagnostic script finds the exact names of all foreign key relationships
-- on the chat_message_reactions table. This will tell us the correct name to use
-- in our application code to fix the "Bad Request" error.
--
-- Please run this in your Supabase SQL Editor and paste the results back.

SELECT
    con.conname AS constraint_name,
    tbl.relname AS table_name,
    att.attname AS column_name,
    cl.relname AS foreign_table_name,
    af.attname AS foreign_column_name
FROM
    pg_constraint con
JOIN
    pg_class tbl ON con.conrelid = tbl.oid
JOIN
    pg_namespace ns ON tbl.relnamespace = ns.oid
JOIN
    pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = ANY(con.conkey)
LEFT JOIN
    pg_class cl ON con.confrelid = cl.oid
LEFT JOIN
    pg_attribute af ON af.attrelid = cl.oid AND af.attnum = ANY(con.confkey)
WHERE
    tbl.relname = 'chat_message_reactions'
    AND ns.nspname = 'public'
    AND con.contype = 'f'; -- 'f' for foreign key 