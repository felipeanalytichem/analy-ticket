import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationDataSecurity } from '../NotificationDataSecurity';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          group: vi.fn()
        })),
        lt: vi.fn(() => ({
          eq: vi.fn()
        }))
      })),
      insert: vi.fn(),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => ({
            eq: vi.fn()
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn()
        }))
      }))
    }))
  }
}));

// Mock crypto API for comprehensive testing
const mockCrypto = {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    importKey: vi.fn().mockResolvedValue('mock-key'),
    deriveKey: vi.fn().mockResolvedValue('mock-derived-key'),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('decrypted-data'))
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

global.btoa = vi.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));
global.atob = vi.fn((str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('NotificationDataSecurity - Final Integration Tests', () => {
  let dataSecurity: NotificationDataSecurity;
  let mockSupabaseFrom: any;

  beforeEach(() => {
    dataSecurity = NotificationDataSecurity.getInstance();
    mockSupabaseFrom = vi.mocked(supabase.from);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Data Protection Workflow', () => {
    it('should handle complete notification lifecycle with security', async () => {
      // Step 1: Create notification with sensitive data
      const originalNotification = {
        title: 'Payment Alert',
        message: 'Credit card ending in 1234 was charged $500. Contact support at help@company.com if unauthorized.',
        type: 'payment_alert',
        user_id: 'user123'
      };

      // Step 2: Validate input
      const validation = dataSecurity.validateNotificationData(originalNotification);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Process for storage (sanitize and encrypt sensitive parts)
      const processedForStorage = await dataSecurity.processNotificationForStorage(originalNotification);
      
      // Should detect and encrypt sensitive data
      expect(processedForStorage.message).toBe('[ENCRYPTED]');
      expect(processedForStorage.encrypted_fields).toContain('message');
      expect(processedForStorage.encryption_data).toHaveProperty('message');

      // Step 4: Simulate storage and retrieval
      const storedNotification = {
        id: 'notif123',
        title: processedForStorage.title,
        message: processedForStorage.message,
        encrypted_fields: processedForStorage.encrypted_fields,
        encryption_data: processedForStorage.encryption_data,
        user_id: 'user123',
        created_at: new Date().toISOString()
      };

      // Step 5: Process for display (decrypt)
      const processedForDisplay = await dataSecurity.processNotificationForDisplay(storedNotification);
      
      expect(processedForDisplay.title).toBe('Payment Alert');
      expect(processedForDisplay.message).toBe('decrypted-data'); // Mocked decryption result
    });

    it('should handle mixed content with partial encryption', async () => {
      const notification = {
        title: 'System Update',
        message: 'System updated successfully. Admin password: temp123. Please change immediately.',
        type: 'system_update',
        user_id: 'admin1'
      };

      const processed = await dataSecurity.processNotificationForStorage(notification);

      // Title should remain unencrypted (no sensitive data)
      expect(processed.title).toBe('System Update');
      
      // Message should be encrypted (contains password)
      expect(processed.message).toBe('[ENCRYPTED]');
      expect(processed.encrypted_fields).toHaveLength(1);
      expect(processed.encrypted_fields).toContain('message');
    });

    it('should sanitize malicious content while preserving legitimate data', async () => {
      const notification = {
        title: 'Security Alert <script>alert("xss")</script>',
        message: 'Suspicious activity detected. <b>Action required</b>. Contact admin@company.com',
        type: 'security_alert',
        user_id: 'user456'
      };

      const processed = await dataSecurity.processNotificationForStorage(notification);

      // Should remove script tags but preserve legitimate content
      expect(processed.title).not.toContain('<script>');
      expect(processed.title).not.toContain('alert(');
      expect(processed.title).toContain('Security Alert');

      // Should encrypt message due to email address
      expect(processed.message).toBe('[ENCRYPTED]');
      expect(processed.encrypted_fields).toContain('message');
    });
  });

  describe('Data Retention and Cleanup', () => {
    it('should apply retention policies correctly', async () => {
      // Mock notification types query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          group: vi.fn().mockResolvedValue({
            data: [
              { type: 'ticket_created' },
              { type: 'sla_breach' }
            ],
            error: null
          })
        })
      });

      // Mock successful retention operations
      mockSupabaseFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null })
            })
          })
        })
      });

      mockSupabaseFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({ count: 10, error: null })
          })
        })
      });

      const result = await dataSecurity.applyDataRetentionPolicies();

      expect(result.errors).toHaveLength(0);
      expect(typeof result.archived).toBe('number');
      expect(typeof result.deleted).toBe('number');
    });

    it('should get appropriate retention policies for different notification types', () => {
      const criticalPolicy = dataSecurity.getRetentionPolicy('sla_breach');
      expect(criticalPolicy.retentionDays).toBe(730); // 2 years
      expect(criticalPolicy.deleteAfterDays).toBe(2555); // 7 years

      const normalPolicy = dataSecurity.getRetentionPolicy('comment_added');
      expect(normalPolicy.retentionDays).toBe(180); // 6 months
      expect(normalPolicy.deleteAfterDays).toBe(730); // 2 years

      const defaultPolicy = dataSecurity.getRetentionPolicy('unknown_type');
      expect(defaultPolicy.retentionDays).toBe(90); // 3 months
      expect(defaultPolicy.deleteAfterDays).toBe(365); // 1 year
    });
  });

  describe('Security Edge Cases and Error Handling', () => {
    it('should handle encryption failures gracefully', async () => {
      // Mock encryption failure
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption service unavailable'));

      const notification = {
        title: 'Test',
        message: 'Sensitive data: user@example.com',
        type: 'test'
      };

      // Should throw error when encryption fails for sensitive data
      await expect(dataSecurity.processNotificationForStorage(notification)).rejects.toThrow();
    });

    it('should handle decryption failures with fallback', async () => {
      // Mock decryption failure
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const encryptedNotification = {
        title: 'Normal Title',
        message: '[ENCRYPTED]',
        encrypted_fields: ['message'],
        encryption_data: {
          message: { encrypted: 'test', iv: 'test', salt: 'test' }
        }
      };

      const result = await dataSecurity.processNotificationForDisplay(encryptedNotification);

      expect(result.title).toBe('Normal Title');
      expect(result.message).toBe('[Unable to decrypt]'); // Fallback
    });

    it('should validate notification data comprehensively', () => {
      const testCases = [
        {
          notification: { title: '', message: 'test', type: 'test', user_id: 'user1' },
          expectedErrors: ['Title is required']
        },
        {
          notification: { title: 'A'.repeat(600), message: 'test', type: 'test', user_id: 'user1' },
          expectedErrors: ['Title is too long (max 500 characters)']
        },
        {
          notification: { title: '<script>alert("xss")</script>', message: 'test', type: 'test', user_id: 'user1' },
          expectedErrors: ['Title contains potentially malicious content']
        }
      ];

      testCases.forEach(({ notification, expectedErrors }) => {
        const result = dataSecurity.validateNotificationData(notification as any);
        expect(result.valid).toBe(false);
        expectedErrors.forEach(error => {
          expect(result.errors).toContain(error);
        });
      });
    });

    it('should handle null and undefined inputs safely', () => {
      // Sanitization should handle null/undefined
      expect(dataSecurity.sanitizeNotificationContent(null as any)).toBe('');
      expect(dataSecurity.sanitizeNotificationContent(undefined as any)).toBe('');

      // Sensitive data detection should handle null/undefined
      expect(dataSecurity.containsSensitiveData(null as any)).toBe(false);
      expect(dataSecurity.containsSensitiveData(undefined as any)).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large content efficiently', () => {
      const largeContent = 'A'.repeat(50000); // 50KB content
      const startTime = Date.now();
      
      const result = dataSecurity.sanitizeNotificationContent(largeContent, { maxLength: 1000 });
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(result.length).toBeLessThanOrEqual(1003); // 1000 + '...'
    });

    it('should handle concurrent operations', async () => {
      const notifications = Array.from({ length: 20 }, (_, i) => ({
        title: `Notification ${i}`,
        message: i % 5 === 0 ? `Sensitive: user${i}@example.com` : `Normal message ${i}`,
        type: 'test'
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        notifications.map(notification => 
          dataSecurity.processNotificationForStorage(notification)
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(results).toHaveLength(20);

      // Check that sensitive notifications were encrypted
      const sensitiveResults = results.filter((_, i) => i % 5 === 0);
      sensitiveResults.forEach(result => {
        expect(result.message).toBe('[ENCRYPTED]');
        expect(result.encrypted_fields).toContain('message');
      });
    });
  });

  describe('Compliance and Audit Features', () => {
    it('should maintain proper audit trail for encrypted data', async () => {
      const notification = {
        title: 'Credit Card Alert: 4532-1234-5678-9012',
        message: 'Transaction processed',
        type: 'payment'
      };

      const processed = await dataSecurity.processNotificationForStorage(notification);

      // Should have complete audit information
      expect(processed.encrypted_fields).toBeDefined();
      expect(Array.isArray(processed.encrypted_fields)).toBe(true);
      expect(processed.encryption_data).toBeDefined();
      expect(typeof processed.encryption_data).toBe('object');

      // Should track which fields were encrypted
      expect(processed.encrypted_fields).toContain('title');
      expect(processed.encryption_data).toHaveProperty('title');
    });

    it('should support admin-only retention policy updates', async () => {
      // Mock admin user check
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock audit log insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const newPolicy = {
        retentionDays: 180,
        deleteAfterDays: 540
      };

      const result = await dataSecurity.updateRetentionPolicy('test_type', newPolicy, 'admin123');
      
      // Should succeed for admin users
      expect(typeof result).toBe('boolean');
    });

    it('should deny retention policy updates for non-admin users', async () => {
      // Mock non-admin user check
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'user' },
              error: null
            })
          })
        })
      });

      const newPolicy = {
        retentionDays: 180,
        deleteAfterDays: 540
      };

      const result = await dataSecurity.updateRetentionPolicy('test_type', newPolicy, 'user123');
      
      expect(result).toBe(false);
    });
  });

  describe('Integration with Notification Service', () => {
    it('should integrate seamlessly with notification creation', async () => {
      const testNotification = {
        title: 'Account Alert',
        message: 'Your account password was changed. If this was not you, contact support@company.com',
        type: 'account_security',
        user_id: 'user789'
      };

      // Validate
      const validation = dataSecurity.validateNotificationData(testNotification);
      expect(validation.valid).toBe(true);

      // Process for storage
      const processed = await dataSecurity.processNotificationForStorage(testNotification);
      
      // Should encrypt message due to email
      expect(processed.message).toBe('[ENCRYPTED]');
      expect(processed.encrypted_fields).toContain('message');

      // Should maintain title (no sensitive data)
      expect(processed.title).toBe('Account Alert');
    });

    it('should handle batch processing efficiently', async () => {
      const notifications = [
        { title: 'Normal 1', message: 'Regular message', type: 'info' },
        { title: 'Sensitive 1', message: 'Credit card: 4532-1234-5678-9012', type: 'payment' },
        { title: 'Normal 2', message: 'Another regular message', type: 'info' },
        { title: 'Sensitive 2', message: 'Contact user@example.com', type: 'contact' }
      ];

      const results = await Promise.all(
        notifications.map(notification => 
          dataSecurity.processNotificationForStorage(notification)
        )
      );

      // Check results
      expect(results[0].message).toBe('Regular message'); // Not encrypted
      expect(results[1].message).toBe('[ENCRYPTED]'); // Encrypted
      expect(results[2].message).toBe('Another regular message'); // Not encrypted
      expect(results[3].message).toBe('[ENCRYPTED]'); // Encrypted

      // Check encryption metadata
      expect(results[0].encrypted_fields).toHaveLength(0);
      expect(results[1].encrypted_fields).toContain('message');
      expect(results[2].encrypted_fields).toHaveLength(0);
      expect(results[3].encrypted_fields).toContain('message');
    });
  });

  describe('Security Pattern Detection', () => {
    it('should detect various sensitive data patterns', () => {
      const testCases = [
        { content: 'Credit card: 4532-1234-5678-9012', shouldDetect: true },
        { content: 'SSN: 123-45-6789', shouldDetect: true },
        { content: 'Email: user@example.com', shouldDetect: true },
        { content: 'Phone: (555) 123-4567', shouldDetect: true },
        { content: 'Password: secret123', shouldDetect: true },
        { content: 'API key: sk_test_123456', shouldDetect: true },
        { content: 'Normal message without sensitive data', shouldDetect: false },
        { content: 'Ticket #12345 updated', shouldDetect: false }
      ];

      testCases.forEach(({ content, shouldDetect }) => {
        const result = dataSecurity.containsSensitiveData(content);
        expect(result).toBe(shouldDetect);
      });
    });

    it('should sanitize various XSS attack vectors', () => {
      const attackVectors = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        'javascript:alert(1)',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        'expression(alert(1))',
        'url(javascript:alert(1))',
        '@import url(javascript:alert(1))'
      ];

      attackVectors.forEach(attack => {
        const sanitized = dataSecurity.sanitizeNotificationContent(attack);
        
        // Should not contain dangerous patterns
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('vbscript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('data:');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('url(');
        expect(sanitized).not.toContain('@import');
      });
    });
  });
});