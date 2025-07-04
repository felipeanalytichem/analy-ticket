import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const UpdateCategoriesPage: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

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

  const updateCategories = async () => {
    setIsUpdating(true);
    setUpdateStatus('🚀 Iniciando atualização das categorias...\n');

    try {
      // 1. Delete all existing subcategories first
      setUpdateStatus(prev => prev + '🗑️ Removendo subcategorias existentes...\n');
      const { error: deleteSubcategoriesError } = await supabase
        .from('subcategories')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteSubcategoriesError) {
        throw new Error(`Erro ao deletar subcategorias: ${deleteSubcategoriesError.message}`);
      }

      // 2. Delete all existing categories
      setUpdateStatus(prev => prev + '🗑️ Removendo categorias existentes...\n');
      const { error: deleteCategoriesError } = await supabase
        .from('categories')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteCategoriesError) {
        throw new Error(`Erro ao deletar categorias: ${deleteCategoriesError.message}`);
      }

      // 3. Create new categories and subcategories
      let categoriesCreated = 0;
      let subcategoriesCreated = 0;

      for (const categoryData of newCategories) {
        setUpdateStatus(prev => prev + `📁 Criando categoria: ${categoryData.name}\n`);
        
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
          throw new Error(`Erro ao criar categoria ${categoryData.name}: ${categoryError.message}`);
        }

        categoriesCreated++;
        setUpdateStatus(prev => prev + `✅ Categoria criada: ${category.name} (ID: ${category.id})\n`);

        // Create subcategories for this category
        for (const subcategoryData of categoryData.subcategories) {
          setUpdateStatus(prev => prev + `  📄 Criando subcategoria: ${subcategoryData.name}\n`);
          
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
            throw new Error(`Erro ao criar subcategoria ${subcategoryData.name}: ${subcategoryError.message}`);
          }

          subcategoriesCreated++;
          setUpdateStatus(prev => prev + `  ✅ Subcategoria criada: ${subcategory.name} (ID: ${subcategory.id})\n`);
        }
      }

      setUpdateStatus(prev => prev + `\n🎉 Atualização concluída com sucesso!\n📊 Resumo:\n   Categorias criadas: ${categoriesCreated}\n   Subcategorias criadas: ${subcategoriesCreated}\n`);

    } catch (error) {
      console.error('💥 Erro durante a atualização:', error);
      setUpdateStatus(prev => prev + `\n❌ Erro durante a atualização: ${error.message}\n`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-6">🔄 Atualizar Categorias do Sistema</h1>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Nova Estrutura de Categorias:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newCategories.map((category, index) => (
                <div key={index} className="border rounded-lg p-4" style={{ borderColor: category.color }}>
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">{category.icon}</span>
                    <h3 className="font-semibold" style={{ color: category.color }}>
                      {category.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{category.description}</p>
                  <div className="text-sm">
                    <strong>Subcategorias ({category.subcategories.length}):</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {category.subcategories.map((sub, subIndex) => (
                        <li key={subIndex} className="text-xs text-gray-700">
                          {sub.name} ({sub.response_time_hours}h/{sub.resolution_time_hours}h)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Atenção:</strong> Esta operação irá remover todas as categorias e subcategorias existentes 
              e criar a nova estrutura. Certifique-se de que não há tickets importantes vinculados às categorias atuais.
            </p>
          </div>

          <button
            onClick={updateCategories}
            disabled={isUpdating}
            className={`px-6 py-3 rounded-lg font-semibold ${
              isUpdating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isUpdating ? '⏳ Atualizando...' : '🚀 Atualizar Categorias'}
          </button>

          {updateStatus && (
            <div className="mt-6 p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Status da Atualização:</h3>
              <pre className="text-sm whitespace-pre-wrap font-mono bg-black text-green-400 p-4 rounded overflow-auto max-h-96">
                {updateStatus}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateCategoriesPage; 