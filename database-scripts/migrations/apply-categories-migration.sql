-- Categories Migration SQL
-- Run this script in Supabase SQL Editor to create the categories and subcategories system

-- Create categories table (or add missing columns if exists)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add missing columns to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'folder',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  response_time_hours INTEGER DEFAULT 24,
  resolution_time_hours INTEGER DEFAULT 72,
  specialized_agents UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(category_id, name)
);

-- Add category and subcategory to tickets_new table
ALTER TABLE tickets_new 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id),
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES subcategories(id);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories (simplified - everyone can read)
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS Policies for subcategories (simplified - everyone can read)
DROP POLICY IF EXISTS "Anyone can view subcategories" ON subcategories;
CREATE POLICY "Anyone can view subcategories" ON subcategories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage subcategories" ON subcategories;
CREATE POLICY "Admins can manage subcategories" ON subcategories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Insert default categories (with all columns)
INSERT INTO categories (name, description, color, icon, sort_order) VALUES
('IT & Technical Support', 'Information Technology and technical issues', '#3b82f6', 'monitor', 1),
('Facilities', 'Office facilities and infrastructure', '#10b981', 'building', 2),
('Human Resources', 'HR related requests and issues', '#f59e0b', 'users', 3),
('Finance', 'Financial and accounting requests', '#ef4444', 'dollar-sign', 4),
('Operations', 'Operational and process related issues', '#8b5cf6', 'settings', 5),
('Other', 'Miscellaneous requests', '#6b7280', 'help-circle', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert IT subcategories
DO $$
DECLARE
  it_cat_id UUID;
BEGIN
  SELECT id INTO it_cat_id FROM categories WHERE name = 'IT & Technical Support';
  
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  -- General Technical Support subcategories
  (it_cat_id, 'Bug Report', 'Software bugs and system errors', 8, 48, 1),
  (it_cat_id, 'Feature Request', 'New feature requests and enhancements', 72, 168, 2),
  (it_cat_id, 'Account Issues', 'User account problems and access issues', 4, 24, 3),
  -- Hardware subcategories
  (it_cat_id, 'Hardware - Desktop/Workstation', 'Desktop computers and workstation issues', 4, 24, 11),
  (it_cat_id, 'Hardware - Laptop', 'Laptop computers and portable devices', 4, 24, 12),
  (it_cat_id, 'Hardware - Server', 'Server hardware and infrastructure', 1, 8, 13),
  (it_cat_id, 'Hardware - Printer/Scanner', 'Printing and scanning devices', 8, 48, 14),
  (it_cat_id, 'Hardware - Mobile Device', 'Smartphones and tablets', 8, 48, 15),
  (it_cat_id, 'Hardware - Peripherals', 'Keyboard, mouse, monitor, accessories', 8, 48, 16),
  (it_cat_id, 'Hardware - Specialized', 'IoT devices, kiosks, unusual hardware', 24, 72, 17),
  -- Software subcategories
  (it_cat_id, 'Software - Operating System', 'OS installation, updates, performance', 8, 48, 21),
  (it_cat_id, 'Software - Productivity Apps', 'Office suite, productivity software', 8, 48, 22),
  (it_cat_id, 'Software - Corporate Apps', 'ERP, CRM, business applications', 4, 24, 23),
  (it_cat_id, 'Software - Browsers & Plugins', 'Web browsers and extensions', 8, 48, 24),
  (it_cat_id, 'Software - Licensing', 'Software licenses and activation', 24, 72, 25),
  (it_cat_id, 'Software - Security', 'Antivirus, patches, security updates', 2, 12, 26),
  -- Network subcategories
  (it_cat_id, 'Network - Connectivity', 'Wi-Fi, Ethernet connectivity issues', 4, 24, 31),
  (it_cat_id, 'Network - VPN & Remote Access', 'VPN connections and remote work', 4, 24, 32),
  (it_cat_id, 'Network - Performance', 'Network speed and performance issues', 8, 48, 33),
  (it_cat_id, 'Network - Security', 'Firewall and network security', 2, 12, 34),
  (it_cat_id, 'Network - Infrastructure', 'Switches, routers, access points', 4, 24, 35),
  (it_cat_id, 'Network - Outages', 'Network failures and outages', 1, 4, 36),
  -- Storage subcategories
  (it_cat_id, 'Storage & Backup', 'File storage and backup systems', 8, 48, 41),
  (it_cat_id, 'Storage - Recovery', 'Data recovery and restoration', 2, 12, 42),
  (it_cat_id, 'Storage - Sync & Share', 'File synchronization and sharing', 8, 48, 43),
  (it_cat_id, 'Storage - Cloud', 'OneDrive, SharePoint, cloud storage', 8, 48, 44),
  -- Identity & Access subcategories
  (it_cat_id, 'Identity & Access - Accounts', 'User account creation and deletion', 4, 24, 51),
  (it_cat_id, 'Identity & Access - Passwords', 'Password resets and changes', 2, 8, 52),
  (it_cat_id, 'Identity & Access - Permissions', 'Access permissions and groups', 4, 24, 53),
  (it_cat_id, 'Identity & Access - MFA', 'Multi-factor authentication', 4, 24, 54),
  (it_cat_id, 'Identity & Access - Directory', 'Active Directory, Azure AD integration', 8, 48, 55),
  -- Services subcategories
  (it_cat_id, 'Services - Certificates', 'SSL certificates and licensing keys', 24, 72, 61),
  (it_cat_id, 'Services - Cloud', 'Azure, AWS, M365 services', 8, 48, 62),
  (it_cat_id, 'Services - Integrations', 'API integrations and connections', 24, 72, 63),
  (it_cat_id, 'Services - Monitoring', 'System monitoring and alerts', 8, 48, 64),
  -- Security subcategories
  (it_cat_id, 'Security - Vulnerabilities', 'Security patches and vulnerabilities', 1, 4, 71),
  (it_cat_id, 'Security - Incidents', 'Security incidents and breaches', 1, 2, 72),
  (it_cat_id, 'Security - Unauthorized Access', 'Unauthorized access attempts', 1, 4, 73),
  (it_cat_id, 'Security - Malware', 'Malware, ransomware, virus issues', 1, 2, 74),
  (it_cat_id, 'Security - Audit', 'Security audits and log analysis', 24, 72, 75)
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- Insert other categories subcategories
DO $$
DECLARE
  facilities_cat_id UUID;
  hr_cat_id UUID;
  finance_cat_id UUID;
  operations_cat_id UUID;
  other_cat_id UUID;
BEGIN
  SELECT id INTO facilities_cat_id FROM categories WHERE name = 'Facilities';
  SELECT id INTO hr_cat_id FROM categories WHERE name = 'Human Resources';
  SELECT id INTO finance_cat_id FROM categories WHERE name = 'Finance';
  SELECT id INTO operations_cat_id FROM categories WHERE name = 'Operations';
  SELECT id INTO other_cat_id FROM categories WHERE name = 'Other';

  -- Facilities subcategories
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  (facilities_cat_id, 'Office Equipment', 'Furniture, office equipment issues', 24, 72, 1),
  (facilities_cat_id, 'Building & Infrastructure', 'HVAC, lighting, building issues', 8, 48, 2),
  (facilities_cat_id, 'Cleaning & Maintenance', 'Cleaning and maintenance requests', 24, 72, 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- HR subcategories
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  (hr_cat_id, 'Employee Onboarding', 'New employee setup and onboarding', 24, 48, 1),
  (hr_cat_id, 'Benefits & Payroll', 'Benefits, payroll, compensation', 24, 72, 2),
  (hr_cat_id, 'Training & Development', 'Training requests and development', 72, 168, 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- Finance subcategories
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  (finance_cat_id, 'Expense Reports', 'Expense reporting and reimbursement', 24, 72, 1),
  (finance_cat_id, 'Procurement', 'Purchase requests and procurement', 48, 168, 2),
  (finance_cat_id, 'Invoicing & Billing', 'Invoice and billing issues', 24, 48, 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- Operations subcategories
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  (operations_cat_id, 'Process Improvement', 'Process optimization requests', 72, 336, 1),
  (operations_cat_id, 'Documentation', 'Documentation and procedure updates', 48, 168, 2),
  (operations_cat_id, 'Quality Issues', 'Quality control and assurance', 24, 72, 3)
  ON CONFLICT (category_id, name) DO NOTHING;
  
  -- Other subcategories
  INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order) VALUES
  (other_cat_id, 'General Inquiry', 'General questions and information', 24, 72, 1),
  (other_cat_id, 'Suggestion', 'Suggestions and feedback', 72, 168, 2)
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets_new(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON tickets_new(subcategory_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
    BEFORE UPDATE ON subcategories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (optional - adjust based on your setup)
GRANT ALL ON categories TO authenticated;
GRANT ALL ON subcategories TO authenticated;

-- Create ticket_attachments table for file management
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on ticket_attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_attachments
DROP POLICY IF EXISTS "Users can view attachments for accessible tickets" ON public.ticket_attachments;
CREATE POLICY "Users can view attachments for accessible tickets" ON public.ticket_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can upload attachments to accessible tickets" ON public.ticket_attachments;
CREATE POLICY "Users can upload attachments to accessible tickets" ON public.ticket_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_at ON public.ticket_attachments(uploaded_at);
