# Implementation Plan

- [x] 1. Update DatabaseService ticket filtering logic





  - Modify the `getTickets` method in `src/lib/database.ts` to enforce strict user-based filtering for regular users
  - Implement time-based filtering for closed tickets (7-day visibility window)
  - Add new `showAllAgentTickets` option for agents to view other agents' tickets
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.3, 2.4, 2.5, 4.2, 4.3_

- [x] 2. Enhance getTicketById method security





  - Add user permission validation in `getTicketById` method to prevent unauthorized access
  - Implement proper error handling for unauthorized ticket access attempts
  - Add audit logging for security events when users try to access tickets they don't own
  - _Requirements: 1.4, 6.1, 6.2, 6.3_

- [x] 3. Create time-based closed ticket filtering utility





  - Write helper function to calculate if a closed ticket is within the 7-day visibility window
  - Add database query logic to filter closed tickets based on `closed_at` timestamp
  - Create unit tests for the time-based filtering logic
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 4. Add new route and page for "All Agent Tickets" view


  - Create new route `/tickets/all-agents` in the routing configuration
  - Implement page component for displaying all agent tickets with proper filtering
  - Add agent-specific filtering options (by assigned agent, status, priority)
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 5. Update sidebar navigation for agents


  - Add "All Agent Tickets" menu option in the sidebar for users with agent role
  - Ensure the new menu item is only visible to agents and admins
  - Update navigation styling and icons to match existing design
  - _Requirements: 4.1_

- [x] 6. Enhance TicketsPage component with improved filtering




  - Update `src/pages/TicketsPage.tsx` to use the enhanced filtering logic
  - Add proper error handling for unauthorized access scenarios
  - Implement loading states and error messages for filtered ticket views
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

- [x] 7. Update TicketDetail component with access validation





  - Add user permission checks in `src/pages/TicketDetail.tsx` before loading ticket details
  - Implement proper error responses (403 Forbidden) for unauthorized access attempts
  - Add user-friendly error messages when users try to access tickets they don't own
  - _Requirements: 1.4, 6.1, 6.2, 6.3_

- [x] 8. Create security audit logging system


  - Implement logging function for unauthorized ticket access attempts
  - Add audit log entries with user ID, ticket ID, timestamp, and action type
  - Create database table or service for storing security audit logs
  - _Requirements: 6.3, 6.4_

- [ ] 9. Update TicketList component for role-based rendering
  - Modify `src/components/tickets/TicketList.tsx` to handle different filtering scenarios
  - Add visual indicators for agent assignment in the "All Agent Tickets" view
  - Implement conditional rendering based on user permissions and ticket ownership
  - _Requirements: 4.3, 4.4_

- [ ] 10. Add database indexes for performance optimization
  - Create database index on `closed_at` column if not already present
  - Verify existing indexes on `user_id`, `assigned_to`, and `status` columns
  - Add composite indexes for common query patterns (user_id + status, assigned_to + status)
  - _Requirements: Performance optimization for all requirements_

- [ ] 11. Implement comprehensive error handling
  - Create standardized error response format for unauthorized access (403 Forbidden)
  - Add generic error messages to prevent information disclosure
  - Implement proper HTTP status codes for different error scenarios
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 12. Create unit tests for ticket filtering logic
  - Write tests for user role filtering in DatabaseService.getTickets method
  - Test time-based closed ticket filtering functionality
  - Create tests for unauthorized access prevention and error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.5_

- [ ] 13. Create integration tests for security scenarios
  - Test end-to-end user flows for ticket visibility restrictions
  - Verify agents can access "All Agent Tickets" view with proper filtering
  - Test unauthorized access attempts return appropriate error responses
  - _Requirements: 1.4, 4.1, 4.2, 4.3, 6.1, 6.2, 6.3_

- [ ] 14. Update TypeScript interfaces and types
  - Add new options to GetTicketsOptions interface for enhanced filtering
  - Create types for security audit logging and error responses
  - Update existing ticket-related interfaces to support new functionality
  - _Requirements: 4.2, 4.5, 6.3_

- [ ] 15. Add agent ticket assignment indicators
  - Create UI components to clearly show which agent each ticket is assigned to
  - Add visual distinction between own tickets and other agents' tickets
  - Implement filtering dropdown for selecting specific agents in "All Agent Tickets" view
  - _Requirements: 4.3, 4.5_