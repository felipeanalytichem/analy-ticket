#!/usr/bin/env node

/**
 * Test Script for Notification Migration
 * This script tests the notification migration with production-like data volumes
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Create Supabase client with service role for testing
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test configuration
const TEST_CONFIG = {
  USERS_COUNT: 100,
  TICKETS_PER_USER: 10,
  NOTIFICATIONS_PER_TICKET: 5,
  BATCH_SIZE: 50
};

/**
 * Generate test data for migration testing
 */
async function generateTestData() {
  console.log('🚀 Starting test data generation...');
  
  try {
    // Create test users
    console.log(`📝 Creating ${TEST_CONFIG.USERS_COUNT} test users...`);
    const users = [];
    for (let i = 0; i < TEST_CONFIG.USERS_COUNT; i++) {
      users.push({
        id: `test-user-${i.toString().padStart(3, '0')}`,
        email: `test-user-${i}@example.com`,
        full_name: `Test User ${i}`,
        role: i % 10 === 0 ? 'admin' : i % 5 === 0 ? 'agent' : 'user'
      });
    }
    
    // Insert users in batches
    for (let i = 0; i < users.length; i += TEST_CONFIG.BATCH_SIZE) {
      const batch = users.slice(i, i + TEST_CONFIG.BATCH_SIZE);
      const { error } = await supabase
        .from('users')
        .upsert(batch);
      
      if (error) {
        console.error('Error inserting users:', error);
        continue;
      }
    }
    
    // Create test categories
    console.log('📝 Creating test categories...');
    const categories = [
      { id: 'cat-1', name: 'Technical Support', description: 'Technical issues' },
      { id: 'cat-2', name: 'Bug Report', description: 'Software bugs' },
      { id: 'cat-3', name: 'Feature Request', description: 'New features' }
    ];
    
    await supabase.from('categories').upsert(categories);
    
    // Create test tickets
    console.log(`📝 Creating ${TEST_CONFIG.USERS_COUNT * TEST_CONFIG.TICKETS_PER_USER} test tickets...`);
    const tickets = [];
    let ticketCounter = 0;
    
    for (const user of users) {
      for (let j = 0; j < TEST_CONFIG.TICKETS_PER_USER; j++) {
        tickets.push({
          id: `test-ticket-${ticketCounter.toString().padStart(4, '0')}`,
          ticket_number: `TKT-TEST-${ticketCounter}`,
          title: `Test Ticket ${ticketCounter}`,
          description: `This is a test ticket for migration testing`,
          status: ['open', 'pending', 'in_progress', 'resolved'][j % 4],
          priority: ['low', 'medium', 'high', 'urgent'][j % 4],
          category_id: categories[j % categories.length].id,
          user_id: user.id,
          assigned_to: j % 3 === 0 ? users[Math.floor(Math.random() * users.length)].id : null
        });
        ticketCounter++;
      }
    }
    
    // Insert tickets in batches
    for (let i = 0; i < tickets.length; i += TEST_CONFIG.BATCH_SIZE) {
      const batch = tickets.slice(i, i + TEST_CONFIG.BATCH_SIZE);
      const { error } = await supabase
        .from('tickets_new')
        .upsert(batch);
      
      if (error) {
        console.error('Error inserting tickets:', error);
        continue;
      }
    }
    
    // Create test notifications
    console.log(`📝 Creating ${tickets.length * TEST_CONFIG.NOTIFICATIONS_PER_TICKET} test notifications...`);
    const notifications = [];
    let notificationCounter = 0;
    
    const notificationTypes = [
      'ticket_created', 'ticket_updated', 'ticket_assigned', 
      'comment_added', 'status_changed', 'priority_changed'
    ];
    
    for (const ticket of tickets) {
      for (let k = 0; k < TEST_CONFIG.NOTIFICATIONS_PER_TICKET; k++) {
        const type = notificationTypes[k % notificationTypes.length];
        notifications.push({
          id: `test-notification-${notificationCounter.toString().padStart(6, '0')}`,
          user_id: ticket.user_id,
          type: type,
          title: `Test Notification ${notificationCounter}`,
          message: `This is a test notification of type ${type}`,
          priority: ['low', 'medium', 'high'][k % 3],
          read: Math.random() > 0.3, // 70% read rate
          ticket_id: ticket.id,
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
        });
        notificationCounter++;
      }
    }
    
    // Insert notifications in batches
    for (let i = 0; i < notifications.length; i += TEST_CONFIG.BATCH_SIZE) {
      const batch = notifications.slice(i, i + TEST_CONFIG.BATCH_SIZE);
      const { error } = await supabase
        .from('notifications')
        .upsert(batch);
      
      if (error) {
        console.error('Error inserting notifications:', error);
        continue;
      }
    }
    
    console.log('✅ Test data generation completed!');
    console.log(`📊 Generated: ${users.length} users, ${tickets.length} tickets, ${notifications.length} notifications`);
    
    return {
      users: users.length,
      tickets: tickets.length,
      notifications: notifications.length
    };
    
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  }
}

