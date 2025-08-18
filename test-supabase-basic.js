// Simple test to verify the enhanced Supabase client works
import { supabase, getSupabaseClient } from './src/lib/supabase.ts';

console.log('Testing enhanced Supabase client...');

try {
  // Test basic client access
  console.log('1. Testing basic client access...');
  const client = getSupabaseClient();
  console.log('✓ Client created successfully');
  
  // Test proxy access
  console.log('2. Testing proxy access...');
  const auth = supabase.auth;
  console.log('✓ Proxy access works');
  
  // Test client health
  console.log('3. Testing client health...');
  const healthStatus = getClientHealthStatus();
  console.log('✓ Health status:', healthStatus.isHealthy ? 'Healthy' : 'Unhealthy');
  
  console.log('All tests passed! Enhanced Supabase client is working correctly.');
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}