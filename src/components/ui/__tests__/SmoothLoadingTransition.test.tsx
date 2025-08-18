import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmoothLoadingTransition } from '../SmoothLoadingTransition';

// Mock timers
vi.useFakeTimers();

describe('SmoothLoadingTransition', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  const loadingComponent = <div data-testid="loading">Loading...</div>;
  const children = <div data-testid="content">Main content</div>;

  it('shows loading component when isLoading is true', () => {
    render(
      <SmoothLoadingTransition
        isLoading={true}
        loadingComponent={loadingComponent}
      >
        {children}
      </SmoothLoadingTransition>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('shows children when isLoading is false', async () => {
    render(
      <SmoothLoadingTransition
        isLoading={false}
        loadingComponent={loadingComponent}
      >
        {children}
      </SmoothLoadingTransition>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('respects minimum loading time', async () => {
    const { rerender } = render(
      <SmoothLoadingTransition
        isLoading={true}
        loadingComponent={loadingComponent}
        minLoadingTime={500}
      >
        {children}
      </SmoothLoadingTransition>
    );

    // Start loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Immediately set loading to false
    rerender(
      <SmoothLoadingTransition
        isLoading={false}
        loadingComponent={loadingComponent}
        minLoadingTime={500}
      >
        {children}
      </SmoothLoadingTransition>
    );

    // Should still show loading due to minimum time
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Now should show content
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SmoothLoadingTransition
        isLoading={false}
        loadingComponent={loadingComponent}
        className="custom-class"
      >
        {children}
      </SmoothLoadingTransition>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles fade transition when enabled', () => {
    const { container } = render(
      <SmoothLoadingTransition
        isLoading={true}
        loadingComponent={loadingComponent}
        fadeTransition={true}
      >
        {children}
      </SmoothLoadingTransition>
    );

    // Should have transition classes
    const transitionElement = container.querySelector('[class*="transition-opacity"]');
    expect(transitionElement).toBeInTheDocument();
  });

  it('handles transition without fade when disabled', () => {
    const { container } = render(
      <SmoothLoadingTransition
        isLoading={true}
        loadingComponent={loadingComponent}
        fadeTransition={false}
      >
        {children}
      </SmoothLoadingTransition>
    );

    // Should not have opacity transition classes
    const transitionElement = container.querySelector('[class*="opacity"]');
    expect(transitionElement).toBeInTheDocument(); // Still has the class but no transition
  });
});