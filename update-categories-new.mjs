import { createClient } from '@supabase/supabase-js';

// Substitua pelas suas credenciais do Supabase
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

console.log('🔧 Para executar este script:');
console.log('1. Substitua as credenciais do Supabase acima');
console.log('2. Execute: node update-categories-new.mjs');
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function updateCategories() {
  try {
    console.log('🚀 Iniciando atualização das categorias...');

    // 1. Delete all existing subcategories first
    console.log('🗑️ Removendo subcategorias existentes...');
    const { error: deleteSubcategoriesError } = await supabase
      .from('subcategories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteSubcategoriesError) {
      console.error('❌ Erro ao deletar subcategorias:', deleteSubcategoriesError);
      throw deleteSubcategoriesError;
    }

    // 2. Delete all existing categories
    console.log('🗑️ Removendo categorias existentes...');
    const { error: deleteCategoriesError } = await supabase
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteCategoriesError) {
      console.error('❌ Erro ao deletar categorias:', deleteCategoriesError);
      throw deleteCategoriesError;
    }

    // 3. Create new categories and subcategories
    let categoriesCreated = 0;
    let subcategoriesCreated = 0;

    for (const categoryData of newCategories) {
      console.log(`📁 Criando categoria: ${categoryData.name}`);
      
      // Create category
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
        console.error(`❌ Erro ao criar categoria ${categoryData.name}:`, categoryError);
        throw categoryError;
      }

      categoriesCreated++;
      console.log(`✅ Categoria criada: ${category.name} (ID: ${category.id})`);

      // Create subcategories for this category
      for (const subcategoryData of categoryData.subcategories) {
        console.log(`  📄 Criando subcategoria: ${subcategoryData.name}`);
        
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
          console.error(`❌ Erro ao criar subcategoria ${subcategoryData.name}:`, subcategoryError);
          throw subcategoryError;
        }

        subcategoriesCreated++;
        console.log(`  ✅ Subcategoria criada: ${subcategory.name} (ID: ${subcategory.id})`);
      }
    }

    console.log('🎉 Atualização concluída com sucesso!');
    console.log(`📊 Resumo:`);
    console.log(`   Categorias criadas: ${categoriesCreated}`);
    console.log(`   Subcategorias criadas: ${subcategoriesCreated}`);

  } catch (error) {
    console.error('💥 Erro durante a atualização:', error);
  }
}

// Execute the update
updateCategories(); 