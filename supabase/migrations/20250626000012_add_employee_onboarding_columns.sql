-- Add all missing employee onboarding columns to tickets_new table
ALTER TABLE tickets_new 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS manager TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS office_location TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT,
ADD COLUMN IF NOT EXISTS mobile_phone TEXT,
ADD COLUMN IF NOT EXISTS start_date TEXT,
ADD COLUMN IF NOT EXISTS signature_group TEXT,
ADD COLUMN IF NOT EXISTS usage_location TEXT,
ADD COLUMN IF NOT EXISTS country_distribution_list TEXT,
ADD COLUMN IF NOT EXISTS license_type TEXT,
ADD COLUMN IF NOT EXISTS mfa_setup TEXT,
ADD COLUMN IF NOT EXISTS attached_form TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comments to explain the purpose of each column
COMMENT ON COLUMN tickets_new.first_name IS 'Employee first name for onboarding';
COMMENT ON COLUMN tickets_new.last_name IS 'Employee last name for onboarding';
COMMENT ON COLUMN tickets_new.username IS 'Employee username/login for onboarding';
COMMENT ON COLUMN tickets_new.display_name IS 'Employee display name for onboarding';
COMMENT ON COLUMN tickets_new.job_title IS 'Employee job title for onboarding';
COMMENT ON COLUMN tickets_new.manager IS 'Employee manager for onboarding';
COMMENT ON COLUMN tickets_new.company_name IS 'Company name for employee onboarding';
COMMENT ON COLUMN tickets_new.department IS 'Employee department for onboarding';
COMMENT ON COLUMN tickets_new.office_location IS 'Employee office location for onboarding';
COMMENT ON COLUMN tickets_new.business_phone IS 'Business phone number for employee onboarding';
COMMENT ON COLUMN tickets_new.mobile_phone IS 'Mobile phone number for employee onboarding';
COMMENT ON COLUMN tickets_new.start_date IS 'Employee start date';
COMMENT ON COLUMN tickets_new.signature_group IS 'Email signature group for employee';
COMMENT ON COLUMN tickets_new.usage_location IS 'Usage location for license assignment';
COMMENT ON COLUMN tickets_new.country_distribution_list IS 'Country distribution list for employee';
COMMENT ON COLUMN tickets_new.license_type IS 'Type of license to assign to employee';
COMMENT ON COLUMN tickets_new.mfa_setup IS 'Multi-factor authentication setup status';
COMMENT ON COLUMN tickets_new.attached_form IS 'Reference to attached form document';
COMMENT ON COLUMN tickets_new.attachments IS 'JSON array containing attachment information for the ticket';