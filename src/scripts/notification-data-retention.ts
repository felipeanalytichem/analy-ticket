#!/usr/bin/env node

/**
 * Notification Data Retention Script
 * 
 * This script applies data retention policies to notification data,
 * archiving old notifications and deleting very old ones according
 * to configured policies.
 * 
 * Usage:
 * - npm run retention:apply - Apply all retention policies
 * - npm run retention:dry-run - Show what would be done without making changes
 * - npm run retention:type <type> - Apply retention for specific notification type
 */

import { NotificationDataSecurity } from '../services/NotificationDataSecurity';
import { supabase } from '../lib/supabase';

interface RetentionOptions {
  dryRun?: boolean;
  notificationType?: string;
  verbose?: boolean;
  maxBatchSize?: number;
}

class NotificationDataRetentionRunner {
  private dataSecurity: NotificationDataSecurity;
  private options: RetentionOptions;

  constructor(options: RetentionOptions = {}) {
    this.dataSecurity = NotificationDataSecurity.getInstance();
    this.options = {
      dryRun: false,
      verbose: false,
      maxBatchSize: 1000,
      ...options
    };
  }

  /**
   * Run the data retention process
   */
  async run(): Promise<void> {
    console.log('🗂️  Starting notification data retention process...');
    console.log(`Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    if (this.options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made');
    }

    try {
      // Get retention statistics before processing
      const beforeStats = await this.getRetentionStats();
      console.log('\n📊 Current notification statistics:');
      console.log(`Total notifications: ${beforeStats.total}`);
      console.log(`Archived notifications: ${beforeStats.archived}`);
      console.log(`Unarchived notifications: ${beforeStats.unarchived}`);

      // Apply retention policies
      let result;
      if (this.options.dryRun) {
        result = await this.simulateRetentionPolicies();
      } else {
        result = await this.dataSecurity.applyDataRetentionPolicies();
      }

      // Report results
      console.log('\n✅ Retention process completed:');
      console.log(`Archived: ${result.archived} notifications`);
      console.log(`Deleted: ${result.deleted} notifications`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }

      // Get statistics after processing
      if (!this.options.dryRun) {
        const afterStats = await this.getRetentionStats();
        console.log('\n📊 Updated notification statistics:');
        console.log(`Total notifications: ${afterStats.total}`);
        console.log(`Archived notifications: ${afterStats.archived}`);
        console.log(`Unarchived notifications: ${afterStats.unarchived}`);
      }

      // Show retention policies if verbose
      if (this.options.verbose) {
        await this.showRetentionPolicies();
      }

    } catch (error) {
      console.error('❌ Error during retention process:', error);
      process.exit(1);
    }
  }

  /**
   * Simulate retention policies without making changes
   */
  private async simulateRetentionPolicies(): Promise<{
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      archived: 0,
      deleted: 0,
      errors: [] as string[]
    };

    try {
      // Get all notification types
      const { data: notificationTypes, error: typesError } = await supabase
        .from('notifications')
        .select('type, count(*)')
        .group('type');

      if (typesError) {
        result.errors.push(`Error fetching notification types: ${typesError.message}`);
        return result;
      }

      console.log('\n🔍 Simulating retention policies:');

      // Process each notification type
      for (const typeData of notificationTypes || []) {
        const notificationType = typeData.type;
        const policy = this.dataSecurity.getRetentionPolicy(notificationType);

        console.log(`\n📋 ${notificationType}:`);
        console.log(`  Retention: ${policy.retentionDays} days`);
        console.log(`  Archive after: ${policy.archiveAfterDays || 'N/A'} days`);
        console.log(`  Delete after: ${policy.deleteAfterDays} days`);

        // Count notifications that would be archived
        if (policy.archiveAfterDays) {
          const archiveDate = new Date();
          archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);

          const { count: archiveCount, error: archiveError } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('type', notificationType)
            .lt('created_at', archiveDate.toISOString())
            .eq('archived', false);

          if (archiveError) {
            result.errors.push(`Error counting archive candidates for ${notificationType}: ${archiveError.message}`);
          } else {
            result.archived += archiveCount || 0;
            console.log(`  Would archive: ${archiveCount || 0} notifications`);
          }
        }

        // Count notifications that would be deleted
        const deleteDate = new Date();
        deleteDate.setDate(deleteDate.getDate() - policy.deleteAfterDays);

        const { count: deleteCount, error: deleteError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('type', notificationType)
          .lt('created_at', deleteDate.toISOString());

        if (deleteError) {
          result.errors.push(`Error counting delete candidates for ${notificationType}: ${deleteError.message}`);
        } else {
          result.deleted += deleteCount || 0;
          console.log(`  Would delete: ${deleteCount || 0} notifications`);
        }
      }

      return result;
    } catch (error) {
      console.error('Error in simulation:', error);
      result.errors.push(`Simulation error: ${error}`);
      return result;
    }
  }

  /**
   * Get current retention statistics
   */
  private async getRetentionStats(): Promise<{
    total: number;
    archived: number;
    unarchived: number;
  }> {
    try {
      const { count: total } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });

      const { count: archived } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('archived', true);

      return {
        total: total || 0,
        archived: archived || 0,
        unarchived: (total || 0) - (archived || 0)
      };
    } catch (error) {
      console.error('Error getting retention stats:', error);
      return { total: 0, archived: 0, unarchived: 0 };
    }
  }

  /**
   * Show current retention policies
   */
  private async showRetentionPolicies(): Promise<void> {
    console.log('\n📋 Current retention policies:');
    
    const notificationTypes = [
      'ticket_created',
      'ticket_updated',
      'ticket_assigned',
      'comment_added',
      'status_changed',
      'priority_changed',
      'assignment_changed',
      'sla_warning',
      'sla_breach'
    ];

    notificationTypes.forEach(type => {
      const policy = this.dataSecurity.getRetentionPolicy(type);
      console.log(`\n  ${type}:`);
      console.log(`    Retention: ${policy.retentionDays} days`);
      console.log(`    Archive after: ${policy.archiveAfterDays || 'N/A'} days`);
      console.log(`    Delete after: ${policy.deleteAfterDays} days`);
    });
  }

  /**
   * Validate database connection and permissions
   */
  private async validateEnvironment(): Promise<boolean> {
    try {
      // Test database connection
      const { data, error } = await supabase
        .from('notifications')
        .select('count(*)')
        .limit(1);

      if (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
      }

      // Test if we can read retention policies (admin check)
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('❌ No authenticated user found');
        return false;
      }

      console.log('✅ Environment validation passed');
      return true;
    } catch (error) {
      console.error('❌ Environment validation failed:', error);
      return false;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): RetentionOptions {
  const args = process.argv.slice(2);
  const options: RetentionOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--type':
      case '-t':
        options.notificationType = args[++i];
        break;
      case '--batch-size':
      case '-b':
        options.maxBatchSize = parseInt(args[++i], 10);
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
Notification Data Retention Script

Usage: node notification-data-retention.js [options]

Options:
  -d, --dry-run          Show what would be done without making changes
  -v, --verbose          Show detailed information
  -t, --type <type>      Apply retention for specific notification type only
  -b, --batch-size <n>   Maximum batch size for operations (default: 1000)
  -h, --help             Show this help message

Examples:
  node notification-data-retention.js --dry-run
  node notification-data-retention.js --verbose
  node notification-data-retention.js --type ticket_created
  node notification-data-retention.js --dry-run --verbose
`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArguments();
  const runner = new NotificationDataRetentionRunner(options);

  // Validate environment before running
  const isValid = await runner.validateEnvironment();
  if (!isValid) {
    console.error('❌ Environment validation failed. Exiting.');
    process.exit(1);
  }

  await runner.run();
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { NotificationDataRetentionRunner };