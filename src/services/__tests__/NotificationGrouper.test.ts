import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationGrouper, NotificationGroup, GroupingOptions } from '../NotificationGrouper';
import { NotificationWithTicket } from '@/lib/notificationService';

// Mock notification data for testing
const createMockNotification = (
  id: string,
  ticketId?: string,
  type: string = 'ticket_created',
  priority: 'low' | 'medium' | 'high' = 'medium',
  read: boolean = false,
  createdAt: string = new Date().toISOString()
): NotificationWithTicket => ({
  id,
  user_id: 'user-1',
  message: `Test notification ${id}`,
  type: type as any,
  ticket_id: ticketId,
  read,
  priority,
  created_at: createdAt,
  title: `Notification ${id}`,
  ticket: ticketId ? {
    id: ticketId,
    title: `Test Ticket ${ticketId}`,
    ticket_number: `#${ticketId.slice(-8)}`,
    status: 'open',
    priority: 'medium'
  } : null
});

describe('NotificationGrouper', () => {
  let mockNotifications: NotificationWithTicket[];

  beforeEach(() => {
    // Create a diverse set of mock notifications for testing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    mockNotifications = [
      // Ticket 1 notifications (should be grouped)
      createMockNotification('1', 'ticket-1', 'ticket_created', 'high', false, now.toISOString()),
      createMockNotification('2', 'ticket-1', 'comment_added', 'medium', false, oneHourAgo.toISOString()),
      createMockNotification('3', 'ticket-1', 'status_changed', 'medium', true, twoHoursAgo.toISOString()),
      
      // Ticket 2 notifications (should be grouped)
      createMockNotification('4', 'ticket-2', 'ticket_assigned', 'high', false, now.toISOString()),
      createMockNotification('5', 'ticket-2', 'comment_added', 'low', false, oneHourAgo.toISOString()),
      
      // Single ticket notification (should not be grouped)
      createMockNotification('6', 'ticket-3', 'ticket_created', 'medium', false, now.toISOString()),
      
      // Non-ticket notifications
      createMockNotification('7', undefined, 'sla_warning', 'high', false, now.toISOString()),
      createMockNotification('8', undefined, 'sla_breach', 'high', false, oneHourAgo.toISOString()),
      
      // Old notification (for time window testing)
      createMockNotification('9', 'ticket-1', 'priority_changed', 'low', true, oneDayAgo.toISOString())
    ];
  });

  describe('groupNotifications', () => {
    it('should return empty array for empty input', () => {
      const result = NotificationGrouper.groupNotifications([]);
      expect(result).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
      const result1 = NotificationGrouper.groupNotifications(null as any);
      const result2 = NotificationGrouper.groupNotifications(undefined as any);
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('should use hybrid strategy by default', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications);
      expect(result.length).toBeGreaterThan(0);
      
      // Should have groups for tickets with multiple notifications
      const ticketGroups = result.filter(group => group.ticketId);
      expect(ticketGroups.length).toBeGreaterThan(0);
    });

    it('should handle unknown strategy gracefully', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'unknown-strategy');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('groupByTicket strategy', () => {
    it('should group notifications by ticket ID', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      
      // Find the group for ticket-1 (should have 4 notifications)
      const ticket1Group = result.find(group => group.ticketId === 'ticket-1');
      expect(ticket1Group).toBeDefined();
      expect(ticket1Group!.notifications.length).toBe(4);
      
      // Find the group for ticket-2 (should have 2 notifications)
      const ticket2Group = result.find(group => group.ticketId === 'ticket-2');
      expect(ticket2Group).toBeDefined();
      expect(ticket2Group!.notifications.length).toBe(2);
      
      // Single notification tickets should be individual groups
      const ticket3Groups = result.filter(group => 
        group.notifications.some(n => n.ticket_id === 'ticket-3')
      );
      expect(ticket3Groups.length).toBe(1);
      expect(ticket3Groups[0].notifications.length).toBe(1);
    });

    it('should handle notifications without ticket IDs', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      
      // Non-ticket notifications should be individual groups
      const nonTicketGroups = result.filter(group => !group.ticketId);
      expect(nonTicketGroups.length).toBeGreaterThan(0);
    });

    it('should sort notifications within groups by creation time (newest first)', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const ticket1Group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(ticket1Group).toBeDefined();
      const notifications = ticket1Group!.notifications;
      
      // Check that notifications are sorted by creation time (newest first)
      for (let i = 0; i < notifications.length - 1; i++) {
        const current = new Date(notifications[i].created_at);
        const next = new Date(notifications[i + 1].created_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });
  });

  describe('groupByType strategy', () => {
    it('should group notifications by type', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'type');
      
      // Should have groups for types with multiple notifications
      const commentGroups = result.filter(group => 
        group.notifications.every(n => n.type === 'comment_added')
      );
      expect(commentGroups.length).toBeGreaterThan(0);
      
      // Find comment group and verify it has multiple notifications
      const commentGroup = commentGroups.find(group => group.notifications.length > 1);
      expect(commentGroup).toBeDefined();
      expect(commentGroup!.notifications.length).toBe(2);
    });

    it('should create individual groups for single-type notifications', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'type');
      
      // SLA warnings should be individual groups if only one exists
      const slaWarningGroups = result.filter(group => 
        group.notifications.some(n => n.type === 'sla_warning')
      );
      expect(slaWarningGroups.length).toBe(1);
    });
  });

  describe('groupByPriority strategy', () => {
    it('should group notifications by priority', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'priority');
      
      // Should have groups for each priority level
      const highPriorityGroup = result.find(group => group.priority === 'high');
      const mediumPriorityGroup = result.find(group => group.priority === 'medium');
      const lowPriorityGroup = result.find(group => group.priority === 'low');
      
      expect(highPriorityGroup).toBeDefined();
      expect(mediumPriorityGroup).toBeDefined();
      expect(lowPriorityGroup).toBeDefined();
    });

    it('should order groups by priority (high, medium, low)', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'priority');
      
      // Find first occurrence of each priority
      const highIndex = result.findIndex(group => group.priority === 'high');
      const mediumIndex = result.findIndex(group => group.priority === 'medium');
      const lowIndex = result.findIndex(group => group.priority === 'low');
      
      // High priority should come before medium and low
      if (highIndex !== -1 && mediumIndex !== -1) {
        expect(highIndex).toBeLessThan(mediumIndex);
      }
      if (mediumIndex !== -1 && lowIndex !== -1) {
        expect(mediumIndex).toBeLessThan(lowIndex);
      }
    });
  });

  describe('hybrid strategy', () => {
    it('should combine ticket and time-based grouping', () => {
      const options: GroupingOptions = {
        timeWindowHours: 2 // 2-hour window
      };
      
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'hybrid', options);
      
      // Should still group by ticket primarily
      const ticketGroups = result.filter(group => group.ticketId);
      expect(ticketGroups.length).toBeGreaterThan(0);
    });

    it('should respect time windows for grouping', () => {
      const options: GroupingOptions = {
        timeWindowHours: 1 // 1-hour window (should split some groups)
      };
      
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'hybrid', options);
      
      // With a 1-hour window, some ticket groups might be split
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('group creation and properties', () => {
    it('should create groups with correct properties', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(group).toBeDefined();
      expect(group!.id).toBeDefined();
      expect(group!.ticketId).toBe('ticket-1');
      expect(group!.type).toBeDefined();
      expect(group!.notifications.length).toBeGreaterThan(0);
      expect(group!.latestNotification).toBeDefined();
      expect(group!.unreadCount).toBeGreaterThanOrEqual(0);
      expect(group!.createdAt).toBeDefined();
      expect(group!.updatedAt).toBeDefined();
      expect(group!.priority).toMatch(/^(low|medium|high)$/);
      expect(group!.summary).toBeDefined();
    });

    it('should calculate unread count correctly', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(group).toBeDefined();
      const expectedUnreadCount = group!.notifications.filter(n => !n.read).length;
      expect(group!.unreadCount).toBe(expectedUnreadCount);
    });

    it('should determine group priority correctly', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(group).toBeDefined();
      // Group should have high priority since it contains a high priority notification
      expect(group!.priority).toBe('high');
    });

    it('should generate meaningful summaries', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(group).toBeDefined();
      expect(group!.summary).toContain('notifications');
      expect(group!.summary).toContain('ticket');
    });

    it('should set latest notification correctly', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.ticketId === 'ticket-1');
      
      expect(group).toBeDefined();
      
      // Latest notification should be the one with the most recent created_at
      const latestTime = Math.max(...group!.notifications.map(n => new Date(n.created_at).getTime()));
      const expectedLatest = group!.notifications.find(n => new Date(n.created_at).getTime() === latestTime);
      
      expect(group!.latestNotification.id).toBe(expectedLatest!.id);
    });
  });

  describe('group optimization', () => {
    it('should split large groups when maxGroupSize is exceeded', () => {
      // Create a large group of notifications
      const largeNotificationSet: NotificationWithTicket[] = [];
      for (let i = 0; i < 15; i++) {
        largeNotificationSet.push(createMockNotification(`large-${i}`, 'large-ticket', 'comment_added'));
      }
      
      const options: GroupingOptions = {
        maxGroupSize: 5
      };
      
      const result = NotificationGrouper.groupNotifications(largeNotificationSet, 'ticket', options);
      
      // Should split into multiple groups
      const largeTicketGroups = result.filter(group => 
        group.notifications.some(n => n.ticket_id === 'large-ticket')
      );
      
      expect(largeTicketGroups.length).toBeGreaterThan(1);
      largeTicketGroups.forEach(group => {
        expect(group.notifications.length).toBeLessThanOrEqual(5);
      });
    });

    it('should sort groups by priority and update time', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      
      // Check that groups are sorted correctly
      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i];
        const next = result[i + 1];
        
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const currentPriorityValue = priorityOrder[current.priority];
        const nextPriorityValue = priorityOrder[next.priority];
        
        if (currentPriorityValue !== nextPriorityValue) {
          expect(currentPriorityValue).toBeGreaterThanOrEqual(nextPriorityValue);
        } else {
          // Same priority, check update time
          const currentTime = new Date(current.updatedAt).getTime();
          const nextTime = new Date(next.updatedAt).getTime();
          expect(currentTime).toBeGreaterThanOrEqual(nextTime);
        }
      }
    });
  });

  describe('utility methods', () => {
    it('should return available grouping strategies', () => {
      const strategies = NotificationGrouper.getAvailableStrategies();
      expect(strategies.length).toBeGreaterThan(0);
      
      strategies.forEach(strategy => {
        expect(strategy.name).toBeDefined();
        expect(strategy.description).toBeDefined();
        expect(strategy.groupFn).toBeDefined();
      });
    });

    it('should expand groups correctly', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const group = result.find(group => group.notifications.length > 1);
      
      expect(group).toBeDefined();
      const expanded = NotificationGrouper.expandGroup(group!);
      expect(expanded).toEqual(group!.notifications);
    });

    it('should collapse notifications back into a group', () => {
      const notifications = mockNotifications.slice(0, 3);
      const collapsed = NotificationGrouper.collapseGroup(notifications);
      
      expect(collapsed.notifications).toEqual(notifications);
      expect(collapsed.type).toBe('collapsed');
    });

    it('should calculate group statistics correctly', () => {
      const result = NotificationGrouper.groupNotifications(mockNotifications, 'ticket');
      const stats = NotificationGrouper.getGroupStatistics(result);
      
      expect(stats.totalGroups).toBe(result.length);
      expect(stats.totalNotifications).toBe(mockNotifications.length);
      expect(stats.unreadGroups).toBeGreaterThanOrEqual(0);
      expect(stats.unreadNotifications).toBeGreaterThanOrEqual(0);
      expect(stats.averageGroupSize).toBeGreaterThan(0);
      expect(stats.priorityBreakdown).toHaveProperty('high');
      expect(stats.priorityBreakdown).toHaveProperty('medium');
      expect(stats.priorityBreakdown).toHaveProperty('low');
    });
  });

  describe('edge cases', () => {
    it('should handle single notification', () => {
      const singleNotification = [mockNotifications[0]];
      const result = NotificationGrouper.groupNotifications(singleNotification, 'ticket');
      
      expect(result.length).toBe(1);
      expect(result[0].notifications.length).toBe(1);
    });

    it('should handle notifications with missing properties', () => {
      const incompleteNotification: NotificationWithTicket = {
        id: 'incomplete',
        user_id: 'user-1',
        message: 'Incomplete notification',
        type: 'ticket_created' as any,
        created_at: new Date().toISOString(),
        title: 'Incomplete'
        // Missing optional properties
      };
      
      const result = NotificationGrouper.groupNotifications([incompleteNotification], 'ticket');
      expect(result.length).toBe(1);
      // The notification itself doesn't get modified, but the group should have a priority
      expect(result[0].priority).toBe('medium'); // Group should default to medium priority
      expect(result[0].notifications[0]).toEqual(incompleteNotification); // Original notification unchanged
    });

    it('should handle notifications with same timestamp', () => {
      const timestamp = new Date().toISOString();
      const sameTimeNotifications = [
        createMockNotification('same1', 'ticket-same', 'ticket_created', 'high', false, timestamp),
        createMockNotification('same2', 'ticket-same', 'comment_added', 'medium', false, timestamp)
      ];
      
      const result = NotificationGrouper.groupNotifications(sameTimeNotifications, 'ticket');
      expect(result.length).toBe(1);
      expect(result[0].notifications.length).toBe(2);
    });

    it('should handle empty ticket IDs', () => {
      const emptyTicketNotifications = [
        createMockNotification('empty1', '', 'ticket_created'),
        createMockNotification('empty2', '', 'comment_added')
      ];
      
      const result = NotificationGrouper.groupNotifications(emptyTicketNotifications, 'ticket');
      // Empty ticket IDs should be treated as individual notifications
      expect(result.length).toBe(2);
    });
  });

  describe('performance considerations', () => {
    it('should handle large datasets efficiently', () => {
      // Create a large dataset
      const largeDataset: NotificationWithTicket[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push(createMockNotification(
          `perf-${i}`,
          `ticket-${Math.floor(i / 10)}`, // 10 notifications per ticket
          'comment_added'
        ));
      }
      
      const startTime = Date.now();
      const result = NotificationGrouper.groupNotifications(largeDataset, 'ticket');
      const endTime = Date.now();
      
      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});