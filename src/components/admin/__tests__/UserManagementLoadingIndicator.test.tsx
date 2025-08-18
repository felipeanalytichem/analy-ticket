import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserManagementLoadingIndicator } from '../UserManagementLoadingIndicator';

// Mock the loading components
vi.mock('../UserManagementSkeleton', () => ({
  UserManagementSkeleton: () => <div data-testid="user-management-skeleton">Loading skeleton</div>
}));

vi.mock('../../ui/SmoothLoadingTransition', () => ({
  SmoothLoadingTransition: ({ isLoading, loadingComponent, children }: any) => (
    <div data-testid="smooth-transition">
      {isLoading ? loadingComponent : children}
    </div>
  )
}));

describe('UserManagementLoadingIndicator', () => {
  const defaultProps = {
    isLoading: false,
    loadingType: null as any,
    error: null,
    authLoading: false,
    isAuthenticated: true,
    hasAdminRole: true,
    retryCount: 0,
    canRetry: true,
    children: <div data-testid="content">Main content</div>
  };

  it('shows authentication loading state', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        authLoading={true}
      />
    );

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
  });

  it('shows authentication required state', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        isAuthenticated={false}
      />
    );

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please log in to access user management.')).toBeInTheDocument();
  });

  it('shows access denied state', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        hasAdminRole={false}
        userRole="user"
      />
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('Administrator privileges required to access user management.')).toBeInTheDocument();
    expect(screen.getByText('Current role: user')).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    const onRetry = vi.fn();
    
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        error="Failed to load users"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Failed to load user data')).toBeInTheDocument();
    expect(screen.getByText('Failed to load users')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows initial loading with skeleton', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        isLoading={true}
        loadingType="initial"
      />
    );

    expect(screen.getByTestId('user-management-skeleton')).toBeInTheDocument();
  });

  it('shows refresh loading state', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        isLoading={true}
        loadingType="refresh"
        operation="user data"
      />
    );

    expect(screen.getByText('Refreshing user data...')).toBeInTheDocument();
  });

  it('shows action loading state', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        isLoading={true}
        loadingType="action"
        operation="user deletion"
      />
    );

    expect(screen.getByText('Processing user deletion...')).toBeInTheDocument();
  });

  it('shows main content when not loading and no errors', () => {
    render(
      <UserManagementLoadingIndicator {...defaultProps} />
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('shows retry count when retrying', () => {
    render(
      <UserManagementLoadingIndicator
        {...defaultProps}
        isLoading={true}
        loadingType="refresh"
        retryCount={2}
      />
    );

    expect(screen.getByText('Retry attempt: 2')).toBeInTheDocument();
  });
});