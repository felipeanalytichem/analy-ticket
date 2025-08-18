import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';

// Mock window.location
const mockLocation = {
  href: '',
  reload: vi.fn()
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

// Component that throws an error
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    console.error = vi.fn(); // Suppress error logs in tests
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not render error UI when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display component errors', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText('This component failed to render')).toBeInTheDocument();
    });

    it('should display custom error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('Error Levels', () => {
    it('should render critical error UI', () => {
      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText('Reload Application')).toBeInTheDocument();
      expect(screen.getByText('Go to Home')).toBeInTheDocument();
    });

    it('should render page error UI', () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText(/Try Again/)).toBeInTheDocument();
    });

    it('should render component error UI by default', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();
      expect(screen.getByText(/Retry/)).toBeInTheDocument();
    });
  });

  describe('Retry Functionality', () => {
    it('should allow retrying failed components', () => {
      let shouldThrow = true;
      
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();

      // Simulate fixing the error
      shouldThrow = false;
      
      const retryButton = screen.getByText(/Retry/);
      fireEvent.click(retryButton);

      // The component should recover
      expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
    });

    it('should track retry attempts', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText(/Retry \(3\)/);
      fireEvent.click(retryButton);

      expect(screen.getByText(/Retry \(2\)/)).toBeInTheDocument();
    });

    it('should disable retry after max attempts', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Click retry 3 times
      for (let i = 0; i < 3; i++) {
        const retryButton = screen.getByText(/Retry/);
        fireEvent.click(retryButton);
      }

      expect(screen.getByText(/Component failed after 3 attempts/)).toBeInTheDocument();
      expect(screen.queryByText(/Retry/)).not.toBeInTheDocument();
    });
  });

  describe('Navigation Actions', () => {
    it('should handle go home action', () => {
      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const homeButton = screen.getByText('Go to Home');
      fireEvent.click(homeButton);

      expect(mockLocation.href).toBe('/');
    });

    it('should handle reload action', () => {
      render(
        <ErrorBoundary level="critical">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload Application');
      fireEvent.click(reloadButton);

      expect(mockLocation.reload).toHaveBeenCalled();
    });
  });

  describe('Error Details', () => {
    it('should show error details when enabled', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details')).toBeInTheDocument();
    });

    it('should hide error details by default', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
    });

    it('should show technical details for critical errors', () => {
      render(
        <ErrorBoundary level="critical" showDetails={true}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Technical Details')).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error UI</div>;
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset error state when reset button is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component Error')).toBeInTheDocument();

      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      // Error should be cleared but component might still throw
      // This tests the reset functionality
      expect(screen.getByText('Component Error')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <div>Test Component</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Test Component')).toBeInTheDocument();
  });

  it('should pass through props to wrapped component', () => {
    const TestComponent = ({ message }: { message: string }) => <div>{message}</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent message="Hello World" />);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowError);

    render(<WrappedComponent shouldThrow={true} />);

    expect(screen.getByText('Component Error')).toBeInTheDocument();
  });

  it('should apply error boundary props', () => {
    const onError = vi.fn();
    const WrappedComponent = withErrorBoundary(ThrowError, { 
      onError,
      level: 'page'
    });

    render(<WrappedComponent shouldThrow={true} />);

    expect(screen.getByText('Page Error')).toBeInTheDocument();
    expect(onError).toHaveBeenCalled();
  });

  it('should set display name correctly', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    
    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('should use component name when displayName is not available', () => {
    function TestComponent() {
      return <div>Test</div>;
    }
    
    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });
});