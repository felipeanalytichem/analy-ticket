import { NotificationWithTicket } from '@/lib/notificationService';

export interface SearchCriteria {
  query?: string;
  type?: string[];
  priority?: ('low' | 'medium' | 'high')[];
  read?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  ticketId?: string;
  userId?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  criteria: SearchCriteria;
  isDefault?: boolean;
  userId?: string; // For user-specific presets
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  exactMatch?: boolean;
  searchFields?: ('message' | 'title' | 'type')[];
  sortBy?: 'created_at' | 'priority' | 'type' | 'read';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  notifications: NotificationWithTicket[];
  totalCount: number;
  filteredCount: number;
  searchTime: number;
  appliedCriteria: SearchCriteria;
  appliedOptions: SearchOptions;
}

export class NotificationSearchFilter {
  private static readonly DEFAULT_SEARCH_OPTIONS: SearchOptions = {
    caseSensitive: false,
    exactMatch: false,
    searchFields: ['message', 'title', 'type'],
    sortBy: 'created_at',
    sortOrder: 'desc',
    limit: 50,
    offset: 0
  };

  private static readonly DEFAULT_PRESETS: FilterPreset[] = [
    {
      id: 'unread',
      name: 'Unread Notifications',
      description: 'Show only unread notifications',
      criteria: { read: false },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'high-priority',
      name: 'High Priority',
      description: 'Show high priority notifications',
      criteria: { priority: ['high'] },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'today',
      name: 'Today',
      description: 'Notifications from today',
      criteria: {
        dateRange: {
          start: new Date(new Date().setHours(0, 0, 0, 0)),
          end: new Date(new Date().setHours(23, 59, 59, 999))
        }
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ticket-updates',
      name: 'Ticket Updates',
      description: 'Ticket-related notifications',
      criteria: {
        type: ['ticket_created', 'ticket_updated', 'ticket_assigned', 'status_changed']
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'sla-alerts',
      name: 'SLA Alerts',
      description: 'SLA warnings and breaches',
      criteria: {
        type: ['sla_warning', 'sla_breach'],
        priority: ['high']
      },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  private static debounceTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Perform real-time search with debouncing
   */
  static searchWithDebounce(
    notifications: NotificationWithTicket[],
    criteria: SearchCriteria,
    options: Partial<SearchOptions> = {},
    debounceKey: string = 'default',
    debounceMs: number = 300
  ): Promise<SearchResult> {
    return new Promise((resolve) => {
      // Clear existing timer for this key
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(() => {
        const result = this.search(notifications, criteria, options);
        this.debounceTimers.delete(debounceKey);
        resolve(result);
      }, debounceMs);

      this.debounceTimers.set(debounceKey, timer);
    });
  }

  /**
   * Main search method
   */
  static search(
    notifications: NotificationWithTicket[],
    criteria: SearchCriteria,
    options: Partial<SearchOptions> = {}
  ): SearchResult {
    const startTime = Date.now();
    const mergedOptions = { ...this.DEFAULT_SEARCH_OPTIONS, ...options };
    
    let filteredNotifications = [...notifications];
    const totalCount = notifications.length;

    // Apply filters
    filteredNotifications = this.applyFilters(filteredNotifications, criteria);

    // Apply text search
    if (criteria.query && criteria.query.trim()) {
      filteredNotifications = this.applyTextSearch(
        filteredNotifications,
        criteria.query.trim(),
        mergedOptions
      );
    }

    // Apply sorting
    filteredNotifications = this.applySorting(filteredNotifications, mergedOptions);

    // Apply pagination
    const paginatedNotifications = this.applyPagination(filteredNotifications, mergedOptions);

    const searchTime = Date.now() - startTime;

    return {
      notifications: paginatedNotifications,
      totalCount,
      filteredCount: filteredNotifications.length,
      searchTime,
      appliedCriteria: criteria,
      appliedOptions: mergedOptions
    };
  }

  /**
   * Apply various filters to notifications
   */
  private static applyFilters(
    notifications: NotificationWithTicket[],
    criteria: SearchCriteria
  ): NotificationWithTicket[] {
    let filtered = notifications;

    // Filter by type
    if (criteria.type && criteria.type.length > 0) {
      filtered = filtered.filter(notification => 
        criteria.type!.includes(notification.type)
      );
    }

    // Filter by priority
    if (criteria.priority && criteria.priority.length > 0) {
      filtered = filtered.filter(notification => 
        criteria.priority!.includes(notification.priority || 'medium')
      );
    }

    // Filter by read status
    if (criteria.read !== undefined) {
      filtered = filtered.filter(notification => 
        notification.read === criteria.read
      );
    }

    // Filter by date range
    if (criteria.dateRange) {
      filtered = filtered.filter(notification => {
        const notificationDate = new Date(notification.created_at);
        return notificationDate >= criteria.dateRange!.start && 
               notificationDate <= criteria.dateRange!.end;
      });
    }

    // Filter by ticket ID
    if (criteria.ticketId) {
      filtered = filtered.filter(notification => 
        notification.ticket_id === criteria.ticketId
      );
    }

    // Filter by user ID
    if (criteria.userId) {
      filtered = filtered.filter(notification => 
        notification.user_id === criteria.userId
      );
    }

    return filtered;
  }

  /**
   * Apply text search across specified fields
   */
  private static applyTextSearch(
    notifications: NotificationWithTicket[],
    query: string,
    options: SearchOptions
  ): NotificationWithTicket[] {
    const searchFields = options.searchFields || ['message', 'title', 'type'];
    const caseSensitive = options.caseSensitive || false;
    const exactMatch = options.exactMatch || false;

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    return notifications.filter(notification => {
      return searchFields.some(field => {
        let fieldValue = '';
        
        switch (field) {
          case 'message':
            fieldValue = notification.message || '';
            break;
          case 'title':
            fieldValue = notification.title || '';
            break;
          case 'type':
            fieldValue = notification.type || '';
            break;
          default:
            return false;
        }

        if (!caseSensitive) {
          fieldValue = fieldValue.toLowerCase();
        }

        if (exactMatch) {
          return fieldValue === searchQuery;
        } else {
          return fieldValue.includes(searchQuery);
        }
      });
    });
  }

  /**
   * Apply sorting to notifications
   */
  private static applySorting(
    notifications: NotificationWithTicket[],
    options: SearchOptions
  ): NotificationWithTicket[] {
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    return [...notifications].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'created_at':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority || 'medium'];
          bValue = priorityOrder[b.priority || 'medium'];
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'read':
          aValue = a.read ? 1 : 0;
          bValue = b.read ? 1 : 0;
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * Apply pagination to notifications
   */
  private static applyPagination(
    notifications: NotificationWithTicket[],
    options: SearchOptions
  ): NotificationWithTicket[] {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    return notifications.slice(offset, offset + limit);
  }

  /**
   * Get default filter presets
   */
  static getDefaultPresets(): FilterPreset[] {
    return [...this.DEFAULT_PRESETS];
  }

  /**
   * Create a custom filter preset
   */
  static createPreset(
    name: string,
    description: string,
    criteria: SearchCriteria,
    userId?: string
  ): FilterPreset {
    return {
      id: this.generatePresetId(name, userId),
      name,
      description,
      criteria,
      isDefault: false,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Update an existing preset
   */
  static updatePreset(
    preset: FilterPreset,
    updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>
  ): FilterPreset {
    return {
      ...preset,
      ...updates,
      updatedAt: new Date()
    };
  }

  /**
   * Apply a preset to get search criteria
   */
  static applyPreset(preset: FilterPreset): SearchCriteria {
    return { ...preset.criteria };
  }

  /**
   * Combine multiple search criteria
   */
  static combineCriteria(...criteriaList: SearchCriteria[]): SearchCriteria {
    const combined: SearchCriteria = {};

    criteriaList.forEach(criteria => {
      // Combine queries with AND logic
      if (criteria.query) {
        combined.query = combined.query 
          ? `${combined.query} ${criteria.query}` 
          : criteria.query;
      }

      // Combine types with OR logic (union)
      if (criteria.type) {
        combined.type = combined.type 
          ? [...new Set([...combined.type, ...criteria.type])]
          : [...criteria.type];
      }

      // Combine priorities with OR logic (union)
      if (criteria.priority) {
        combined.priority = combined.priority 
          ? [...new Set([...combined.priority, ...criteria.priority])]
          : [...criteria.priority];
      }

      // Read status - last one wins
      if (criteria.read !== undefined) {
        combined.read = criteria.read;
      }

      // Date range - use intersection (most restrictive)
      if (criteria.dateRange) {
        if (combined.dateRange) {
          combined.dateRange = {
            start: new Date(Math.max(
              combined.dateRange.start.getTime(),
              criteria.dateRange.start.getTime()
            )),
            end: new Date(Math.min(
              combined.dateRange.end.getTime(),
              criteria.dateRange.end.getTime()
            ))
          };
        } else {
          combined.dateRange = { ...criteria.dateRange };
        }
      }

      // Ticket ID - last one wins
      if (criteria.ticketId) {
        combined.ticketId = criteria.ticketId;
      }

      // User ID - last one wins
      if (criteria.userId) {
        combined.userId = criteria.userId;
      }
    });

    return combined;
  }

  /**
   * Get search suggestions based on existing notifications
   */
  static getSearchSuggestions(
    notifications: NotificationWithTicket[],
    query: string,
    maxSuggestions: number = 10
  ): string[] {
    if (!query || query.length < 2) {
      return [];
    }

    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();

    notifications.forEach(notification => {
      // Extract words from message and title
      const text = `${notification.message} ${notification.title}`.toLowerCase();
      const words = text.split(/\s+/).filter(word => 
        word.length > 2 && word.includes(lowerQuery)
      );

      words.forEach(word => {
        if (suggestions.size < maxSuggestions) {
          suggestions.add(word);
        }
      });

      // Add notification types as suggestions
      if (notification.type.toLowerCase().includes(lowerQuery)) {
        suggestions.add(notification.type);
      }
    });

    return Array.from(suggestions).slice(0, maxSuggestions);
  }

  /**
   * Get filter statistics for UI display
   */
  static getFilterStatistics(
    notifications: NotificationWithTicket[],
    criteria: SearchCriteria
  ): {
    totalCount: number;
    filteredCount: number;
    typeBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
    readBreakdown: { read: number; unread: number };
    dateBreakdown: { today: number; thisWeek: number; thisMonth: number };
  } {
    const filtered = this.applyFilters(notifications, criteria);
    
    const typeBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<string, number> = {};
    let readCount = 0;
    let unreadCount = 0;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayCount = 0;
    let thisWeekCount = 0;
    let thisMonthCount = 0;

    filtered.forEach(notification => {
      // Type breakdown
      typeBreakdown[notification.type] = (typeBreakdown[notification.type] || 0) + 1;

      // Priority breakdown
      const priority = notification.priority || 'medium';
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

      // Read breakdown
      if (notification.read) {
        readCount++;
      } else {
        unreadCount++;
      }

      // Date breakdown
      const notificationDate = new Date(notification.created_at);
      if (notificationDate >= today) {
        todayCount++;
      }
      if (notificationDate >= thisWeek) {
        thisWeekCount++;
      }
      if (notificationDate >= thisMonth) {
        thisMonthCount++;
      }
    });

    return {
      totalCount: notifications.length,
      filteredCount: filtered.length,
      typeBreakdown,
      priorityBreakdown,
      readBreakdown: { read: readCount, unread: unreadCount },
      dateBreakdown: { today: todayCount, thisWeek: thisWeekCount, thisMonth: thisMonthCount }
    };
  }

  /**
   * Clear all debounce timers
   */
  static clearDebounceTimers(): void {
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Generate a unique ID for a preset
   */
  private static generatePresetId(name: string, userId?: string): string {
    const base = `${name}-${userId || 'global'}-${Date.now()}`;
    return base.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  /**
   * Validate search criteria
   */
  static validateCriteria(criteria: SearchCriteria): string[] {
    const errors: string[] = [];

    if (criteria.dateRange) {
      if (criteria.dateRange.start > criteria.dateRange.end) {
        errors.push('Start date must be before end date');
      }
    }

    if (criteria.query && criteria.query.length > 1000) {
      errors.push('Search query is too long (max 1000 characters)');
    }

    if (criteria.type && criteria.type.length > 20) {
      errors.push('Too many notification types selected (max 20)');
    }

    if (criteria.priority && criteria.priority.length > 3) {
      errors.push('Invalid priority selection');
    }

    return errors;
  }

  /**
   * Export search results to different formats
   */
  static exportResults(
    searchResult: SearchResult,
    format: 'json' | 'csv' = 'json'
  ): string {
    if (format === 'csv') {
      const headers = ['ID', 'Type', 'Priority', 'Title', 'Message', 'Read', 'Created At', 'Ticket ID'];
      const rows = searchResult.notifications.map(notification => [
        notification.id || '',
        notification.type,
        notification.priority || 'medium',
        notification.title,
        notification.message,
        notification.read ? 'Yes' : 'No',
        notification.created_at,
        notification.ticket_id || ''
      ]);

      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    }

    return JSON.stringify(searchResult, null, 2);
  }
}