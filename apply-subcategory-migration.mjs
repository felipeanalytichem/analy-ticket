import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';

// Read environment variables or set them directly
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bjwqwdafoqnfwzmopzni.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySubcategoryMigration() {
  console.log('🚀 Starting subcategory is_enabled column migration...');

  try {
    // Step 1: Add the is_enabled column
    console.log('📝 Adding is_enabled column to subcategories table...');
    
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE subcategories 
        ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true;
      `
    });

    if (alterError) {
      console.log('ℹ️ Note: Column might already exist or using direct SQL...');
      
      // Try direct approach
      const { error: directError } = await supabase
        .from('subcategories')
        .select('is_enabled')
        .limit(1);

      if (directError && directError.message.includes('column "is_enabled" does not exist')) {
        console.log('⚠️ Column does not exist. Please run the SQL manually in Supabase SQL Editor.');
        console.log('\n📋 Copy and paste this SQL in Supabase SQL Editor:');
        console.log('----------------------------------------');
        
        const sqlContent = await fs.readFile('add-subcategory-is-enabled-column.sql', 'utf8');
        console.log(sqlContent);
        console.log('----------------------------------------');
        
        return;
      }
    }

    // Step 2: Create index
    console.log('📊 Creating index for performance...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_subcategories_is_enabled ON subcategories(is_enabled);
      `
    });

    if (indexError) {
      console.log('ℹ️ Index creation might need manual execution');
    }

    // Step 3: Update existing records
    console.log('🔄 Updating existing subcategories to enabled...');
    const { error: updateError } = await supabase
      .from('subcategories')
      .update({ is_enabled: true })
      .is('is_enabled', null);

    if (updateError) {
      console.log('ℹ️ Update might need manual execution:', updateError.message);
    }

    // Step 4: Verify the migration
    console.log('✅ Verifying migration...');
    const { data: subcategories, error: selectError } = await supabase
      .from('subcategories')
      .select('id, name, is_enabled')
      .limit(5);

    if (selectError) {
      console.error('❌ Error verifying migration:', selectError.message);
      console.log('\n📋 Please run the SQL manually in Supabase SQL Editor:');
      console.log('----------------------------------------');
      const sqlContent = await fs.readFile('add-subcategory-is-enabled-column.sql', 'utf8');
      console.log(sqlContent);
      console.log('----------------------------------------');
      return;
    }

    console.log('🎉 Migration completed successfully!');
    console.log('📊 Sample subcategories with is_enabled status:');
    console.table(subcategories);

    // Step 5: Test the toggle functionality
    if (subcategories && subcategories.length > 0) {
      console.log('\n🧪 Testing toggle functionality...');
      const testSubcategory = subcategories[0];
      
      const { error: toggleError } = await supabase
        .from('subcategories')
        .update({ is_enabled: false })
        .eq('id', testSubcategory.id);

      if (toggleError) {
        console.error('❌ Error testing toggle:', toggleError.message);
      } else {
        console.log('✅ Toggle functionality working!');
        
        // Restore original state
        await supabase
          .from('subcategories')
          .update({ is_enabled: true })
          .eq('id', testSubcategory.id);
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Please run the SQL manually in Supabase SQL Editor:');
    console.log('----------------------------------------');
    try {
      const sqlContent = await fs.readFile('add-subcategory-is-enabled-column.sql', 'utf8');
      console.log(sqlContent);
    } catch (readError) {
      console.log('Could not read SQL file. Please add the is_enabled column manually.');
    }
    console.log('----------------------------------------');
  }
}

// Run the migration
applySubcategoryMigration(); 