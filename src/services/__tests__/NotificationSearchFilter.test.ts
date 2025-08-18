import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationSearchFilter, SearchCriteria, SearchOptions, FilterPreset } from '../NotificationSearchFilter';
import { NotificationWithTicket } from '@/lib/notificationService';

// Mock notification data for testing
const createMockNotification = (
  id: string,
  type: string = 'ticket_created',
  priority: 'low' | 'medium' | 'high' = 'medium',
  read: boolean = false,
  createdAt: string = new Date().toISOString(),
  message: string = `Test notification ${id}`,
  title: string = `Notification ${id}`,
  ticketId?: string,
  userId: string = 'user-1'
): NotificationWithTicket => ({
  id,
  user_id: userId,
  message,
  type: type as any,
  ticket_id: ticketId,
  read,
  priority,
  created_at: createdAt,
  title,
  ticket: ticketId ? {
    id: ticketId,
    title: `Test Ticket ${ticketId}`,
    ticket_number: `#${ticketId.slice(-8)}`,
    status: 'open',
    priority: 'medium'
  } : null
});

describe('NotificationSearchFilter', () => {
  let mockNotifications: NotificationWithTicket[];

  beforeEach(() => {
    // Create a diverse set of mock notifications for testing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    mockNotifications = [
      // Recent high priority notifications
      createMockNotification('1', 'sla_breach', 'high', false, now.toISOString(), 
        'SLA breach detected for ticket', 'SLA Breach Alert', 'ticket-1'),
      createMockNotification('2', 'sla_warning', 'high', false, oneHourAgo.toISOString(), 
        'SLA warning for ticket response time', 'SLA Warning', 'ticket-2'),
      
      // Ticket-related notifications
      createMockNotification('3', 'ticket_created', 'medium', false, now.toISOString(), 
        'New ticket has been created', 'New Ticket Created', 'ticket-3'),
      createMockNotification('4', 'ticket_assigned', 'medium', true, oneHourAgo.toISOString(), 
        'Ticket has been assigned to you', 'Ticket Assigned', 'ticket-4'),
      createMockNotification('5', 'status_changed', 'low', false, oneDayAgo.toISOString(), 
        'Ticket status changed to resolved', 'Status Changed', 'ticket-5'),
      
      // Comment notifications
      createMockNotification('6', 'comment_added', 'medium', false, now.toISOString(), 
        'New comment added to your ticket', 'New Comment', 'ticket-6'),
      createMockNotification('7', 'comment_added', 'low', true, oneWeekAgo.toISOString(), 
        'Comment added by support agent', 'Agent Comment', 'ticket-7'),
      
      // Different users
      createMockNotification('8', 'ticket_created', 'high', false, now.toISOString(), 
        'Urgent ticket requires attention', 'Urgent Ticket', 'ticket-8', 'user-2'),
      
      // Old notifications
      createMockNotification('9', 'priority_changed', 'low', true, oneWeekAgo.toISOString(), 
        'Ticket priority has been updated', 'Priority Updated', 'ticket-9'),
      createMockNotification('10', 'assignment_changed', 'medium', false, oneWeekAgo.toISOString(), 
        'Ticket assignment has been changed', 'Assignment Changed', 'ticket-10')
    ];
  });

  afterEach(() => {
    // Clean up debounce timers
    NotificationSearchFilter.clearDebounceTimers();
  });

  describe('search', () => {
    it('should return all notifications when no criteria provided', () => {
      const result = NotificationSearchFilter.search(mockNotifications, {});
      
      expect(result.notifications.length).toBe(mockNotifications.length);
      expect(result.totalCount).toBe(mockNotifications.length);
      expect(result.filteredCount).toBe(mockNotifications.length);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should filter by notification type', () => {
      const criteria: SearchCriteria = {
        type: ['sla_breach', 'sla_warning']
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(2);
      expect(result.notifications.every(n => ['sla_breach', 'sla_warning'].includes(n.type))).toBe(true);
      expect(result.filteredCount).toBe(2);
    });

    it('should filter by priority', () => {
      const criteria: SearchCriteria = {
        priority: ['high']
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(3);
      expect(result.notifications.every(n => n.priority === 'high')).toBe(true);
    });

    it('should filter by read status', () => {
      const criteria: SearchCriteria = {
        read: false
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.every(n => n.read === false)).toBe(true);
      expect(result.filteredCount).toBeGreaterThan(0);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const criteria: SearchCriteria = {
        dateRange: {
          start: oneDayAgo,
          end: now
        }
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.filteredCount).toBeGreaterThan(0);
      result.notifications.forEach(notification => {
        const notificationDate = new Date(notification.created_at);
        expect(notificationDate.getTime()).toBeGreaterThanOrEqual(oneDayAgo.getTime());
        expect(notificationDate.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });

    it('should filter by ticket ID', () => {
      const criteria: SearchCriteria = {
        ticketId: 'ticket-1'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].ticket_id).toBe('ticket-1');
    });

    it('should filter by user ID', () => {
      const criteria: SearchCriteria = {
        userId: 'user-2'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].user_id).toBe('user-2');
    });

    it('should perform text search in message', () => {
      const criteria: SearchCriteria = {
        query: 'SLA breach'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].message).toContain('SLA breach');
    });

    it('should perform case-insensitive text search by default', () => {
      const criteria: SearchCriteria = {
        query: 'sla breach'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].message.toLowerCase()).toContain('sla breach');
    });

    it('should perform case-sensitive text search when specified', () => {
      const criteria: SearchCriteria = {
        query: 'sla breach'
      };
      
      const options: SearchOptions = {
        caseSensitive: true
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria, options);
      
      expect(result.notifications.length).toBe(0);
    });

    it('should perform exact match search when specified', () => {
      const criteria: SearchCriteria = {
        query: 'New comment added to your ticket'
      };
      
      const options: SearchOptions = {
        exactMatch: true
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria, options);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].message).toBe('New comment added to your ticket');
    });

    it('should search in specified fields only', () => {
      const criteria: SearchCriteria = {
        query: 'ticket_created'
      };
      
      const options: SearchOptions = {
        searchFields: ['type']
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria, options);
      
      expect(result.notifications.length).toBe(2);
      expect(result.notifications.every(n => n.type === 'ticket_created')).toBe(true);
    });

    it('should combine multiple criteria with AND logic', () => {
      const criteria: SearchCriteria = {
        type: ['ticket_created', 'ticket_assigned'],
        priority: ['medium'],
        read: false
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].type).toBe('ticket_created');
      expect(result.notifications[0].priority).toBe('medium');
      expect(result.notifications[0].read).toBe(false);
    });
  });

  describe('sorting', () => {
    it('should sort by creation date descending by default', () => {
      const result = NotificationSearchFilter.search(mockNotifications, {});
      
      for (let i = 0; i < result.notifications.length - 1; i++) {
        const current = new Date(result.notifications[i].created_at);
        const next = new Date(result.notifications[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should sort by creation date ascending when specified', () => {
      const options: SearchOptions = {
        sortBy: 'created_at',
        sortOrder: 'asc'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      for (let i = 0; i < result.notifications.length - 1; i++) {
        const current = new Date(result.notifications[i].created_at);
        const next = new Date(result.notifications[i + 1].created_at);
        expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
      }
    });

    it('should sort by priority', () => {
      const options: SearchOptions = {
        sortBy: 'priority',
        sortOrder: 'desc'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      // High priority should come first
      const priorities = result.notifications.map(n => n.priority || 'medium');
      const priorityValues = priorities.map(p => ({ high: 3, medium: 2, low: 1 }[p]));
      
      for (let i = 0; i < priorityValues.length - 1; i++) {
        expect(priorityValues[i]).toBeGreaterThanOrEqual(priorityValues[i + 1]);
      }
    });

    it('should sort by type', () => {
      const options: SearchOptions = {
        sortBy: 'type',
        sortOrder: 'asc'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      for (let i = 0; i < result.notifications.length - 1; i++) {
        expect(result.notifications[i].type.localeCompare(result.notifications[i + 1].type)).toBeLessThanOrEqual(0);
      }
    });

    it('should sort by read status', () => {
      const options: SearchOptions = {
        sortBy: 'read',
        sortOrder: 'asc'
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      // Unread (false) should come before read (true) in ascending order
      for (let i = 0; i < result.notifications.length - 1; i++) {
        const current = result.notifications[i].read ? 1 : 0;
        const next = result.notifications[i + 1].read ? 1 : 0;
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });

  describe('pagination', () => {
    it('should apply default pagination', () => {
      const result = NotificationSearchFilter.search(mockNotifications, {});
      
      expect(result.notifications.length).toBeLessThanOrEqual(50); // Default limit
    });

    it('should apply custom limit', () => {
      const options: SearchOptions = {
        limit: 3
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      expect(result.notifications.length).toBe(3);
      expect(result.filteredCount).toBe(mockNotifications.length);
    });

    it('should apply offset', () => {
      const options: SearchOptions = {
        limit: 3,
        offset: 2
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      expect(result.notifications.length).toBe(3);
      
      // Compare with non-offset result to verify offset works
      const fullResult = NotificationSearchFilter.search(mockNotifications, {}, { limit: 10 });
      expect(result.notifications[0].id).toBe(fullResult.notifications[2].id);
    });
  });

  describe('searchWithDebounce', () => {
    it('should debounce search calls', async () => {
      const criteria: SearchCriteria = { query: 'test' };
      
      // Make multiple rapid calls
      const promise1 = NotificationSearchFilter.searchWithDebounce(mockNotifications, criteria, {}, 'test-key', 100);
      const promise2 = NotificationSearchFilter.searchWithDebounce(mockNotifications, criteria, {}, 'test-key', 100);
      const promise3 = NotificationSearchFilter.searchWithDebounce(mockNotifications, criteria, {}, 'test-key', 100);
      
      // Only the last call should execute
      const result = await promise3;
      
      expect(result.appliedCriteria.query).toBe('test');
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle different debounce keys separately', async () => {
      const criteria1: SearchCriteria = { query: 'test1' };
      const criteria2: SearchCriteria = { query: 'test2' };
      
      const promise1 = NotificationSearchFilter.searchWithDebounce(mockNotifications, criteria1, {}, 'key1', 50);
      const promise2 = NotificationSearchFilter.searchWithDebounce(mockNotifications, criteria2, {}, 'key2', 50);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.appliedCriteria.query).toBe('test1');
      expect(result2.appliedCriteria.query).toBe('test2');
    });
  });

  describe('presets', () => {
    it('should return default presets', () => {
      const presets = NotificationSearchFilter.getDefaultPresets();
      
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.every(preset => preset.isDefault)).toBe(true);
      
      // Check for expected default presets
      const presetNames = presets.map(p => p.name);
      expect(presetNames).toContain('Unread Notifications');
      expect(presetNames).toContain('High Priority');
      expect(presetNames).toContain('Today');
    });

    it('should create custom preset', () => {
      const criteria: SearchCriteria = {
        type: ['ticket_created'],
        priority: ['high']
      };
      
      const preset = NotificationSearchFilter.createPreset(
        'My Custom Filter',
        'High priority ticket creations',
        criteria,
        'user-123'
      );
      
      expect(preset.name).toBe('My Custom Filter');
      expect(preset.description).toBe('High priority ticket creations');
      expect(preset.criteria).toEqual(criteria);
      expect(preset.userId).toBe('user-123');
      expect(preset.isDefault).toBe(false);
      expect(preset.id).toBeDefined();
    });

    it('should update existing preset', () => {
      const originalPreset = NotificationSearchFilter.createPreset(
        'Original',
        'Original description',
        { type: ['ticket_created'] }
      );
      
      const updatedPreset = NotificationSearchFilter.updatePreset(originalPreset, {
        name: 'Updated',
        description: 'Updated description',
        criteria: { type: ['ticket_updated'] }
      });
      
      expect(updatedPreset.name).toBe('Updated');
      expect(updatedPreset.description).toBe('Updated description');
      expect(updatedPreset.criteria.type).toEqual(['ticket_updated']);
      expect(updatedPreset.id).toBe(originalPreset.id);
      expect(updatedPreset.createdAt).toBe(originalPreset.createdAt);
      expect(updatedPreset.updatedAt).not.toBe(originalPreset.updatedAt);
    });

    it('should apply preset criteria', () => {
      const preset: FilterPreset = {
        id: 'test-preset',
        name: 'Test Preset',
        description: 'Test description',
        criteria: { type: ['sla_breach'], priority: ['high'] },
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const appliedCriteria = NotificationSearchFilter.applyPreset(preset);
      
      expect(appliedCriteria).toEqual(preset.criteria);
      expect(appliedCriteria).not.toBe(preset.criteria); // Should be a copy
    });
  });

  describe('combineCriteria', () => {
    it('should combine queries with AND logic', () => {
      const criteria1: SearchCriteria = { query: 'ticket' };
      const criteria2: SearchCriteria = { query: 'urgent' };
      
      const combined = NotificationSearchFilter.combineCriteria(criteria1, criteria2);
      
      expect(combined.query).toBe('ticket urgent');
    });

    it('should combine types with OR logic', () => {
      const criteria1: SearchCriteria = { type: ['ticket_created'] };
      const criteria2: SearchCriteria = { type: ['ticket_updated', 'ticket_created'] };
      
      const combined = NotificationSearchFilter.combineCriteria(criteria1, criteria2);
      
      expect(combined.type).toEqual(['ticket_created', 'ticket_updated']);
    });

    it('should combine priorities with OR logic', () => {
      const criteria1: SearchCriteria = { priority: ['high'] };
      const criteria2: SearchCriteria = { priority: ['medium'] };
      
      const combined = NotificationSearchFilter.combineCriteria(criteria1, criteria2);
      
      expect(combined.priority).toEqual(['high', 'medium']);
    });

    it('should use intersection for date ranges', () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      
      const criteria1: SearchCriteria = {
        dateRange: { start: threeDaysAgo, end: oneDayAgo }
      };
      const criteria2: SearchCriteria = {
        dateRange: { start: twoDaysAgo, end: now }
      };
      
      const combined = NotificationSearchFilter.combineCriteria(criteria1, criteria2);
      
      expect(combined.dateRange!.start.getTime()).toBe(twoDaysAgo.getTime());
      expect(combined.dateRange!.end.getTime()).toBe(oneDayAgo.getTime());
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return empty array for short queries', () => {
      const suggestions = NotificationSearchFilter.getSearchSuggestions(mockNotifications, 'a');
      expect(suggestions).toEqual([]);
    });

    it('should return word suggestions from notifications', () => {
      const suggestions = NotificationSearchFilter.getSearchSuggestions(mockNotifications, 'ticket');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('ticket'))).toBe(true);
    });

    it('should include notification types in suggestions', () => {
      const suggestions = NotificationSearchFilter.getSearchSuggestions(mockNotifications, 'sla');
      
      expect(suggestions).toContain('sla_breach');
      expect(suggestions).toContain('sla_warning');
    });

    it('should limit number of suggestions', () => {
      const suggestions = NotificationSearchFilter.getSearchSuggestions(mockNotifications, 'e', 3);
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getFilterStatistics', () => {
    it('should return comprehensive statistics', () => {
      const stats = NotificationSearchFilter.getFilterStatistics(mockNotifications, {});
      
      expect(stats.totalCount).toBe(mockNotifications.length);
      expect(stats.filteredCount).toBe(mockNotifications.length);
      expect(stats.typeBreakdown).toBeDefined();
      expect(stats.priorityBreakdown).toBeDefined();
      expect(stats.readBreakdown).toBeDefined();
      expect(stats.dateBreakdown).toBeDefined();
      
      // Check that counts add up
      const totalRead = stats.readBreakdown.read + stats.readBreakdown.unread;
      expect(totalRead).toBe(mockNotifications.length);
    });

    it('should calculate statistics for filtered results', () => {
      const criteria: SearchCriteria = { priority: ['high'] };
      const stats = NotificationSearchFilter.getFilterStatistics(mockNotifications, criteria);
      
      expect(stats.filteredCount).toBeLessThan(stats.totalCount);
      expect(stats.priorityBreakdown.high).toBe(stats.filteredCount);
    });
  });

  describe('validateCriteria', () => {
    it('should return no errors for valid criteria', () => {
      const criteria: SearchCriteria = {
        query: 'test',
        type: ['ticket_created'],
        priority: ['high'],
        read: false
      };
      
      const errors = NotificationSearchFilter.validateCriteria(criteria);
      expect(errors).toEqual([]);
    });

    it('should validate date range', () => {
      const criteria: SearchCriteria = {
        dateRange: {
          start: new Date('2023-12-31'),
          end: new Date('2023-01-01')
        }
      };
      
      const errors = NotificationSearchFilter.validateCriteria(criteria);
      expect(errors).toContain('Start date must be before end date');
    });

    it('should validate query length', () => {
      const criteria: SearchCriteria = {
        query: 'a'.repeat(1001)
      };
      
      const errors = NotificationSearchFilter.validateCriteria(criteria);
      expect(errors).toContain('Search query is too long (max 1000 characters)');
    });

    it('should validate type array length', () => {
      const criteria: SearchCriteria = {
        type: new Array(21).fill('ticket_created')
      };
      
      const errors = NotificationSearchFilter.validateCriteria(criteria);
      expect(errors).toContain('Too many notification types selected (max 20)');
    });
  });

  describe('exportResults', () => {
    it('should export results as JSON', () => {
      const result = NotificationSearchFilter.search(mockNotifications, {}, { limit: 2 });
      const exported = NotificationSearchFilter.exportResults(result, 'json');
      
      const parsed = JSON.parse(exported);
      expect(parsed.notifications).toBeDefined();
      expect(parsed.totalCount).toBeDefined();
      expect(parsed.filteredCount).toBeDefined();
    });

    it('should export results as CSV', () => {
      const result = NotificationSearchFilter.search(mockNotifications, {}, { limit: 2 });
      const exported = NotificationSearchFilter.exportResults(result, 'csv');
      
      const lines = exported.split('\n');
      expect(lines.length).toBe(3); // Header + 2 data rows
      expect(lines[0]).toContain('ID');
      expect(lines[0]).toContain('Type');
      expect(lines[0]).toContain('Priority');
    });
  });

  describe('edge cases', () => {
    it('should handle empty notification array', () => {
      const result = NotificationSearchFilter.search([], { query: 'test' });
      
      expect(result.notifications).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.filteredCount).toBe(0);
    });

    it('should handle notifications with missing properties', () => {
      const incompleteNotifications: NotificationWithTicket[] = [
        {
          id: 'incomplete',
          user_id: 'user-1',
          message: 'Incomplete notification',
          type: 'ticket_created' as any,
          created_at: new Date().toISOString(),
          title: 'Incomplete'
          // Missing optional properties
        }
      ];
      
      const result = NotificationSearchFilter.search(incompleteNotifications, {
        priority: ['medium']
      });
      
      expect(result.notifications.length).toBe(1);
    });

    it('should handle invalid sort field gracefully', () => {
      const options: SearchOptions = {
        sortBy: 'invalid_field' as any
      };
      
      const result = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      expect(result.notifications.length).toBe(mockNotifications.length);
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeDataset: NotificationWithTicket[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push(createMockNotification(
          `perf-${i}`,
          'ticket_created',
          'medium',
          i % 2 === 0,
          new Date(Date.now() - i * 1000).toISOString(),
          `Performance test notification ${i}`
        ));
      }
      
      const startTime = Date.now();
      const result = NotificationSearchFilter.search(largeDataset, {
        query: 'Performance',
        priority: ['medium'],
        read: false
      });
      const endTime = Date.now();
      
      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });
  });
});