import { createClient } from '@supabase/supabase-js';

// Use the same hardcoded values as in the supabase client
const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSecurityAuditTable() {
  try {
    console.log('🔍 Testing if security_audit_logs table exists...');
    
    // Try to query the table
    const { data, error } = await supabase
      .from('security_audit_logs')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does not exist. Need to create it.');
        return false;
      } else {
        console.log('❌ Error querying table:', error);
        return false;
      }
    }
    
    console.log('✅ Table exists and is accessible!');
    console.log('📊 Sample data:', data);
    return true;
    
  } catch (error) {
    console.error('❌ Exception while testing table:', error);
    return false;
  }
}

async function testSecurityAuditService() {
  try {
    console.log('🧪 Testing SecurityAuditService functionality...');
    
    // Try to insert a test record
    const testRecord = {
      user_id: null,
      action: 'unauthorized_ticket_access',
      ticket_id: null,
      user_role: 'user',
      error_message: 'Test record from security audit system implementation',
      metadata: { 
        test: true, 
        timestamp: new Date().toISOString(),
        implementation_test: true
      }
    };
    
    const { data, error } = await supabase
      .from('security_audit_logs')
      .insert(testRecord)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Failed to insert test record:', error);
      return false;
    }
    
    console.log('✅ Successfully inserted test record:', data);
    
    // Try to query it back
    const { data: queryData, error: queryError } = await supabase
      .from('security_audit_logs')
      .select('*')
      .eq('id', data.id)
      .single();
    
    if (queryError) {
      console.error('❌ Failed to query test record:', queryError);
      return false;
    }
    
    console.log('✅ Successfully queried test record:', queryData);
    
    // Clean up test record
    const { error: deleteError } = await supabase
      .from('security_audit_logs')
      .delete()
      .eq('id', data.id);
    
    if (deleteError) {
      console.warn('⚠️ Failed to clean up test record:', deleteError);
    } else {
      console.log('✅ Test record cleaned up successfully');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Exception during service test:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting security audit system tests...\n');
  
  const tableExists = await testSecurityAuditTable();
  
  if (tableExists) {
    console.log('\n🧪 Running service functionality tests...\n');
    const serviceWorks = await testSecurityAuditService();
    
    if (serviceWorks) {
      console.log('\n🎉 All tests passed! Security audit system is working correctly.');
    } else {
      console.log('\n❌ Service tests failed. Check the implementation.');
    }
  } else {
    console.log('\n❌ Table does not exist. The migration needs to be applied first.');
  }
}

main().catch(console.error);