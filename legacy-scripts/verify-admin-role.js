import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyAdminRole() {
  try {
    console.log('Verifying admin role for felipe.henrique@analytichem.com...');
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'felipe.henrique@analytichem.com')
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return;
    }
    
    console.log('User details:');
    console.log('- Email:', user.email);
    console.log('- Name:', user.full_name);
    console.log('- Role:', user.role);
    console.log('- ID:', user.id);
    console.log('- Created:', user.created_at);
    console.log('- Updated:', user.updated_at);
    
    if (user.role === 'admin') {
      console.log('✅ SUCCESS: User is now an administrator!');
    } else {
      console.log('❌ FAILED: User role is still:', user.role);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

verifyAdminRole(); 