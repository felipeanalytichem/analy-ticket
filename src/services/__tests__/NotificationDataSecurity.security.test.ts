import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationDataSecurity } from '../NotificationDataSecurity';

// Mock crypto API for comprehensive security testing
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

describe('NotificationDataSecurity - Security Tests', () => {
  let dataSecurity: NotificationDataSecurity;

  beforeEach(() => {
    dataSecurity = NotificationDataSecurity.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('XSS Prevention', () => {
    it('should prevent script injection attacks', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)"</style>',
        '<div onclick="alert(1)">Click me</div>',
        '<a href="javascript:alert(1)">Click me</a>'
      ];

      maliciousInputs.forEach(input => {
        const sanitized = dataSecurity.sanitizeNotificationContent(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('onclick=');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
        expect(sanitized).not.toContain('<embed');
      });
    });

    it('should prevent CSS injection attacks', () => {
      const cssAttacks = [
        'expression(alert("xss"))',
        'url(javascript:alert(1))',
        '@import url(javascript:alert(1))',
        'behavior:url(xss.htc)',
        '-moz-binding:url(xss.xml#xss)'
      ];

      cssAttacks.forEach(attack => {
        const sanitized = dataSecurity.sanitizeNotificationContent(attack);
        expect(sanitized).not.toContain('expression(');
        expect(sanitized).not.toContain('url(');
        expect(sanitized).not.toContain('@import');
        expect(sanitized).not.toContain('behavior:');
        expect(sanitized).not.toContain('-moz-binding:');
      });
    });

    it('should prevent data URI attacks', () => {
      const dataUriAttacks = [
        'data:text/html,<script>alert(1)</script>',
        'data:image/svg+xml,<svg onload=alert(1)>',
        'data:text/javascript,alert(1)'
      ];

      dataUriAttacks.forEach(attack => {
        const sanitized = dataSecurity.sanitizeNotificationContent(attack);
        expect(sanitized).not.toContain('data:');
      });
    });

    it('should handle encoded attacks', () => {
      const encodedAttacks = [
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#60;script&#62;alert(1)&#60;/script&#62;',
        '%3Cscript%3Ealert(1)%3C/script%3E'
      ];

      encodedAttacks.forEach(attack => {
        const sanitized = dataSecurity.sanitizeNotificationContent(attack);
        // Should decode but still remove dangerous content
        expect(sanitized).not.toContain('alert(1)');
      });
    });
  });

  describe('Sensitive Data Detection', () => {
    it('should detect various credit card formats', () => {
      const creditCards = [
        '4532-1234-5678-9012',
        '4532 1234 5678 9012',
        '4532123456789012',
        '5555-5555-5555-4444',
        '5555 5555 5555 4444',
        '5555555555554444',
        '3782-822463-10005',
        '3782 822463 10005',
        '378282246310005'
      ];

      creditCards.forEach(card => {
        expect(dataSecurity.containsSensitiveData(`Card: ${card}`)).toBe(true);
      });
    });

    it('should detect various SSN formats', () => {
      const ssns = [
        '123-45-6789',
        '987-65-4321',
        '000-00-0000'
      ];

      ssns.forEach(ssn => {
        expect(dataSecurity.containsSensitiveData(`SSN: ${ssn}`)).toBe(true);
      });
    });

    it('should detect various email formats', () => {
      const emails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@sub.domain.org',
        'firstname.lastname@company.com'
      ];

      emails.forEach(email => {
        expect(dataSecurity.containsSensitiveData(`Contact: ${email}`)).toBe(true);
      });
    });

    it('should detect various phone number formats', () => {
      const phones = [
        '555-123-4567',
        '555.123.4567',
        '5551234567',
        '(555) 123-4567',
        '+1-555-123-4567'
      ];

      phones.forEach(phone => {
        expect(dataSecurity.containsSensitiveData(`Phone: ${phone}`)).toBe(true);
      });
    });

    it('should detect password and token patterns', () => {
      const secrets = [
        'password: mySecret123',
        'pwd=secretPassword',
        'pass: admin123',
        'secret: topSecret',
        'token: abc123def456',
        'key: myApiKey123',
        'api_key=sk_test_123456',
        'access_token: bearer_token_123',
        'bearer abc123def456'
      ];

      secrets.forEach(secret => {
        expect(dataSecurity.containsSensitiveData(secret)).toBe(true);
      });
    });

    it('should not flag safe content as sensitive', () => {
      const safeContent = [
        'This is a normal message',
        'Ticket #12345 has been updated',
        'Please review the document',
        'Meeting scheduled for tomorrow',
        'The system is working properly'
      ];

      safeContent.forEach(content => {
        expect(dataSecurity.containsSensitiveData(content)).toBe(false);
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', () => {
      const invalidNotifications = [
        { title: '', message: 'test', type: 'test', user_id: 'user1' },
        { title: 'test', message: '', type: 'test', user_id: 'user1' },
        { title: 'test', message: 'test', type: '', user_id: 'user1' },
        { title: 'test', message: 'test', type: 'test', user_id: '' },
        { title: null, message: 'test', type: 'test', user_id: 'user1' },
        { title: 'test', message: null, type: 'test', user_id: 'user1' }
      ];

      invalidNotifications.forEach(notification => {
        const result = dataSecurity.validateNotificationData(notification as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should validate field lengths', () => {
      const longTitle = 'A'.repeat(600);
      const longMessage = 'B'.repeat(2500);

      const notification = {
        title: longTitle,
        message: longMessage,
        type: 'test',
        user_id: 'user1'
      };

      const result = dataSecurity.validateNotificationData(notification);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is too long (max 500 characters)');
      expect(result.errors).toContain('Message is too long (max 2000 characters)');
    });

    it('should detect malicious patterns in validation', () => {
      const maliciousNotification = {
        title: '<script>alert("xss")</script>',
        message: 'javascript:alert("hack")',
        type: 'test',
        user_id: 'user1'
      };

      const result = dataSecurity.validateNotificationData(maliciousNotification);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title contains potentially malicious content');
      expect(result.errors).toContain('Message contains potentially malicious content');
    });
  });

  describe('Encryption Security', () => {
    it('should use strong encryption parameters', async () => {
      const testData = 'sensitive information';
      
      await dataSecurity.encryptSensitiveData(testData);

      // Verify that proper encryption methods are called
      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2); // IV and salt
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          iterations: 100000, // Strong iteration count
          hash: 'SHA-256'
        }),
        expect.any(Object),
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256 // Strong key length
        }),
        false,
        ['encrypt', 'decrypt']
      );
    });

    it('should generate unique IVs and salts for each encryption', async () => {
      const testData = 'test data';
      
      // Mock getRandomValues to return different values each time
      let callCount = 0;
      mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = callCount + i; // Different values each call
        }
        callCount += 100;
        return array;
      });

      const result1 = await dataSecurity.encryptSensitiveData(testData);
      const result2 = await dataSecurity.encryptSensitiveData(testData);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });

    it('should handle encryption failures securely', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(dataSecurity.encryptSensitiveData('test')).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption failures securely', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      const encryptionResult = {
        encrypted: 'test',
        iv: 'test',
        salt: 'test'
      };

      await expect(dataSecurity.decryptSensitiveData(encryptionResult)).rejects.toThrow('Decryption failed');
    });
  });

  describe('Content Sanitization Edge Cases', () => {
    it('should handle null and undefined inputs', () => {
      expect(() => dataSecurity.sanitizeNotificationContent(null as any)).not.toThrow();
      expect(() => dataSecurity.sanitizeNotificationContent(undefined as any)).not.toThrow();
    });

    it('should handle very long inputs', () => {
      const veryLongInput = 'A'.repeat(100000);
      const result = dataSecurity.sanitizeNotificationContent(veryLongInput, { maxLength: 1000 });
      
      expect(result.length).toBeLessThanOrEqual(1003); // 1000 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle mixed content types', () => {
      const mixedContent = `
        Normal text with <b>bold</b> and <script>alert('xss')</script>
        Email: user@example.com
        Credit card: 4532-1234-5678-9012
        Phone: 555-123-4567
      `;

      const sanitized = dataSecurity.sanitizeNotificationContent(mixedContent);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert(');
      expect(sanitized).toContain('Normal text');
    });

    it('should normalize various whitespace characters', () => {
      const messyWhitespace = 'Hello\t\t\tWorld\n\n\nTest\r\r\rEnd   ';
      const result = dataSecurity.sanitizeNotificationContent(messyWhitespace);
      
      expect(result).toBe('Hello World Test End');
    });

    it('should handle HTML entities correctly', () => {
      const htmlEntities = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; normal text';
      const result = dataSecurity.sanitizeNotificationContent(htmlEntities);
      
      expect(result).toContain('normal text');
      expect(result).not.toContain('alert("xss")');
    });
  });

  describe('Security Headers and Metadata', () => {
    it('should properly mark encrypted fields', async () => {
      const notification = {
        title: 'Credit card: 4532-1234-5678-9012',
        message: 'Contact user@example.com',
        type: 'test'
      };

      const processed = await dataSecurity.processNotificationForStorage(notification);

      expect(processed.encrypted_fields).toContain('title');
      expect(processed.encrypted_fields).toContain('message');
      expect(processed.encryption_data).toHaveProperty('title');
      expect(processed.encryption_data).toHaveProperty('message');
    });

    it('should handle partial encryption correctly', async () => {
      const notification = {
        title: 'Normal title',
        message: 'Sensitive email: user@example.com',
        type: 'test'
      };

      const processed = await dataSecurity.processNotificationForStorage(notification);

      expect(processed.title).toBe('Normal title');
      expect(processed.message).toBe('[ENCRYPTED]');
      expect(processed.encrypted_fields).toHaveLength(1);
      expect(processed.encrypted_fields).toContain('message');
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle rapid successive sanitization calls', () => {
      const testContent = '<script>alert("test")</script>Normal content';
      const startTime = Date.now();
      
      // Simulate rapid calls
      for (let i = 0; i < 100; i++) {
        dataSecurity.sanitizeNotificationContent(testContent);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent encryption operations', async () => {
      const testData = Array.from({ length: 10 }, (_, i) => `sensitive data ${i}`);
      
      const startTime = Date.now();
      const promises = testData.map(data => dataSecurity.encryptSensitiveData(data));
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should handle concurrent operations efficiently
      expect(duration).toBeLessThan(5000);
    });

    it('should limit content length to prevent memory exhaustion', () => {
      const hugeContent = 'A'.repeat(1000000); // 1MB of content
      const result = dataSecurity.sanitizeNotificationContent(hugeContent, { maxLength: 1000 });
      
      expect(result.length).toBeLessThanOrEqual(1003);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide safe fallbacks for all operations', async () => {
      // Test sanitization fallback
      const maliciousContent = '<script>alert("xss")</script>Important message';
      const sanitized = dataSecurity.sanitizeNotificationContent(maliciousContent);
      
      expect(sanitized).toContain('Important message');
      expect(sanitized).not.toContain('<script>');
    });

    it('should handle corrupted encryption data gracefully', async () => {
      const corruptedData = {
        encrypted: 'corrupted-data',
        iv: 'invalid-iv',
        salt: 'invalid-salt'
      };

      await expect(dataSecurity.decryptSensitiveData(corruptedData)).rejects.toThrow();
    });

    it('should validate encryption result structure', async () => {
      const testData = 'test data';
      const result = await dataSecurity.encryptSensitiveData(testData);

      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('salt');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.salt).toBe('string');
    });
  });

  describe('Compliance and Audit', () => {
    it('should maintain audit trail for sensitive operations', async () => {
      const sensitiveNotification = {
        title: 'Credit card: 4532-1234-5678-9012',
        message: 'Normal message',
        type: 'test'
      };

      const processed = await dataSecurity.processNotificationForStorage(sensitiveNotification);

      // Should have metadata for audit purposes
      expect(processed.encrypted_fields).toBeDefined();
      expect(processed.encryption_data).toBeDefined();
      expect(Array.isArray(processed.encrypted_fields)).toBe(true);
    });

    it('should support data retention policies', () => {
      const policies = [
        'ticket_created',
        'sla_breach',
        'comment_added',
        'unknown_type'
      ];

      policies.forEach(type => {
        const policy = dataSecurity.getRetentionPolicy(type);
        expect(policy).toHaveProperty('retentionDays');
        expect(policy).toHaveProperty('deleteAfterDays');
        expect(typeof policy.retentionDays).toBe('number');
        expect(typeof policy.deleteAfterDays).toBe('number');
        expect(policy.retentionDays).toBeGreaterThan(0);
        expect(policy.deleteAfterDays).toBeGreaterThan(0);
      });
    });
  });
});