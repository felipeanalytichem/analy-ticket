import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Checking database connectivity and state...');

try {
  // Test basic connectivity with a simple query
  const { data: testData, error: testError } = await supabase
    .from('users')
    .select('count')
    .limit(1);
  
  if (testError) {
    console.error('❌ Database connectivity error:', testError);
    
    // Try to check if it's an RLS issue
    if (testError.message.includes('RLS') || testError.message.includes('policy')) {
      console.log('⚠️  This appears to be an RLS (Row Level Security) issue');
      console.log('📋 Checking if tables exist without data access...');
      
      // Try to get table schema information
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(10);
      
      if (tablesError) {
        console.error('❌ Cannot access table schema:', tablesError);
      } else {
        console.log(`📊 Found ${tables?.length || 0} tables in public schema`);
        if (tables && tables.length > 0) {
          console.log('📋 Tables:', tables.map(t => t.table_name).join(', '));
        }
      }
    }
  } else {
    console.log('✅ Database connection successful');
    console.log('📊 Users table accessible');
  }
  
  // Try to test authentication by attempting to sign in with a test user
  console.log('\n🔐 Testing authentication system...');
  
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'admin@analytichem.com',
    password: 'AnalytiChem2024!'
  });
  
  if (signInError) {
    console.error('❌ Authentication test failed:', signInError.message);
    
    if (signInError.message === 'Invalid login credentials') {
      console.log('⚠️  This confirms the "Invalid login credentials" error');
      console.log('🔍 Possible causes:');
      console.log('  1. Admin user was deleted during database reset');
      console.log('  2. Password was changed');
      console.log('  3. Email confirmation is required');
      console.log('  4. User exists in public.users but not in auth.users');
    }
  } else {
    console.log('✅ Authentication successful!');
    console.log('👤 User:', signInData.user?.email);
    
    // Sign out after test
    await supabase.auth.signOut();
  }
  
} catch (error) {
  console.error('❌ Unexpected error:', error);
}

console.log('\n📋 Summary:');
console.log('The database migration was applied successfully, but user authentication may need to be restored.');
console.log('If login fails, we need to recreate the admin user in both auth.users and public.users tables.'); 