import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM2NTcwNywiZXhwIjoyMDQ5OTQxNzA3fQ.ZhcpGQ0LtG5xWLvJFBzrKfqDjhKlBN7VrKFgNfhNAzM';

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restoreCategories() {
  try {
    console.log('🔄 Starting category restoration...');
    
    // First, delete existing categories (this will cascade to subcategories)
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all categories
      
    if (deleteError) {
      console.error('⚠️ Error deleting existing categories:', deleteError.message);
      return;
    }
    
    // Insert main categories
    const categories = [
      { name: 'Users & Passwords', description: 'User management and authentication', color: '#3B82F6', icon: '👤', sort_order: 1 },
      { name: 'ERP', description: 'Enterprise Resource Planning systems', color: '#F59E0B', icon: '📊', sort_order: 2 },
      { name: 'Infrastructure & Hardware', description: 'Hardware and infrastructure support', color: '#EF4444', icon: '🖥️', sort_order: 3 },
      { name: 'Other', description: 'General support and miscellaneous', color: '#8B5CF6', icon: '❓', sort_order: 4 },
      { name: 'Website & Intranet', description: 'Web-related support and issues', color: '#10B981', icon: '🌐', sort_order: 5 },
      { name: 'Office 365 & SharePoint', description: 'Microsoft Office 365 suite support', color: '#F97316', icon: '📧', sort_order: 6 }
    ];
    
    const { data: createdCategories, error: insertError } = await supabase
      .from('categories')
      .insert(categories)
      .select();
      
    if (insertError) {
      console.error('⚠️ Error inserting categories:', insertError.message);
      return;
    }
    
    // Create a map of category names to their IDs
    const categoryMap = {};
    createdCategories.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });
    
    // Insert subcategories
    const subcategories = [
      // Users & Passwords subcategories
      { category_id: categoryMap['Users & Passwords'], name: '[Germany] New Employee Onboarding', description: 'Onboarding process for new employees in Germany', response_time_hours: 24, resolution_time_hours: 48, sort_order: 1 },
      { category_id: categoryMap['Users & Passwords'], name: '[Rest of Europe] Onboard new employees', description: 'Onboarding process for new employees in other European countries', response_time_hours: 24, resolution_time_hours: 48, sort_order: 2 },
      { category_id: categoryMap['Users & Passwords'], name: 'Employee offboarding', description: 'Process for departing employees', response_time_hours: 8, resolution_time_hours: 24, sort_order: 3 },
      { category_id: categoryMap['Users & Passwords'], name: 'Forgot my password', description: 'Password reset requests', response_time_hours: 2, resolution_time_hours: 4, sort_order: 4 },
      { category_id: categoryMap['Users & Passwords'], name: 'Multi factor authentication', description: 'MFA setup and issues', response_time_hours: 4, resolution_time_hours: 8, sort_order: 5 },
      
      // ERP subcategories
      { category_id: categoryMap['ERP'], name: 'ERP Belgium', description: 'ERP system support for Belgium', response_time_hours: 4, resolution_time_hours: 24, sort_order: 1 },
      { category_id: categoryMap['ERP'], name: 'ERP Germany (Dynamics NAV)', description: 'Dynamics NAV support for Germany', response_time_hours: 4, resolution_time_hours: 24, sort_order: 2 },
      { category_id: categoryMap['ERP'], name: 'ERP Netherlands', description: 'ERP system support for Netherlands', response_time_hours: 4, resolution_time_hours: 24, sort_order: 3 },
      { category_id: categoryMap['ERP'], name: 'ERP UK', description: 'ERP system support for UK', response_time_hours: 4, resolution_time_hours: 24, sort_order: 4 },
      { category_id: categoryMap['ERP'], name: 'SAP system', description: 'SAP system support', response_time_hours: 4, resolution_time_hours: 24, sort_order: 5 },
      
      // Infrastructure & Hardware subcategories
      { category_id: categoryMap['Infrastructure & Hardware'], name: 'Get a guest wifi account', description: 'Guest WiFi access requests', response_time_hours: 2, resolution_time_hours: 4, sort_order: 1 },
      { category_id: categoryMap['Infrastructure & Hardware'], name: 'New mobile device', description: 'Mobile device requests and setup', response_time_hours: 8, resolution_time_hours: 48, sort_order: 2 },
      { category_id: categoryMap['Infrastructure & Hardware'], name: 'Printer & Scanner', description: 'Printer and scanner support', response_time_hours: 4, resolution_time_hours: 24, sort_order: 3 },
      { category_id: categoryMap['Infrastructure & Hardware'], name: 'Request new hardware', description: 'New hardware requests', response_time_hours: 24, resolution_time_hours: 72, sort_order: 4 },
      
      // Other subcategories
      { category_id: categoryMap['Other'], name: 'Get IT help', description: 'General IT support requests', response_time_hours: 4, resolution_time_hours: 24, sort_order: 1 },
      
      // Website & Intranet subcategories
      { category_id: categoryMap['Website & Intranet'], name: 'Intranet', description: 'Internal website support', response_time_hours: 4, resolution_time_hours: 24, sort_order: 1 },
      { category_id: categoryMap['Website & Intranet'], name: 'Web shop / eCommerce', description: 'Online store support', response_time_hours: 2, resolution_time_hours: 8, sort_order: 2 },
      { category_id: categoryMap['Website & Intranet'], name: 'Website issue', description: 'External website issues', response_time_hours: 2, resolution_time_hours: 8, sort_order: 3 },
      
      // Office 365 & SharePoint subcategories
      { category_id: categoryMap['Office 365 & SharePoint'], name: 'Outlook', description: 'Email and calendar support', response_time_hours: 2, resolution_time_hours: 8, sort_order: 1 },
      { category_id: categoryMap['Office 365 & SharePoint'], name: 'SharePoint issues & permissions', description: 'SharePoint access and issues', response_time_hours: 4, resolution_time_hours: 24, sort_order: 2 },
      { category_id: categoryMap['Office 365 & SharePoint'], name: 'Teams & OneDrive issues', description: 'Microsoft Teams and OneDrive support', response_time_hours: 2, resolution_time_hours: 8, sort_order: 3 },
      { category_id: categoryMap['Office 365 & SharePoint'], name: 'Word / Excel / PowerPoint issues', description: 'Office suite application support', response_time_hours: 2, resolution_time_hours: 8, sort_order: 4 }
    ];
    
    const { error: subError } = await supabase
      .from('subcategories')
      .insert(subcategories);
      
    if (subError) {
      console.error('⚠️ Error inserting subcategories:', subError.message);
      return;
    }
    
    console.log('✅ Categories restored successfully!');
    
    // Verify the categories were created
    const { data: verifyCategories, error: catError } = await supabase
      .from('categories')
      .select('name, color')
      .order('sort_order');
      
    if (catError) {
      console.error('⚠️ Error verifying categories:', catError.message);
    } else {
      console.log('\n📋 Created Categories:');
      verifyCategories.forEach(cat => {
        console.log(`- ${cat.name} (${cat.color})`);
      });
    }
    
    // Verify subcategories
    const { data: verifySubcategories, error: verifySubError } = await supabase
      .from('subcategories')
      .select(`
        name,
        response_time_hours,
        resolution_time_hours,
        categories (name)
      `)
      .order('sort_order');
      
    if (verifySubError) {
      console.error('⚠️ Error verifying subcategories:', verifySubError.message);
    } else {
      console.log('\n📋 Created Subcategories:');
      verifySubcategories.forEach(sub => {
        console.log(`- ${sub.name} (${sub.response_time_hours}h response, ${sub.resolution_time_hours}h resolution)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to restore categories:', error.message);
  }
}

// Run the restoration
restoreCategories(); 