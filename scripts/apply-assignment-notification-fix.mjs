#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://plbmgjqitlxedsmdqpld.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('🔧 Applying assignment_changed notification type migration...');
    
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20250115000010_add_assignment_changed_notification_type.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration SQL loaded');
    console.log('🔄 Executing migration...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      return;
    }
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the migration by checking if the new enum value exists
    console.log('🔍 Verifying migration...');
    
    const { data: enumData, error: enumError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT enumlabel 
          FROM pg_enum 
          WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
          ORDER BY enumlabel;
        `
      });
    
    if (enumError) {
      console.error('❌ Verification failed:', enumError);
      return;
    }
    
    console.log('📋 Current notification_type enum values:');
    if (enumData && Array.isArray(enumData)) {
      enumData.forEach(row => {
        console.log(`  - ${row.enumlabel}`);
      });
    }
    
    // Try to create a test notification with the new type
    console.log('🧪 Testing new notification type...');
    
    const { data: testData, error: testError } = await supabase
      .from('notifications')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
        type: 'assignment_changed',
        title: 'Test Notification',
        message: 'This is a test to verify the assignment_changed type works',
        priority: 'medium',
        read: false
      })
      .select()
      .single();
    
    if (testError) {
      console.error('❌ Test notification failed:', testError);
      console.log('🔧 The enum was added but there might be other issues');
    } else {
      console.log('✅ Test notification created successfully!');
      
      // Clean up test notification
      await supabase
        .from('notifications')
        .delete()
        .eq('id', testData.id);
      
      console.log('🧹 Test notification cleaned up');
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('💡 You can now use "assignment_changed" as a notification type');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch(console.error); 