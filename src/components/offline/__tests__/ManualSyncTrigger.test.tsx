import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManualSyncTrigger } from '../ManualSyncTrigger';
import { offlineManager } from '@/services/OfflineManager';
import { backgroundSyncManager } from '@/services/BackgroundSyncManager';

// Mock dependencies
vi.mock('@/services/OfflineManager', () => ({
  offlineManager: {
    initialize: vi.fn(),
    isOffline: vi.fn(),
    onOfflineStatusChange: vi.fn()
  }
}));

vi.mock('@/services/BackgroundSyncManager', () => ({
  backgroundSyncManager: {
    getSyncStatus: vi.fn(),
    onSyncProgress: vi.fn(),
    onSyncComplete: vi.fn(),
    onSyncError: vi.fn(),
    forceSyncNow: vi.fn(),
    syncWithFilter: vi.fn()
  }
}));

describe('ManualSyncTrigger', () => {
  let mockOfflineManager: any;
  let mockBackgroundSyncManager: any;

  beforeEach(() => {
    mockOfflineManager = offlineManager as any;
    mockBackgroundSyncManager = backgroundSyncManager as any;

    // Default mock implementations
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.isOffline.mockReturnValue(false);
    mockOfflineManager.onOfflineStatusChange.mockImplementation(() => {});
    
    mockBackgroundSyncManager.getSyncStatus.mockReturnValue({
      isRunning: false,
      lastSync: null,
      nextScheduledSync: null,
      totalActionsSynced: 0,
      totalConflictsResolved: 0,
      averageSyncTime: 0,
      syncHistory: []
    });
    mockBackgroundSyncManager.onSyncProgress.mockImplementation(() => {});
    mockBackgroundSyncManager.onSyncComplete.mockImplementation(() => {});
    mockBackgroundSyncManager.onSyncError.mockImplementation(() => {});
    mockBackgroundSyncManager.forceSyncNow.mockResolvedValue({
      success: true,
      syncedActions: 1,
      failedActions: 0,
      conflicts: [],
      errors: []
    });
    mockBackgroundSyncManager.syncWithFilter.mockResolvedValue({
      success: true,
      syncedActions: 1,
      failedActions: 0,
      conflicts: [],
      errors: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Button Variant', () => {
    it('should render sync button by default', async () => {
      render(<ManualSyncTrigger />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync/i })).toBeInTheDocument();
      });
    });

    it('should show pending actions count in button', async () => {
      // Simulate status change with pending actions
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });

      render(<ManualSyncTrigger />);

      // Trigger status change
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: false,
          lastSync: null,
          pendingActions: 5,
          cachedDataSize: 0,
          syncInProgress: false
        });
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync \(5\)/i })).toBeInTheDocument();
      });
    });

    it('should disable button when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);

      render(<ManualSyncTrigger />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sync/i });
        expect(button).toBeDisabled();
      });
    });

    it('should handle sync button click', async () => {
      render(<ManualSyncTrigger />);

      await waitFor(() => {
        const syncButton = screen.getByRole('button', { name: /sync/i });
        fireEvent.click(syncButton);
      });

      expect(mockBackgroundSyncManager.forceSyncNow).toHaveBeenCalled();
    });
  });

  describe('Compact Variant', () => {
    it('should render compact button', async () => {
      render(<ManualSyncTrigger variant="compact" />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sync/i });
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Card Variant', () => {
    it('should render card with sync controls', async () => {
      render(<ManualSyncTrigger variant="card" />);

      await waitFor(() => {
        expect(screen.getByText('Manual Sync')).toBeInTheDocument();
        expect(screen.getByText('Status:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sync/i })).toBeInTheDocument();
      });
    });

    it('should show online status badge', async () => {
      render(<ManualSyncTrigger variant="card" />);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });

    it('should show offline status badge when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);

      render(<ManualSyncTrigger variant="card" />);

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });

    it('should show pending actions badge', async () => {
      // Simulate status change with pending actions
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger status change
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: false,
          lastSync: null,
          pendingActions: 3,
          cachedDataSize: 0,
          syncInProgress: false
        });
      }

      await waitFor(() => {
        expect(screen.getByText('3 pending')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Progress', () => {
    it('should show sync progress', async () => {
      // Simulate sync progress
      let progressCallback: any;
      mockBackgroundSyncManager.onSyncProgress.mockImplementation((callback) => {
        progressCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger progress update
      if (progressCallback) {
        progressCallback({
          total: 10,
          completed: 7,
          failed: 0,
          inProgress: 1,
          percentage: 70,
          currentAction: 'Syncing tickets',
          estimatedTimeRemaining: 15000
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Progress:')).toBeInTheDocument();
        expect(screen.getByText('70%')).toBeInTheDocument();
        expect(screen.getByText('Syncing tickets')).toBeInTheDocument();
        expect(screen.getByText('7/10 completed')).toBeInTheDocument();
      });
    });

    it('should show syncing state in button', async () => {
      // Simulate sync progress
      let progressCallback: any;
      mockBackgroundSyncManager.onSyncProgress.mockImplementation((callback) => {
        progressCallback = callback;
      });

      render(<ManualSyncTrigger />);

      // Trigger progress update
      if (progressCallback) {
        progressCallback({
          total: 10,
          completed: 5,
          failed: 0,
          inProgress: 1,
          percentage: 50,
          currentAction: 'Syncing...'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Syncing...')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Results', () => {
    it('should show successful sync result', async () => {
      // Simulate sync completion
      let completeCallback: any;
      mockBackgroundSyncManager.onSyncComplete.mockImplementation((callback) => {
        completeCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger sync completion
      if (completeCallback) {
        completeCallback({
          success: true,
          syncedActions: 5,
          failedActions: 0,
          conflicts: [],
          errors: []
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Last sync:')).toBeInTheDocument();
        expect(screen.getByText('✓ Synced 5 items')).toBeInTheDocument();
      });
    });

    it('should show failed sync result', async () => {
      // Simulate sync completion with failures
      let completeCallback: any;
      mockBackgroundSyncManager.onSyncComplete.mockImplementation((callback) => {
        completeCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger sync completion
      if (completeCallback) {
        completeCallback({
          success: false,
          syncedActions: 2,
          failedActions: 3,
          conflicts: [],
          errors: ['Network error', 'Timeout']
        });
      }

      await waitFor(() => {
        expect(screen.getByText('✗ 3 failed, 2 synced')).toBeInTheDocument();
        expect(screen.getByText('Errors: Network error, Timeout')).toBeInTheDocument();
      });
    });

    it('should show conflicts in result', async () => {
      // Simulate sync completion with conflicts
      let completeCallback: any;
      mockBackgroundSyncManager.onSyncComplete.mockImplementation((callback) => {
        completeCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger sync completion
      if (completeCallback) {
        completeCallback({
          success: true,
          syncedActions: 3,
          failedActions: 0,
          conflicts: [
            { actionId: '1', type: 'manual', serverData: {}, clientData: {} },
            { actionId: '2', type: 'server_wins', serverData: {}, clientData: {} }
          ],
          errors: []
        });
      }

      await waitFor(() => {
        expect(screen.getByText('2 conflicts detected')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should show filters when enabled', () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      expect(screen.getByText('Sync Filters')).toBeInTheDocument();
      expect(screen.getByText('Tables:')).toBeInTheDocument();
      expect(screen.getByText('Priorities:')).toBeInTheDocument();
      expect(screen.getByText('Action Types:')).toBeInTheDocument();
    });

    it('should handle table filter selection', async () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      const ticketsCheckbox = screen.getByLabelText('tickets');
      fireEvent.click(ticketsCheckbox);

      expect(ticketsCheckbox).toBeChecked();
    });

    it('should handle priority filter selection', async () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      const highPriorityCheckbox = screen.getByLabelText('high');
      fireEvent.click(highPriorityCheckbox);

      expect(highPriorityCheckbox).toBeChecked();
    });

    it('should handle action type filter selection', async () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      const createCheckbox = screen.getByLabelText('CREATE');
      fireEvent.click(createCheckbox);

      expect(createCheckbox).toBeChecked();
    });

    it('should use filters when syncing', async () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      // Select some filters
      const ticketsCheckbox = screen.getByLabelText('tickets');
      const highPriorityCheckbox = screen.getByLabelText('high');
      const createCheckbox = screen.getByLabelText('CREATE');

      fireEvent.click(ticketsCheckbox);
      fireEvent.click(highPriorityCheckbox);
      fireEvent.click(createCheckbox);

      // Click sync button
      const syncButton = screen.getByRole('button', { name: /sync/i });
      fireEvent.click(syncButton);

      await waitFor(() => {
        expect(mockBackgroundSyncManager.syncWithFilter).toHaveBeenCalledWith({
          tables: ['tickets'],
          priorities: ['high'],
          actionTypes: ['CREATE']
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle sync errors', async () => {
      // Simulate sync error
      let errorCallback: any;
      mockBackgroundSyncManager.onSyncError.mockImplementation((callback) => {
        errorCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger sync error
      if (errorCallback) {
        errorCallback(new Error('Sync failed'));
      }

      await waitFor(() => {
        expect(screen.getByText('✗ 0 failed, 0 synced')).toBeInTheDocument();
      });
    });

    it('should handle initialization errors gracefully', async () => {
      mockOfflineManager.initialize.mockRejectedValue(new Error('Init failed'));

      // Should not throw
      expect(() => {
        render(<ManualSyncTrigger />);
      }).not.toThrow();
    });

    it('should handle sync promise rejection', async () => {
      mockBackgroundSyncManager.forceSyncNow.mockRejectedValue(new Error('Sync failed'));

      render(<ManualSyncTrigger />);

      await waitFor(() => {
        const syncButton = screen.getByRole('button', { name: /sync/i });
        fireEvent.click(syncButton);
      });

      // Should handle error gracefully
      expect(mockBackgroundSyncManager.forceSyncNow).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should disable button during sync', async () => {
      render(<ManualSyncTrigger />);

      const syncButton = screen.getByRole('button', { name: /sync/i });
      fireEvent.click(syncButton);

      // Button should be disabled during sync
      expect(syncButton).toBeDisabled();
    });

    it('should clear result after timeout', async () => {
      vi.useFakeTimers();

      // Simulate sync completion
      let completeCallback: any;
      mockBackgroundSyncManager.onSyncComplete.mockImplementation((callback) => {
        completeCallback = callback;
      });

      render(<ManualSyncTrigger variant="card" />);

      // Trigger sync completion
      if (completeCallback) {
        completeCallback({
          success: true,
          syncedActions: 1,
          failedActions: 0,
          conflicts: [],
          errors: []
        });
      }

      await waitFor(() => {
        expect(screen.getByText('✓ Synced 1 items')).toBeInTheDocument();
      });

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText('✓ Synced 1 items')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', async () => {
      render(<ManualSyncTrigger />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sync/i });
        expect(button).toBeInTheDocument();
      });
    });

    it('should have proper form labels in filters', () => {
      render(<ManualSyncTrigger variant="card" showFilters={true} />);

      expect(screen.getByText('Tables:')).toBeInTheDocument();
      expect(screen.getByText('Priorities:')).toBeInTheDocument();
      expect(screen.getByText('Action Types:')).toBeInTheDocument();
    });
  });
});