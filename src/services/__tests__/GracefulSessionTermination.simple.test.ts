import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GracefulSessionTermination } from '../GracefulSessionTermination';
import { StateManager } from '../StateManager';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn()
    }
  }
}));

vi.mock('../StateManager');

// Mock DOM APIs
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/test-path',
    search: '?test=1',
    hash: '#section',
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000/test-path?test=1#section'
  },
  writable: true
});

const { supabase } = await import('@/lib/supabase');

describe('GracefulSessionTermination - Core Functionality', () => {
  let gracefulTermination: GracefulSessionTermination;
  let mockStateManager: StateManager;
  let mockSignOut: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStateManager = new StateManager();
    mockSignOut = vi.fn().mockResolvedValue({ error: null });
    (supabase.auth.signOut as any) = mockSignOut;
    
    gracefulTermination = new GracefulSessionTermination(mockStateManager);
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    gracefulTermination.destroy();
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize correctly', () => {
      expect(gracefulTermination).toBeInstanceOf(GracefulSessionTermination);
    });

    it('should terminate session successfully', async () => {
      await gracefulTermination.terminateSession();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should handle custom termination context', async () => {
      const context = {
        reason: 'expired' as const,
        formData: { field: 'value' }
      };

      await gracefulTermination.terminateSession(context);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should prevent multiple simultaneous terminations', async () => {
      const promise1 = gracefulTermination.terminateSession();
      const promise2 = gracefulTermination.terminateSession();

      await Promise.all([promise1, promise2]);
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Options', () => {
    it('should respect saveDataBeforeTermination config', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        saveDataBeforeTermination: false
      });

      await termination.terminateSession();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      termination.destroy();
    });

    it('should respect preserveContext config', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        preserveContext: false
      });

      await termination.terminateSession();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      termination.destroy();
    });
  });

  describe('Error Handling', () => {
    it('should handle logout errors gracefully', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Logout failed'));

      // Should not throw
      await expect(gracefulTermination.terminateSession()).resolves.toBeUndefined();
    });

    it('should handle state manager errors', async () => {
      vi.mocked(mockStateManager.saveState).mockRejectedValueOnce(new Error('Save failed'));

      await gracefulTermination.terminateSession();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('Context Restoration', () => {
    it('should restore session context when available', async () => {
      const mockContext = {
        route: '/previous-route',
        timestamp: new Date(),
        reason: 'expired' as const
      };

      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce(mockContext);

      const restoredContext = await gracefulTermination.restoreSessionContext();
      expect(restoredContext).toEqual(mockContext);
      expect(mockStateManager.clearState).toHaveBeenCalledWith('session-termination-context');
    });

    it('should return null when no context exists', async () => {
      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce(null);

      const restoredContext = await gracefulTermination.restoreSessionContext();
      expect(restoredContext).toBeNull();
    });

    it('should check for pending context restoration', async () => {
      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce({ some: 'data' });

      const hasPending = await gracefulTermination.hasPendingContextRestoration();
      expect(hasPending).toBe(true);
    });
  });

  describe('Event Management', () => {
    it('should handle event listeners correctly', () => {
      const callback = vi.fn();
      
      gracefulTermination.on('before-termination', callback);
      
      // Emit event manually to test
      (gracefulTermination as any).emit('before-termination', { test: 'data' });
      
      expect(callback).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should remove event listeners', () => {
      const callback = vi.fn();
      
      gracefulTermination.on('before-termination', callback);
      gracefulTermination.off('before-termination', callback);
      
      // Emit event manually to test
      (gracefulTermination as any).emit('before-termination', { test: 'data' });
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const callback = vi.fn();
      gracefulTermination.on('before-termination', callback);

      gracefulTermination.destroy();

      // Should clear event listeners
      (gracefulTermination as any).emit('before-termination', { test: 'data' });
      expect(callback).not.toHaveBeenCalled();
    });
  });
});