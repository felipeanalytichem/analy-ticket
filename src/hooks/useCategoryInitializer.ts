import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useCategoryInitializer = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeCategories = async () => {
    if (isInitializing || isInitialized) return;
    
    setIsInitializing(true);
    setError(null);

    try {
      console.log('🔍 Checking if categories need initialization...');

      // Check if categories already exist
      const { data: existingCategories, error: checkError } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

      if (checkError) {
        console.error('Error checking existing categories:', checkError);
        setError('Failed to check existing categories');
        return;
      }

      // If categories already exist, don't reinitialize
      if (existingCategories && existingCategories.length > 0) {
        console.log('✅ Categories already initialized');
        setIsInitialized(true);
        return;
      }

      console.log('🚀 Initializing categories for the first time...');
      await createCategoriesStructure();
      setIsInitialized(true);
      console.log('🎉 Categories initialization completed!');

    } catch (error) {
      console.error('Error initializing categories:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsInitializing(false);
    }
  };

  const createCategoriesStructure = async () => {
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

    // Create new categories and subcategories
    for (const categoryData of newCategories) {
      console.log(`📁 Creating category: ${categoryData.name}`);
      
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
        console.error(`❌ Error creating category ${categoryData.name}:`, categoryError);
        throw categoryError;
      }

      console.log(`✅ Created category: ${category.name} (ID: ${category.id})`);

      // Create subcategories for this category
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

    // Display summary
    const { data: categoriesCount } = await supabase
      .from('categories')
      .select('id', { count: 'exact' });
    
    const { data: subcategoriesCount } = await supabase
      .from('subcategories')
      .select('id', { count: 'exact' });

    console.log(`📊 Summary:`);
    console.log(`   Categories created: ${categoriesCount?.length || 0}`);
    console.log(`   Subcategories created: ${subcategoriesCount?.length || 0}`);
  };

  useEffect(() => {
    // Initialize categories when the hook is first used
    initializeCategories();
  }, []);

  return {
    isInitialized,
    isInitializing,
    error,
    initializeCategories
  };
}; 