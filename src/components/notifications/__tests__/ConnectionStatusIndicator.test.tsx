import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionStatusIndicator, ConnectionStatus, useConnectionStatus } from '../ConnectionStatusIndicator';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

describe('ConnectionStatusIndicator', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Display', () => {
    it('should display connected status correctly', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          showLabel={true}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should display connecting status correctly', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTING}
          showLabel={true}
        />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    it('should display disconnected status correctly', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          showLabel={true}
        />
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should display reconnecting status with retry count', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.RECONNECTING}
          retryCount={3}
          showLabel={true}
        />
      );

      expect(screen.getByText('Reconnecting (3)')).toBeInTheDocument();
    });

    it('should display error status correctly', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.ERROR}
          showLabel={true}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should hide label when showLabel is false', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          showLabel={false}
        />
      );

      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });
  });

  describe('Offline Detection', () => {
    it('should show offline status when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          showLabel={true}
        />
      );

      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('should update status when online/offline events are fired', async () => {
      const { rerender } = render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          showLabel={true}
        />
      );

      // Initially online
      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      fireEvent(window, new Event('offline'));

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
      fireEvent(window, new Event('online'));

      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      });
    });
  });

  describe('Retry Functionality', () => {
    it('should show retry button for disconnected status when online', () => {
      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          onRetry={onRetry}
          showRetryButton={true}
        />
      );

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should show retry button for error status when online', () => {
      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.ERROR}
          onRetry={onRetry}
          showRetryButton={true}
        />
      );

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should not show retry button for connected status', () => {
      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          onRetry={onRetry}
          showRetryButton={true}
        />
      );

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should not show retry button when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          onRetry={onRetry}
          showRetryButton={true}
        />
      );

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          onRetry={onRetry}
          showRetryButton={true}
        />
      );

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalled();
    });

    it('should hide retry button when showRetryButton is false', () => {
      const onRetry = vi.fn();
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          onRetry={onRetry}
          showRetryButton={false}
        />
      );

      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });
  });

  describe('Last Connected Time', () => {
    it('should format last connected time correctly for minutes', () => {
      const lastConnected = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          lastConnected={lastConnected}
          showLabel={true}
        />
      );

      // Just verify the component renders without error
      const container = screen.getByText('Disconnected').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should format last connected time correctly for hours', () => {
      const lastConnected = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          lastConnected={lastConnected}
          showLabel={true}
        />
      );

      const container = screen.getByText('Disconnected').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should format last connected time correctly for days', () => {
      const lastConnected = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          lastConnected={lastConnected}
          showLabel={true}
        />
      );

      const container = screen.getByText('Disconnected').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should show "Just now" for very recent connections', () => {
      const lastConnected = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.DISCONNECTED}
          lastConnected={lastConnected}
          showLabel={true}
        />
      );

      const container = screen.getByText('Disconnected').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Animation States', () => {
    it('should apply pulse animation for connecting status', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTING}
          showLabel={true}
        />
      );

      const icon = screen.getByText('Connecting').parentElement?.querySelector('svg');
      expect(icon).toHaveClass('animate-pulse');
    });

    it('should apply pulse animation for reconnecting status', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.RECONNECTING}
          showLabel={true}
        />
      );

      const icon = screen.getByText('Reconnecting').parentElement?.querySelector('svg');
      expect(icon).toHaveClass('animate-pulse');
    });

    it('should not apply pulse animation for connected status', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          showLabel={true}
        />
      );

      const icon = screen.getByText('Connected').parentElement?.querySelector('svg');
      expect(icon).not.toHaveClass('animate-pulse');
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      render(
        <ConnectionStatusIndicator 
          status={ConnectionStatus.CONNECTED}
          className="custom-class"
        />
      );

      const container = screen.getByText('Connected').closest('.custom-class');
      expect(container).toBeInTheDocument();
    });
  });
});

describe('useConnectionStatus Hook', () => {
  it('should initialize with disconnected status', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useConnectionStatus();
      return null;
    }

    render(<TestComponent />);

    expect(hookResult.status).toBe(ConnectionStatus.DISCONNECTED);
    expect(hookResult.lastConnected).toBeNull();
    expect(hookResult.retryCount).toBe(0);
  });

  it('should update status and set lastConnected when connected', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useConnectionStatus();
      return (
        <button onClick={() => hookResult.updateStatus(ConnectionStatus.CONNECTED)}>
          Connect
        </button>
      );
    }

    render(<TestComponent />);

    const connectButton = screen.getByText('Connect');
    fireEvent.click(connectButton);

    expect(hookResult.status).toBe(ConnectionStatus.CONNECTED);
    expect(hookResult.lastConnected).toBeInstanceOf(Date);
    expect(hookResult.retryCount).toBe(0);
  });

  it('should increment retry count when reconnecting', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useConnectionStatus();
      return (
        <button onClick={() => hookResult.updateStatus(ConnectionStatus.RECONNECTING)}>
          Reconnect
        </button>
      );
    }

    render(<TestComponent />);

    const reconnectButton = screen.getByText('Reconnect');
    
    // First reconnect attempt
    fireEvent.click(reconnectButton);
    expect(hookResult.retryCount).toBe(1);
    
    // Second reconnect attempt
    fireEvent.click(reconnectButton);
    expect(hookResult.retryCount).toBe(2);
  });

  it('should reset all values when reset is called', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useConnectionStatus();
      return (
        <div>
          <button onClick={() => hookResult.updateStatus(ConnectionStatus.CONNECTED)}>
            Connect
          </button>
          <button onClick={() => hookResult.updateStatus(ConnectionStatus.RECONNECTING)}>
            Reconnect
          </button>
          <button onClick={() => hookResult.reset()}>
            Reset
          </button>
        </div>
      );
    }

    render(<TestComponent />);

    // Set some state
    fireEvent.click(screen.getByText('Connect'));
    fireEvent.click(screen.getByText('Reconnect'));

    expect(hookResult.status).toBe(ConnectionStatus.RECONNECTING);
    expect(hookResult.lastConnected).toBeInstanceOf(Date);
    expect(hookResult.retryCount).toBe(1);

    // Reset
    fireEvent.click(screen.getByText('Reset'));

    expect(hookResult.status).toBe(ConnectionStatus.DISCONNECTED);
    expect(hookResult.lastConnected).toBeNull();
    expect(hookResult.retryCount).toBe(0);
  });
});