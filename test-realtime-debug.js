// Simple test script to debug real-time functionality
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://your-project.supabase.co'; // Replace with actual URL
const supabaseKey = 'your-anon-key'; // Replace with actual key

const supabase = createClient(supabaseUrl, supabaseKey);

// Test real-time subscription
console.log('🧪 Testing Supabase real-time connection...');

const testChannel = supabase.channel('test-realtime');

testChannel
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'chat_messages'
  }, (payload) => {
    console.log('📨 Real-time message received:', payload);
  })
  .subscribe((status) => {
    console.log('🔗 Real-time status:', status);
    
    if (status === 'SUBSCRIBED') {
      console.log('✅ Real-time subscription working!');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Real-time subscription failed');
    }
  });

// Test table access
async function testTableAccess() {
  try {
    console.log('🧪 Testing table access...');
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Table access failed:', error);
    } else {
      console.log('✅ Table access working');
    }
  } catch (err) {
    console.error('❌ Table access error:', err);
  }
}

testTableAccess(); 