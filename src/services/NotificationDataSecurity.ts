import DOMPurify from 'isomorphic-dompurify';
import { supabase } from '@/lib/supabase';

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  stripScripts?: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  salt: string;
}

export interface NotificationDataRetentionPolicy {
  retentionDays: number;
  archiveAfterDays?: number;
  deleteAfterDays: number;
  applyToTypes?: string[];
}

/**
 * Service for handling notification data security, sanitization, and encryption
 */
export class NotificationDataSecurity {
  private static instance: NotificationDataSecurity;
  private readonly ENCRYPTION_KEY_LENGTH = 32;
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 16;

  // Default retention policies by notification type
  private readonly DEFAULT_RETENTION_POLICIES: Record<string, NotificationDataRetentionPolicy> = {
    'ticket_created': { retentionDays: 365, deleteAfterDays: 1095 }, // 3 years
    'ticket_updated': { retentionDays: 365, deleteAfterDays: 1095 },
    'ticket_assigned': { retentionDays: 180, deleteAfterDays: 730 }, // 2 years
    'comment_added': { retentionDays: 180, deleteAfterDays: 730 },
    'status_changed': { retentionDays: 180, deleteAfterDays: 730 },
    'priority_changed': { retentionDays: 90, deleteAfterDays: 365 }, // 1 year
    'assignment_changed': { retentionDays: 90, deleteAfterDays: 365 },
    'sla_warning': { retentionDays: 730, deleteAfterDays: 2555 }, // 7 years (compliance)
    'sla_breach': { retentionDays: 730, deleteAfterDays: 2555 },
    'default': { retentionDays: 90, deleteAfterDays: 365 }
  };

  static getInstance(): NotificationDataSecurity {
    if (!NotificationDataSecurity.instance) {
      NotificationDataSecurity.instance = new NotificationDataSecurity();
    }
    return NotificationDataSecurity.instance;
  }

