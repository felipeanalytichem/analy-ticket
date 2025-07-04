import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM2NTcwNywiZXhwIjoyMDQ5OTQxNzA3fQ.ZhcpGQ0LtG5xWLvJFBzrKfqDjhKlBN7VrKFgNfhNAzM';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restoreAdminUser() {
  console.log('🔍 Checking current users in database...');
  
  try {
    // Check if users table exists and what users are there
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('❌ Error checking users table:', usersError);
      return;
    }
    
    console.log(`📊 Found ${users?.length || 0} users in database`);
    
    if (users && users.length > 0) {
      console.log('👥 Existing users:');
      users.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - ID: ${user.id}`);
      });
    }
    
    // Check auth.users table
    console.log('\n🔍 Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error checking auth users:', authError);
    } else {
      console.log(`📊 Found ${authUsers.users?.length || 0} users in auth.users`);
      
      if (authUsers.users && authUsers.users.length > 0) {
        console.log('👥 Auth users:');
        authUsers.users.forEach(user => {
          console.log(`  - ${user.email} - ID: ${user.id} - Created: ${user.created_at}`);
        });
      }
    }
    
    // Check if admin user exists
    const adminUser = users?.find(user => user.role === 'admin');
    
    if (!adminUser) {
      console.log('\n⚠️  No admin user found! Creating admin user...');
      
      // Create admin user in auth
      const adminEmail = 'admin@analytichem.com';
      const adminPassword = 'AnalytiChem2024!';
      
      const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      });
      
      if (createAuthError) {
        console.error('❌ Error creating auth user:', createAuthError);
        return;
      }
      
      console.log('✅ Auth user created:', newAuthUser.user.id);
      
      // Create user in public.users table
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          id: newAuthUser.user.id,
          email: adminEmail,
          full_name: 'Admin AnalytiChem',
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (createUserError) {
        console.error('❌ Error creating user record:', createUserError);
        return;
      }
      
      console.log('✅ Admin user created successfully!');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      console.log(`🆔 User ID: ${newAuthUser.user.id}`);
      
    } else {
      console.log('\n✅ Admin user already exists:');
      console.log(`📧 Email: ${adminUser.email}`);
      console.log(`🆔 User ID: ${adminUser.id}`);
      
      // Check if this admin user exists in auth.users
      const authUser = authUsers.users?.find(user => user.id === adminUser.id);
      if (!authUser) {
        console.log('⚠️  Admin user exists in public.users but not in auth.users!');
        console.log('This might be the cause of login issues.');
        
        // Try to create the auth user
        console.log('🔧 Attempting to create auth record...');
        const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
          email: adminUser.email,
          password: 'AnalytiChem2024!', // Default password
          email_confirm: true,
          user_id: adminUser.id // Use existing ID
        });
        
        if (createAuthError) {
          console.error('❌ Error creating auth user:', createAuthError);
        } else {
          console.log('✅ Auth user created for existing admin!');
          console.log(`🔑 Default password: AnalytiChem2024!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

restoreAdminUser(); 