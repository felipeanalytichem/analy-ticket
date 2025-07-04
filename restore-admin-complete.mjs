import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

// We'll need the service role key for admin operations
// This is the old one from the conversation - we'll update it if needed
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM2NTcwNywiZXhwIjoyMDQ5OTQxNzA3fQ.ZhcpGQ0LtG5xWLvJFBzrKfqDjhKlBN7VrKFgNfhNAzM';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔧 Starting database repair process...');

async function fixDatabase() {
  try {
    console.log('1️⃣ Fixing RLS policies and creating admin user...');
    
    // Execute the SQL fix script
    const sqlScript = readFileSync('fix-database-issues.sql', 'utf8');
    
    // Split the script into individual statements
    const statements = sqlScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.includes('SELECT create_admin_auth_user()') || 
          statement.includes('SELECT id, email')) {
        // Skip SELECT statements for now
        continue;
      }
      
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', { 
          sql_query: statement 
        });
        
        if (error) {
          console.log(`⚠️  SQL statement had an issue: ${error.message}`);
          // Continue with other statements
        }
      } catch (err) {
        console.log(`⚠️  Could not execute statement: ${err.message}`);
      }
    }
    
    console.log('2️⃣ Creating admin user in auth.users...');
    
    const adminEmail = 'admin@analytichem.com';
    const adminPassword = 'AnalytiChem2024!';
    const adminUserId = '00000000-0000-0000-0000-000000000001';
    
    // Try to create the auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_id: adminUserId
    });
    
    if (authError) {
      console.error('❌ Error creating auth user:', authError.message);
      
      // If user already exists, try to update password
      if (authError.message.includes('already exists') || authError.message.includes('duplicate')) {
        console.log('🔄 User exists, trying to update password...');
        
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          adminUserId,
          { password: adminPassword }
        );
        
        if (updateError) {
          console.error('❌ Error updating password:', updateError.message);
        } else {
          console.log('✅ Password updated successfully!');
        }
      }
    } else {
      console.log('✅ Auth user created successfully!');
    }
    
    console.log('3️⃣ Testing login...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    
    if (loginError) {
      console.error('❌ Login test failed:', loginError.message);
    } else {
      console.log('✅ Login test successful!');
      console.log(`👤 Logged in as: ${loginData.user.email}`);
      
      // Sign out
      await supabase.auth.signOut();
    }
    
    console.log('\n🎉 Database repair completed!');
    console.log('📧 Admin Email: admin@analytichem.com');
    console.log('🔑 Admin Password: AnalytiChem2024!');
    console.log('🆔 Admin User ID: 00000000-0000-0000-0000-000000000001');
    
  } catch (error) {
    console.error('❌ Unexpected error during repair:', error);
  }
}

fixDatabase(); 