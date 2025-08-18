import { NotificationWithTicket } from '@/lib/notificationService';

export interface NotificationGroup {
  id: string;
  ticketId?: string;
  type: string;
  notifications: NotificationWithTicket[];
  latestNotification: NotificationWithTicket;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  priority: 'low' | 'medium' | 'high';
  summary: string;
}

export interface GroupingOptions {
  groupByTicket?: boolean;
  groupByType?: boolean;
  maxGroupSize?: number;
  timeWindowHours?: number;
  priorityGrouping?: boolean;
}

export interface GroupingStrategy {
  name: string;
  description: string;
  groupFn: (notifications: NotificationWithTicket[], options?: GroupingOptions) => NotificationGroup[];
}

export class NotificationGrouper {
  private static readonly DEFAULT_OPTIONS: GroupingOptions = {
    groupByTicket: true,
    groupByType: false,
    maxGroupSize: 10,
    timeWindowHours: 24,
    priorityGrouping: true
  };

  private static readonly GROUPING_STRATEGIES: Record<string, GroupingStrategy> = {
    ticket: {
      name: 'Ticket-based Grouping',
      description: 'Groups notifications by ticket ID',
      groupFn: (notifications, options) => NotificationGrouper.groupByTicket(notifications, options)
    },
    type: {
      name: 'Type-based Grouping',
      description: 'Groups notifications by notification type',
      groupFn: (notifications, options) => NotificationGrouper.groupByType(notifications, options)
    },
    hybrid: {
      name: 'Hybrid Grouping',
      description: 'Groups by ticket first, then by type within time windows',
      groupFn: (notifications, options) => NotificationGrouper.groupHybrid(notifications, options)
    },
    priority: {
      name: 'Priority-based Grouping',
      description: 'Groups notifications by priority level',
      groupFn: (notifications, options) => NotificationGrouper.groupByPriority(notifications, options)
    }
  };

  /**
   * Main grouping method that applies intelligent grouping logic
   */
  static groupNotifications(
    notifications: NotificationWithTicket[],
    strategy: string = 'hybrid',
    options: Partial<GroupingOptions> = {}
  ): NotificationGroup[] {
    if (!notifications || notifications.length === 0) {
      return [];
    }

    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const groupingStrategy = this.GROUPING_STRATEGIES[strategy];

    if (!groupingStrategy) {
      console.warn(`Unknown grouping strategy: ${strategy}. Using hybrid strategy.`);
      return this.GROUPING_STRATEGIES.hybrid.groupFn(notifications, mergedOptions);
    }

    const groups = groupingStrategy.groupFn(notifications, mergedOptions);
    
    // Apply post-processing optimizations
    return this.optimizeGroups(groups, mergedOptions);
  }

  /**
   * Group notifications by ticket ID
   */
  private static groupByTicket(
    notifications: NotificationWithTicket[],
    options: GroupingOptions = {}
  ): NotificationGroup[] {
    const ticketGroups = new Map<string, NotificationWithTicket[]>();
    const ungroupedNotifications: NotificationWithTicket[] = [];

    // Separate notifications by ticket
    notifications.forEach(notification => {
      if (notification.ticket_id) {
        const key = notification.ticket_id;
        if (!ticketGroups.has(key)) {
          ticketGroups.set(key, []);
        }
        ticketGroups.get(key)!.push(notification);
      } else {
        ungroupedNotifications.push(notification);
      }
    });

    const groups: NotificationGroup[] = [];

    // Create groups for ticket-based notifications
    ticketGroups.forEach((groupNotifications, ticketId) => {
      if (groupNotifications.length > 1) {
        groups.push(NotificationGrouper.createGroup(groupNotifications, {
          ticketId,
          type: 'ticket',
          groupingKey: ticketId
        }));
      } else {
        // Single notifications don't need grouping
        ungroupedNotifications.push(...groupNotifications);
      }
    });

    // Add ungrouped notifications as individual groups
    ungroupedNotifications.forEach(notification => {
      groups.push(NotificationGrouper.createGroup([notification], {
        type: 'individual',
        groupingKey: notification.id || 'unknown'
      }));
    });

    return groups;
  }

  /**
   * Group notifications by type
   */
  private static groupByType(
    notifications: NotificationWithTicket[],
    options: GroupingOptions = {}
  ): NotificationGroup[] {
    const typeGroups = new Map<string, NotificationWithTicket[]>();

    // Group by notification type
    notifications.forEach(notification => {
      const key = notification.type;
      if (!typeGroups.has(key)) {
        typeGroups.set(key, []);
      }
      typeGroups.get(key)!.push(notification);
    });

    const groups: NotificationGroup[] = [];

    typeGroups.forEach((groupNotifications, type) => {
      if (groupNotifications.length > 1) {
        groups.push(NotificationGrouper.createGroup(groupNotifications, {
          type: 'type',
          groupingKey: type
        }));
      } else {
        // Single notifications as individual groups
        groups.push(NotificationGrouper.createGroup(groupNotifications, {
          type: 'individual',
          groupingKey: groupNotifications[0].id || 'unknown'
        }));
      }
    });

    return groups;
  }