  /**
   * Sanitize notification content to prevent XSS and other security issues
   */
  sanitizeNotificationContent(content: string, options: SanitizationOptions = {}): string {
    const {
      allowHtml = false,
      maxLength = 1000,
      stripScripts = true,
      allowedTags = ['b', 'i', 'em', 'strong', 'br'],
      allowedAttributes = []
    } = options;

    try {
      // Handle null/undefined inputs
      if (!content || typeof content !== 'string') {
        return '';
      }

      // First, truncate if too long
      let sanitized = content.length > maxLength ? content.substring(0, maxLength) + '...' : content;

      if (!allowHtml) {
        // Strip all HTML tags and decode entities
        sanitized = this.stripHtmlTags(sanitized);
      } else {
        // Use DOMPurify to sanitize HTML while preserving allowed tags
        sanitized = DOMPurify.sanitize(sanitized, {
          ALLOWED_TAGS: allowedTags,
          ALLOWED_ATTR: allowedAttributes,
          FORBID_SCRIPT: stripScripts,
          FORBID_TAGS: stripScripts ? ['script', 'object', 'embed', 'iframe'] : [],
          KEEP_CONTENT: true
        });
      }

      // Remove potentially dangerous patterns
      sanitized = this.removeDangerousPatterns(sanitized);

      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();

      return sanitized;
    } catch (error) {
      console.error('Error sanitizing notification content:', error);
      // Return a safe fallback
      return this.stripHtmlTags(content.substring(0, 100)) + '...';
    }
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtmlTags(content: string): string {
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')   // Decode common entities
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  /**
   * Remove potentially dangerous patterns
   */
  private removeDangerousPatterns(content: string): string {
    const dangerousPatterns = [
      /javascript:/gi,
      /vbscript:/gi,
      /data:/gi,
      /on\w+\s*=/gi, // Event handlers like onclick=
      /<script/gi,
      /<\/script>/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /expression\s*\(/gi, // CSS expressions
      /url\s*\(/gi, // CSS url() functions
      /@import/gi, // CSS imports
      /alert\s*\(/gi, // Alert functions
      /eval\s*\(/gi, // Eval functions
      /document\./gi, // Document access
      /window\./gi // Window access
    ];

    let sanitized = content;
    dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  /**
   * Encrypt sensitive notification data
   */
  async encryptSensitiveData(data: string): Promise<EncryptionResult> {
    try {
      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive key from a master key (in production, this should come from environment variables)
      const masterKey = await this.getMasterKey();
      const key = await this.deriveKey(masterKey, salt);

      // Encrypt the data
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        dataBuffer
      );

      // Convert to base64 for storage
      const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      return {
        encrypted,
        iv: ivBase64,
        salt: saltBase64
      };
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive notification data
   */
  async decryptSensitiveData(encryptionResult: EncryptionResult): Promise<string> {
    try {
      const { encrypted, iv, salt } = encryptionResult;

      // Convert from base64
      const encryptedBuffer = new Uint8Array(
        atob(encrypted).split('').map(char => char.charCodeAt(0))
      );
      const ivBuffer = new Uint8Array(
        atob(iv).split('').map(char => char.charCodeAt(0))
      );
      const saltBuffer = new Uint8Array(
        atob(salt).split('').map(char => char.charCodeAt(0))
      );

      // Derive the same key
      const masterKey = await this.getMasterKey();
      const key = await this.deriveKey(masterKey, saltBuffer);

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer
        },
        key,
        encryptedBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Get or generate master encryption key
   */
  private async getMasterKey(): Promise<CryptoKey> {
    // In production, this should come from a secure key management service
    // For now, we'll use a derived key from a password
    const password = process.env.NOTIFICATION_ENCRYPTION_KEY || 'default-key-change-in-production';
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return keyMaterial;
  }

  /**
   * Derive encryption key from master key and salt
   */
  private async deriveKey(masterKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      masterKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Check if notification content contains sensitive data
   */
  containsSensitiveData(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const sensitivePatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN format
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
      /\b(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, // Phone numbers with parentheses
      /\b(?:password|pwd|pass|secret|token|key)\s*[:=]\s*\S+/gi, // Passwords/tokens
      /\b(?:api[_-]?key|access[_-]?token|bearer)\s*[:=]\s*\S+/gi // API keys
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Sanitize and encrypt notification if needed
   */
  async processNotificationForStorage(notification: {
    title: string;
    message: string;
    type: string;
  }): Promise<{
    title: string;
    message: string;
    encrypted_fields?: string[];
    encryption_data?: Record<string, EncryptionResult>;
  }> {
    const processed = {
      title: this.sanitizeNotificationContent(notification.title, { maxLength: 200 }),
      message: this.sanitizeNotificationContent(notification.message, { maxLength: 1000 }),
      encrypted_fields: [] as string[],
      encryption_data: {} as Record<string, EncryptionResult>
    };

    // Check if title contains sensitive data
    if (this.containsSensitiveData(processed.title)) {
      const encryptedTitle = await this.encryptSensitiveData(processed.title);
      processed.encryption_data.title = encryptedTitle;
      processed.encrypted_fields.push('title');
      processed.title = '[ENCRYPTED]';
    }

    // Check if message contains sensitive data
    if (this.containsSensitiveData(processed.message)) {
      const encryptedMessage = await this.encryptSensitiveData(processed.message);
      processed.encryption_data.message = encryptedMessage;
      processed.encrypted_fields.push('message');
      processed.message = '[ENCRYPTED]';
    }

    return processed;
  }

  /**
   * Decrypt notification for display
   */
  async processNotificationForDisplay(notification: {
    title: string;
    message: string;
    encrypted_fields?: string[];
    encryption_data?: Record<string, EncryptionResult>;
  }): Promise<{
    title: string;
    message: string;
  }> {
    let { title, message } = notification;

    if (notification.encrypted_fields && notification.encryption_data) {
      try {
        // Decrypt title if encrypted
        if (notification.encrypted_fields.includes('title') && notification.encryption_data.title) {
          title = await this.decryptSensitiveData(notification.encryption_data.title);
        }

        // Decrypt message if encrypted
        if (notification.encrypted_fields.includes('message') && notification.encryption_data.message) {
          message = await this.decryptSensitiveData(notification.encryption_data.message);
        }
      } catch (error) {
        console.error('Error decrypting notification:', error);
        // Return sanitized fallback
        title = title === '[ENCRYPTED]' ? '[Unable to decrypt]' : title;
        message = message === '[ENCRYPTED]' ? '[Unable to decrypt]' : message;
      }
    }

    return { title, message };
  }

  /**
   * Apply data retention policies
   */
  async applyDataRetentionPolicies(): Promise<{
    archived: number;
    deleted: number;
    errors: string[];
  }> {
    const results = {
      archived: 0,
      deleted: 0,
      errors: [] as string[]
    };

    try {
      // Get all notification types and their counts
      const { data: notificationTypes, error: typesError } = await supabase
        .from('notifications')
        .select('type')
        .group('type');

      if (typesError) {
        results.errors.push(`Error fetching notification types: ${typesError.message}`);
        return results;
      }

      // Process each notification type
      for (const typeData of notificationTypes || []) {
        const notificationType = typeData.type;
        const policy = this.DEFAULT_RETENTION_POLICIES[notificationType] || 
                      this.DEFAULT_RETENTION_POLICIES.default;

        try {
          // Archive old notifications
          if (policy.archiveAfterDays) {
            const archiveDate = new Date();
            archiveDate.setDate(archiveDate.getDate() - policy.archiveAfterDays);

            const { count: archivedCount, error: archiveError } = await supabase
              .from('notifications')
              .update({ archived: true })
              .eq('type', notificationType)
              .lt('created_at', archiveDate.toISOString())
              .eq('archived', false);

            if (archiveError) {
              results.errors.push(`Error archiving ${notificationType}: ${archiveError.message}`);
            } else {
              results.archived += archivedCount || 0;
            }
          }

          // Delete very old notifications
          const deleteDate = new Date();
          deleteDate.setDate(deleteDate.getDate() - policy.deleteAfterDays);

          const { count: deletedCount, error: deleteError } = await supabase
            .from('notifications')
            .delete()
            .eq('type', notificationType)
            .lt('created_at', deleteDate.toISOString());

          if (deleteError) {
            results.errors.push(`Error deleting ${notificationType}: ${deleteError.message}`);
          } else {
            results.deleted += deletedCount || 0;
          }
        } catch (error) {
          results.errors.push(`Error processing ${notificationType}: ${error}`);
        }
      }

      console.log(`Data retention completed: ${results.archived} archived, ${results.deleted} deleted`);
      return results;
    } catch (error) {
      console.error('Error in data retention process:', error);
      results.errors.push(`General error: ${error}`);
      return results;
    }
  }

  /**
   * Get retention policy for a notification type
   */
  getRetentionPolicy(notificationType: string): NotificationDataRetentionPolicy {
    return this.DEFAULT_RETENTION_POLICIES[notificationType] || 
           this.DEFAULT_RETENTION_POLICIES.default;
  }

  /**
   * Update retention policy for a notification type (admin only)
   */
  async updateRetentionPolicy(
    notificationType: string, 
    policy: NotificationDataRetentionPolicy,
    adminUserId: string
  ): Promise<boolean> {
    try {
      // Verify admin permissions
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminUserId)
        .single();

      if (userError || !user || user.role !== 'admin') {
        console.error('Unauthorized attempt to update retention policy');
        return false;
      }

      // Store the policy (in a real implementation, this would be in a database table)
      this.DEFAULT_RETENTION_POLICIES[notificationType] = policy;

      // Log the change
      await supabase
        .from('notification_access_logs')
        .insert({
          user_id: adminUserId,
          action: 'update',
          allowed: true,
          reason: `Updated retention policy for ${notificationType}`,
          created_at: new Date().toISOString()
        });

      return true;
    } catch (error) {
      console.error('Error updating retention policy:', error);
      return false;
    }
  }

  /**
   * Validate notification data before processing
   */
  validateNotificationData(notification: {
    title?: string;
    message?: string;
    type?: string;
    user_id?: string;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!notification.title || notification.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!notification.message || notification.message.trim().length === 0) {
      errors.push('Message is required');
    }

    if (!notification.type) {
      errors.push('Notification type is required');
    }

    if (!notification.user_id) {
      errors.push('User ID is required');
    }

    // Check field lengths
    if (notification.title && notification.title.length > 500) {
      errors.push('Title is too long (max 500 characters)');
    }

    if (notification.message && notification.message.length > 2000) {
      errors.push('Message is too long (max 2000 characters)');
    }

    // Check for malicious content
    if (notification.title && this.containsMaliciousContent(notification.title)) {
      errors.push('Title contains potentially malicious content');
    }

    if (notification.message && this.containsMaliciousContent(notification.message)) {
      errors.push('Message contains potentially malicious content');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for malicious content patterns
   */
  private containsMaliciousContent(content: string): boolean {
    const maliciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /expression\s*\(/gi,
      /import\s+/gi,
      /require\s*\(/gi
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }
}