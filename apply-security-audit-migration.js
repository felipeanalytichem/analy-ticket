import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Use the same hardcoded values as in the supabase client
const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyMigration() {
  try {
    console.log('🔄 Applying security audit logs migration...');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250728000001_create_security_audit_logs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Security audit logs migration applied successfully!');
    
    // Test the table by inserting a test record
    const { error: testError } = await supabase
      .from('security_audit_logs')
      .insert({
        user_id: null,
        action: 'unauthorized_ticket_access',
        ticket_id: null,
        user_role: 'user',
        error_message: 'Test migration - this record can be deleted',
        metadata: { test: true }
      });
    
    if (testError) {
      console.error('❌ Test insert failed:', testError);
    } else {
      console.log('✅ Test insert successful - table is working correctly');
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();