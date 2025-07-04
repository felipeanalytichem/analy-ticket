// Run database migrations
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Supabase client setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Migration files to run in sequence
const migrationFiles = [
  'add-attached-form-column.sql',
  'add-attachments-column.sql',
  'add-employee-onboarding-columns.sql',
  'fix-notifications-rls.sql'
];

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  for (const file of migrationFiles) {
    try {
      console.log(`📄 Reading migration file: ${file}`);
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`⚙️ Executing migration: ${file}`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`❌ Migration failed for ${file}:`, error);
        process.exit(1);
      }
      
      console.log(`✅ Migration successful: ${file}`);
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err);
      process.exit(1);
    }
  }
  
  console.log('🎉 All migrations completed successfully!');
}

runMigrations().catch(err => {
  console.error('❌ Migration process failed:', err);
  process.exit(1);
}); 