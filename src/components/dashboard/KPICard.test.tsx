import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KPICard } from './KPICard';
import { Clock } from 'lucide-react';
import { vi } from 'date-fns/locale';

// Mock the mobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}));

describe('KPICard', () => {
  it('renders basic KPI card with title and value', () => {
    render(
      <KPICard
        title="Test Metric"
        value={42}
        color="blue"
        icon={Clock}
      />
    );

    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('displays formatted percentage value', () => {
    render(
      <KPICard
        title="Success Rate"
        value={85}
        color="green"
        icon={Clock}
        format="percentage"
      />
    );

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('displays formatted time value', () => {
    render(
      <KPICard
        title="Response Time"
        value={125}
        color="blue"
        icon={Clock}
        format="time"
      />
    );

    expect(screen.getByText('2h 5m')).toBeInTheDocument();
  });

  it('shows target progress when target is provided', () => {
    render(
      <KPICard
        title="Performance"
        value={80}
        target={100}
        color="blue"
        icon={Clock}
        format="percentage"
      />
    );

    expect(screen.getByText('Target: 100%')).toBeInTheDocument();
    expect(screen.getAllByText('80%')).toHaveLength(2); // Main value and progress percentage
  });

  it('displays trend indicators correctly', () => {
    render(
      <KPICard
        title="Trending Up"
        value={50}
        trend="up"
        color="green"
        icon={Clock}
      />
    );

    expect(screen.getByText('Trending up')).toBeInTheDocument();
  });

  it('shows loading state when loading prop is true', () => {
    const { container } = render(
      <KPICard
        title="Loading Metric"
        value={0}
        color="blue"
        icon={Clock}
        loading={true}
      />
    );

    const card = container.querySelector('.animate-pulse');
    expect(card).toBeInTheDocument();
  });

  it('applies correct color classes', () => {
    const { container } = render(
      <KPICard
        title="Red Metric"
        value={25}
        color="red"
        icon={Clock}
      />
    );

    const card = container.firstChild;
    expect(card).toHaveClass('border-red-200', 'dark:border-red-800');
    expect(card).toHaveClass('bg-red-50', 'dark:bg-red-950/20');
  });
});