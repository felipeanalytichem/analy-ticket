import { createClient } from '@supabase/supabase-js';

// Hardcode the Supabase URL and key for this script
const supabaseUrl = 'https://ixqjqjqjqjqjqjqjqjqj.supabase.co';
const supabaseKey = 'your-anon-key-here';

console.log('🔍 Please update the Supabase URL and key in this script before running');
console.log('You can find these values in your Supabase project settings');

// For now, let's create a version that shows what would be done
const newCategories = [
  {
    name: 'Users & Passwords',
    description: 'User management and authentication issues',
    color: '#3B82F6', // Blue
    icon: '👤',
    sort_order: 1,
    subcategories: [
      { name: '[Germany] New Employee Onboarding', sort_order: 1, response_time_hours: 24, resolution_time_hours: 48 },
      { name: '[Rest of Europe] Onboard new employees', sort_order: 2, response_time_hours: 24, resolution_time_hours: 48 },
      { name: 'Employee offboarding', sort_order: 3, response_time_hours: 8, resolution_time_hours: 24 },
      { name: 'Forgot my password', sort_order: 4, response_time_hours: 2, resolution_time_hours: 4 },
      { name: 'Multi factor authentication', sort_order: 5, response_time_hours: 4, resolution_time_hours: 8 }
    ]
  },
  {
    name: 'ERP',
    description: 'Enterprise Resource Planning systems',
    color: '#F59E0B', // Yellow
    icon: '📊',
    sort_order: 2,
    subcategories: [
      { name: 'ERP Belgium', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'ERP Germany (Dynamics NAV)', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'ERP Netherlands', sort_order: 3, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'ERP UK', sort_order: 4, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'SAP system', sort_order: 5, response_time_hours: 4, resolution_time_hours: 24 }
    ]
  },
  {
    name: 'Infrastructure & Hardware',
    description: 'Hardware and infrastructure support',
    color: '#EF4444', // Red
    icon: '🖥️',
    sort_order: 3,
    subcategories: [
      { name: 'Get a guest wifi account', sort_order: 1, response_time_hours: 2, resolution_time_hours: 4 },
      { name: 'New mobile device', sort_order: 2, response_time_hours: 8, resolution_time_hours: 48 },
      { name: 'Printer & Scanner', sort_order: 3, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'Request new hardware', sort_order: 4, response_time_hours: 24, resolution_time_hours: 72 }
    ]
  },
  {
    name: 'Other',
    description: 'General IT support and other issues',
    color: '#8B5CF6', // Purple
    icon: '❓',
    sort_order: 4,
    subcategories: [
      { name: 'Get IT help', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 }
    ]
  },
  {
    name: 'Website & Intranet',
    description: 'Website and intranet related issues',
    color: '#10B981', // Green
    icon: '🌐',
    sort_order: 5,
    subcategories: [
      { name: 'Intranet', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'Web shop / eCommerce', sort_order: 2, response_time_hours: 2, resolution_time_hours: 8 },
      { name: 'Website issue', sort_order: 3, response_time_hours: 2, resolution_time_hours: 8 }
    ]
  },
  {
    name: 'Office 365 & SharePoint',
    description: 'Microsoft Office 365 and SharePoint support',
    color: '#F97316', // Orange
    icon: '📧',
    sort_order: 6,
    subcategories: [
      { name: 'Outlook', sort_order: 1, response_time_hours: 2, resolution_time_hours: 8 },
      { name: 'SharePoint issues & permissions', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
      { name: 'Teams & OneDrive issues', sort_order: 3, response_time_hours: 2, resolution_time_hours: 8 },
      { name: 'Word / Excel / PowerPoint issues', sort_order: 4, response_time_hours: 2, resolution_time_hours: 8 }
    ]
  }
];

console.log('📋 New Categories Structure:');
console.log('============================');

newCategories.forEach((category, index) => {
  console.log(`\n${index + 1}. ${category.icon} ${category.name} (${category.color})`);
  console.log(`   Description: ${category.description}`);
  console.log(`   Subcategories:`);
  
  category.subcategories.forEach((sub, subIndex) => {
    console.log(`     ${subIndex + 1}. ${sub.name}`);
    console.log(`        Response: ${sub.response_time_hours}h | Resolution: ${sub.resolution_time_hours}h`);
  });
});

console.log('\n🔧 To actually update the database:');
console.log('1. Update the supabaseUrl and supabaseKey variables in this script');
console.log('2. Uncomment the database update code below');
console.log('3. Run the script again');

/*
// Uncomment this section after updating the Supabase credentials above

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCategories() {
  try {
    console.log('🚀 Starting category update process...');

    // 1. Delete all existing subcategories first
    console.log('🗑️ Deleting existing subcategories...');
    const { error: deleteSubcategoriesError } = await supabase
      .from('subcategories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteSubcategoriesError) {
      console.error('❌ Error deleting subcategories:', deleteSubcategoriesError);
      throw deleteSubcategoriesError;
    }

    // 2. Delete all existing categories
    console.log('🗑️ Deleting existing categories...');
    const { error: deleteCategoriesError } = await supabase
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteCategoriesError) {
      console.error('❌ Error deleting categories:', deleteCategoriesError);
      throw deleteCategoriesError;
    }

    // 3. Create new categories and subcategories
    for (const categoryData of newCategories) {
      console.log(`📁 Creating category: ${categoryData.name}`);
      
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert({
          name: categoryData.name,
          description: categoryData.description,
          color: categoryData.color,
          icon: categoryData.icon,
          sort_order: categoryData.sort_order
        })
        .select()
        .single();

      if (categoryError) {
        console.error(`❌ Error creating category ${categoryData.name}:`, categoryError);
        throw categoryError;
      }

      console.log(`✅ Created category: ${category.name} (ID: ${category.id})`);

      for (const subcategoryData of categoryData.subcategories) {
        console.log(`  📄 Creating subcategory: ${subcategoryData.name}`);
        
        const { data: subcategory, error: subcategoryError } = await supabase
          .from('subcategories')
          .insert({
            category_id: category.id,
            name: subcategoryData.name,
            sort_order: subcategoryData.sort_order,
            response_time_hours: subcategoryData.response_time_hours,
            resolution_time_hours: subcategoryData.resolution_time_hours,
            specialized_agents: []
          })
          .select()
          .single();

        if (subcategoryError) {
          console.error(`❌ Error creating subcategory ${subcategoryData.name}:`, subcategoryError);
          throw subcategoryError;
        }

        console.log(`  ✅ Created subcategory: ${subcategory.name} (ID: ${subcategory.id})`);
      }
    }

    console.log('🎉 Category update completed successfully!');
    
    const { data: categoriesCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact' });
    
    const { data: subcategoriesCount } = await supabase
      .from('subcategories')
      .select('id', { count: 'exact' });

    console.log(`📊 Summary:`);
    console.log(`   Categories created: ${categoriesCount?.length || 0}`);
    console.log(`   Subcategories created: ${subcategoriesCount?.length || 0}`);

  } catch (error) {
    console.error('💥 Fatal error during category update:', error);
    process.exit(1);
  }
}

// Run the update
updateCategories();
*/ 