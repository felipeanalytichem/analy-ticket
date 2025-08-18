import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotificationSearchFilter, SearchCriteria, SearchOptions } from '../NotificationSearchFilter';
import { NotificationGrouper } from '../NotificationGrouper';
import { NotificationWithTicket } from '@/lib/notificationService';

// Mock notification data for integration testing
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

describe('NotificationSearchFilter Integration Tests', () => {
  let mockNotifications: NotificationWithTicket[];

  beforeEach(() => {
    // Create a comprehensive dataset for integration testing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    mockNotifications = [
      // High priority SLA notifications
      createMockNotification('sla-1', 'sla_breach', 'high', false, now.toISOString(), 
        'Critical SLA breach detected for urgent ticket', 'Critical SLA Breach', 'ticket-urgent-1'),
      createMockNotification('sla-2', 'sla_warning', 'high', false, oneHourAgo.toISOString(), 
        'SLA warning: Response time approaching limit', 'SLA Warning Alert', 'ticket-urgent-2'),
      
      // Ticket lifecycle notifications for same ticket
      createMockNotification('ticket-1-created', 'ticket_created', 'medium', false, oneDayAgo.toISOString(), 
        'New support ticket has been created by customer', 'New Ticket: Login Issues', 'ticket-123'),
      createMockNotification('ticket-1-assigned', 'ticket_assigned', 'medium', false, oneDayAgo.toISOString(), 
        'Ticket has been assigned to support agent', 'Ticket Assigned', 'ticket-123'),
      createMockNotification('ticket-1-comment', 'comment_added', 'low', true, oneHourAgo.toISOString(), 
        'Customer added additional information to ticket', 'New Customer Comment', 'ticket-123'),
      createMockNotification('ticket-1-status', 'status_changed', 'medium', false, now.toISOString(), 
        'Ticket status changed from open to in progress', 'Status Update', 'ticket-123'),
      
      // Different user notifications
      createMockNotification('user2-1', 'ticket_created', 'high', false, now.toISOString(), 
        'Urgent ticket requires immediate attention', 'Urgent: System Down', 'ticket-456', 'user-2'),
      createMockNotification('user2-2', 'priority_changed', 'high', false, oneHourAgo.toISOString(), 
        'Ticket priority escalated to high', 'Priority Escalation', 'ticket-456', 'user-2'),
      
      // Bulk comment notifications
      createMockNotification('comment-1', 'comment_added', 'low', true, oneWeekAgo.toISOString(), 
        'Agent provided solution steps', 'Agent Response', 'ticket-789'),
      createMockNotification('comment-2', 'comment_added', 'low', false, oneWeekAgo.toISOString(), 
        'Customer confirmed issue resolution', 'Customer Feedback', 'ticket-789'),
      createMockNotification('comment-3', 'comment_added', 'medium', false, oneDayAgo.toISOString(), 
        'Internal note added by supervisor', 'Internal Note', 'ticket-789'),
      
      // Assignment changes
      createMockNotification('assign-1', 'assignment_changed', 'medium', false, oneDayAgo.toISOString(), 
        'Ticket reassigned to specialist team', 'Reassignment Notice', 'ticket-999'),
      createMockNotification('assign-2', 'assignment_changed', 'low', true, oneWeekAgo.toISOString(), 
        'Ticket assignment updated due to workload', 'Assignment Update', 'ticket-888'),
      
      // Mixed priority notifications
      createMockNotification('mixed-1', 'ticket_updated', 'low', true, oneWeekAgo.toISOString(), 
        'Ticket details updated by customer', 'Ticket Update', 'ticket-111'),
      createMockNotification('mixed-2', 'ticket_updated', 'high', false, now.toISOString(), 
        'Critical ticket information updated', 'Critical Update', 'ticket-222')
    ];
  });

  afterEach(() => {
    NotificationSearchFilter.clearDebounceTimers();
  });

  describe('Search and Filter Integration', () => {
    it('should filter and search notifications effectively', () => {
      // Complex search: High priority SLA notifications from today
      const criteria: SearchCriteria = {
        query: 'SLA',
        priority: ['high'],
        dateRange: {
          start: new Date(new Date().setHours(0, 0, 0, 0)),
          end: new Date(new Date().setHours(23, 59, 59, 999))
        }
      };

      const result = NotificationSearchFilter.search(mockNotifications, criteria);

      expect(result.notifications.length).toBe(2);
      expect(result.notifications.every(n => n.priority === 'high')).toBe(true);
      expect(result.notifications.every(n => 
        n.message.toLowerCase().includes('sla') || n.title.toLowerCase().includes('sla')
      )).toBe(true);
    });

    it('should combine multiple filter criteria with text search', () => {
      // Search for ticket-related notifications for specific user
      const criteria: SearchCriteria = {
        query: 'ticket',
        type: ['ticket_created', 'ticket_assigned', 'ticket_updated'],
        userId: 'user-2',
        read: false
      };

      const result = NotificationSearchFilter.search(mockNotifications, criteria);

      expect(result.notifications.length).toBe(1);
      expect(result.notifications[0].user_id).toBe('user-2');
      expect(result.notifications[0].type).toBe('ticket_created');
      expect(result.notifications[0].read).toBe(false);
    });

    it('should handle complex sorting with filtering', () => {
      // Get all comment notifications sorted by priority then date
      const criteria: SearchCriteria = {
        type: ['comment_added']
      };

      const options: SearchOptions = {
        sortBy: 'priority',
        sortOrder: 'desc'
      };

      const result = NotificationSearchFilter.search(mockNotifications, criteria, options);

      expect(result.notifications.length).toBe(4);
      
      // Should be sorted by priority (high to low)
      const priorities = result.notifications.map(n => n.priority || 'medium');
      const priorityValues = priorities.map(p => ({ high: 3, medium: 2, low: 1 }[p]));
      
      for (let i = 0; i < priorityValues.length - 1; i++) {
        expect(priorityValues[i]).toBeGreaterThanOrEqual(priorityValues[i + 1]);
      }
    });

    it('should work with pagination on filtered results', () => {
      // Get all notifications, paginated
      const options: SearchOptions = {
        limit: 5,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const page1 = NotificationSearchFilter.search(mockNotifications, {}, options);
      
      const page2Options: SearchOptions = {
        ...options,
        offset: 5
      };
      const page2 = NotificationSearchFilter.search(mockNotifications, {}, page2Options);

      expect(page1.notifications.length).toBe(5);
      expect(page2.notifications.length).toBeGreaterThan(0);
      expect(page1.totalCount).toBe(page2.totalCount);
      expect(page1.filteredCount).toBe(page2.filteredCount);
      
      // Ensure no overlap between pages
      const page1Ids = page1.notifications.map(n => n.id);
      const page2Ids = page2.notifications.map(n => n.id);
      const overlap = page1Ids.filter(id => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe('Search with Grouping Integration', () => {
    it('should search notifications and then group results', () => {
      // First, search for ticket-related notifications
      const searchCriteria: SearchCriteria = {
        type: ['ticket_created', 'ticket_assigned', 'comment_added', 'status_changed']
      };

      const searchResult = NotificationSearchFilter.search(mockNotifications, searchCriteria);
      
      // Then group the search results by ticket
      const groups = NotificationGrouper.groupNotifications(
        searchResult.notifications,
        'ticket'
      );

      expect(groups.length).toBeGreaterThan(0);
      
      // Verify that groups contain only searched notification types
      groups.forEach(group => {
        group.notifications.forEach(notification => {
          expect(searchCriteria.type).toContain(notification.type);
        });
      });
    });

    it('should filter grouped notifications', () => {
      // First group all notifications
      const allGroups = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      
      // Then search within grouped notifications for high priority
      const highPriorityGroups = allGroups.filter(group => 
        group.priority === 'high'
      );

      expect(highPriorityGroups.length).toBeGreaterThan(0);
      expect(highPriorityGroups.every(group => group.priority === 'high')).toBe(true);
    });

    it('should search and group with statistics', () => {
      // Search for unread notifications
      const searchCriteria: SearchCriteria = {
        read: false
      };

      const searchResult = NotificationSearchFilter.search(mockNotifications, searchCriteria);
      const stats = NotificationSearchFilter.getFilterStatistics(mockNotifications, searchCriteria);
      
      // Group the unread notifications
      const groups = NotificationGrouper.groupNotifications(
        searchResult.notifications,
        'hybrid'
      );

      const groupStats = NotificationGrouper.getGroupStatistics(groups);

      expect(stats.readBreakdown.unread).toBe(searchResult.filteredCount);
      expect(groupStats.totalNotifications).toBe(searchResult.filteredCount);
      expect(groupStats.unreadNotifications).toBe(searchResult.filteredCount);
    });
  });

  describe('Preset Integration', () => {
    it('should use presets for common search scenarios', () => {
      const presets = NotificationSearchFilter.getDefaultPresets();
      
      // Test "High Priority" preset
      const highPriorityPreset = presets.find(p => p.name === 'High Priority');
      expect(highPriorityPreset).toBeDefined();
      
      const criteria = NotificationSearchFilter.applyPreset(highPriorityPreset!);
      const result = NotificationSearchFilter.search(mockNotifications, criteria);
      
      expect(result.notifications.every(n => n.priority === 'high')).toBe(true);
    });

    it('should combine presets with additional criteria', () => {
      const presets = NotificationSearchFilter.getDefaultPresets();
      const unreadPreset = presets.find(p => p.name === 'Unread Notifications');
      const highPriorityPreset = presets.find(p => p.name === 'High Priority');
      
      expect(unreadPreset).toBeDefined();
      expect(highPriorityPreset).toBeDefined();
      
      // Combine presets: unread AND high priority
      const combinedCriteria = NotificationSearchFilter.combineCriteria(
        NotificationSearchFilter.applyPreset(unreadPreset!),
        NotificationSearchFilter.applyPreset(highPriorityPreset!)
      );
      
      const result = NotificationSearchFilter.search(mockNotifications, combinedCriteria);
      
      expect(result.notifications.every(n => !n.read && n.priority === 'high')).toBe(true);
    });

    it('should create and use custom presets', () => {
      // Create a custom preset for SLA alerts
      const customPreset = NotificationSearchFilter.createPreset(
        'My SLA Alerts',
        'Critical SLA notifications requiring immediate attention',
        {
          type: ['sla_breach', 'sla_warning'],
          priority: ['high'],
          read: false
        },
        'user-123'
      );

      const criteria = NotificationSearchFilter.applyPreset(customPreset);
      const result = NotificationSearchFilter.search(mockNotifications, criteria);

      expect(result.notifications.length).toBe(2);
      expect(result.notifications.every(n => 
        ['sla_breach', 'sla_warning'].includes(n.type) && 
        n.priority === 'high' && 
        !n.read
      )).toBe(true);
    });
  });

  describe('Real-time Search Integration', () => {
    it('should handle debounced search with changing criteria', async () => {
      // Simulate rapid user typing
      const searches = [
        { query: 't' },
        { query: 'ti' },
        { query: 'tic' },
        { query: 'tick' },
        { query: 'ticket' }
      ];

      // Only the last search should execute
      const promises = searches.map((criteria, index) => 
        NotificationSearchFilter.searchWithDebounce(
          mockNotifications, 
          criteria, 
          {}, 
          'user-typing', 
          50
        )
      );

      const result = await promises[promises.length - 1];

      expect(result.appliedCriteria.query).toBe('ticket');
      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.notifications.every(n => 
        n.message.toLowerCase().includes('ticket') || 
        n.title.toLowerCase().includes('ticket') ||
        n.type.includes('ticket')
      )).toBe(true);
    });

    it('should provide search suggestions based on filtered content', () => {
      // First filter to a subset
      const filteredResult = NotificationSearchFilter.search(mockNotifications, {
        type: ['ticket_created', 'ticket_assigned']
      });

      // Get suggestions from filtered results
      const suggestions = NotificationSearchFilter.getSearchSuggestions(
        filteredResult.notifications,
        'tick'
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('ticket'))).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle complex search and grouping operations efficiently', () => {
      // Create a larger dataset
      const largeDataset: NotificationWithTicket[] = [...mockNotifications];
      
      // Duplicate the dataset multiple times to simulate larger volume
      for (let i = 0; i < 10; i++) {
        mockNotifications.forEach((notification, index) => {
          largeDataset.push({
            ...notification,
            id: `${notification.id}-copy-${i}-${index}`,
            created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        });
      }

      const startTime = Date.now();

      // Complex search operation
      const searchResult = NotificationSearchFilter.search(largeDataset, {
        query: 'ticket',
        priority: ['high', 'medium'],
        read: false
      }, {
        sortBy: 'priority',
        sortOrder: 'desc',
        limit: 20
      });

      // Group the results
      const groups = NotificationGrouper.groupNotifications(
        searchResult.notifications,
        'hybrid'
      );

      // Get statistics
      const stats = NotificationSearchFilter.getFilterStatistics(largeDataset, {
        priority: ['high', 'medium']
      });

      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(searchResult.notifications.length).toBeLessThanOrEqual(20);
      expect(groups.length).toBeGreaterThan(0);
      expect(stats.totalCount).toBe(largeDataset.length);
    });
  });

  describe('Export Integration', () => {
    it('should export filtered and grouped results', () => {
      // Search and filter
      const searchResult = NotificationSearchFilter.search(mockNotifications, {
        priority: ['high'],
        read: false
      });

      // Export as JSON
      const jsonExport = NotificationSearchFilter.exportResults(searchResult, 'json');
      const parsedJson = JSON.parse(jsonExport);

      expect(parsedJson.notifications).toBeDefined();
      expect(parsedJson.totalCount).toBeDefined();
      expect(parsedJson.appliedCriteria.priority).toEqual(['high']);

      // Export as CSV
      const csvExport = NotificationSearchFilter.exportResults(searchResult, 'csv');
      const csvLines = csvExport.split('\n');

      expect(csvLines.length).toBe(searchResult.notifications.length + 1); // +1 for header
      expect(csvLines[0]).toContain('Priority');
      expect(csvLines[1]).toContain('high'); // First data row should have high priority
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid search criteria gracefully', () => {
      const invalidCriteria: SearchCriteria = {
        dateRange: {
          start: new Date('2023-12-31'),
          end: new Date('2023-01-01') // Invalid: start after end
        }
      };

      const errors = NotificationSearchFilter.validateCriteria(invalidCriteria);
      expect(errors.length).toBeGreaterThan(0);

      // Should still return results, but with invalid date range filtering applied (returns 0)
      const result = NotificationSearchFilter.search(mockNotifications, invalidCriteria);
      expect(result.notifications.length).toBe(0); // Invalid date range filters out all results
    });

    it('should handle empty results gracefully', () => {
      const impossibleCriteria: SearchCriteria = {
        query: 'nonexistent-term-xyz123',
        type: ['nonexistent_type' as any],
        priority: ['high']
      };

      const result = NotificationSearchFilter.search(mockNotifications, impossibleCriteria);
      const groups = NotificationGrouper.groupNotifications(result.notifications, 'ticket');
      const stats = NotificationSearchFilter.getFilterStatistics(mockNotifications, impossibleCriteria);

      expect(result.notifications.length).toBe(0);
      expect(groups.length).toBe(0);
      expect(stats.filteredCount).toBe(0);
      expect(stats.totalCount).toBe(mockNotifications.length);
    });
  });
});