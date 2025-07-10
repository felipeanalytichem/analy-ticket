import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySLANotificationTypesMigration() {
  try {
    console.log('🔧 Applying SLA notification types migration...');

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250107000117_add_sla_notification_types.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabase.rpc('exec', { sql: migrationSQL });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ SLA notification types migration applied successfully!');
    
    // Verify the enum values were added
    console.log('🔍 Verifying notification types...');
    const { data: enumValues, error: enumError } = await supabase
      .from('pg_enum')
      .select('enumlabel')
      .eq('enumtypid', supabase.rpc('get_notification_type_oid'));

    if (!enumError && enumValues) {
      console.log('📋 Available notification types:', enumValues.map(v => v.enumlabel).join(', '));
    }

    // Test creating a notification with the new types
    console.log('🧪 Testing SLA notification creation...');
    const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID for test
    
    const { error: testError } = await supabase
      .from('notifications')
      .insert({
        user_id: testUserId,
        type: 'sla_warning',
        title: 'Test SLA Warning',
        message: 'This is a test of the SLA warning notification type',
        priority: 'high',
        read: false,
        created_at: new Date().toISOString()
      });

    if (testError && !testError.message.includes('violates foreign key constraint')) {
      console.error('❌ Test notification creation failed:', testError);
    } else {
      console.log('✅ SLA notification types are working correctly!');
      
      // Clean up test notification if it was created
      if (!testError) {
        await supabase
          .from('notifications')
          .delete()
          .eq('user_id', testUserId)
          .eq('title', 'Test SLA Warning');
      }
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

// Run the migration
applySLANotificationTypesMigration(); 