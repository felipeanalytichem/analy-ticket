const { createClient } = require('@supabase/supabase-js');

// These should match your project's credentials
const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
// IMPORTANT: Use the SERVICE_ROLE_KEY here for admin operations
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTE1MjIyNiwiZXhwIjoyMDY0NzI4MjI2fQ.y4W2nkt3nJpX2fVxg2yI4VILtcqctc3O3s5p3e34a7s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAuthSystem() {
  const randomEmail = `test.auth.${Date.now()}@example.com`;
  const testPassword = `Password${Date.now()}`;
  const testFullName = 'Auth Verification User';

  console.log(`🚀 Starting authentication system verification...`);
  console.log(`   Email: ${randomEmail}`);
  console.log(`   Password: ${testPassword}`);
  console.log('--------------------------------------------------');

  try {
    // Step 1: Create a new user using the admin API
    console.log('1. Creating user with supabase.auth.admin.createUser...');
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: randomEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: testFullName,
        role: 'user'
      }
    });

    if (createError) {
      console.error('❌ User creation failed!');
      console.error(createError);
      return;
    }

    const userId = createData.user.id;
    console.log(`✅ User created successfully! User ID: ${userId}`);
    console.log('--------------------------------------------------');

    // Step 2: Verify the user profile was created by the trigger
    console.log('2. Verifying public.users profile creation...');
    let userProfile;
    for (let i = 0; i < 5; i++) {
        await new Promise(res => setTimeout(res, 1000)); // Wait for replication
        const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileData) {
            userProfile = profileData;
            break;
        }
        if (profileError && profileError.code !== 'PGRST116') {
             console.error('❌ Error fetching profile:', profileError);
             return;
        }
        console.log(`   Attempt ${i+1}: Profile not found, retrying...`);
    }

    if (userProfile) {
        console.log('✅ User profile found in public.users:');
        console.log(userProfile);
    } else {
        console.error('❌ User profile was not created in public.users after 5 seconds.');
        return;
    }
    console.log('--------------------------------------------------');


    // Step 3: Attempt to sign in with the new credentials
    console.log('3. Attempting to sign in with new credentials...');
    // We need a new client instance using the anon key for this part
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';
    const client = createClient(supabaseUrl, anonKey);
    
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: randomEmail,
      password: testPassword
    });

    if (signInError) {
      console.error('❌ Sign-in failed!');
      console.error(signInError);
      return;
    }

    if (signInData.user) {
      console.log('✅✅✅ SUCCESS! Sign-in successful!');
      console.log(`   User ID: ${signInData.user.id}`);
      console.log(`   Access Token: ${signInData.session.access_token.substring(0, 30)}...`);
    } else {
      console.error('❌ Sign-in failed unexpectedly, no user object returned.');
    }
    console.log('--------------------------------------------------');
    console.log('Verification complete.');

  } catch (e) {
    console.error('🚨 An unexpected error occurred during the script execution:');
    console.error(e);
  }
}

verifyAuthSystem(); 