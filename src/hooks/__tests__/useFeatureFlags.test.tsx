/**
 * Tests for useFeatureFlags hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFeatureFlags, useFeatureFlag, useNotificationFeatureFlags, useABTest } from '../useFeatureFlags';

// Mock the auth context
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'user' as const,
  created_at: '2024-01-01T00:00:00Z'
};

const mockUseAuth = vi.fn(() => ({
  user: mockUser
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth
}));

// Mock the feature flag service
const mockFeatureFlagService = {
  getFlags: vi.fn(),
  isEnabled: vi.fn(),
  getABTestVariant: vi.fn(),
  trackUsage: vi.fn()
};

vi.mock('@/services/FeatureFlagService', () => ({
  featureFlagService: mockFeatureFlagService,
  NOTIFICATION_FEATURE_FLAGS: {
    ENHANCED_REALTIME: 'notifications_enhanced_realtime',
    INTELLIGENT_GROUPING: 'notifications_intelligent_grouping',
    ADVANCED_CACHING: 'notifications_advanced_caching'
  }
}));

describe('useFeatureFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useFeatureFlags', () => {
    it('should return loading state initially', () => {
      mockFeatureFlagService.getFlags.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag']));
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.flags).toEqual({});
      expect(result.current.error).toBeNull();
    });

    it('should load flags successfully', async () => {
      const mockFlags = { test_flag: true, another_flag: false };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag', 'another_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.flags).toEqual(mockFlags);
      expect(result.current.error).toBeNull();
      expect(mockFeatureFlagService.getFlags).toHaveBeenCalledWith(
        ['test_flag', 'another_flag'],
        expect.objectContaining({
          userId: mockUser.id,
          role: mockUser.role,
          email: mockUser.email
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to load flags');
      mockFeatureFlagService.getFlags.mockRejectedValue(error);
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.error).toBe('Failed to load flags');
      expect(result.current.flags).toEqual({ test_flag: false }); // Fail closed
    });

    it('should track usage when enabled', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      renderHook(() => useFeatureFlags(['test_flag'], { trackUsage: true }));
      
      await waitFor(() => {
        expect(mockFeatureFlagService.trackUsage).toHaveBeenCalledWith(
          'test_flag',
          expect.objectContaining({ userId: mockUser.id }),
          true
        );
      });
    });

    it('should not track usage when disabled', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      
      renderHook(() => useFeatureFlags(['test_flag'], { trackUsage: false }));
      
      await waitFor(() => {
        expect(mockFeatureFlagService.trackUsage).not.toHaveBeenCalled();
      });
    });

    it('should provide isEnabled helper function', async () => {
      const mockFlags = { test_flag: true, another_flag: false };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag', 'another_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.isEnabled('test_flag')).toBe(true);
      expect(result.current.isEnabled('another_flag')).toBe(false);
      expect(result.current.isEnabled('non_existent_flag')).toBe(false);
    });

    it('should provide getVariant function', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.getABTestVariant.mockResolvedValue('variant_a');
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      const variant = await result.current.getVariant('test_ab_test');
      expect(variant).toBe('variant_a');
      expect(mockFeatureFlagService.getABTestVariant).toHaveBeenCalledWith(
        'test_ab_test',
        expect.objectContaining({ userId: mockUser.id })
      );
    });

    it('should handle refresh functionality', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      // Clear previous calls
      vi.clearAllMocks();
      
      // Call refresh
      await result.current.refresh();
      
      expect(mockFeatureFlagService.getFlags).toHaveBeenCalledTimes(1);
    });

    it('should handle no user gracefully', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      
      const { result } = renderHook(() => useFeatureFlags(['test_flag']));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.flags).toEqual({});
      expect(mockFeatureFlagService.getFlags).not.toHaveBeenCalled();
    });
  });

  describe('useFeatureFlag', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser });
    });

    it('should return single flag state', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlag('test_flag'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.enabled).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should return false for disabled flag', async () => {
      const mockFlags = { test_flag: false };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useFeatureFlag('test_flag'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.enabled).toBe(false);
    });
  });

  describe('useNotificationFeatureFlags', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser });
    });

    it('should provide convenience getters for notification flags', async () => {
      const mockFlags = {
        notifications_enhanced_realtime: true,
        notifications_intelligent_grouping: false,
        notifications_advanced_caching: true
      };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useNotificationFeatureFlags());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.hasEnhancedRealtime).toBe(true);
      expect(result.current.hasIntelligentGrouping).toBe(false);
      expect(result.current.hasAdvancedCaching).toBe(true);
    });

    it('should include all base functionality', async () => {
      const mockFlags = { notifications_enhanced_realtime: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      const { result } = renderHook(() => useNotificationFeatureFlags());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.flags).toBeDefined();
      expect(result.current.isEnabled).toBeDefined();
      expect(result.current.refresh).toBeDefined();
      expect(result.current.getVariant).toBeDefined();
    });
  });

  describe('useABTest', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser });
    });

    it('should return A/B test variant', async () => {
      mockFeatureFlagService.getABTestVariant.mockResolvedValue('variant_a');
      
      const { result } = renderHook(() => useABTest('test_ab_test'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.variant).toBe('variant_a');
      expect(result.current.isInTest).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle no variant assignment', async () => {
      mockFeatureFlagService.getABTestVariant.mockResolvedValue(null);
      
      const { result } = renderHook(() => useABTest('test_ab_test'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.variant).toBeNull();
      expect(result.current.isInTest).toBe(false);
    });

    it('should handle A/B test errors', async () => {
      const error = new Error('A/B test error');
      mockFeatureFlagService.getABTestVariant.mockRejectedValue(error);
      
      const { result } = renderHook(() => useABTest('test_ab_test'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.variant).toBeNull();
      expect(result.current.error).toBe('A/B test error');
      expect(result.current.isInTest).toBe(false);
    });

    it('should handle no user for A/B test', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      
      const { result } = renderHook(() => useABTest('test_ab_test'));
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.variant).toBeNull();
      expect(result.current.isInTest).toBe(false);
      expect(mockFeatureFlagService.getABTestVariant).not.toHaveBeenCalled();
    });
  });

  describe('refresh interval', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: mockUser });
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should refresh flags at specified interval', async () => {
      const mockFlags = { test_flag: true };
      mockFeatureFlagService.getFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.trackUsage.mockResolvedValue(undefined);
      
      renderHook(() => useFeatureFlags(['test_flag'], { refreshInterval: 60000 })); // 1 minute
      
      // Wait for initial load
      await waitFor(() => {
        expect(mockFeatureFlagService.getFlags).toHaveBeenCalledTimes(1);
      });
      
      // Clear previous calls
      vi.clearAllMocks();
      
      // Fast-forward time
      vi.advanceTimersByTime(60000);
      
      await waitFor(() => {
        expect(mockFeatureFlagService.getFlags).toHaveBeenCalledTimes(1);
      });
    });
  });
});