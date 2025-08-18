import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineDataIndicator } from '../OfflineDataIndicator';
import { offlineManager } from '@/services/OfflineManager';

// Mock dependencies
vi.mock('@/services/OfflineManager', () => ({
  offlineManager: {
    initialize: vi.fn(),
    getCachedData: vi.fn()
  }
}));

describe('OfflineDataIndicator', () => {
  let mockOfflineManager: any;

  beforeEach(() => {
    mockOfflineManager = offlineManager as any;

    // Default mock implementations
    mockOfflineManager.initialize.mockResolvedValue(undefined);
    mockOfflineManager.getCachedData.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Compact Indicator', () => {
    it('should render compact indicator by default', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" />);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should show zero count when no data cached', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([]);

      render(<OfflineDataIndicator table="test_table" />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      render(<OfflineDataIndicator table="test_table" />);

      expect(screen.getByRole('generic')).toBeInTheDocument();
    });

    it('should handle specific item ID', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: 'item1',
          table: 'test_table',
          data: { name: 'Specific Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" itemId="item1" />);

      await waitFor(() => {
        expect(mockOfflineManager.getCachedData).toHaveBeenCalledWith('test_table', 'item1');
      });
    });
  });

  describe('Detailed View', () => {
    it('should render detailed card when showDetails is true', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Offline Data - test_table')).toBeInTheDocument();
        expect(screen.getByText('Status:')).toBeInTheDocument();
        expect(screen.getByText('Items:')).toBeInTheDocument();
        expect(screen.getByText('Size:')).toBeInTheDocument();
        expect(screen.getByText('Last updated:')).toBeInTheDocument();
      });
    });

    it('should show available offline status when data exists', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Available offline')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should show not cached status when no data exists', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Not cached')).toBeInTheDocument();
      });
    });

    it('should show stale data status for old data', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Old Item' },
          timestamp: twoHoursAgo,
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Stale data')).toBeInTheDocument();
      });
    });

    it('should show cache data button', async () => {
      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cache data/i })).toBeInTheDocument();
      });
    });

    it('should show refresh cache button when data exists', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /refresh cache/i })).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format data size correctly', async () => {
      const largeData = { name: 'A'.repeat(1000) }; // Create large data
      
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: largeData,
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        // Should show size in appropriate units
        expect(screen.getByText(/KB|MB|B/)).toBeInTheDocument();
      });
    });

    it('should format last updated time correctly', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: fiveMinutesAgo,
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('5m ago')).toBeInTheDocument();
      });
    });

    it('should show "Just now" for very recent data', async () => {
      const justNow = new Date(Date.now() - 10000); // 10 seconds ago
      
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: justNow,
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should handle cache data button click', async () => {
      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        const cacheButton = screen.getByRole('button', { name: /cache data/i });
        fireEvent.click(cacheButton);
      });

      // Should trigger data availability check
      expect(mockOfflineManager.getCachedData).toHaveBeenCalledTimes(2); // Initial + after click
    });

    it('should handle refresh cache button click', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Test Item' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh cache/i });
        fireEvent.click(refreshButton);
      });

      // Should trigger data availability check
      expect(mockOfflineManager.getCachedData).toHaveBeenCalledTimes(2); // Initial + after click
    });
  });

  describe('Periodic Updates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update data availability periodically', async () => {
      render(<OfflineDataIndicator table="test_table" />);

      // Initial call
      expect(mockOfflineManager.getCachedData).toHaveBeenCalledTimes(1);

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      // Should have made another call
      expect(mockOfflineManager.getCachedData).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      mockOfflineManager.initialize.mockRejectedValue(new Error('Init failed'));

      render(<OfflineDataIndicator table="test_table" />);

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    it('should handle getCachedData errors gracefully', async () => {
      mockOfflineManager.getCachedData.mockRejectedValue(new Error('Cache error'));

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('Not cached')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Items', () => {
    it('should handle multiple cached items', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Item 1' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        },
        {
          id: '2',
          table: 'test_table',
          data: { name: 'Item 2' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        },
        {
          id: '3',
          table: 'test_table',
          data: { name: 'Item 3' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Available offline')).toBeInTheDocument();
      });
    });

    it('should calculate total size for multiple items', async () => {
      mockOfflineManager.getCachedData.mockResolvedValue([
        {
          id: '1',
          table: 'test_table',
          data: { name: 'Item 1' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        },
        {
          id: '2',
          table: 'test_table',
          data: { name: 'Item 2' },
          timestamp: new Date(),
          expiresAt: new Date(Date.now() + 60000),
          version: 1
        }
      ]);

      render(<OfflineDataIndicator table="test_table" showDetails={true} />);

      await waitFor(() => {
        expect(screen.getByText(/B|KB|MB/)).toBeInTheDocument();
      });
    });
  });
});