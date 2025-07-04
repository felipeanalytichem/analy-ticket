import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUsersData() {
  try {
    console.log('Fetching users data...');
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching users:', error);
      return;
    }
    
    console.log('Raw data from database:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\nProcessed data:');
    (data || []).forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log('- ID:', user?.id);
      console.log('- Email:', user?.email);
      console.log('- Full Name:', user?.full_name);
      console.log('- Role:', user?.role);
      console.log('- Created:', user?.created_at);
      console.log('- Updated:', user?.updated_at);
      console.log('- Raw object:', user);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugUsersData(); 