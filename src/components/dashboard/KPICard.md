# KPICard Component

The `KPICard` component is an enhanced version of the existing StatsCards pattern, designed to provide better visual hierarchy, trend indicators, and target vs actual comparisons for analytics dashboards.

## Features

- **Trend Indicators**: Visual up/down/neutral trend indicators with color coding
- **Target vs Actual**: Progress bars showing performance against targets
- **Multiple Formats**: Support for time, percentage, and number formatting
- **Responsive Design**: Mobile-first design with touch-friendly interactions
- **Loading States**: Skeleton animations for data loading
- **Accessibility**: WCAG AA compliant with proper ARIA labels
- **Hover Effects**: Smooth transitions and scale effects

## Props

```typescript
interface KPICardProps {
  title: string;                    // Card title/metric name
  value: string | number;           // Current metric value
  target?: string | number;         // Optional target value for comparison
  trend?: 'up' | 'down' | 'neutral'; // Trend direction
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple'; // Color theme
  icon: LucideIcon;                 // Icon component from lucide-react
  format?: 'time' | 'percentage' | 'number'; // Value formatting
  loading?: boolean;                // Show loading state
  className?: string;               // Additional CSS classes
}
```

## Usage Examples

### Basic KPI Card
```tsx
<KPICard
  title="Active Tickets"
  value={127}
  color="blue"
  icon={AlertCircle}
/>
```

### With Target and Trend
```tsx
<KPICard
  title="SLA Compliance"
  value={92}
  target={95}
  trend="down"
  color="green"
  icon={CheckCircle}
  format="percentage"
/>
```

### Time Format
```tsx
<KPICard
  title="Avg Resolution Time"
  value={45}
  target={60}
  trend="up"
  color="blue"
  icon={Clock}
  format="time"
/>
```

### Loading State
```tsx
<KPICard
  title="Loading Metric"
  value={0}
  color="blue"
  icon={Clock}
  loading={true}
/>
```

## Color Themes

Each color theme includes consistent text, background, border, and accent colors:

- **blue**: Primary metrics and general KPIs
- **green**: Success metrics, positive indicators
- **yellow**: Warning metrics, attention items
- **red**: Critical metrics, negative indicators
- **purple**: Secondary metrics, productivity indicators

## Responsive Behavior

- **Mobile (< 768px)**: 2-column grid, reduced padding, smaller icons
- **Tablet (768px - 1024px)**: 2-column grid, balanced sizing
- **Desktop (> 1024px)**: 4-column grid, full sizing

## Grid Layout Recommendations

```tsx
{/* Main KPIs - 4 columns desktop, 2 mobile */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  {/* KPI Cards */}
</div>

{/* Agent Performance - 3 columns desktop, 1 mobile */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Performance Cards */}
</div>

{/* Critical Metrics - 2 columns */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Critical Cards */}
</div>
```

## Integration with Analytics Page

The KPICard can be used to enhance the existing AnalyticsPage by replacing or supplementing the current StatsCards:

```tsx
import { KPICard } from '@/components/dashboard/KPICard';

// In your analytics component
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <KPICard
    title="Avg Resolution Time"
    value={stats.avgResolutionTime}
    target={60}
    trend={getTrend(stats.avgResolutionTime, previousStats.avgResolutionTime)}
    color="blue"
    icon={Clock}
    format="time"
  />
  {/* More KPI cards */}
</div>
```

## Accessibility Features

- Proper ARIA labels for screen readers
- Keyboard navigation support
- High contrast color combinations
- Focus indicators for interactive elements
- Descriptive text for trend indicators

## Performance Considerations

- Uses React.memo for optimized re-rendering
- Efficient CSS transitions
- Skeleton loading states prevent layout shifts
- Responsive images and icons

## Testing

The component includes comprehensive unit tests covering:
- Basic rendering
- Value formatting
- Target progress display
- Trend indicators
- Loading states
- Color themes
- Responsive behavior

Run tests with:
```bash
npm run test -- KPICard.test.tsx
```