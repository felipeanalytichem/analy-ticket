-- Clear All Tickets - Start Fresh with 0 Tickets
-- This script removes all existing tickets from the database
-- Run this script in your Supabase SQL editor to clear all ticket data

-- Delete all ticket attachments first (to maintain referential integrity)
DELETE FROM ticket_attachments;

-- Delete all ticket comments
DELETE FROM ticket_comments;

-- Delete all tickets from the main table
DELETE FROM tickets_new;

-- Reset the ticket number sequence (if you have one)
-- This ensures the next ticket will start from #1
-- Uncomment the line below if you have a sequence for ticket numbers
-- ALTER SEQUENCE tickets_new_ticket_number_seq RESTART WITH 1;

-- Optional: Reset any auto-increment IDs
-- This will make the next ticket have ID starting from a fresh number
-- Uncomment if you want to reset the ID sequence as well
-- SELECT setval(pg_get_serial_sequence('tickets_new', 'id'), 1, false);

-- Verify the cleanup
SELECT 
  'tickets_new' as table_name, 
  COUNT(*) as remaining_records 
FROM tickets_new
UNION ALL
SELECT 
  'ticket_comments' as table_name, 
  COUNT(*) as remaining_records 
FROM ticket_comments
UNION ALL
SELECT 
  'ticket_attachments' as table_name, 
  COUNT(*) as remaining_records 
FROM ticket_attachments;

-- Success message
SELECT 'All tickets have been successfully deleted. Database is now clean with 0 tickets.' as status;
