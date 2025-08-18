# Design Document

## Overview

This design addresses two critical bugs in the Analy-Ticket application:

1. **Missing Manifest Icons**: The web manifest references icons that don't exist, causing browser console errors
2. **Malformed Supabase Query**: The PostgREST query syntax for filtering tickets is invalid, causing 400 Bad Request errors

The solution involves generating missing icon files and fixing the query construction logic to use proper PostgREST syntax.

## Architecture

### Icon Generation System
- **Icon Source**: Use existing `icon-base.svg` as the source for generating missing icons
- **Generation Process**: Convert SVG to PNG at required sizes using a build-time script
- **Fallback Strategy**: Provide default icons if generation fails

### Query Fix Architecture
- **Problem**: The current `or()` query combines different logical operators incorrectly
- **Solution**: Restructure the query to use proper PostgREST syntax with correct parentheses and operators
- **Error Handling**: Add query validation and fallback mechanisms

## Components and Interfaces

### Icon Generation Component
```typescript
interface IconGenerationService {
  generateMissingIcons(): Promise<void>;
  validateIconExists(iconPath: string): boolean;
  createIconFromSVG(svgPath: string, size: number, outputPath: string): Promise<void>;
}
```

### Query Builder Component
```typescript
interface QueryBuilder {
  buildTicketFilterQuery(options: TicketFilterOptions): string;
  validateQuerySyntax(query: string): boolean;
  buildClosedTicketFilter(): string;
}
```

### Database Service Updates
- **Current Issue**: The `or()` method receives malformed logical expressions
- **Fix**: Restructure the query to use proper PostgREST logical operators
- **Validation**: Add query syntax validation before execution

## Data Models

### Icon Configuration
```typescript
interface IconConfig {
  src: string;
  sizes: string;
  type: string;
  exists: boolean;
}

interface ManifestIcons {
  icons: IconConfig[];
  missingIcons: IconConfig[];
}
```

### Query Filter Models
```typescript
interface TicketFilterQuery {
  baseQuery: string;
  statusFilters: string[];
  timeFilters: string[];
  logicalOperators: string[];
}
```

## Error Handling

### Icon Generation Errors
- **Missing Source SVG**: Log warning and use fallback icon
- **Generation Failure**: Continue with existing icons, log error
- **Permission Issues**: Provide clear error messages for file system access

### Query Construction Errors
- **Syntax Validation**: Validate query before sending to Supabase
- **Fallback Queries**: Use simpler queries if complex ones fail
- **Error Logging**: Detailed logging for debugging malformed queries

### User Experience
- **Loading States**: Show appropriate loading indicators during data fetch
- **Error Messages**: User-friendly error messages instead of technical details
- **Graceful Degradation**: Application continues to function even with some failures

## Testing Strategy

### Icon Generation Testing
- **Unit Tests**: Test icon generation functions with mock file system
- **Integration Tests**: Verify generated icons are valid and accessible
- **Visual Tests**: Ensure generated icons display correctly in browsers

### Query Fix Testing
- **Unit Tests**: Test query builder functions with various filter combinations
- **Integration Tests**: Test actual Supabase queries with real database
- **Error Scenario Tests**: Test handling of malformed queries and network failures

### End-to-End Testing
- **Manifest Validation**: Verify no console errors on application load
- **Ticket Loading**: Verify tickets and counts load correctly
- **Cross-Browser Testing**: Test icon display across different browsers

## Implementation Approach

### Phase 1: Icon Generation
1. Create icon generation utility using Sharp or Canvas API
2. Generate missing icons from base SVG
3. Update build process to include icon generation
4. Validate all manifest icons exist

### Phase 2: Query Fix
1. Analyze current query construction logic
2. Rewrite `buildClosedTicketFilter` method
3. Fix the `or()` query syntax in `getTickets` method
4. Add query validation and error handling

### Phase 3: Testing and Validation
1. Add comprehensive test coverage
2. Validate fixes in development environment
3. Test error scenarios and edge cases
4. Performance testing for query optimizations

## Security Considerations

- **File Generation**: Validate file paths to prevent directory traversal
- **Query Injection**: Ensure query parameters are properly sanitized
- **Error Information**: Avoid exposing sensitive database information in error messages

## Performance Considerations

- **Icon Generation**: Generate icons at build time, not runtime
- **Query Optimization**: Ensure fixed queries are performant
- **Caching**: Cache generated icons and query results appropriately
- **Error Recovery**: Fast fallback mechanisms for failed operations