/**
 * Test the migration performance
 */
async function testMigrationPerformance() {
  console.log('⏱️  Testing migration performance...');
  
  try {
    // Test notification grouping performance
    const startTime = Date.now();
    
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, ticket_id, type')
      .limit(1000);
    
    if (error) throw error;
    
    console.log(`📊 Queried ${notifications.length} notifications in ${Date.now() - startTime}ms`);
    
    // Test group creation performance
    const groupStartTime = Date.now();
    
    const { data: groups, error: groupError } = await supabase
      .from('notification_groups')
      .select('*')
      .limit(100);
    
    if (groupError) throw groupError;
    
    console.log(`📊 Queried ${groups?.length || 0} groups in ${Date.now() - groupStartTime}ms`);
    
    // Test analytics query performance
    const analyticsStartTime = Date.now();
    
    const { data: analytics, error: analyticsError } = await supabase
      .from('notification_analytics')
      .select('*')
      .limit(1000);
    
    if (analyticsError) throw analyticsError;
    
    console.log(`📊 Queried ${analytics?.length || 0} analytics records in ${Date.now() - analyticsStartTime}ms`);
    
  } catch (error) {
    console.error('❌ Error testing migration performance:', error);
    throw error;
  }
}

/**
 * Validate migration results
 */
async function validateMigration() {
  console.log('🔍 Validating migration results...');
  
  try {
    // Run the validation function
    const { data: validationResults, error } = await supabase
      .rpc('validate_notification_migration');
    
    if (error) throw error;
    
    console.log('📋 Migration Validation Results:');
    validationResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : 'ℹ️';
      console.log(`${status} ${result.check_name}: ${result.details}`);
    });
    
    // Check for any failed validations
    const failures = validationResults.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.error(`❌ Migration validation failed with ${failures.length} issues`);
      return false;
    }
    
    console.log('✅ Migration validation passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Error validating migration:', error);
    throw error;
  }
}

/**
 * Test notification statistics function
 */
async function testNotificationStats() {
  console.log('📊 Testing notification statistics...');
  
  try {
    // Get a test user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (userError) throw userError;
    if (!users || users.length === 0) {
      console.log('⚠️  No users found for stats testing');
      return;
    }
    
    const userId = users[0].id;
    
    // Test the stats function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_notification_stats', { p_user_id: userId });
    
    if (statsError) throw statsError;
    
    if (stats && stats.length > 0) {
      const userStats = stats[0];
      console.log('📈 User Notification Statistics:');
      console.log(`   Total Notifications: ${userStats.total_notifications}`);
      console.log(`   Unread Notifications: ${userStats.unread_notifications}`);
      console.log(`   Total Groups: ${userStats.total_groups}`);
      console.log(`   Unread Groups: ${userStats.unread_groups}`);
      console.log(`   Notifications by Type:`, userStats.notifications_by_type);
    }
    
  } catch (error) {
    console.error('❌ Error testing notification stats:', error);
    throw error;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete test notifications
    await supabase
      .from('notifications')
      .delete()
      .like('id', 'test-notification-%');
    
    // Delete test tickets
    await supabase
      .from('tickets_new')
      .delete()
      .like('id', 'test-ticket-%');
    
    // Delete test users
    await supabase
      .from('users')
      .delete()
      .like('id', 'test-user-%');
    
    // Delete test categories
    await supabase
      .from('categories')
      .delete()
      .in('id', ['cat-1', 'cat-2', 'cat-3']);
    
    console.log('✅ Test data cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error cleaning up test data:', error);
    throw error;
  }
}

/**
 * Main test function
 */
async function runMigrationTest() {
  console.log('🧪 Starting Notification Migration Test');
  console.log('=====================================');
  
  const startTime = Date.now();
  
  try {
    // Generate test data
    const testData = await generateTestData();
    
    // Test migration performance
    await testMigrationPerformance();
    
    // Validate migration
    const isValid = await validateMigration();
    
    // Test notification statistics
    await testNotificationStats();
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n🎉 Migration Test Summary');
    console.log('========================');
    console.log(`⏱️  Total Test Time: ${totalTime}ms`);
    console.log(`📊 Test Data: ${testData.users} users, ${testData.tickets} tickets, ${testData.notifications} notifications`);
    console.log(`✅ Migration Valid: ${isValid ? 'Yes' : 'No'}`);
    
    if (process.argv.includes('--cleanup')) {
      await cleanupTestData();
    } else {
      console.log('\n💡 Run with --cleanup flag to remove test data');
    }
    
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Migration test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (process.argv[1] === __filename) {
  runMigrationTest();
}

export {
  generateTestData,
  testMigrationPerformance,
  validateMigration,
  testNotificationStats,
  cleanupTestData,
  runMigrationTest
};