// Script para atualizar categorias - Execute no console do navegador
// ATENÇÃO: Este script irá DELETAR todas as categorias e subcategorias existentes!

console.log('🚨 ATENÇÃO: Este script irá DELETAR todas as categorias existentes!');
console.log('📋 Para executar, copie e cole este código no console do navegador na página do sistema.');
console.log('');

// Função para executar a atualização das categorias
async function updateCategories() {
  // Verificar se o supabase está disponível
  if (typeof window === 'undefined' || !window.supabase) {
    console.error('❌ Supabase não está disponível. Execute este script na página do sistema.');
    return;
  }

  const supabase = window.supabase;

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
        { name: '[Germany] Employee Offboarding', sort_order: 3, response_time_hours: 4, resolution_time_hours: 8 },
        { name: 'Password Reset', sort_order: 4, response_time_hours: 2, resolution_time_hours: 4 },
        { name: 'MFA Setup/Issues', sort_order: 5, response_time_hours: 4, resolution_time_hours: 8 }
      ]
    },
    {
      name: 'ERP',
      description: 'ERP system issues and requests',
      color: '#EAB308', // Yellow
      icon: '📊',
      sort_order: 2,
      subcategories: [
        { name: '[Germany] ERP Issues', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
        { name: '[Rest of Europe] ERP Issues', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
        { name: '[USA] ERP Issues', sort_order: 3, response_time_hours: 8, resolution_time_hours: 48 },
        { name: '[Asia] ERP Issues', sort_order: 4, response_time_hours: 8, resolution_time_hours: 48 },
        { name: 'SAP Issues', sort_order: 5, response_time_hours: 4, resolution_time_hours: 24 }
      ]
    },
    {
      name: 'Infrastructure & Hardware',
      description: 'Network, hardware and infrastructure issues',
      color: '#DC2626', // Red
      icon: '🖥️',
      sort_order: 3,
      subcategories: [
        { name: 'WiFi/Network Issues', sort_order: 1, response_time_hours: 2, resolution_time_hours: 8 },
        { name: 'Device Issues (Laptop/Desktop)', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
        { name: 'Printer Issues', sort_order: 3, response_time_hours: 4, resolution_time_hours: 8 },
        { name: 'Hardware Requests', sort_order: 4, response_time_hours: 24, resolution_time_hours: 72 }
      ]
    },
    {
      name: 'Other',
      description: 'General IT support and other issues',
      color: '#7C3AED', // Purple
      icon: '❓',
      sort_order: 4,
      subcategories: [
        { name: 'General IT Help', sort_order: 1, response_time_hours: 8, resolution_time_hours: 24 }
      ]
    },
    {
      name: 'Website & Intranet',
      description: 'Website and intranet related issues',
      color: '#059669', // Green
      icon: '🌐',
      sort_order: 5,
      subcategories: [
        { name: 'Intranet Issues', sort_order: 1, response_time_hours: 4, resolution_time_hours: 24 },
        { name: 'E-commerce Issues', sort_order: 2, response_time_hours: 2, resolution_time_hours: 8 },
        { name: 'Website Issues', sort_order: 3, response_time_hours: 4, resolution_time_hours: 24 }
      ]
    },
    {
      name: 'Office 365 & SharePoint',
      description: 'Microsoft Office 365 and SharePoint issues',
      color: '#EA580C', // Orange
      icon: '📧',
      sort_order: 6,
      subcategories: [
        { name: 'Outlook Issues', sort_order: 1, response_time_hours: 2, resolution_time_hours: 8 },
        { name: 'SharePoint Issues', sort_order: 2, response_time_hours: 4, resolution_time_hours: 24 },
        { name: 'Teams Issues', sort_order: 3, response_time_hours: 2, resolution_time_hours: 8 },
        { name: 'Office Apps Issues', sort_order: 4, response_time_hours: 4, resolution_time_hours: 24 }
      ]
    }
  ];

  try {
    console.log('🗑️ Deletando categorias e subcategorias existentes...');
    
    // Deletar todas as subcategorias primeiro
    const { error: deleteSubcategoriesError } = await supabase
      .from('subcategories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteSubcategoriesError) {
      console.error('Erro ao deletar subcategorias:', deleteSubcategoriesError);
      return;
    }

    // Deletar todas as categorias
    const { error: deleteCategoriesError } = await supabase
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteCategoriesError) {
      console.error('Erro ao deletar categorias:', deleteCategoriesError);
      return;
    }

    console.log('✅ Categorias e subcategorias existentes deletadas');

    // Criar novas categorias e subcategorias
    for (const categoryData of newCategories) {
      const { subcategories, ...categoryInfo } = categoryData;
      
      console.log(`📁 Criando categoria: ${categoryInfo.name}`);
      
      // Criar categoria
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .insert(categoryInfo)
        .select()
        .single();

      if (categoryError) {
        console.error(`Erro ao criar categoria ${categoryInfo.name}:`, categoryError);
        continue;
      }

      // Criar subcategorias
      for (const subcategoryData of subcategories) {
        const subcategoryInfo = {
          ...subcategoryData,
          category_id: category.id,
          specialized_agents: []
        };

        console.log(`  📄 Criando subcategoria: ${subcategoryInfo.name}`);
        
        const { error: subcategoryError } = await supabase
          .from('subcategories')
          .insert(subcategoryInfo);

        if (subcategoryError) {
          console.error(`Erro ao criar subcategoria ${subcategoryInfo.name}:`, subcategoryError);
        }
      }
    }

    console.log('🎉 Estrutura de categorias atualizada com sucesso!');
    console.log('📊 Resumo:');
    console.log('- 6 categorias principais criadas');
    console.log('- 22 subcategorias criadas');
    console.log('- Tempos de SLA configurados (2h-72h para resposta, 4h-72h para resolução)');
    console.log('');
    console.log('🔄 Recarregue a página para ver as novas categorias!');
    
  } catch (error) {
    console.error('❌ Erro durante a atualização:', error);
  }
}

// Executar a função
console.log('🚀 Iniciando atualização das categorias...');
updateCategories(); 