import { supabase } from '@/lib/supabase';

/**
 * Utility to test database connectivity
 */
export async function testDatabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    console.log('🔍 Testing database connection...');

    // Test 1: Check auth session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return {
        success: false,
        message: 'Authentication session error',
        details: sessionError
      };
    }

    if (!sessionData.session) {
      return {
        success: false,
        message: 'No active session - user needs to login',
        details: 'Authentication required'
      };
    }

    console.log('✅ Auth session valid');

    // Test 2: Test database query
    const { data, error } = await supabase
      .from('tickets_new')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('❌ Tickets table query failed:', error);
      
      // Try alternative table
      const { error: usersError } = await supabase
        .from('users')
        .select('id')
        .limit(1);

      if (usersError) {
        return {
          success: false,
          message: 'Database connection failed - both tickets_new and users tables inaccessible',
          details: { ticketsError: error, usersError }
        };
      } else {
        return {
          success: true,
          message: 'Database partially accessible - users table works, tickets_new table has issues',
          details: { ticketsError: error }
        };
      }
    }

    console.log('✅ Database query successful');

    // Test 3: Test real-time connection
    try {
      const channel = supabase.channel('connection-test')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tickets_new'
        }, () => {})
        .subscribe((status) => {
          console.log('📡 Real-time status:', status);
        });

      // Clean up the test channel
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 1000);

      console.log('✅ Real-time connection test initiated');
    } catch (realtimeError) {
      console.warn('⚠️ Real-time connection test failed:', realtimeError);
    }

    return {
      success: true,
      message: 'Database connection fully operational',
      details: {
        session: sessionData.session.user.email,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return {
      success: false,
      message: 'Database connection test failed with exception',
      details: error
    };
  }
}

/**
 * Quick database health check
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return false;

    const { error } = await supabase
      .from('tickets_new')
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Expose utilities globally for debugging
 */
if (typeof window !== 'undefined') {
  (window as any).testDatabaseConnection = testDatabaseConnection;
  (window as any).quickHealthCheck = quickHealthCheck;
}
