#!/usr/bin/env node

/**
 * Notification Security Audit Script
 * 
 * This script performs comprehensive security audits on notification data,
 * checking for potential security issues, unencrypted sensitive data,
 * and compliance with security policies.
 * 
 * Usage:
 * - npm run security:audit - Run full security audit
 * - npm run security:scan-sensitive - Scan for unencrypted sensitive data
 * - npm run security:validate-encryption - Validate encryption integrity
 */

import { NotificationDataSecurity } from '../services/NotificationDataSecurity';
import { supabase } from '../lib/supabase';

interface SecurityAuditOptions {
  scanSensitiveData?: boolean;
  validateEncryption?: boolean;
  checkRetentionCompliance?: boolean;
  generateReport?: boolean;
  batchSize?: number;
}

interface SecurityIssue {
  id: string;
  type: 'sensitive_data' | 'encryption_error' | 'retention_violation' | 'malicious_content';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  notificationId: string;
  userId?: string;
  createdAt: string;
  recommendation: string;
}

interface SecurityAuditReport {
  timestamp: string;
  totalNotifications: number;
  issuesFound: SecurityIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

class NotificationSecurityAuditor {
  private dataSecurity: NotificationDataSecurity;
  private options: SecurityAuditOptions;
  private issues: SecurityIssue[] = [];

  constructor(options: SecurityAuditOptions = {}) {
    this.dataSecurity = NotificationDataSecurity.getInstance();
    this.options = {
      scanSensitiveData: true,
      validateEncryption: true,
      checkRetentionCompliance: true,
      generateReport: true,
      batchSize: 100,
      ...options
    };
  }

  /**
   * Run comprehensive security audit
   */
  async runAudit(): Promise<SecurityAuditReport> {
    console.log('🔒 Starting notification security audit...');
    
    const startTime = Date.now();
    this.issues = [];

    try {
      // Get total notification count
      const { count: totalNotifications } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });

      console.log(`📊 Auditing ${totalNotifications || 0} notifications...`);

      // Run different audit checks
      if (this.options.scanSensitiveData) {
        await this.scanForSensitiveData();
      }

      if (this.options.validateEncryption) {
        await this.validateEncryption();
      }

      if (this.options.checkRetentionCompliance) {
        await this.checkRetentionCompliance();
      }

      // Additional security checks
      await this.scanForMaliciousContent();
      await this.checkAccessPatterns();

      // Generate report
      const report = this.generateSecurityReport(totalNotifications || 0);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`\n✅ Security audit completed in ${duration.toFixed(2)}s`);
      this.displayReport(report);

      if (this.options.generateReport) {
        await this.saveReport(report);
      }

