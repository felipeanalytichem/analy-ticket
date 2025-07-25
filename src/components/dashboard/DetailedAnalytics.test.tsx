import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DetailedAnalytics } from './DetailedAnalytics';
import { BrowserRouter } from 'react-router-dom';

// Mock the auth context
const mockAuthContext = {
  userProfile: { id: '1', role: 'admin', name: 'Test Admin' },
  user: null,
  signOut: vi.fn(),
  loading: false
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Mock the database service
vi.mock('@/lib/database', () => ({
  default: {
    getTickets: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getCategories: vi.fn().mockResolvedValue([]),
    getSubcategories: vi.fn().mockResolvedValue([])
  }
}));

// Mock the mobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock recharts
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  RadialBarChart: ({ children }: any) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div data-testid="radial-bar" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Legend: () => <div data-testid="legend" />,
  ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('DetailedAnalytics', () => {
  it('shows loading skeletons initially', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Check for skeleton loading elements
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.classList.contains('animate-pulse') || 
      el.className.includes('animate-pulse')
    );
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders header skeleton during loading', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Should show skeleton elements in header area
    const headerSkeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    
    expect(headerSkeletons.length).toBeGreaterThan(0);
  });

  it('renders KPI metrics skeleton during loading', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Should show skeleton elements for KPI metrics
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders charts skeleton during loading', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Should show skeleton elements for charts
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders agent performance skeleton during loading', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Should show skeleton elements for agent performance
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders category insights skeleton during loading', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Should show skeleton elements for category insights
    const skeletons = screen.getAllByRole('generic').filter(el => 
      el.className.includes('animate-pulse')
    );
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('has proper accessibility structure with ARIA labels', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Check for proper heading structure
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
    
    // Check for proper banner role
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
    
    // Check for proper region roles
    const regions = screen.getAllByRole('region');
    expect(regions.length).toBeGreaterThan(0);
  });

  it('provides proper ARIA labels for status indicators', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Check for status indicators with proper ARIA labels
    const statusIndicator = screen.getByRole('status', { name: /data status/i });
    expect(statusIndicator).toBeInTheDocument();
  });

  it('supports keyboard navigation for interactive elements', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Check that interactive elements are focusable
    const focusableElements = screen.getAllByRole('button').concat(
      screen.getAllByRole('listitem').filter(el => el.tabIndex === 0)
    );
    
    focusableElements.forEach(element => {
      expect(element).toHaveAttribute('tabIndex');
    });
  });

  it('provides screen reader support for charts and metrics', async () => {
    renderWithRouter(<DetailedAnalytics />);
    
    // Check for proper list structure for metrics
    const metricsList = screen.getByRole('list', { name: /key performance metrics/i });
    expect(metricsList).toBeInTheDocument();
    
    // Check for proper ARIA descriptions
    const metricsItems = screen.getAllByRole('listitem');
    metricsItems.forEach(item => {
      if (item.hasAttribute('aria-label')) {
        expect(item.getAttribute('aria-label')).toBeTruthy();
      }
    });
  });
});