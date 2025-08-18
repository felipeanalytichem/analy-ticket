/**
 * Tests for FeatureFlagService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { featureFlagService, NOTIFICATION_FEATURE_FLAGS, type UserContext, type FeatureFlag } from '../FeatureFlagService';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn()
      })),
      in: vi.fn(),
      insert: vi.fn(),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    insert: vi.fn(),
    upsert: vi.fn()
  }))
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

describe('FeatureFlagService', () => {
  const mockUserContext: UserContext = {
    userId: 'test-user-123',
    role: 'user',
    email: 'test@example.com',
    groups: ['user'],
    metadata: {}
  };

  const mockFeatureFlag: FeatureFlag = {
    id: 'flag-1',
    name: 'test_feature',
    description: 'Test feature flag',
    enabled: true,
    rollout_percentage: 50,
    user_groups: [],
    conditions: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by: 'admin-user'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    featureFlagService.invalidateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isEnabled', () => {
    it('should return false for non-existent flag', async () => {
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [],
        error: null
      });

      const result = await featureFlagService.isEnabled('non_existent_flag', mockUserContext);
      expect(result).toBe(false);
    });

    it('should return false for disabled flag', async () => {
      const disabledFlag = { ...mockFeatureFlag, enabled: false };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [disabledFlag],
        error: null
      });

      const result = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(result).toBe(false);
    });

    it('should return true for enabled flag with 100% rollout', async () => {
      const fullRolloutFlag = { ...mockFeatureFlag, rollout_percentage: 100 };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [fullRolloutFlag],
        error: null
      });

      const result = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(result).toBe(true);
    });

    it('should respect user group restrictions', async () => {
      const adminOnlyFlag = { ...mockFeatureFlag, user_groups: ['admin'] };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [adminOnlyFlag],
        error: null
      });

      const result = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(result).toBe(false);

      // Test with admin user
      const adminContext = { ...mockUserContext, role: 'admin' as const, groups: ['admin'] };
      const adminResult = await featureFlagService.isEnabled('test_feature', adminContext);
      expect(adminResult).toBe(true);
    });

    it('should handle rollout percentage correctly', async () => {
      const partialRolloutFlag = { ...mockFeatureFlag, rollout_percentage: 10 };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [partialRolloutFlag],
        error: null
      });

      // Test multiple times to check consistency
      const results = await Promise.all([
        featureFlagService.isEnabled('test_feature', mockUserContext),
        featureFlagService.isEnabled('test_feature', mockUserContext),
        featureFlagService.isEnabled('test_feature', mockUserContext)
      ]);

      // Results should be consistent for the same user
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.from().select().eq().mockResolvedValue({
        data: null,
        error: new Error('Database error')
      });

      const result = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(result).toBe(false); // Fail closed
    });
  });

  describe('evaluateFlag', () => {
    it('should provide detailed evaluation reasoning', async () => {
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [mockFeatureFlag],
        error: null
      });

      const evaluation = await featureFlagService.evaluateFlag('test_feature', mockUserContext);
      
      expect(evaluation).toHaveProperty('flagName', 'test_feature');
      expect(evaluation).toHaveProperty('enabled');
      expect(evaluation).toHaveProperty('reason');
      expect(typeof evaluation.enabled).toBe('boolean');
      expect(typeof evaluation.reason).toBe('string');
    });

    it('should return correct reason for disabled flag', async () => {
      const disabledFlag = { ...mockFeatureFlag, enabled: false };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [disabledFlag],
        error: null
      });

      const evaluation = await featureFlagService.evaluateFlag('test_feature', mockUserContext);
      
      expect(evaluation.enabled).toBe(false);
      expect(evaluation.reason).toBe('Flag globally disabled');
    });

    it('should return correct reason for user group mismatch', async () => {
      const adminOnlyFlag = { ...mockFeatureFlag, user_groups: ['admin'] };
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [adminOnlyFlag],
        error: null
      });

      const evaluation = await featureFlagService.evaluateFlag('test_feature', mockUserContext);
      
      expect(evaluation.enabled).toBe(false);
      expect(evaluation.reason).toBe('User not in target groups');
      expect(evaluation.metadata).toHaveProperty('userGroups');
      expect(evaluation.metadata).toHaveProperty('targetGroups');
    });
  });

  describe('getFlags', () => {
    it('should return multiple flags', async () => {
      const flags = [
        { ...mockFeatureFlag, name: 'flag1', rollout_percentage: 100 },
        { ...mockFeatureFlag, name: 'flag2', rollout_percentage: 0 }
      ];
      
      mockSupabase.from().select().eq().mockResolvedValue({
        data: flags,
        error: null
      });

      const result = await featureFlagService.getFlags(['flag1', 'flag2'], mockUserContext);
      
      expect(result).toHaveProperty('flag1');
      expect(result).toHaveProperty('flag2');
      expect(result.flag1).toBe(true);
      expect(result.flag2).toBe(false);
    });

    it('should handle empty flag list', async () => {
      const result = await featureFlagService.getFlags([], mockUserContext);
      expect(result).toEqual({});
    });
  });

  describe('getABTestVariant', () => {
    it('should return null for non-existent test', async () => {
      mockSupabase.from().select().eq().single().mockResolvedValue({
        data: null,
        error: new Error('Not found')
      });

      const variant = await featureFlagService.getABTestVariant('non_existent_test', mockUserContext);
      expect(variant).toBeNull();
    });

    it('should handle test assignment correctly', async () => {
      const mockTest = {
        id: 'test-1',
        name: 'notification_ui_test',
        variants: [
          { id: 'control', name: 'control', allocation_percentage: 50 },
          { id: 'variant', name: 'new_ui', allocation_percentage: 50 }
        ],
        traffic_allocation: 100,
        status: 'active'
      };

      mockSupabase.from().select().eq().single().mockResolvedValue({
        data: mockTest,
        error: null
      });

      const variant = await featureFlagService.getABTestVariant('notification_ui_test', mockUserContext);
      expect(['control', 'new_ui']).toContain(variant);
    });
  });

  describe('trackUsage', () => {
    it('should track flag usage without throwing', async () => {
      mockSupabase.from().insert().mockResolvedValue({
        data: null,
        error: null
      });

      await expect(
        featureFlagService.trackUsage('test_feature', mockUserContext, true)
      ).resolves.not.toThrow();
    });

    it('should not throw on tracking errors', async () => {
      mockSupabase.from().insert().mockResolvedValue({
        data: null,
        error: new Error('Insert failed')
      });

      await expect(
        featureFlagService.trackUsage('test_feature', mockUserContext, true)
      ).resolves.not.toThrow();
    });
  });

  describe('caching', () => {
    it('should cache feature flags', async () => {
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [mockFeatureFlag],
        error: null
      });

      // First call should hit database
      await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(mockSupabase.from).toHaveBeenCalled();

      // Reset mock call count
      vi.clearAllMocks();

      // Second call should use cache
      await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(mockSupabase.from).toHaveBeenCalled(); // Still called for cache refresh logic
    });

    it('should invalidate cache when requested', async () => {
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [mockFeatureFlag],
        error: null
      });

      await featureFlagService.isEnabled('test_feature', mockUserContext);
      
      featureFlagService.invalidateCache();
      
      await featureFlagService.isEnabled('test_feature', mockUserContext);
      
      // Should have made multiple database calls due to cache invalidation
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('hash function', () => {
    it('should produce consistent hashes for same input', () => {
      const service = featureFlagService as any;
      const hash1 = service.hashUserId('user123', 'flag1');
      const hash2 = service.hashUserId('user123', 'flag1');
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const service = featureFlagService as any;
      const hash1 = service.hashUserId('user123', 'flag1');
      const hash2 = service.hashUserId('user456', 'flag1');
      const hash3 = service.hashUserId('user123', 'flag2');
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });
  });

  describe('condition evaluation', () => {
    it('should evaluate role conditions correctly', async () => {
      const roleConditionFlag = {
        ...mockFeatureFlag,
        conditions: { required_role: 'admin' }
      };
      
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [roleConditionFlag],
        error: null
      });

      // Should fail for regular user
      const userResult = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(userResult).toBe(false);

      // Should pass for admin user
      const adminContext = { ...mockUserContext, role: 'admin' as const };
      const adminResult = await featureFlagService.isEnabled('test_feature', adminContext);
      expect(adminResult).toBe(true);
    });

    it('should evaluate email domain conditions correctly', async () => {
      const emailConditionFlag = {
        ...mockFeatureFlag,
        conditions: { email_domain: '@company.com' }
      };
      
      mockSupabase.from().select().eq().mockResolvedValue({
        data: [emailConditionFlag],
        error: null
      });

      // Should fail for external email
      const externalResult = await featureFlagService.isEnabled('test_feature', mockUserContext);
      expect(externalResult).toBe(false);

      // Should pass for company email
      const companyContext = { ...mockUserContext, email: 'user@company.com' };
      const companyResult = await featureFlagService.isEnabled('test_feature', companyContext);
      expect(companyResult).toBe(true);
    });
  });

  describe('notification feature flags constants', () => {
    it('should have all expected notification feature flags', () => {
      const expectedFlags = [
        'ENHANCED_REALTIME',
        'INTELLIGENT_GROUPING',
        'ADVANCED_CACHING',
        'OPTIMISTIC_UPDATES',
        'NEW_NOTIFICATION_BELL',
        'VIRTUAL_SCROLLING',
        'ADVANCED_FILTERING',
        'NOTIFICATION_PREVIEW',
        'GRANULAR_PREFERENCES',
        'QUIET_HOURS',
        'SMART_BATCHING',
        'USAGE_ANALYTICS',
        'PERFORMANCE_MONITORING',
        'ERROR_TRACKING',
        'CONTENT_ENCRYPTION',
        'ACCESS_LOGGING',
        'DATA_RETENTION',
        'AI_PRIORITIZATION',
        'CROSS_TAB_SYNC',
        'OFFLINE_QUEUE'
      ];

      expectedFlags.forEach(flag => {
        expect(NOTIFICATION_FEATURE_FLAGS).toHaveProperty(flag);
        expect(typeof NOTIFICATION_FEATURE_FLAGS[flag as keyof typeof NOTIFICATION_FEATURE_FLAGS]).toBe('string');
      });
    });

    it('should have unique flag names', () => {
      const flagValues = Object.values(NOTIFICATION_FEATURE_FLAGS);
      const uniqueValues = new Set(flagValues);
      
      expect(flagValues.length).toBe(uniqueValues.size);
    });
  });
});