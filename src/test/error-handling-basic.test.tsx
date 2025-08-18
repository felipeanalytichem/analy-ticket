import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { UserDataErrorState } from '@/components/admin/UserDataErrorState';

describe('Error Handling Components', () => {
  describe('ErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch and display error state', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });

    it('should show retry and reload buttons', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });
  });

  describe('UserDataErrorState', () => {
    const defaultProps = {
      error: 'Network connection failed',
      retryCount: 1,
      maxRetries: 3,
      canRetry: true,
      onRetry: vi.fn(),
      onReset: vi.fn()
    };

    it('should render error state with network error', () => {
      render(<UserDataErrorState {...defaultProps} />);

      expect(screen.getByText('Network Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument();
    });

    it('should show retry count information', () => {
      render(<UserDataErrorState {...defaultProps} />);

      expect(screen.getByText('Retry attempt 1 of 3')).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      const props = { ...defaultProps, onRetry };

      render(<UserDataErrorState {...props} />);

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should disable retry button when max retries reached', () => {
      const props = {
        ...defaultProps,
        retryCount: 3,
        canRetry: false
      };

      render(<UserDataErrorState {...props} />);

      const retryButton = screen.getByRole('button', { name: /max retries reached/i });
      expect(retryButton).toBeDisabled();
    });

    it('should identify database errors correctly', () => {
      const props = {
        ...defaultProps,
        error: 'Database query failed: connection timeout'
      };

      render(<UserDataErrorState {...props} />);

      expect(screen.getByText('Database Error')).toBeInTheDocument();
      expect(screen.getByText(/There was an issue accessing the user database/)).toBeInTheDocument();
    });

    it('should identify timeout errors correctly', () => {
      const props = {
        ...defaultProps,
        error: 'Request timeout after 30 seconds'
      };

      render(<UserDataErrorState {...props} />);

      expect(screen.getByText('Request Timeout')).toBeInTheDocument();
      expect(screen.getByText(/The request took too long to complete/)).toBeInTheDocument();
    });
  });
});