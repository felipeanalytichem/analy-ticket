-- Check Database Schema
-- Run this script first to see what tables exist in your database

-- List all tables in the public schema
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if tickets_new table exists and show its columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tickets_new' 
ORDER BY ordinal_position;

-- Check for other ticket-related tables
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%ticket%'
ORDER BY table_name;
