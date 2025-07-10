-- ============================================================================
-- APPLY TICKET NUMBER FIX
-- ============================================================================
-- Run this script in your Supabase SQL Editor to fix the ticket number
-- generation issue. This will create the proper trigger to auto-generate
-- ticket numbers in the format ACS-TK-YYYYMM-NNNN
-- ============================================================================

-- 1. Create ticket_sequences table for monthly sequence control
CREATE TABLE IF NOT EXISTS ticket_sequences (
    year_month TEXT PRIMARY KEY, -- formato YYYYMM
    last_sequence INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on ticket_sequences table
ALTER TABLE ticket_sequences ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist and create new ones
DROP POLICY IF EXISTS "Users can read ticket sequences" ON ticket_sequences;
DROP POLICY IF EXISTS "Users can insert ticket sequences" ON ticket_sequences;
DROP POLICY IF EXISTS "Users can update ticket sequences" ON ticket_sequences;

CREATE POLICY "Users can read ticket sequences" ON ticket_sequences
    FOR SELECT USING (true);

CREATE POLICY "Users can insert ticket sequences" ON ticket_sequences
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update ticket sequences" ON ticket_sequences
    FOR UPDATE USING (true);

-- 4. Create function to generate ticket numbers in format ACS-TK-YYYYMM-NNNN
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    current_year_month TEXT;
    next_sequence INTEGER;
    ticket_number TEXT;
BEGIN
    -- Get current year and month in YYYYMM format
    current_year_month := TO_CHAR(NOW(), 'YYYYMM');
    
    -- Insert or update sequence for current month
    INSERT INTO ticket_sequences (year_month, last_sequence)
    VALUES (current_year_month, 1)
    ON CONFLICT (year_month)
    DO UPDATE SET 
        last_sequence = ticket_sequences.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO next_sequence;
    
    -- Generate ticket number in format ACS-TK-YYYYMM-NNNN
    ticket_number := 'ACS-TK-' || current_year_month || '-' || LPAD(next_sequence::TEXT, 4, '0');
    
    RETURN ticket_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger function to set ticket number automatically
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    -- If ticket_number is not provided or is empty, generate automatically
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON tickets_new;
CREATE TRIGGER trigger_set_ticket_number
    BEFORE INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- 7. Update existing tickets without proper ticket numbers
UPDATE tickets_new 
SET ticket_number = generate_ticket_number()
WHERE ticket_number IS NULL 
   OR ticket_number = '' 
   OR NOT ticket_number ~ '^ACS-TK-[0-9]{6}-[0-9]{4}$';

-- Success message and verification
SELECT 'SUCCESS: Ticket number generation system has been implemented!' as status;

-- Test the trigger by showing what would happen
SELECT 
    'Test ticket number generation' as test_description,
    generate_ticket_number() as sample_ticket_number;

-- Verify the trigger exists
SELECT 
    'Trigger verification' as verification,
    tgname as trigger_name,
    tgrelid::regclass as table_name
FROM pg_trigger 
WHERE tgname = 'trigger_set_ticket_number';

-- Show current sequence status
SELECT 
    'Current sequences' as info,
    year_month,
    last_sequence,
    created_at
FROM ticket_sequences
ORDER BY year_month DESC; 