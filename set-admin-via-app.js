import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setAdminRole() {
  try {
    console.log('Setting admin role for felipe.henrique@analytichem.com...');
    
    // First, let's try to update using the user ID directly
    const userId = 'cc4ed50d-5ba6-4d98-b58a-ee74e14d89e3';
    
    console.log('Attempting to update user role...');
    
    // Try updating by ID instead of email
    const { data: updateResult, error: updateError } = await supabase
      .from('users')
      .update({ 
        role: 'admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (updateError) {
      console.error('Error updating user role:', updateError);
      
      // Try alternative approach - delete and recreate
      console.log('Trying alternative approach...');
      
      // First delete the existing user
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        return;
      }
      
      console.log('User deleted, creating new admin user...');
      
      // Create new admin user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: userId,
            email: 'felipe.henrique@analytichem.com',
            full_name: 'Felipe Henrique',
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select();
      
      if (createError) {
        console.error('Error creating admin user:', createError);
        return;
      }
      
      console.log('✅ Admin user created successfully:', newUser);
    } else {
      console.log('✅ User role updated successfully');
    }
    
    // Verify the change
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (verifyError) {
      console.error('Error verifying user:', verifyError);
      return;
    }
    
    console.log('Final verification:');
    console.log('- Email:', verifyUser.email);
    console.log('- Name:', verifyUser.full_name);
    console.log('- Role:', verifyUser.role);
    
    if (verifyUser.role === 'admin') {
      console.log('🎉 SUCCESS: Felipe Henrique is now an administrator!');
    } else {
      console.log('❌ FAILED: Role is still:', verifyUser.role);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

setAdminRole(); 