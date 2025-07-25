# Design Document

## Overview

This design addresses the critical security and user experience issue where users can currently see all tickets in the system instead of being restricted to only their own tickets. The solution involves modifying the ticket fetching logic in the `DatabaseService.getTickets()` method and ensuring proper filtering is applied based on user roles and ticket status, including the 7-day visibility window for closed tickets.

The current system has a fundamental flaw in the `getTickets` method where the user role filtering logic is not properly enforced for regular users, allowing them to see tickets from other users. This design will fix this issue while maintaining the existing functionality for agents and administrators.

## Architecture

### Current System Analysis

Based on the research, the current ticket visibility system has these components:

1. **Database Layer**: `tickets_new` table with proper RLS policies
2. **Service Layer**: `DatabaseService.getTickets()` method with filtering logic
3. **UI Layer**: `TicketsPage.tsx` and related components
4. **Authentication**: Role-based access through `useAuth` context

### Current Issues Identified

1. **Insufficient User Filtering**: The current `getTickets` method has logic that allows users to see tickets beyond their own
2. **Missing Closed Ticket Time Filtering**: No implementation of the 7-day visibility window for closed tickets
3. **Inconsistent Status Filtering**: The status filtering doesn't properly handle the user-specific requirements

### Proposed Architecture Changes

The solution will modify the existing `DatabaseService.getTickets()` method to:

1. **Enforce strict user-based filtering** for regular users
2. **Implement time-based filtering** for closed tickets
3. **Maintain existing agent/admin functionality**
4. **Add proper error handling** for unauthorized access attempts

## Components and Interfaces

### 1. Database Service Modifications

**File**: `src/lib/database.ts`

The `getTickets` method will be enhanced with:

```typescript
interface GetTicketsOptions {
  userId?: string;
  showAll?: boolean;
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  statusFilter?: string;
  limit?: number;
  userRole?: 'user' | 'agent' | 'admin';
  searchTerm?: string;
  includeClosedTickets?: boolean; // New option for closed ticket visibility
}
```

**Key Changes**:
- Enhanced user role filtering logic
- Time-based filtering for closed tickets (7-day window)
- Improved query construction for user-specific visibility
- Better error handling for unauthorized access

### 2. Ticket Filtering Logic

**User Role Filtering**:
```typescript
// For regular users - strict filtering
if (userRole === 'user' && userId) {
  query = query.eq('user_id', userId);
  
  // Apply status filtering with time-based rules
  if (statusFilter !== 'all') {
    // Include open, in_progress, resolved tickets
    // Include closed tickets only if closed within 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    query = query.or(`
      status.in.(open,in_progress,resolved),
      and(status.eq.closed,closed_at.gte.${sevenDaysAgo.toISOString()})
    `);
  }
}
```

**Agent/Admin Filtering**:
- Agents: See assigned tickets + unassigned tickets (existing functionality)
- Agents: New separate menu to view all agent tickets (new functionality)
- Admins: See all tickets with no restrictions (unchanged)

### 3. Security Enhancements

**Unauthorized Access Prevention**:
- Add validation in `getTicketById` method
- Implement proper error responses for unauthorized access
- Add audit logging for security events

**Database Query Security**:
- Ensure all queries include proper WHERE clauses
- Validate user permissions before executing queries
- Use parameterized queries to prevent injection

### 4. UI Component Updates

**Files to Update**:
- `src/pages/TicketsPage.tsx`: Update ticket loading logic
- `src/pages/TicketDetail.tsx`: Add access validation
- `src/components/tickets/TicketList.tsx`: Handle filtered results
- Sidebar navigation: Add "All Agent Tickets" menu option for agents

**Changes**:
- Add proper error handling for unauthorized access
- Update loading states and error messages
- Ensure consistent filtering across all ticket views
- Add new "All Agent Tickets" view for agents to see other agents' tickets

### 5. New Agent Ticket View

**New Route**: `/tickets/all-agents`

**Functionality**:
- Display tickets assigned to any agent in the system
- Include filtering by assigned agent, status, and priority
- Show clear indication of which agent each ticket is assigned to
- Allow read access to ticket details with restricted modification actions
- Separate from main agent dashboard to avoid clutter

