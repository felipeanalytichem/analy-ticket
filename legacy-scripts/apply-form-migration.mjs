import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://your-project-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFormMigration() {
  console.log('🔄 Starting form migration from categories to subcategories...');
  
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/20250108000003_migrate_category_forms_to_subcategories.sql', 'utf8');
    
    console.log('📖 Executing migration SQL...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    console.log('✅ Migration executed successfully');
    
    // Check results
    console.log('🔍 Checking migration results...');
    
    // Check for any remaining category form schemas
    const { data: categoriesWithForms } = await supabase
      .from('categories')
      .select('id, name, dynamic_form_schema')
      .not('dynamic_form_schema', 'is', null);
    
    console.log('📊 Categories still with form schemas:', categoriesWithForms?.length || 0);
    
    // Check subcategories with migrated forms
    const { data: subcategoriesWithForms } = await supabase
      .from('subcategories')
      .select('id, name, dynamic_form_fields, category:categories(name)')
      .not('dynamic_form_fields', 'is', null);
    
    console.log('📊 Subcategories now with form fields:', subcategoriesWithForms?.length || 0);
    
    if (subcategoriesWithForms && subcategoriesWithForms.length > 0) {
      console.log('✅ Migrated form fields to subcategories:');
      subcategoriesWithForms.forEach(sub => {
        console.log(`  - ${sub.category?.name} -> ${sub.name} (${sub.dynamic_form_fields?.length || 0} fields)`);
      });
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Alternative direct approach if RPC doesn't work
async function runDirectMigration() {
  console.log('🔄 Running direct migration...');
  
  try {
    // Get categories with form schemas
    const { data: categoriesWithForms, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, dynamic_form_schema')
      .not('dynamic_form_schema', 'is', null);
    
    if (categoriesError) {
      console.error('❌ Error fetching categories:', categoriesError);
      throw categoriesError;
    }
    
    console.log(`📊 Found ${categoriesWithForms?.length || 0} categories with form schemas`);
    
    for (const category of categoriesWithForms || []) {
      console.log(`🔧 Processing category: ${category.name}`);
      
      // Get subcategories for this category
      const { data: subcategories, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('id, name')
        .eq('category_id', category.id);
      
      if (subcategoriesError) {
        console.error(`❌ Error fetching subcategories for ${category.name}:`, subcategoriesError);
        continue;
      }
      
      // Extract form fields from category schema
      let formFields = null;
      
      if (category.dynamic_form_schema) {
        if (category.dynamic_form_schema.fields) {
          formFields = category.dynamic_form_schema.fields;
        } else if (Array.isArray(category.dynamic_form_schema)) {
          formFields = category.dynamic_form_schema;
        }
      }
      
      if (formFields && subcategories) {
        console.log(`  📝 Migrating ${formFields.length} form fields to ${subcategories.length} subcategories`);
        
        // Update each subcategory with the form fields
        for (const subcategory of subcategories) {
          const { error: updateError } = await supabase
            .from('subcategories')
            .update({ dynamic_form_fields: formFields })
            .eq('id', subcategory.id);
          
          if (updateError) {
            console.error(`❌ Error updating subcategory ${subcategory.name}:`, updateError);
          } else {
            console.log(`    ✅ Updated ${subcategory.name}`);
          }
        }
        
        // Clear the category form schema
        const { error: clearError } = await supabase
          .from('categories')
          .update({ dynamic_form_schema: null })
          .eq('id', category.id);
        
        if (clearError) {
          console.error(`❌ Error clearing category ${category.name} form schema:`, clearError);
        } else {
          console.log(`    🧹 Cleared form schema from category ${category.name}`);
        }
      }
    }
    
    console.log('✅ Direct migration completed successfully');
    
  } catch (error) {
    console.error('💥 Direct migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
console.log('🚀 Starting form field migration...');
console.log('📋 This will move existing form schemas from categories to subcategories');
console.log('');

// Try direct migration first (more reliable)
runDirectMigration()
  .then(() => {
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('💡 Tip: The form builder should now show existing form fields');
    console.log('🔄 You may need to refresh the Category Management page');
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 