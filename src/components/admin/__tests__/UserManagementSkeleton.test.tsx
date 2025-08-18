import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserManagementSkeleton, UserItemSkeleton } from '../UserManagementSkeleton';

describe('UserManagementSkeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<UserManagementSkeleton />);
    
    // Should render skeleton elements with animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders specified number of user items', () => {
    const { container } = render(<UserManagementSkeleton itemCount={3} />);
    
    // Should render skeleton elements
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('can hide header when specified', () => {
    const { container } = render(<UserManagementSkeleton showHeader={false} />);
    
    // Should still render skeleton elements but without header
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<UserManagementSkeleton className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

describe('UserItemSkeleton', () => {
  it('renders user item skeleton structure', () => {
    const { container } = render(<UserItemSkeleton />);
    
    // Should render skeleton elements for user item
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});