**Database Query Enhancement**:
```typescript
// New option for agent ticket visibility
interface GetTicketsOptions {
  // ... existing options
  showAllAgentTickets?: boolean; // New option for viewing all agent tickets
  excludeUnassigned?: boolean; // Option to exclude unassigned tickets
}

// Agent filtering logic enhancement
if (userRole === 'agent' && showAllAgentTickets) {
  // Show tickets assigned to any agent (not just current user)
  query = query.not('assigned_to', 'is', null);
  // Optionally filter by specific agent if provided
  if (assignedAgentId) {
    query = query.eq('assigned_to', assignedAgentId);
  }
}
```

## Data Models

### Enhanced Ticket Query Structure

```typescript
interface TicketQuery {
  baseQuery: string;
  userFilter: {
    type: 'owner' | 'assigned' | 'all';
    userId?: string;
  };
  statusFilter: {
    statuses: TicketStatus[];
    timeBasedRules: {
      closedTicketDays?: number;
    };
  };
  securityContext: {
    userRole: 'user' | 'agent' | 'admin';
    permissions: string[];
  };
}
```

### Time-Based Filtering Model

```typescript
interface ClosedTicketVisibility {
  isVisible: boolean;
  closedAt: Date;
  daysSinceClosed: number;
  visibilityExpiresAt: Date;
}
```

## Error Handling

### Security Error Responses

1. **Unauthorized Ticket Access**:
   - HTTP 403 Forbidden
   - Generic error message to prevent information disclosure
   - Audit log entry

2. **Invalid Ticket ID**:
   - HTTP 404 Not Found
   - Standard "Ticket not found" message

3. **Database Query Errors**:
   - HTTP 500 Internal Server Error
   - Logged error details (server-side only)
   - Generic user-facing message

### Error Logging Strategy

```typescript
interface SecurityAuditLog {
  timestamp: Date;
  userId: string;
  action: 'unauthorized_ticket_access' | 'invalid_ticket_query';
  ticketId?: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
}
```

## Testing Strategy

### Unit Tests

1. **Database Service Tests**:
   - Test user role filtering logic
   - Test time-based closed ticket filtering
   - Test unauthorized access prevention
   - Test query construction for different scenarios

2. **Security Tests**:
   - Verify users cannot access other users' tickets
   - Test closed ticket visibility window
   - Validate error handling for unauthorized access

### Integration Tests

1. **End-to-End User Flows**:
   - User login and ticket visibility
   - Agent ticket assignment and visibility
   - Admin full access verification

2. **API Security Tests**:
   - Direct API calls with different user roles
   - Ticket ID manipulation attempts
   - Time-based access validation

### Test Scenarios

```typescript
describe('User Ticket Visibility', () => {
  test('User sees only their own tickets');
  test('User sees closed tickets for 7 days only');
  test('User cannot access other users tickets');
  test('Agent sees assigned and unassigned tickets');
  test('Admin sees all tickets');
  test('Unauthorized access returns 403');
});
```

## Performance Considerations

### Database Query Optimization

1. **Indexed Columns**: Ensure proper indexes on:
   - `user_id` (existing)
   - `status` (existing)
   - `closed_at` (may need to add)
   - `created_at` (existing)

2. **Query Efficiency**:
   - Use single query with proper WHERE clauses
   - Avoid N+1 queries for user data
   - Implement pagination for large result sets

### Caching Strategy

1. **User Permission Caching**: Cache user role and permissions
2. **Ticket Count Caching**: Cache ticket counts for dashboard
3. **Query Result Caching**: Short-term caching for frequently accessed data

## Security Measures

### Defense in Depth

1. **Database Level**: RLS policies (already implemented)
2. **Service Level**: Enhanced filtering logic (this design)
3. **API Level**: Request validation and authorization
4. **UI Level**: Conditional rendering based on permissions

### Audit and Monitoring

1. **Security Event Logging**: Log unauthorized access attempts
2. **Performance Monitoring**: Track query performance
3. **Access Pattern Analysis**: Monitor for suspicious activity

## Migration Strategy

### Implementation Phases

1. **Phase 1**: Update `DatabaseService.getTickets()` method
2. **Phase 2**: Add time-based filtering for closed tickets
3. **Phase 3**: Update UI components and error handling
4. **Phase 4**: Add security logging and monitoring

### Rollback Plan

1. **Database Changes**: No schema changes required
2. **Code Changes**: Feature flags for gradual rollout
3. **Monitoring**: Real-time monitoring during deployment

### Testing in Production

1. **Gradual Rollout**: Enable for small percentage of users first
2. **A/B Testing**: Compare old vs new filtering logic
3. **Performance Monitoring**: Ensure no performance degradation