# ChartContainer Component

A reusable container component for charts that provides consistent styling, loading states, error handling, and responsive behavior.

## Features

- **Consistent Styling**: Follows the existing card design patterns with hover effects
- **Loading States**: Built-in skeleton animations during data loading
- **Error Handling**: Graceful error displays with retry functionality
- **Responsive Design**: Mobile-optimized with touch-friendly interactions
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## Props

```typescript
interface ChartContainerProps {
  title: string;                    // Chart title
  children: React.ReactNode;        // Chart content
  actions?: React.ReactNode;        // Optional action buttons (filters, export, etc.)
  loading?: boolean;                // Loading state
  error?: string | null;            // Error message
  height?: number;                  // Chart height in pixels (default: 320)
  className?: string;               // Additional CSS classes
  onRetry?: () => void;            // Retry function for error recovery
  description?: string;             // Optional description text
}
```

## Usage Examples

### Basic Chart Container

```tsx
import { ChartContainer } from "@/components/dashboard/ChartContainer";
import { BarChart, Bar, XAxis, YAxis } from "recharts";

<ChartContainer
  title="Ticket Status Distribution"
  description="Overview of current ticket statuses"
  height={300}
>
  <BarChart data={data}>
    <XAxis dataKey="name" />
    <YAxis />
    <Bar dataKey="value" fill="#3b82f6" />
  </BarChart>
</ChartContainer>
```

### With Loading State

```tsx
<ChartContainer
  title="Performance Metrics"
  loading={isLoading}
  height={400}
>
  <LineChart data={data}>
    {/* Chart content */}
  </LineChart>
</ChartContainer>
```

### With Error Handling

```tsx
<ChartContainer
  title="Agent Performance"
  error={error}
  onRetry={handleRetry}
  height={350}
>
  <PieChart data={data}>
    {/* Chart content */}
  </PieChart>
</ChartContainer>
```

### With Action Buttons

```tsx
<ChartContainer
  title="Ticket Timeline"
  actions={
    <div className="flex gap-2">
      <Button variant="outline" size="sm">
        Export
      </Button>
      <Button variant="outline" size="sm">
        Filter
      </Button>
    </div>
  }
>
  <LineChart data={timelineData}>
    {/* Chart content */}
  </LineChart>
</ChartContainer>
```

### Multiple Chart Skeletons

```tsx
import { ChartContainerSkeleton } from "@/components/dashboard/ChartContainer";

// Show 3 loading skeletons
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <ChartContainerSkeleton count={3} height={300} />
</div>
```

## Responsive Behavior

- **Mobile (< 768px)**: 
  - Reduced padding and font sizes
  - Stacked header layout
  - Horizontal scroll for wide charts
  - Touch-optimized interactions

- **Tablet (768px - 1024px)**:
  - Balanced layout with appropriate spacing
  - Optimized chart sizing

- **Desktop (> 1024px)**:
  - Full layout with maximum information density
  - Hover effects and transitions

## Accessibility Features

- Proper heading hierarchy with CardTitle
- Error states with clear messaging
- Keyboard navigation support
- Screen reader compatible
- High contrast support in dark mode

## Integration with Existing Charts

The ChartContainer works seamlessly with:
- Recharts components (BarChart, LineChart, PieChart, etc.)
- Custom chart implementations
- Third-party chart libraries
- Static chart images or SVGs

## Styling Consistency

The component follows the existing design system:
- Uses the same card styling as KPICard and StatsCards
- Consistent hover effects and transitions
- Proper dark mode support
- Mobile-first responsive design
- Follows the established color palette and spacing