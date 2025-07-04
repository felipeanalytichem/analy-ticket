import React, { useState } from 'react';
import DatabaseService from '../../lib/database';

const CategoryUpdater: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  const updateCategories = async () => {
    setIsUpdating(true);
    setUpdateStatus('🚀 Iniciando atualização das categorias...');

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

    try {
      // 1. Delete all existing subcategories first
      setUpdateStatus('🗑️ Removendo subcategorias existentes...');
      await DatabaseService.deleteSubcategories(['all']);

      // 2. Delete all existing categories
      setUpdateStatus('🗑️ Removendo categorias existentes...');
      await DatabaseService.deleteCategories(['all']);

      // 3. Create new categories and subcategories
      let categoriesCreated = 0;
      let subcategoriesCreated = 0;

      for (const categoryData of newCategories) {
        setUpdateStatus(`📁 Criando categoria: ${categoryData.name}`);
        
        // Create category
        const category = await DatabaseService.createCategory({
          name: categoryData.name,
          description: categoryData.description,
          color: categoryData.color,
          icon: categoryData.icon,
          sort_order: categoryData.sort_order
        });

        categoriesCreated++;

        // Create subcategories for this category
        for (const subcategoryData of categoryData.subcategories) {
          setUpdateStatus(`  📄 Criando subcategoria: ${subcategoryData.name}`);
          
          await DatabaseService.createSubcategory({
            category_id: category.id,
            name: subcategoryData.name,
            sort_order: subcategoryData.sort_order,
            response_time_hours: subcategoryData.response_time_hours,
            resolution_time_hours: subcategoryData.resolution_time_hours,
            specialized_agents: []
          });

          subcategoriesCreated++;
        }
      }

      setUpdateStatus(`🎉 Atualização concluída com sucesso!\n📊 Resumo:\n   Categorias criadas: ${categoriesCreated}\n   Subcategorias criadas: ${subcategoriesCreated}`);

    } catch (error) {
      console.error('💥 Erro durante a atualização:', error);
      setUpdateStatus(`❌ Erro durante a atualização: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">🔄 Atualizar Categorias</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Nova Estrutura de Categorias:</h3>
        <div className="space-y-2 text-sm">
          <div>🟦 <strong>Users & Passwords</strong> - 5 subcategorias</div>
          <div>🟨 <strong>ERP</strong> - 5 subcategorias</div>
          <div>🟥 <strong>Infrastructure & Hardware</strong> - 4 subcategorias</div>
          <div>🟪 <strong>Other</strong> - 1 subcategoria</div>
          <div>🟩 <strong>Website & Intranet</strong> - 3 subcategorias</div>
          <div>🟧 <strong>Office 365 & SharePoint</strong> - 4 subcategorias</div>
        </div>
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
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold mb-2">Status da Atualização:</h4>
          <pre className="text-sm whitespace-pre-wrap">{updateStatus}</pre>
        </div>
      )}

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Atenção:</strong> Esta operação irá remover todas as categorias e subcategorias existentes 
          e criar a nova estrutura. Certifique-se de que não há tickets importantes vinculados às categorias atuais.
        </p>
      </div>
    </div>
  );
};

export default CategoryUpdater; 