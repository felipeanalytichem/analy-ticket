// Real-time messaging diagnostic script
// Run this in browser console to test Supabase real-time functionality

console.log('🔍 Starting real-time diagnostic...');

const testRealtime = async () => {
  try {
    // Import Supabase client
    const { supabase } = await import('./src/lib/supabase.ts');
    
    console.log('✅ Supabase client imported');
    
    // Test 1: Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('👤 Current user:', user?.email);
    
    // Test 2: Check if chat tables exist
    const { data: tables, error: tableError } = await supabase
      .from('chat_messages')
      .select('id')
      .limit(1);
      
    if (tableError) {
      console.error('❌ Chat tables error:', tableError);
      return;
    }
    
    console.log('📊 Chat tables accessible');
    
    // Test 3: Test basic subscription
    console.log('🔌 Testing subscription...');
    
    const channel = supabase
      .channel('test-channel')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages'
        }, 
        (payload) => {
          console.log('📨 Real-time event received:', payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription successful!');
          
          // Test 4: Send a test message after subscription is ready
          setTimeout(async () => {
            try {
              console.log('📤 Sending test message...');
              
              // Get first available chat
              const { data: chats } = await supabase
                .from('ticket_chats')
                .select('id')
                .limit(1);
                
              if (chats && chats.length > 0) {
                const testChatId = chats[0].id;
                
                const { data: message, error: msgError } = await supabase
                  .from('chat_messages')
                  .insert({
                    chat_id: testChatId,
                    sender_id: user.id,
                    message: `Test message ${new Date().toISOString()}`,
                    is_internal: false,
                    message_type: 'text'
                  })
                  .select()
                  .single();
                  
                if (msgError) {
                  console.error('❌ Error sending test message:', msgError);
                } else {
                  console.log('✅ Test message sent:', message);
                  console.log('🎯 Check if real-time event was received above');
                }
              } else {
                console.log('⚠️ No chats available for testing');
              }
            } catch (error) {
              console.error('❌ Test message error:', error);
            }
          }, 2000);
        }
      });
      
    // Cleanup after 10 seconds
    setTimeout(() => {
      channel.unsubscribe();
      console.log('🧹 Test completed, subscription cleaned up');
    }, 10000);
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
};

// Run the test
testRealtime();

console.log('ℹ️ Diagnostic started. Check console for results...'); 