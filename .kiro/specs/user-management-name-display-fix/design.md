# Design Document

## Overview

The user management page displays "Name not available" for all users because of a mismatch between the database schema and the component interface. The database stores user names in the `full_name` field, but the component is trying to access a `name` field that doesn't exist in the database query results. This design addresses the data mapping issue and implements proper fallback logic for name display.

## Architecture

The fix involves updating the data transformation layer between the database query and the UI component to properly map the `full_name` field to the expected `name` field, while implementing robust fallback logic for cases where name data is missing.

### Current Data Flow
```
Database (full_name) → Component Interface (name) → UI Display
```

### Proposed Data Flow
```
Database (full_name) → Data Transformation → Component Interface (name) → UI Display with Fallbacks
```

## Components and Interfaces

### 1. Database Query Enhancement
- **Location**: `src/components/admin/UserManagement.tsx` - `loadUsers` function
- **Changes**: Update the data transformation to properly map `full_name` to `name`
- **Rationale**: Ensure consistent data structure between database and component interface

### 2. User Interface Updates
- **Location**: `src/components/admin/UserManagement.tsx` - User interface definition
- **Changes**: Clarify the relationship between `name` and `full_name` fields
- **Rationale**: Maintain backward compatibility while fixing the data mapping

### 3. Name Display Logic Enhancement
- **Location**: `src/components/admin/UserManagement.tsx` - User list rendering
- **Changes**: Implement intelligent fallback logic for name display
- **Rationale**: Provide meaningful information even when name data is incomplete

## Data Models

### Current User Interface
```typescript
interface User {
  id: string;
  name: string;           // ← This field is not properly populated
  email: string;
  role: "user" | "agent" | "admin";
  full_name?: string;     // ← This field contains the actual name data
  // ... other fields
}
```

### Updated Data Transformation
```typescript
// Transform database result to component interface
const transformUser = (dbUser: DatabaseUser): User => ({
  ...dbUser,
  name: dbUser.full_name || extractNameFromEmail(dbUser.email) || 'No name provided'
});
```

### Name Fallback Strategy
1. **Primary**: Use `full_name` if available and not empty
2. **Secondary**: Extract username portion from email (before @)
3. **Tertiary**: Display "No name provided" as final fallback

## Error Handling

### Missing Name Data
- **Scenario**: User has null or empty `full_name`
- **Handling**: Apply fallback strategy (email username → "No name provided")
- **UI Impact**: Consistent styling with subtle indication of missing data

### Database Query Errors
- **Scenario**: Database connection issues or query failures
- **Handling**: Display error state with retry mechanism
- **UI Impact**: Clear error message with action button to retry loading

### Data Transformation Errors
- **Scenario**: Unexpected data structure from database
- **Handling**: Log error and apply safe fallbacks
- **UI Impact**: Graceful degradation with fallback display

## Testing Strategy

### Unit Tests
- **Name Transformation Logic**: Test all fallback scenarios
- **Data Mapping**: Verify correct transformation from database to component interface
- **Edge Cases**: Handle null, undefined, and empty string values

### Integration Tests
- **Database Query**: Verify correct data retrieval and transformation
- **UI Rendering**: Ensure proper display of names and fallbacks
- **Error Scenarios**: Test error handling and recovery

### User Acceptance Tests
- **Name Display**: Verify actual names appear instead of "Name not available"
- **Fallback Behavior**: Confirm appropriate fallbacks for missing data
- **Performance**: Ensure no degradation in page load times

## Implementation Approach

### Phase 1: Data Transformation Fix
1. Update `loadUsers` function to properly map `full_name` to `name`
2. Implement name extraction utility function
3. Apply transformation to all user data before setting state

### Phase 2: Fallback Logic Enhancement
1. Create intelligent name display function
2. Update UI rendering to use enhanced display logic
3. Ensure consistent styling for fallback states

### Phase 3: Error Handling Improvement
1. Add proper error boundaries for data loading
2. Implement retry mechanisms for failed queries
3. Provide user feedback for error states

## Performance Considerations

### Database Query Optimization
- **Current**: Single query selecting all user fields
- **Maintained**: Keep existing query structure for consistency
- **Enhancement**: Ensure proper indexing on frequently accessed fields

### Client-Side Processing
- **Data Transformation**: Minimal overhead for name mapping
- **Fallback Logic**: Efficient string operations with early returns
- **Memory Usage**: No significant impact on existing memory footprint

## Security Considerations

### Data Exposure
- **Name Information**: No additional sensitive data exposed
- **Email Handling**: Existing email display patterns maintained
- **User Privacy**: Fallback logic doesn't reveal additional user information

### Input Validation
- **Database Data**: Trust existing database constraints
- **Transformation Safety**: Handle malformed data gracefully
- **XSS Prevention**: Maintain existing text sanitization practices