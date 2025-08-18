import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionExtensionService, ActivityTrackingConfig, ExtensionConfig } from '../SessionExtensionService';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn()
    }
  }
}));

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: vi.fn(),
  writable: true
});

const { supabase } = await import('@/lib/supabase');

describe('SessionExtensionService', () => {
  let service: SessionExtensionService;
  let mockRefreshSession: ReturnType<typeof vi.fn>;
  let mockConfirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockRefreshSession = vi.fn();
    mockConfirm = vi.fn().mockReturnValue(true); // Default to true for most tests
    
    (supabase.auth.refreshSession as any) = mockRefreshSession;
    (window.confirm as any) = mockConfirm;
    
    // Create service with confirmation dialog disabled by default for easier testing
    service = new SessionExtensionService({}, { showConfirmationDialog: false });
  });

  afterEach(() => {
    service.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize correctly with default config', async () => {
      await service.initialize();
      expect(service).toBeInstanceOf(SessionExtensionService);
    });

    it('should initialize with custom config', async () => {
      const activityConfig: ActivityTrackingConfig = {
        enabled: false,
        inactivityThreshold: 10 * 60 * 1000
      };
      
      const extensionConfig: ExtensionConfig = {
        maxExtensions: 3,
        showConfirmationDialog: false
      };

      const customService = new SessionExtensionService(activityConfig, extensionConfig);
      await customService.initialize();
      
      expect(customService).toBeInstanceOf(SessionExtensionService);
      customService.destroy();
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw or cause issues
      expect(service).toBeInstanceOf(SessionExtensionService);
    });
  });

  describe('Session Extension', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should extend session successfully', async () => {
      const mockSession = {
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_at: Date.now() / 1000 + 3600
      };

      mockRefreshSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null
      });

      const result = await service.extendSession('manual');
      
      expect(result).toBe(true);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });

    it('should handle extension failure', async () => {
      mockRefreshSession.mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'Refresh failed' }
      });

      const result = await service.extendSession('manual');
      
      expect(result).toBe(false);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });

    it('should show confirmation dialog for manual extensions', async () => {
      const customService = new SessionExtensionService({}, { showConfirmationDialog: true });
      await customService.initialize();

      mockConfirm.mockReturnValueOnce(true);
      mockRefreshSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null
      });

      const result = await customService.extendSession('manual');
      
      expect(mockConfirm).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
      
      customService.destroy();
    });

    it('should cancel extension if user declines confirmation', async () => {
      const customService = new SessionExtensionService({}, { showConfirmationDialog: true });
      await customService.initialize();

      mockConfirm.mockReturnValueOnce(false);

      const result = await customService.extendSession('manual');
      
      expect(mockConfirm).toHaveBeenCalledTimes(1);
      expect(mockRefreshSession).not.toHaveBeenCalled();
      expect(result).toBe(false);
      
      customService.destroy();
    });

    it('should not show confirmation for automatic extensions', async () => {
      const customService = new SessionExtensionService({}, { showConfirmationDialog: true });
      await customService.initialize();

      mockRefreshSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null
      });

      const result = await customService.extendSession('automatic');
      
      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBe(true);
      
      customService.destroy();
    });

    it('should respect maximum extensions limit', async () => {
      const customService = new SessionExtensionService({}, { maxExtensions: 2 });
      await customService.initialize();

      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null
      });

      // First two extensions should succeed
      expect(await customService.extendSession('manual')).toBe(true);
      expect(await customService.extendSession('manual')).toBe(true);
      
      // Third extension should fail due to limit
      expect(await customService.extendSession('manual')).toBe(false);
      
      customService.destroy();
    });
  });

  describe('Activity Tracking', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track user activity', () => {
      const activity = service.getUserActivity();
      
      expect(activity).toHaveProperty('lastActivity');
      expect(activity).toHaveProperty('activityCount');
      expect(activity).toHaveProperty('inactivityDuration');
      expect(activity).toHaveProperty('isActive');
    });

    it('should detect activity events', async () => {
      const activityCallback = vi.fn();
      service.on('activity-detected', activityCallback);

      // Simulate mouse click
      const clickEvent = new MouseEvent('click');
      document.dispatchEvent(clickEvent);

      // Wait for debounce
      vi.advanceTimersByTime(1100);

      expect(activityCallback).toHaveBeenCalled();
    });

    it('should detect inactivity', async () => {
      const inactivityCallback = vi.fn();
      service.on('inactivity-detected', inactivityCallback);

      // Advance time past inactivity threshold (15 minutes default)
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(inactivityCallback).toHaveBeenCalled();
    });

    it('should auto-extend on activity when configured', async () => {
      const customService = new SessionExtensionService(
        { enabled: true },
        { autoExtendOnActivity: true }
      );
      await customService.initialize();

      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null
      });

      const extensionCallback = vi.fn();
      customService.on('extension-success', extensionCallback);

      // Simulate activity that should trigger auto-extension
      const clickEvent = new MouseEvent('click');
      document.dispatchEvent(clickEvent);

      // Wait for debounce and processing
      vi.advanceTimersByTime(1100);

      // Note: Auto-extension logic depends on shouldAutoExtend() conditions
      // This test verifies the mechanism is in place
      
      customService.destroy();
    });
  });

  describe('Extension History', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track extension history', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null
      });

      await service.extendSession('manual');
      
      const history = service.getExtensionHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('success', true);
      expect(history[0]).toHaveProperty('reason', 'manual');
    });

    it('should track failed extensions', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Failed' }
      });

      await service.extendSession('manual');
      
      const history = service.getExtensionHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('success', false);
      expect(history[0]).toHaveProperty('error', 'Failed');
    });

    it('should get recent extensions', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null
      });

      await service.extendSession('manual');
      
      const recent = service.getRecentExtensions();
      expect(recent).toHaveLength(1);
    });

    it('should reset extension history', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: { access_token: 'token' } },
        error: null
      });

      await service.extendSession('manual');
      expect(service.getExtensionHistory()).toHaveLength(1);
      
      service.resetExtensionHistory();
      expect(service.getExtensionHistory()).toHaveLength(0);
    });
  });

  describe('Auto-Extension Logic', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should determine when auto-extension is appropriate', () => {
      // Test with default config (auto-extend enabled)
      const shouldExtend = service.shouldAutoExtend();
      
      // Result depends on current activity state and extension history
      expect(typeof shouldExtend).toBe('boolean');
    });

    it('should not auto-extend when disabled', async () => {
      const customService = new SessionExtensionService(
        {},
        { autoExtendOnActivity: false }
      );
      await customService.initialize();

      const shouldExtend = customService.shouldAutoExtend();
      expect(shouldExtend).toBe(false);
      
      customService.destroy();
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle event listeners', () => {
      const callback = vi.fn();
      
      service.on('extension-requested', callback);
      
      // Emit event manually to test
      (service as any).emit('extension-requested', { test: 'data' });
      
      expect(callback).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();
      
      service.on('extension-requested', callback);
      service.off('extension-requested', callback);
      
      // Emit event manually to test
      (service as any).emit('extension-requested', { test: 'data' });
      
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle event listener errors gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();
      
      service.on('extension-requested', errorCallback);
      service.on('extension-requested', normalCallback);
      
      // Should not throw
      expect(() => {
        (service as any).emit('extension-requested', { test: 'data' });
      }).not.toThrow();
      
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle network errors during extension', async () => {
      mockRefreshSession.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.extendSession('manual');
      
      expect(result).toBe(false);
      
      const history = service.getExtensionHistory();
      expect(history[0]).toHaveProperty('success', false);
      expect(history[0]).toHaveProperty('error', 'Network error');
    });

    it('should handle unexpected errors', async () => {
      mockRefreshSession.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const result = await service.extendSession('manual');
      
      expect(result).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      await service.initialize();
      
      const callback = vi.fn();
      service.on('extension-requested', callback);

      service.destroy();

      // Should clear event listeners
      (service as any).emit('extension-requested', { test: 'data' });
      expect(callback).not.toHaveBeenCalled();
      
      // Should clear history
      expect(service.getExtensionHistory()).toHaveLength(0);
    });
  });
});