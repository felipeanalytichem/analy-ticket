import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineModeBanner } from '../OfflineModeBanner';
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
    forceSyncNow: vi.fn()
  }
}));

describe('OfflineModeBanner', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Online State', () => {
    it('should not render when online and showWhenOnline is false', () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      render(<OfflineModeBanner showWhenOnline={false} />);
      
      // Banner should not be visible
      expect(screen.queryByText('Online')).not.toBeInTheDocument();
      expect(screen.queryByText('Working Offline')).not.toBeInTheDocument();
    });

    it('should render when online and showWhenOnline is true', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Last sync: Never')).toBeInTheDocument();
    });

    it('should show sync button when online', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
      });
    });

    it('should handle manual sync when online', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      await waitFor(() => {
        const syncButton = screen.getByRole('button', { name: /sync now/i });
        fireEvent.click(syncButton);
      });
      
      expect(mockBackgroundSyncManager.forceSyncNow).toHaveBeenCalled();
    });
  });

  describe('Offline State', () => {
    it('should render when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      render(<OfflineModeBanner />);
      
      await waitFor(() => {
        expect(screen.getByText('Working Offline')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Changes will sync when online')).toBeInTheDocument();
    });

    it('should not show sync button when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      render(<OfflineModeBanner />);
      
      await waitFor(() => {
        expect(screen.getByText('Working Offline')).toBeInTheDocument();
      });
      
      expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
    });

    it('should show pending actions badge when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      // Simulate status change with pending actions
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });
      
      render(<OfflineModeBanner />);
      
      // Trigger status change
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: true,
          lastSync: null,
          pendingActions: 3,
          cachedDataSize: 1024,
          syncInProgress: false
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText('3 pending')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Progress', () => {
    it('should show sync progress when syncing', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      // Simulate sync progress
      let progressCallback: any;
      mockBackgroundSyncManager.onSyncProgress.mockImplementation((callback) => {
        progressCallback = callback;
      });
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      // Trigger progress update
      if (progressCallback) {
        progressCallback({
          total: 10,
          completed: 5,
          failed: 0,
          inProgress: 1,
          percentage: 50,
          currentAction: 'Syncing tickets',
          estimatedTimeRemaining: 30000
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText('Syncing tickets')).toBeInTheDocument();
        expect(screen.getByText('5/10 (50%)')).toBeInTheDocument();
        expect(screen.getByText('~30s remaining')).toBeInTheDocument();
      });
    });

    it('should show syncing badge during sync', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      // Simulate sync in progress
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      // Trigger status change with sync in progress
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: false,
          lastSync: null,
          pendingActions: 0,
          cachedDataSize: 0,
          syncInProgress: true
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText('Syncing')).toBeInTheDocument();
      });
    });
  });

  describe('Sync Results', () => {
    it('should show success badge after successful sync', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      // Simulate sync completion
      let completeCallback: any;
      mockBackgroundSyncManager.onSyncComplete.mockImplementation((callback) => {
        completeCallback = callback;
      });
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
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
        expect(screen.getByText('Synced')).toBeInTheDocument();
      });
    });

    it('should show error badge after failed sync', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      // Simulate sync error
      let errorCallback: any;
      mockBackgroundSyncManager.onSyncError.mockImplementation((callback) => {
        errorCallback = callback;
      });
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      // Trigger sync error
      if (errorCallback) {
        errorCallback(new Error('Sync failed'));
      }
      
      await waitFor(() => {
        expect(screen.getByText('Sync Failed')).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format data size correctly', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      // Simulate status change with cached data
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });
      
      render(<OfflineModeBanner />);
      
      // Trigger status change with cached data
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: true,
          lastSync: null,
          pendingActions: 0,
          cachedDataSize: 1024 * 1024, // 1MB
          syncInProgress: false
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText(/1 MB cached/)).toBeInTheDocument();
      });
    });

    it('should format last sync time correctly', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      
      // Simulate status change with last sync time
      let statusChangeCallback: any;
      mockOfflineManager.onOfflineStatusChange.mockImplementation((callback) => {
        statusChangeCallback = callback;
      });
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      // Trigger status change with recent sync
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (statusChangeCallback) {
        statusChangeCallback({
          isOffline: false,
          lastSync: fiveMinutesAgo,
          pendingActions: 0,
          cachedDataSize: 0,
          syncInProgress: false
        });
      }
      
      await waitFor(() => {
        expect(screen.getByText('Last sync: 5m ago')).toBeInTheDocument();
      });
    });
  });

  describe('Position and Styling', () => {
    it('should apply top position by default', () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      const { container } = render(<OfflineModeBanner />);
      
      const banner = container.querySelector('.fixed');
      expect(banner).toHaveClass('top-4');
    });

    it('should apply bottom position when specified', () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      const { container } = render(<OfflineModeBanner position="bottom" />);
      
      const banner = container.querySelector('.fixed');
      expect(banner).toHaveClass('bottom-4');
    });

    it('should apply custom className', () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      const { container } = render(<OfflineModeBanner className="custom-class" />);
      
      const banner = container.querySelector('.fixed');
      expect(banner).toHaveClass('custom-class');
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      mockOfflineManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      // Should not throw
      expect(() => {
        render(<OfflineModeBanner />);
      }).not.toThrow();
    });

    it('should handle sync errors gracefully', async () => {
      mockOfflineManager.isOffline.mockReturnValue(false);
      mockBackgroundSyncManager.forceSyncNow.mockRejectedValue(new Error('Sync failed'));
      
      render(<OfflineModeBanner showWhenOnline={true} />);
      
      await waitFor(() => {
        const syncButton = screen.getByRole('button', { name: /sync now/i });
        fireEvent.click(syncButton);
      });
      
      // Should handle error gracefully
      expect(mockBackgroundSyncManager.forceSyncNow).toHaveBeenCalled();
    });
  });
});