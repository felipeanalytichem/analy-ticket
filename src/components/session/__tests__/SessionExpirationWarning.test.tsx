import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionExpirationWarning } from '../SessionExpirationWarning';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useSessionContext } from '@/contexts/SessionContext';

// Mock the hooks
vi.mock('@/hooks/useSessionManager');
vi.mock('@/contexts/SessionContext');

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={className} data-testid="progress" data-value={value}>
      Progress: {value}%
    </div>
  )
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}));

const mockUseSessionManager = vi.mocked(useSessionManager);
const mockUseSessionContext = vi.mocked(useSessionContext);

describe('SessionExpirationWarning', () => {
  const mockExtendSession = vi.fn();
  const mockOnDismiss = vi.fn();
  const mockOnExtend = vi.fn();

  const defaultSessionStatus = {
    isActive: true,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    timeUntilExpiry: 10 * 60 * 1000,
    lastActivity: new Date(),
    refreshToken: 'mock-refresh-token',
    accessToken: 'mock-access-token'
  };

  const defaultSessionManagerReturn = {
    sessionStatus: defaultSessionStatus,
    isSessionActive: true,
    timeUntilExpiry: 10 * 60 * 1000,
    lastActivity: new Date(),
    extendSession: mockExtendSession,
    terminateSession: vi.fn(),
    refreshSession: vi.fn(),
    updateActivity: vi.fn()
  };

  const defaultSessionContextReturn = {
    sessionManager: null,
    tokenRefreshService: null,
    sessionStatus: defaultSessionStatus,
    isInitialized: true,
    isSessionExpiring: false,
    expirationWarningTime: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockUseSessionManager.mockReturnValue(defaultSessionManagerReturn);
    mockUseSessionContext.mockReturnValue(defaultSessionContextReturn);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Visibility', () => {
    it('should not render when session is not expiring', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: false,
        expirationWarningTime: null
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
    });

    it('should render when session is expiring', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000 // 5 minutes
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
      expect(screen.getByText(/Your session will expire in/)).toBeInTheDocument();
    });

    it('should not render when session is not active', () => {
      mockUseSessionManager.mockReturnValue({
        ...defaultSessionManagerReturn,
        sessionStatus: { ...defaultSessionStatus, isActive: false },
        isSessionActive: false
      });

      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
    });
  });

  describe('Countdown Timer', () => {
    it('should display correct time format for minutes and seconds', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000 // 5 minutes
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getAllByText('5:00')).toHaveLength(2); // Main message and progress section
    });

    it('should display seconds only when less than a minute', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 45 * 1000 // 45 seconds
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getAllByText('45s')).toHaveLength(2); // Main message and progress section
    });

    it('should format time correctly', () => {
      // Test different time formats
      const testCases = [
        { time: 5 * 60 * 1000, expected: '5:00' },
        { time: 65 * 1000, expected: '1:05' },
        { time: 45 * 1000, expected: '45s' },
        { time: 1000, expected: '1s' }
      ];

      testCases.forEach(({ time, expected }) => {
        mockUseSessionContext.mockReturnValue({
          ...defaultSessionContextReturn,
          isSessionExpiring: true,
          expirationWarningTime: time
        });

        const { unmount } = render(<SessionExpirationWarning />);
        expect(screen.getAllByText(expected)).toHaveLength(2);
        unmount();
      });
    });
  });

  describe('Urgency Levels', () => {
    it('should show high urgency for less than 1 minute', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 30 * 1000 // 30 seconds
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getByText(/Session will expire very soon/)).toBeInTheDocument();
    });

    it('should show medium urgency for 1-2 minutes', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 90 * 1000 // 1.5 minutes
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.queryByText(/Session will expire very soon/)).not.toBeInTheDocument();
      expect(screen.getAllByText('1:30')).toHaveLength(2);
    });

    it('should show low urgency for more than 2 minutes', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000 // 5 minutes
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.queryByText(/Session will expire very soon/)).not.toBeInTheDocument();
      expect(screen.getAllByText('5:00')).toHaveLength(2);
    });
  });

  describe('Progress Bar', () => {
    it('should show progress bar by default', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getByTestId('progress')).toBeInTheDocument();
    });

    it('should hide progress bar when showProgress is false', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning showProgress={false} />);
      
      expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    });

    it('should show initial progress as 100%', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 10 * 1000 // 10 seconds
      });

      render(<SessionExpirationWarning />);
      
      const progress = screen.getByTestId('progress');
      expect(progress).toHaveAttribute('data-value', '100');
    });
  });

  describe('Session Extension', () => {
    it('should call extendSession when extend button is clicked', () => {
      mockExtendSession.mockResolvedValue(true);
      
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning onExtend={mockOnExtend} />);
      
      const extendButton = screen.getByText('Extend Session');
      fireEvent.click(extendButton);
      
      expect(mockExtendSession).toHaveBeenCalledTimes(1);
    });

    it('should show extend session button', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getByText('Extend Session')).toBeInTheDocument();
    });

    it('should show dismiss button', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning />);
      
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });
  });

  describe('Dismissal', () => {
    it('should hide warning when dismiss button is clicked', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning onDismiss={mockOnDismiss} />);
      
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);
      
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should hide warning when X button is clicked', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning onDismiss={mockOnDismiss} />);
      
      const closeButton = screen.getByLabelText('Dismiss warning');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not show warning again after dismissal until session expiring state changes', () => {
      const { rerender } = render(<SessionExpirationWarning />);
      
      // Initially not expiring
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
      
      // Start expiring
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });
      
      rerender(<SessionExpirationWarning />);
      expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
      
      // Dismiss
      const dismissButton = screen.getByText('Dismiss');
      fireEvent.click(dismissButton);
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
      
      // Re-render with same expiring state - should not show
      rerender(<SessionExpirationWarning />);
      expect(screen.queryByText('Session Expiring Soon')).not.toBeInTheDocument();
      
      // Stop expiring and start again - should show
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: false,
        expirationWarningTime: null
      });
      
      rerender(<SessionExpirationWarning />);
      
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 3 * 60 * 1000
      });
      
      rerender(<SessionExpirationWarning />);
      expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should display custom message when provided', () => {
      const customMessage = 'Your custom session warning message';
      
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning customMessage={customMessage} />);
      
      expect(screen.getByText(customMessage)).toBeInTheDocument();
      expect(screen.queryByText(/Your session will expire in/)).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      const { container } = render(
        <SessionExpirationWarning className="custom-warning-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-warning-class');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      const { container } = render(<SessionExpirationWarning />);
      
      const warning = container.firstChild as HTMLElement;
      expect(warning).toHaveAttribute('role', 'alert');
      expect(warning).toHaveAttribute('aria-live', 'assertive');
      expect(warning).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have accessible dismiss button', () => {
      mockUseSessionContext.mockReturnValue({
        ...defaultSessionContextReturn,
        isSessionExpiring: true,
        expirationWarningTime: 5 * 60 * 1000
      });

      render(<SessionExpirationWarning />);
      
      const closeButton = screen.getByLabelText('Dismiss warning');
      expect(closeButton).toBeInTheDocument();
    });
  });
});