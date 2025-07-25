import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChartContainer, ChartContainerSkeleton } from './ChartContainer';

// Mock the mobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}));

describe('ChartContainer', () => {
  it('renders chart content when not loading', () => {
    render(
      <ChartContainer title="Test Chart">
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading is true', () => {
    render(
      <ChartContainer title="Test Chart" loading={true}>
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
  });

  it('shows error state when error is provided', () => {
    const mockRetry = vi.fn();
    render(
      <ChartContainer 
        title="Test Chart" 
        error="Test error message"
        onRetry={mockRetry}
      >
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    expect(screen.getByText('Chart Error')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledOnce();
  });

  it('renders description when provided', () => {
    render(
      <ChartContainer title="Test Chart" description="Test description">
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders action buttons when provided', () => {
    render(
      <ChartContainer 
        title="Test Chart"
        actions={<button>Export</button>}
      >
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <ChartContainer title="Test Chart" height={400}>
        <div data-testid="chart-content">Chart Content</div>
      </ChartContainer>
    );

    const chartContent = screen.getByTestId('chart-content').parentElement;
    expect(chartContent).toHaveStyle({ height: '400px' });
  });
});

describe('ChartContainerSkeleton', () => {
  it('renders single skeleton by default', () => {
    render(<ChartContainerSkeleton />);
    
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('animate-pulse')
    );
    expect(skeletons).toHaveLength(1);
  });

  it('renders multiple skeletons when count is specified', () => {
    render(<ChartContainerSkeleton count={3} />);
    
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('animate-pulse')
    );
    expect(skeletons).toHaveLength(3);
  });
});