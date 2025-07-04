-- Restore Categories SQL
-- This script will create the exact category structure requested

-- First, clear existing categories (this will cascade to subcategories)
DELETE FROM subcategories;
DELETE FROM categories;

-- Insert main categories
INSERT INTO categories (name, description, color, icon, sort_order)
VALUES
('Users & Passwords', 'User management and authentication', '#3B82F6', '👤', 1),
('ERP', 'Enterprise Resource Planning systems', '#F59E0B', '📊', 2),
('Infrastructure & Hardware', 'Hardware and infrastructure support', '#EF4444', '🖥️', 3),
('Other', 'General support and miscellaneous', '#8B5CF6', '❓', 4),
('Website & Intranet', 'Web-related support and issues', '#10B981', '🌐', 5),
('Office 365 & SharePoint', 'Microsoft Office 365 suite support', '#F97316', '📧', 6);

-- Get category IDs
DO $$
DECLARE
    users_cat_id UUID;
    erp_cat_id UUID;
    infra_cat_id UUID;
    other_cat_id UUID;
    web_cat_id UUID;
    office_cat_id UUID;
BEGIN
    -- Get category IDs
    SELECT id INTO users_cat_id FROM categories WHERE name = 'Users & Passwords';
    SELECT id INTO erp_cat_id FROM categories WHERE name = 'ERP';
    SELECT id INTO infra_cat_id FROM categories WHERE name = 'Infrastructure & Hardware';
    SELECT id INTO other_cat_id FROM categories WHERE name = 'Other';
    SELECT id INTO web_cat_id FROM categories WHERE name = 'Website & Intranet';
    SELECT id INTO office_cat_id FROM categories WHERE name = 'Office 365 & SharePoint';

    -- Insert subcategories
    -- Users & Passwords subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (users_cat_id, '[Germany] New Employee Onboarding', 'Onboarding process for new employees in Germany', 24, 48, 1),
    (users_cat_id, '[Rest of Europe] Onboard new employees', 'Onboarding process for new employees in other European countries', 24, 48, 2),
    (users_cat_id, 'Employee offboarding', 'Process for departing employees', 8, 24, 3),
    (users_cat_id, 'Forgot my password', 'Password reset requests', 2, 4, 4),
    (users_cat_id, 'Multi factor authentication', 'MFA setup and issues', 4, 8, 5);

    -- ERP subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (erp_cat_id, 'ERP Belgium', 'ERP system support for Belgium', 4, 24, 1),
    (erp_cat_id, 'ERP Germany (Dynamics NAV)', 'Dynamics NAV support for Germany', 4, 24, 2),
    (erp_cat_id, 'ERP Netherlands', 'ERP system support for Netherlands', 4, 24, 3),
    (erp_cat_id, 'ERP UK', 'ERP system support for UK', 4, 24, 4),
    (erp_cat_id, 'SAP system', 'SAP system support', 4, 24, 5);

    -- Infrastructure & Hardware subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (infra_cat_id, 'Get a guest wifi account', 'Guest WiFi access requests', 2, 4, 1),
    (infra_cat_id, 'New mobile device', 'Mobile device requests and setup', 8, 48, 2),
    (infra_cat_id, 'Printer & Scanner', 'Printer and scanner support', 4, 24, 3),
    (infra_cat_id, 'Request new hardware', 'New hardware requests', 24, 72, 4);

    -- Other subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (other_cat_id, 'Get IT help', 'General IT support requests', 4, 24, 1);

    -- Website & Intranet subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (web_cat_id, 'Intranet', 'Internal website support', 4, 24, 1),
    (web_cat_id, 'Web shop / eCommerce', 'Online store support', 2, 8, 2),
    (web_cat_id, 'Website issue', 'External website issues', 2, 8, 3);

    -- Office 365 & SharePoint subcategories
    INSERT INTO subcategories (category_id, name, description, response_time_hours, resolution_time_hours, sort_order)
    VALUES
    (office_cat_id, 'Outlook', 'Email and calendar support', 2, 8, 1),
    (office_cat_id, 'SharePoint issues & permissions', 'SharePoint access and issues', 4, 24, 2),
    (office_cat_id, 'Teams & OneDrive issues', 'Microsoft Teams and OneDrive support', 2, 8, 3),
    (office_cat_id, 'Word / Excel / PowerPoint issues', 'Office suite application support', 2, 8, 4);
END $$; 