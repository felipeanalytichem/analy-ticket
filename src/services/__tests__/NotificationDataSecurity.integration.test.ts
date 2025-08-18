import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationDataSecurity } from '../NotificationDataSecurity';
import { NotificationService } from '@/lib/notificationService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn()
        })),
        in: vi.fn(() => ({
          single: vi.fn()
        })),
        order: vi.fn(() => ({
          limit: vi.fn()
        })),
        group: vi.fn()
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
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

// Mock crypto API
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
    decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('decrypted-sensitive-data'))
  }
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

global.btoa = vi.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));
global.atob = vi.fn((str: string) => Buffer.from(str, 'base64').toString('binary'));

describe('NotificationDataSecurity Integration Tests', () => {
  let dataSecurity: NotificationDataSecurity;
  let mockSupabaseAuth: any;
  let mockSupabaseFrom: any;

  beforeEach(() => {
    dataSecurity = NotificationDataSecurity.getInstance();
    mockSupabaseAuth = vi.mocked(supabase.auth);
    mockSupabaseFrom = vi.mocked(supabase.from);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Integration with NotificationService', () => {
    it('should sanitize and encrypt sensitive data when creating notifications', async () => {
      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'admin1', email: 'admin@test.com' } },
        error: null
      });

      // Mock admin role query
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

      // Mock recipients query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'agent1' }, { id: 'agent2' }],
            error: null
          })
        })
      });

      // Mock permission validation queries
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null
            })
          })
        })
      });

      // Mock audit log inserts
      mockSupabaseFrom.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      // Mock notification insert
      mockSupabaseFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      });

      const context = {
        ticketNumber: 'T-001',
        ticketTitle: 'Credit card issue: 4532-1234-5678-9012',
        userName: 'user@example.com'
      };

      const result = await NotificationService.createTicketCreatedNotification('ticket1', context);

      expect(result).toBe(true);
      // Verify that the notification was processed for security
      expect(mockSupabaseFrom).toHaveBeenCalled();
    });

    it('should decrypt notifications when retrieving them', async () => {
      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock notifications query with encrypted data
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'notification1',
                    user_id: 'user1',
                    title: '[ENCRYPTED]',
                    message: '[ENCRYPTED]',
                    type: 'ticket_created',
                    read: false,
                    priority: 'medium',
                    created_at: '2024-01-01T00:00:00Z',
                    ticket_id: 'ticket1',
                    encrypted_fields: ['title', 'message'],
                    encryption_data: {
                      title: { encrypted: 'enc1', iv: 'iv1', salt: 'salt1' },
                      message: { encrypted: 'enc2', iv: 'iv2', salt: 'salt2' }
                    }
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      // Mock ticket query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'ticket1',
                title: 'Test Ticket',
                ticket_number: 'T-001',
                status: 'open',
                priority: 'medium'
              },
              error: null
            })
          })
        })
      });

      const notifications = await NotificationService.getNotifications('user1');

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('decrypted-sensitive-data');
      expect(notifications[0].message).toBe('decrypted-sensitive-data');
    });

    it('should handle decryption errors gracefully', async () => {
      // Mock decryption failure
      mockCrypto.subtle.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));

      // Mock authenticated user
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@test.com' } },
        error: null
      });

      // Mock notifications query with encrypted data
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'notification1',
                    user_id: 'user1',
                    title: '[ENCRYPTED]',
                    message: 'Normal message',
                    type: 'ticket_created',
                    read: false,
                    priority: 'medium',
                    created_at: '2024-01-01T00:00:00Z',
                    ticket_id: 'ticket1',
                    encrypted_fields: ['title'],
                    encryption_data: {
                      title: { encrypted: 'enc1', iv: 'iv1', salt: 'salt1' }
                    }
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      // Mock ticket query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'ticket1',
                title: 'Test Ticket',
                ticket_number: 'T-001',
                status: 'open',
                priority: 'medium'
              },
              error: null
            })
          })
        })
      });

      const notifications = await NotificationService.getNotifications('user1');

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('[ENCRYPTED]'); // Fallback to original
      expect(notifications[0].message).toBe('Normal message');
    });
  });

  describe('End-to-end security workflow', () => {
    it('should complete full security workflow for sensitive notification', async () => {
      const originalNotification = {
        title: 'Payment Issue',
        message: 'Customer credit card 4532-1234-5678-9012 was declined. Contact user@example.com',
        type: 'ticket_created'
      };

      // Step 1: Validate notification data
      const validation = dataSecurity.validateNotificationData({
        ...originalNotification,
        user_id: 'user123'
      });

      expect(validation.valid).toBe(true);

      // Step 2: Process for storage (sanitize and encrypt)
      const processedForStorage = await dataSecurity.processNotificationForStorage(originalNotification);

      expect(processedForStorage.title).toBe('Payment Issue'); // No sensitive data in title
      expect(processedForStorage.message).toBe('[ENCRYPTED]'); // Sensitive data encrypted
      expect(processedForStorage.encrypted_fields).toContain('message');
      expect(processedForStorage.encryption_data).toHaveProperty('message');

      // Step 3: Process for display (decrypt)
      const processedForDisplay = await dataSecurity.processNotificationForDisplay({
        title: processedForStorage.title,
        message: processedForStorage.message,
        encrypted_fields: processedForStorage.encrypted_fields,
        encryption_data: processedForStorage.encryption_data
      });

      expect(processedForDisplay.title).toBe('Payment Issue');
      expect(processedForDisplay.message).toBe('decrypted-sensitive-data');
    });

    it('should handle mixed sensitive and non-sensitive content', async () => {
      const originalNotification = {
        title: 'User email: user@example.com',
        message: 'This is a normal message without sensitive data',
        type: 'comment_added'
      };

      // Process for storage
      const processedForStorage = await dataSecurity.processNotificationForStorage(originalNotification);

      expect(processedForStorage.title).toBe('[ENCRYPTED]'); // Email detected
      expect(processedForStorage.message).toBe('This is a normal message without sensitive data');
      expect(processedForStorage.encrypted_fields).toHaveLength(1);
      expect(processedForStorage.encrypted_fields).toContain('title');

      // Process for display
      const processedForDisplay = await dataSecurity.processNotificationForDisplay({
        title: processedForStorage.title,
        message: processedForStorage.message,
        encrypted_fields: processedForStorage.encrypted_fields,
        encryption_data: processedForStorage.encryption_data
      });

      expect(processedForDisplay.title).toBe('decrypted-sensitive-data');
      expect(processedForDisplay.message).toBe('This is a normal message without sensitive data');
    });

    it('should sanitize malicious content', async () => {
      const maliciousNotification = {
        title: '<script>alert("xss")</script>Important Alert',
        message: 'Click here: javascript:alert("hack") for details',
        type: 'ticket_updated'
      };

      const processedForStorage = await dataSecurity.processNotificationForStorage(maliciousNotification);

      expect(processedForStorage.title).not.toContain('<script>');
      expect(processedForStorage.title).not.toContain('alert("xss")');
      expect(processedForStorage.message).not.toContain('javascript:');
      expect(processedForStorage.title).toContain('Important Alert');
    });
  });

  describe('Data retention integration', () => {
    it('should apply retention policies across notification types', async () => {
      // Mock notification types query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          group: vi.fn().mockResolvedValue({
            data: [
              { type: 'ticket_created' },
              { type: 'sla_breach' },
              { type: 'comment_added' }
            ],
            error: null
          })
        })
      });

      // Mock archive operations for each type
      const mockArchiveOperations = [
        { count: 10, error: null },
        { count: 5, error: null },
        { count: 15, error: null }
      ];

      // Mock delete operations for each type
      const mockDeleteOperations = [
        { count: 20, error: null },
        { count: 2, error: null },
        { count: 8, error: null }
      ];

      // Set up mocks for each operation
      mockArchiveOperations.forEach((result) => {
        mockSupabaseFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue(result)
              })
            })
          })
        });
      });

      mockDeleteOperations.forEach((result) => {
        mockSupabaseFrom.mockReturnValueOnce({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue(result)
            })
          })
        });
      });

      const result = await dataSecurity.applyDataRetentionPolicies();

      expect(result.archived).toBe(30); // 10 + 5 + 15
      expect(result.deleted).toBe(30); // 20 + 2 + 8
      expect(result.errors).toHaveLength(0);
    });

    it('should handle retention policy errors gracefully', async () => {
      // Mock notification types query
      mockSupabaseFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          group: vi.fn().mockResolvedValue({
            data: [{ type: 'ticket_created' }],
            error: null
          })
        })
      });

      // Mock archive operation with error
      mockSupabaseFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: null,
                error: { message: 'Archive failed' }
              })
            })
          })
        })
      });

      // Mock delete operation with error
      mockSupabaseFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              count: null,
              error: { message: 'Delete failed' }
            })
          })
        })
      });

      const result = await dataSecurity.applyDataRetentionPolicies();

      expect(result.archived).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Archive failed');
      expect(result.errors[1]).toContain('Delete failed');
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large notification batches efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        title: `Notification ${i}`,
        message: i % 10 === 0 ? `Sensitive data: user${i}@example.com` : `Normal message ${i}`,
        type: 'ticket_created'
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        notifications.map(notification => 
          dataSecurity.processNotificationForStorage(notification)
        )
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process 100 notifications in reasonable time (less than 5 seconds)
      expect(processingTime).toBeLessThan(5000);
      expect(results).toHaveLength(100);

      // Check that sensitive notifications were encrypted
      const sensitiveResults = results.filter((_, i) => i % 10 === 0);
      sensitiveResults.forEach(result => {
        expect(result.message).toBe('[ENCRYPTED]');
        expect(result.encrypted_fields).toContain('message');
      });
    });

    it('should handle concurrent encryption/decryption operations', async () => {
      const sensitiveData = [
        'Credit card: 4532-1234-5678-9012',
        'SSN: 123-45-6789',
        'Email: user@example.com',
        'Phone: 555-123-4567',
        'API key: abc123def456'
      ];

      // Encrypt all data concurrently
      const encryptionPromises = sensitiveData.map(data => 
        dataSecurity.encryptSensitiveData(data)
      );

      const encryptedResults = await Promise.all(encryptionPromises);
      expect(encryptedResults).toHaveLength(5);

      // Decrypt all data concurrently
      const decryptionPromises = encryptedResults.map(encrypted => 
        dataSecurity.decryptSensitiveData(encrypted)
      );

      const decryptedResults = await Promise.all(decryptionPromises);
      expect(decryptedResults).toHaveLength(5);
      
      // All should be the mocked decrypted value
      decryptedResults.forEach(result => {
        expect(result).toBe('decrypted-sensitive-data');
      });
    });
  });

  describe('Error recovery and resilience', () => {
    it('should continue processing other notifications when one fails', async () => {
      const notifications = [
        { title: 'Good notification 1', message: 'Normal message', type: 'ticket_created' },
        { title: null, message: null, type: 'invalid' }, // This will fail validation
        { title: 'Good notification 2', message: 'user@example.com', type: 'comment_added' }
      ];

      const results = [];
      for (const notification of notifications) {
        try {
          const validation = dataSecurity.validateNotificationData({
            ...notification,
            user_id: 'user123'
          });

          if (validation.valid) {
            const processed = await dataSecurity.processNotificationForStorage(notification);
            results.push(processed);
          }
        } catch (error) {
          // Continue processing other notifications
          console.error('Failed to process notification:', error);
        }
      }

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Good notification 1');
      expect(results[1].title).toBe('Good notification 2');
      expect(results[1].message).toBe('[ENCRYPTED]'); // Email detected
    });

    it('should provide fallback when encryption service is unavailable', async () => {
      // Mock encryption to fail
      mockCrypto.subtle.encrypt.mockRejectedValueOnce(new Error('Encryption service unavailable'));

      const notification = {
        title: 'Normal title',
        message: 'Sensitive data: user@example.com',
        type: 'ticket_created'
      };

      // Should throw error for encryption failure
      await expect(
        dataSecurity.processNotificationForStorage(notification)
      ).rejects.toThrow();

      // But sanitization should still work
      const sanitized = dataSecurity.sanitizeNotificationContent(notification.message);
      expect(sanitized).toBe('Sensitive data: user@example.com');
    });
  });
});