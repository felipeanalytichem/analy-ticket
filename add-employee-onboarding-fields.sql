-- Add Employee Onboarding Fields to tickets_new table
-- This script adds all the employee onboarding specific columns
-- Run this script in your Supabase SQL editor

-- Add employee onboarding specific columns to tickets_new table
-- Using IF NOT EXISTS equivalent for PostgreSQL

DO $$ 
BEGIN
    -- Add first_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'first_name') THEN
        ALTER TABLE tickets_new ADD COLUMN first_name TEXT;
    END IF;

    -- Add last_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'last_name') THEN
        ALTER TABLE tickets_new ADD COLUMN last_name TEXT;
    END IF;

    -- Add username column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'username') THEN
        ALTER TABLE tickets_new ADD COLUMN username TEXT;
    END IF;

    -- Add display_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'display_name') THEN
        ALTER TABLE tickets_new ADD COLUMN display_name TEXT;
    END IF;

    -- Add job_title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'job_title') THEN
        ALTER TABLE tickets_new ADD COLUMN job_title TEXT;
    END IF;

    -- Add manager column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'manager') THEN
        ALTER TABLE tickets_new ADD COLUMN manager TEXT;
    END IF;

    -- Add company_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'company_name') THEN
        ALTER TABLE tickets_new ADD COLUMN company_name TEXT;
    END IF;

    -- Add department column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'department') THEN
        ALTER TABLE tickets_new ADD COLUMN department TEXT;
    END IF;

    -- Add office_location column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'office_location') THEN
        ALTER TABLE tickets_new ADD COLUMN office_location TEXT;
    END IF;

    -- Add business_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'business_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN business_phone TEXT;
    END IF;

    -- Add mobile_phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mobile_phone') THEN
        ALTER TABLE tickets_new ADD COLUMN mobile_phone TEXT;
    END IF;

    -- Add start_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'start_date') THEN
        ALTER TABLE tickets_new ADD COLUMN start_date DATE;
    END IF;

    -- Add signature_group column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'signature_group') THEN
        ALTER TABLE tickets_new ADD COLUMN signature_group TEXT;
    END IF;

    -- Add usage_location column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'usage_location') THEN
        ALTER TABLE tickets_new ADD COLUMN usage_location TEXT;
    END IF;

    -- Add country_distribution_list column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'country_distribution_list') THEN
        ALTER TABLE tickets_new ADD COLUMN country_distribution_list TEXT;
    END IF;

    -- Add license_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'license_type') THEN
        ALTER TABLE tickets_new ADD COLUMN license_type TEXT;
    END IF;

    -- Add mfa_setup column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'mfa_setup') THEN
        ALTER TABLE tickets_new ADD COLUMN mfa_setup TEXT;
    END IF;

    -- Add attached_form column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets_new' AND column_name = 'attached_form') THEN
        ALTER TABLE tickets_new ADD COLUMN attached_form TEXT;
    END IF;

END $$;

-- Add indexes for better performance on commonly searched fields
CREATE INDEX IF NOT EXISTS idx_tickets_new_first_name ON tickets_new(first_name);
CREATE INDEX IF NOT EXISTS idx_tickets_new_last_name ON tickets_new(last_name);
CREATE INDEX IF NOT EXISTS idx_tickets_new_username ON tickets_new(username);
CREATE INDEX IF NOT EXISTS idx_tickets_new_company_name ON tickets_new(company_name);
CREATE INDEX IF NOT EXISTS idx_tickets_new_department ON tickets_new(department);
CREATE INDEX IF NOT EXISTS idx_tickets_new_start_date ON tickets_new(start_date);

-- Add comments for documentation
COMMENT ON COLUMN tickets_new.first_name IS 'Employee first name for onboarding tickets';
COMMENT ON COLUMN tickets_new.last_name IS 'Employee last name for onboarding tickets';
COMMENT ON COLUMN tickets_new.username IS 'Employee username/email for onboarding tickets';
COMMENT ON COLUMN tickets_new.display_name IS 'Employee display name for onboarding tickets';
COMMENT ON COLUMN tickets_new.job_title IS 'Employee job title for onboarding tickets';
COMMENT ON COLUMN tickets_new.manager IS 'Employee manager for onboarding tickets';
COMMENT ON COLUMN tickets_new.company_name IS 'Company name for onboarding tickets';
COMMENT ON COLUMN tickets_new.department IS 'Department for onboarding tickets';
COMMENT ON COLUMN tickets_new.office_location IS 'Office location for onboarding tickets';
COMMENT ON COLUMN tickets_new.business_phone IS 'Business phone number for onboarding tickets';
COMMENT ON COLUMN tickets_new.mobile_phone IS 'Mobile phone number for onboarding tickets';
COMMENT ON COLUMN tickets_new.start_date IS 'Employee start date for onboarding tickets';
COMMENT ON COLUMN tickets_new.signature_group IS 'Email signature group for onboarding tickets';
COMMENT ON COLUMN tickets_new.usage_location IS 'Usage location/country for onboarding tickets';
COMMENT ON COLUMN tickets_new.country_distribution_list IS 'Country-based distribution list for onboarding tickets';
COMMENT ON COLUMN tickets_new.license_type IS 'License type (Email Only, Full Office Apps, Teams Only) for onboarding tickets';
COMMENT ON COLUMN tickets_new.mfa_setup IS 'MFA setup information for onboarding tickets';
COMMENT ON COLUMN tickets_new.attached_form IS 'Attached form information for onboarding tickets';

-- Success message
SELECT 'Employee onboarding fields have been successfully added to tickets_new table.' as status; 