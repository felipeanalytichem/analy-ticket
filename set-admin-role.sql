-- Set felipe.henrique@analytichem.com as administrator
-- This script should be run directly in the Supabase SQL editor

-- Update the user role to admin
UPDATE users 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE email = 'felipe.henrique@analytichem.com';

-- Verify the update
SELECT 
  id,
  email,
  full_name,
  role,
  created_at,
  updated_at
FROM users 
WHERE email = 'felipe.henrique@analytichem.com'; 