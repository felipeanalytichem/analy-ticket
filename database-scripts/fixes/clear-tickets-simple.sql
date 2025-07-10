-- Clear All Tickets - Simple Version
-- This script removes all existing tickets from the tickets_new table only
-- Run this script in your Supabase SQL editor

-- Delete all tickets from the main table
DELETE FROM tickets_new;

-- Verify the cleanup
SELECT 
  'tickets_new' as table_name, 
  COUNT(*) as remaining_records 
FROM tickets_new;

-- Success message
SELECT 'All tickets have been successfully deleted from tickets_new table. Database now has 0 tickets.' as status; 