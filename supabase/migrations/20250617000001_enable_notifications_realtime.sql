-- Enable realtime replication for notifications table
-- This ensures Supabase realtime service emits INSERT/UPDATE events
-- for the notifications table so the frontend receives them without refreshing.

alter publication supabase_realtime add table public.notifications; 