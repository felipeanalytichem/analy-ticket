import { createClient } from '@supabase/supabase-js';

// Test the admin-users function directly
async function testAdminFunction() {
  const supabase = createClient(
    'https://plbmgjqitlxedsmdqpld.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMDY5ODksImV4cCI6MjA1MTU4Mjk4OX0.t51dNPnqnR4HNDyRu8qGGNS3ZtR4g8KrqvfuoepzCTo'
  );

  console.log('🧪 Testing admin-users function...');

  try {
    const testPayload = {
      operation: 'create',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      generateTempPassword: true
    };

    console.log('📤 Sending request:', testPayload);

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: testPayload,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (error) {
      console.error('❌ Function error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Function response:', data);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testAdminFunction(); 