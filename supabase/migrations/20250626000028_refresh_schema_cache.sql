-- Refresh schema cache
SELECT pg_notify('supabase_realtime', 'reload'); 