      return report;

    } catch (error) {
      console.error('❌ Security audit failed:', error);
      throw error;
    }
  }

  /**
   * Scan for unencrypted sensitive data
   */
  private async scanForSensitiveData(): Promise<void> {
    console.log('🔍 Scanning for unencrypted sensitive data...');

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, title, message, encrypted_fields, user_id, created_at')
        .range(offset, offset + this.options.batchSize! - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        break;
      }

      if (!notifications || notifications.length === 0) {
        hasMore = false;
        break;
      }

      for (const notification of notifications) {
        // Check if title contains sensitive data but is not encrypted
        if (this.dataSecurity.containsSensitiveData(notification.title)) {
          if (!notification.encrypted_fields?.includes('title')) {
            this.issues.push({
              id: `sensitive-title-${notification.id}`,
              type: 'sensitive_data',
              severity: 'high',
              description: 'Notification title contains sensitive data but is not encrypted',
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Encrypt the notification title to protect sensitive information'
            });
          }
        }

        // Check if message contains sensitive data but is not encrypted
        if (this.dataSecurity.containsSensitiveData(notification.message)) {
          if (!notification.encrypted_fields?.includes('message')) {
            this.issues.push({
              id: `sensitive-message-${notification.id}`,
              type: 'sensitive_data',
              severity: 'high',
              description: 'Notification message contains sensitive data but is not encrypted',
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Encrypt the notification message to protect sensitive information'
            });
          }
        }
      }

      offset += this.options.batchSize!;
      
      // Progress indicator
      if (offset % (this.options.batchSize! * 10) === 0) {
        console.log(`  Processed ${offset} notifications...`);
      }
    }

    console.log(`✅ Sensitive data scan completed. Found ${this.issues.filter(i => i.type === 'sensitive_data').length} issues.`);
  }

  /**
   * Validate encryption integrity
   */
  private async validateEncryption(): Promise<void> {
    console.log('🔐 Validating encryption integrity...');

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, title, message, encrypted_fields, encryption_data, user_id, created_at')
        .not('encrypted_fields', 'is', null)
        .range(offset, offset + this.options.batchSize! - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching encrypted notifications:', error);
        break;
      }

      if (!notifications || notifications.length === 0) {
        hasMore = false;
        break;
      }

      for (const notification of notifications) {
        // Validate encryption data structure
        if (notification.encrypted_fields && notification.encrypted_fields.length > 0) {
          if (!notification.encryption_data) {
            this.issues.push({
              id: `missing-encryption-data-${notification.id}`,
              type: 'encryption_error',
              severity: 'critical',
              description: 'Notification marked as encrypted but missing encryption data',
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Investigate and fix encryption data corruption'
            });
            continue;
          }

          // Check if all encrypted fields have corresponding encryption data
          for (const field of notification.encrypted_fields) {
            if (!notification.encryption_data[field]) {
              this.issues.push({
                id: `missing-field-encryption-${notification.id}-${field}`,
                type: 'encryption_error',
                severity: 'high',
                description: `Field '${field}' marked as encrypted but missing encryption data`,
                notificationId: notification.id,
                userId: notification.user_id,
                createdAt: notification.created_at,
                recommendation: `Re-encrypt the '${field}' field or remove it from encrypted_fields`
              });
            } else {
              // Validate encryption data structure
              const encData = notification.encryption_data[field];
              if (!encData.encrypted || !encData.iv || !encData.salt) {
                this.issues.push({
                  id: `invalid-encryption-structure-${notification.id}-${field}`,
                  type: 'encryption_error',
                  severity: 'high',
                  description: `Invalid encryption data structure for field '${field}'`,
                  notificationId: notification.id,
                  userId: notification.user_id,
                  createdAt: notification.created_at,
                  recommendation: `Re-encrypt the '${field}' field with proper structure`
                });
              }
            }
          }

          // Test decryption (without actually decrypting sensitive data)
          try {
            await this.dataSecurity.processNotificationForDisplay({
              title: notification.title,
              message: notification.message,
              encrypted_fields: notification.encrypted_fields,
              encryption_data: notification.encryption_data
            });
          } catch (error) {
            this.issues.push({
              id: `decryption-failed-${notification.id}`,
              type: 'encryption_error',
              severity: 'high',
              description: 'Failed to decrypt notification data',
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Investigate encryption key issues or data corruption'
            });
          }
        }
      }

      offset += this.options.batchSize!;
    }

    console.log(`✅ Encryption validation completed. Found ${this.issues.filter(i => i.type === 'encryption_error').length} issues.`);
  }

  /**
   * Check retention policy compliance
   */
  private async checkRetentionCompliance(): Promise<void> {
    console.log('📅 Checking retention policy compliance...');

    // Get notification types and their policies
    const { data: notificationTypes, error } = await supabase
      .from('notifications')
      .select('type')
      .group('type');

    if (error) {
      console.error('Error fetching notification types:', error);
      return;
    }

    for (const typeData of notificationTypes || []) {
      const notificationType = typeData.type;
      const policy = this.dataSecurity.getRetentionPolicy(notificationType);

      // Check for notifications that should be archived but aren't
      if (policy.archiveAfterDays) {
        const archiveDate = new Date();
        archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);

        const { data: unarchived, error: archiveError } = await supabase
          .from('notifications')
          .select('id, user_id, created_at')
          .eq('type', notificationType)
          .lt('created_at', archiveDate.toISOString())
          .eq('archived', false)
          .limit(100); // Limit to avoid too many issues

        if (!archiveError && unarchived) {
          unarchived.forEach(notification => {
            this.issues.push({
              id: `retention-archive-${notification.id}`,
              type: 'retention_violation',
              severity: 'medium',
              description: `Notification should be archived according to retention policy (${policy.archiveAfterDays} days)`,
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Run data retention process to archive old notifications'
            });
          });
        }
      }

      // Check for notifications that should be deleted
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() - policy.deleteAfterDays);

      const { data: shouldDelete, error: deleteError } = await supabase
        .from('notifications')
        .select('id, user_id, created_at')
        .eq('type', notificationType)
        .lt('created_at', deleteDate.toISOString())
        .limit(50); // Limit to avoid too many issues

      if (!deleteError && shouldDelete) {
        shouldDelete.forEach(notification => {
          this.issues.push({
            id: `retention-delete-${notification.id}`,
            type: 'retention_violation',
            severity: 'low',
            description: `Notification should be deleted according to retention policy (${policy.deleteAfterDays} days)`,
            notificationId: notification.id,
            userId: notification.user_id,
            createdAt: notification.created_at,
            recommendation: 'Run data retention process to delete old notifications'
          });
        });
      }
    }

    console.log(`✅ Retention compliance check completed. Found ${this.issues.filter(i => i.type === 'retention_violation').length} issues.`);
  }

  /**
   * Scan for malicious content
   */
  private async scanForMaliciousContent(): Promise<void> {
    console.log('🛡️ Scanning for malicious content...');

    let offset = 0;
    let hasMore = true;

    const maliciousPatterns = [
      /<script[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /expression\s*\(/gi
    ];

    while (hasMore) {
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, title, message, user_id, created_at')
        .range(offset, offset + this.options.batchSize! - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        break;
      }

      if (!notifications || notifications.length === 0) {
        hasMore = false;
        break;
      }

      for (const notification of notifications) {
        const content = `${notification.title} ${notification.message}`;
        
        for (const pattern of maliciousPatterns) {
          if (pattern.test(content)) {
            this.issues.push({
              id: `malicious-content-${notification.id}`,
              type: 'malicious_content',
              severity: 'critical',
              description: `Notification contains potentially malicious content: ${pattern.source}`,
              notificationId: notification.id,
              userId: notification.user_id,
              createdAt: notification.created_at,
              recommendation: 'Sanitize notification content and investigate how malicious content was stored'
            });
            break; // Only report one pattern per notification
          }
        }
      }

      offset += this.options.batchSize!;
    }

    console.log(`✅ Malicious content scan completed. Found ${this.issues.filter(i => i.type === 'malicious_content').length} issues.`);
  }

  /**
   * Check for suspicious access patterns
   */
  private async checkAccessPatterns(): Promise<void> {
    console.log('👁️ Checking access patterns...');

    // This would typically check access logs, but for now we'll check for
    // notifications with unusual characteristics
    
    const { data: suspiciousNotifications, error } = await supabase
      .from('notifications')
      .select('id, title, message, user_id, created_at, type')
      .or('title.ilike.%password%,title.ilike.%secret%,title.ilike.%token%,message.ilike.%password%,message.ilike.%secret%,message.ilike.%token%')
      .limit(100);

    if (!error && suspiciousNotifications) {
      suspiciousNotifications.forEach(notification => {
        this.issues.push({
          id: `suspicious-content-${notification.id}`,
          type: 'sensitive_data',
          severity: 'medium',
          description: 'Notification contains suspicious keywords that might indicate credential exposure',
          notificationId: notification.id,
          userId: notification.user_id,
          createdAt: notification.created_at,
          recommendation: 'Review notification content for potential credential exposure'
        });
      });
    }

    console.log(`✅ Access pattern check completed. Found ${this.issues.filter(i => i.id.includes('suspicious')).length} issues.`);
  }

  /**
   * Generate security audit report
   */
  private generateSecurityReport(totalNotifications: number): SecurityAuditReport {
    const summary = {
      critical: this.issues.filter(i => i.severity === 'critical').length,
      high: this.issues.filter(i => i.severity === 'high').length,
      medium: this.issues.filter(i => i.severity === 'medium').length,
      low: this.issues.filter(i => i.severity === 'low').length
    };

    const recommendations = [
      'Implement automated encryption for all sensitive notification data',
      'Set up regular data retention policy execution',
      'Add content sanitization validation to notification creation process',
      'Monitor for suspicious access patterns and unusual notification content',
      'Regularly audit encryption integrity and key management',
      'Implement real-time security monitoring for notification system'
    ];

    return {
      timestamp: new Date().toISOString(),
      totalNotifications,
      issuesFound: this.issues,
      summary,
      recommendations
    };
  }

  /**
   * Display audit report
   */
  private displayReport(report: SecurityAuditReport): void {
    console.log('\n📋 SECURITY AUDIT REPORT');
    console.log('========================');
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Notifications Audited: ${report.totalNotifications}`);
    console.log(`Total Issues Found: ${report.issuesFound.length}`);
    
    console.log('\n📊 Issue Summary:');
    console.log(`  🔴 Critical: ${report.summary.critical}`);
    console.log(`  🟠 High: ${report.summary.high}`);
    console.log(`  🟡 Medium: ${report.summary.medium}`);
    console.log(`  🟢 Low: ${report.summary.low}`);

    if (report.issuesFound.length > 0) {
      console.log('\n🚨 Issues Found:');
      
      // Group issues by severity
      const criticalIssues = report.issuesFound.filter(i => i.severity === 'critical');
      const highIssues = report.issuesFound.filter(i => i.severity === 'high');
      const mediumIssues = report.issuesFound.filter(i => i.severity === 'medium');
      const lowIssues = report.issuesFound.filter(i => i.severity === 'low');

      [criticalIssues, highIssues, mediumIssues, lowIssues].forEach((issues, index) => {
        const severityLabels = ['🔴 CRITICAL', '🟠 HIGH', '🟡 MEDIUM', '🟢 LOW'];
        if (issues.length > 0) {
          console.log(`\n${severityLabels[index]} Issues:`);
          issues.slice(0, 5).forEach(issue => { // Show first 5 of each severity
            console.log(`  - ${issue.description}`);
            console.log(`    Notification: ${issue.notificationId}`);
            console.log(`    Recommendation: ${issue.recommendation}`);
            console.log('');
          });
          if (issues.length > 5) {
            console.log(`    ... and ${issues.length - 5} more ${severityLabels[index].toLowerCase()} issues`);
          }
        }
      });
    }

    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  /**
   * Save audit report to file
   */
  private async saveReport(report: SecurityAuditReport): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const reportsDir = path.join(process.cwd(), 'security-audit-reports');
      
      // Create reports directory if it doesn't exist
      try {
        await fs.access(reportsDir);
      } catch {
        await fs.mkdir(reportsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `notification-security-audit-${timestamp}.json`;
      const filepath = path.join(reportsDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(`\n💾 Report saved to: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to save report:', error);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArguments(): SecurityAuditOptions {
  const args = process.argv.slice(2);
  const options: SecurityAuditOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--scan-sensitive':
        options.scanSensitiveData = true;
        options.validateEncryption = false;
        options.checkRetentionCompliance = false;
        break;
      case '--validate-encryption':
        options.scanSensitiveData = false;
        options.validateEncryption = true;
        options.checkRetentionCompliance = false;
        break;
      case '--no-report':
        options.generateReport = false;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
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
Notification Security Audit Script

Usage: node notification-security-audit.js [options]

Options:
  --scan-sensitive       Only scan for unencrypted sensitive data
  --validate-encryption  Only validate encryption integrity
  --no-report           Don't save report to file
  --batch-size <n>      Batch size for processing (default: 100)
  -h, --help            Show this help message

Examples:
  node notification-security-audit.js
  node notification-security-audit.js --scan-sensitive
  node notification-security-audit.js --validate-encryption
  node notification-security-audit.js --batch-size 50
`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArguments();
  const auditor = new NotificationSecurityAuditor(options);

  try {
    await auditor.runAudit();
  } catch (error) {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { NotificationSecurityAuditor };