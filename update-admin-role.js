import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUserToAdmin() {
  try {
    console.log('Updating user felipe.henrique@analytichem.com to admin role...');
    
    // First, let's check if the user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'felipe.henrique@analytichem.com')
      .single();
    
    if (checkError) {
      console.error('Error checking user:', checkError);
      return;
    }
    
    if (!existingUser) {
      console.log('User not found. Creating user...');
      
      // Create the user if it doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            email: 'felipe.henrique@analytichem.com',
            full_name: 'Felipe Henrique',
            role: 'admin',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        return;
      }
      
      console.log('User created successfully:', newUser);
    } else {
      console.log('User found:', existingUser);
      
      // Update the existing user to admin role
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('email', 'felipe.henrique@analytichem.com')
        .select();
      
      if (updateError) {
        console.error('Error updating user role:', updateError);
        return;
      }
      
      console.log('User role updated successfully:', updatedUser);
    }
    
    console.log('✅ Felipe Henrique is now an administrator!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateUserToAdmin(); 