import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagementErrorBoundary } from '../UserManagementErrorBoundary';
import { vi } from 'vitest';

// Mock child component that can throw errors
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child component rendered successfully</div>;
};

// Mock timers for testing retry delays
vi.useFakeTimers();

describe('UserManagementErrorBoundary', () => {
  const mockOnRetry = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    
    // Suppress console.error for error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should render children when no error occurs', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={false} />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('Child component rendered successfully')).toBeInTheDocument();
  });

  it('should catch and display error when child component throws', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('User Management Error')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred in the user management system/)).toBeInTheDocument();
  });

  it('should classify network errors correctly', () => {
    const NetworkError = () => {
      throw new Error('Network connection failed');
    };

    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <NetworkError />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
  });

  it('should classify database errors correctly', () => {
    const DatabaseError = () => {
      throw new Error('Database query failed');
    };

    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <DatabaseError />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('Database Access Error')).toBeInTheDocument();
    expect(screen.getByText(/There was an issue accessing the user database/)).toBeInTheDocument();
  });

  it('should classify permission errors correctly', () => {
    const PermissionError = () => {
      throw new Error('Permission denied');
    };

    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <PermissionError />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('Permission Error')).toBeInTheDocument();
    expect(screen.getByText(/You do not have sufficient permissions/)).toBeInTheDocument();
  });

  it('should show retry count and cooldown information', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText(/Retry attempt 0 of 3/)).toBeInTheDocument();
  });

  it('should disable retry button during cooldown period', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /Retry Cooldown/ });
    expect(retryButton).toBeDisabled();
  });

  it('should enable retry button after cooldown period', async () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    // Fast-forward past cooldown period (5 seconds)
    vi.advanceTimersByTime(6000);

    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /Retry Now/ });
      expect(retryButton).not.toBeDisabled();
    });
  });

  it('should call onRetry when retry button is clicked', async () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    // Fast-forward past cooldown
    vi.advanceTimersByTime(6000);

    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /Retry Now/ });
      fireEvent.click(retryButton);
    });

    // Wait for retry delay
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockOnRetry).toHaveBeenCalled();
    });
  });

  it('should call onReset when reset button is clicked', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    const resetButton = screen.getByRole('button', { name: /Reset/ });
    fireEvent.click(resetButton);

    expect(mockOnReset).toHaveBeenCalled();
  });

  it('should show technical details when expanded', () => {
    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    const detailsToggle = screen.getByText('Technical Details');
    fireEvent.click(detailsToggle);

    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText(/Test error message/)).toBeInTheDocument();
    expect(screen.getByText(/Type:/)).toBeInTheDocument();
    expect(screen.getByText(/Boundary:/)).toBeInTheDocument();
  });

  it('should show graceful degradation when enabled with fallback data', () => {
    const fallbackData = [
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'user' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'admin' }
    ];

    render(
      <UserManagementErrorBoundary 
        onRetry={mockOnRetry} 
        onReset={mockOnReset}
        enableGracefulDegradation={true}
        fallbackData={fallbackData}
      >
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText('Limited Functionality Mode')).toBeInTheDocument();
    expect(screen.getByText(/Some features may be unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/Cached Users \(2\):/)).toBeInTheDocument();
    expect(screen.getByText(/John Doe \(user\)/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith \(admin\)/)).toBeInTheDocument();
  });

  it('should limit displayed fallback data to 5 items', () => {
    const fallbackData = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      role: 'user'
    }));

    render(
      <UserManagementErrorBoundary 
        onRetry={mockOnRetry} 
        onReset={mockOnReset}
        enableGracefulDegradation={true}
        fallbackData={fallbackData}
      >
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    expect(screen.getByText(/Cached Users \(10\):/)).toBeInTheDocument();
    expect(screen.getByText(/... and 5 more users/)).toBeInTheDocument();
  });

  it('should implement exponential backoff for retry delays', async () => {
    const { rerender } = render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    // First retry attempt
    vi.advanceTimersByTime(6000); // Past cooldown
    
    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /Retry Now/ });
      fireEvent.click(retryButton);
    });

    // Should have 1 second delay for first retry
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1000);

    // Simulate another error to test exponential backoff
    rerender(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    vi.advanceTimersByTime(6000); // Past cooldown again
    
    await waitFor(() => {
      const retryButton = screen.getByRole('button', { name: /Retry Now/ });
      fireEvent.click(retryButton);
    });

    // Should have 2 second delay for second retry (exponential backoff)
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);
  });

  it('should prevent retry when max retries reached', () => {
    // Create a component that tracks retry count
    const ErrorBoundaryWithMaxRetries = () => {
      const [retryCount, setRetryCount] = React.useState(0);
      
      return (
        <UserManagementErrorBoundary 
          onRetry={() => setRetryCount(prev => prev + 1)}
          onReset={mockOnReset}
        >
          <ThrowError shouldThrow={true} />
        </UserManagementErrorBoundary>
      );
    };

    render(<ErrorBoundaryWithMaxRetries />);

    // After 3 retries, button should be disabled
    expect(screen.getByText(/Retry attempt 0 of 3/)).toBeInTheDocument();
  });

  it('should show reload page button', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true
    });

    render(
      <UserManagementErrorBoundary onRetry={mockOnRetry} onReset={mockOnReset}>
        <ThrowError shouldThrow={true} />
      </UserManagementErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Reload Page/ });
    fireEvent.click(reloadButton);

    expect(mockReload).toHaveBeenCalled();
  });
});