  /**
   * Hybrid grouping strategy - combines ticket and type grouping with time windows
   */
  private static groupHybrid(
    notifications: NotificationWithTicket[],
    options: GroupingOptions = {}
  ): NotificationGroup[] {
    const groups: NotificationGroup[] = [];
    const processed = new Set<string>();

    // Sort notifications by creation time (newest first)
    const sortedNotifications = [...notifications].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // First pass: Group by ticket ID
    const ticketGroups = NotificationGrouper.groupByTicket(sortedNotifications, options);
    
    // Second pass: Apply time-based grouping within ticket groups
    ticketGroups.forEach(group => {
      if (group.notifications.length > 1) {
        const timeBasedSubGroups = NotificationGrouper.applyTimeWindowGrouping(
          group.notifications,
          options.timeWindowHours || 24
        );
        
        if (timeBasedSubGroups.length > 1) {
          // Split into multiple time-based groups
          timeBasedSubGroups.forEach(subGroup => {
            groups.push(NotificationGrouper.createGroup(subGroup, {
              ticketId: group.ticketId,
              type: 'ticket-time',
              groupingKey: `${group.ticketId}-${subGroup[0].created_at}`
            }));
          });
        } else {
          // Keep as single group
          groups.push(group);
        }
      } else {
        groups.push(group);
      }
    });

    return groups;
  }

  /**
   * Group notifications by priority level
   */
  private static groupByPriority(
    notifications: NotificationWithTicket[],
    options: GroupingOptions = {}
  ): NotificationGroup[] {
    const priorityGroups = new Map<string, NotificationWithTicket[]>();

    notifications.forEach(notification => {
      const priority = notification.priority || 'medium';
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)!.push(notification);
    });

    const groups: NotificationGroup[] = [];

    // Process in priority order: high, medium, low
    const priorityOrder = ['high', 'medium', 'low'];
    
    priorityOrder.forEach(priority => {
      const groupNotifications = priorityGroups.get(priority);
      if (groupNotifications && groupNotifications.length > 0) {
        if (groupNotifications.length > 1) {
          groups.push(NotificationGrouper.createGroup(groupNotifications, {
            type: 'priority',
            groupingKey: priority
          }));
        } else {
          groups.push(NotificationGrouper.createGroup(groupNotifications, {
            type: 'individual',
            groupingKey: groupNotifications[0].id || 'unknown'
          }));
        }
      }
    });

    return groups;
  }

  /**
   * Apply time window grouping to notifications
   */
  private static applyTimeWindowGrouping(
    notifications: NotificationWithTicket[],
    timeWindowHours: number
  ): NotificationWithTicket[][] {
    if (notifications.length <= 1) {
      return [notifications];
    }

    const groups: NotificationWithTicket[][] = [];
    const sortedNotifications = [...notifications].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let currentGroup: NotificationWithTicket[] = [sortedNotifications[0]];
    let groupStartTime = new Date(sortedNotifications[0].created_at);

    for (let i = 1; i < sortedNotifications.length; i++) {
      const notification = sortedNotifications[i];
      const notificationTime = new Date(notification.created_at);
      const timeDiffHours = (notificationTime.getTime() - groupStartTime.getTime()) / (1000 * 60 * 60);

      if (timeDiffHours <= timeWindowHours) {
        // Add to current group
        currentGroup.push(notification);
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [notification];
        groupStartTime = notificationTime;
      }
    }

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Create a notification group from a list of notifications
   */
  private static createGroup(
    notifications: NotificationWithTicket[],
    metadata: {
      ticketId?: string;
      type: string;
      groupingKey: string;
    }
  ): NotificationGroup {
    if (notifications.length === 0) {
      throw new Error('Cannot create group with empty notifications array');
    }

    // Sort notifications by creation time (newest first)
    const sortedNotifications = [...notifications].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const latestNotification = sortedNotifications[0];
    const oldestNotification = sortedNotifications[sortedNotifications.length - 1];
    const unreadCount = notifications.filter(n => !n.read).length;

    // Determine group priority (highest priority among notifications)
    const priority = NotificationGrouper.determineGroupPriority(notifications);

    // Generate group summary
    const summary = NotificationGrouper.generateGroupSummary(notifications, metadata);

    return {
      id: NotificationGrouper.generateGroupId(metadata.groupingKey, notifications),
      ticketId: metadata.ticketId,
      type: metadata.type,
      notifications: sortedNotifications,
      latestNotification,
      unreadCount,
      createdAt: oldestNotification.created_at,
      updatedAt: latestNotification.created_at,
      priority,
      summary
    };
  }

  /**
   * Determine the priority of a group based on its notifications
   */
  private static determineGroupPriority(notifications: NotificationWithTicket[]): 'low' | 'medium' | 'high' {
    const priorities = notifications.map(n => n.priority || 'medium');
    
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Generate a human-readable summary for a group
   */
  private static generateGroupSummary(
    notifications: NotificationWithTicket[],
    metadata: { ticketId?: string; type: string; groupingKey: string }
  ): string {
    const count = notifications.length;
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (metadata.type === 'ticket' && metadata.ticketId) {
      const ticketNumber = notifications[0].ticket?.ticket_number || `#${metadata.ticketId.slice(-8)}`;
      return `${count} notifications for ticket ${ticketNumber}${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`;
    }
    
    if (metadata.type === 'type') {
      const typeName = NotificationGrouper.getNotificationTypeName(metadata.groupingKey);
      return `${count} ${typeName} notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`;
    }
    
    if (metadata.type === 'priority') {
      return `${count} ${metadata.groupingKey} priority notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`;
    }
    
    return `${count} notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`;
  }

  /**
   * Get human-readable name for notification type
   */
  private static getNotificationTypeName(type: string): string {
    const typeNames: Record<string, string> = {
      'ticket_created': 'ticket creation',
      'ticket_updated': 'ticket update',
      'ticket_assigned': 'ticket assignment',
      'comment_added': 'comment',
      'status_changed': 'status change',
      'priority_changed': 'priority change',
      'assignment_changed': 'assignment change',
      'sla_warning': 'SLA warning',
      'sla_breach': 'SLA breach'
    };
    
    return typeNames[type] || type;
  }

  /**
   * Generate a unique ID for a group
   */
  private static generateGroupId(groupingKey: string, notifications: NotificationWithTicket[]): string {
    const hash = NotificationGrouper.simpleHash(groupingKey + notifications.map(n => n.id).join(''));
    return `group-${hash}`;
  }

  /**
   * Simple hash function for generating group IDs
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Optimize groups by merging small groups and splitting large ones
   */
  private static optimizeGroups(
    groups: NotificationGroup[],
    options: GroupingOptions
  ): NotificationGroup[] {
    const optimizedGroups: NotificationGroup[] = [];
    const maxGroupSize = options.maxGroupSize || 10;

    groups.forEach(group => {
      if (group.notifications.length > maxGroupSize) {
        // Split large groups
        const chunks = NotificationGrouper.chunkArray(group.notifications, maxGroupSize);
        chunks.forEach((chunk, index) => {
          optimizedGroups.push(NotificationGrouper.createGroup(chunk, {
            ticketId: group.ticketId,
            type: `${group.type}-split`,
            groupingKey: `${group.id}-${index}`
          }));
        });
      } else {
        optimizedGroups.push(group);
      }
    });

    // Sort groups by priority and update time
    return optimizedGroups.sort((a, b) => {
      // First sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by update time (newest first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  /**
   * Utility method to chunk array into smaller arrays
   */
  private static chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get available grouping strategies
   */
  static getAvailableStrategies(): GroupingStrategy[] {
    return Object.values(this.GROUPING_STRATEGIES);
  }

  /**
   * Expand a group to show all notifications
   */
  static expandGroup(group: NotificationGroup): NotificationWithTicket[] {
    return group.notifications;
  }

  /**
   * Collapse notifications back into a group summary
   */
  static collapseGroup(notifications: NotificationWithTicket[]): NotificationGroup {
    return NotificationGrouper.createGroup(notifications, {
      type: 'collapsed',
      groupingKey: notifications.map(n => n.id).join('-')
    });
  }

  /**
   * Get group statistics
   */
  static getGroupStatistics(groups: NotificationGroup[]): {
    totalGroups: number;
    totalNotifications: number;
    unreadGroups: number;
    unreadNotifications: number;
    averageGroupSize: number;
    priorityBreakdown: Record<string, number>;
  } {
    const totalGroups = groups.length;
    const totalNotifications = groups.reduce((sum, group) => sum + group.notifications.length, 0);
    const unreadGroups = groups.filter(group => group.unreadCount > 0).length;
    const unreadNotifications = groups.reduce((sum, group) => sum + group.unreadCount, 0);
    const averageGroupSize = totalGroups > 0 ? totalNotifications / totalGroups : 0;
    
    const priorityBreakdown: Record<string, number> = { high: 0, medium: 0, low: 0 };
    groups.forEach(group => {
      priorityBreakdown[group.priority]++;
    });

    return {
      totalGroups,
      totalNotifications,
      unreadGroups,
      unreadNotifications,
      averageGroupSize: Math.round(averageGroupSize * 100) / 100,
      priorityBreakdown
    };
  }
}