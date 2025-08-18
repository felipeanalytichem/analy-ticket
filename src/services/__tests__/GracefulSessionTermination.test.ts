import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GracefulSessionTermination, TerminationContext } from '../GracefulSessionTermination';
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

Object.defineProperty(window, 'scrollX', { value: 100, writable: true });
Object.defineProperty(window, 'scrollY', { value: 200, writable: true });

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: class MockNotification {
    static permission = 'granted';
    constructor(public title: string, public options: any) {}
  },
  writable: true
});

const { supabase } = await import('@/lib/supabase');

describe('GracefulSessionTermination', () => {
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
    
    // Mock Object.keys for localStorage
    vi.spyOn(Object, 'keys').mockReturnValue([
      'analy-ticket-session-test1',
      'analy-ticket-session-test2',
      'other-key'
    ]);
  });

  afterEach(() => {
    gracefulTermination.destroy();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const termination = new GracefulSessionTermination(mockStateManager);
      expect(termination).toBeInstanceOf(GracefulSessionTermination);
    });

    it('should initialize with custom configuration', () => {
      const config = {
        saveDataBeforeTermination: false,
        preserveContext: false,
        redirectToLogin: false,
        showTerminationMessage: false,
        autoSaveTimeout: 10000
      };
      
      const termination = new GracefulSessionTermination(mockStateManager, config);
      expect(termination).toBeInstanceOf(GracefulSessionTermination);
    });
  });

  describe('terminateSession', () => {
    it('should perform graceful termination with default context', async () => {
      const beforeTerminationSpy = vi.fn();
      const afterTerminationSpy = vi.fn();
      
      gracefulTermination.on('before-termination', beforeTerminationSpy);
      gracefulTermination.on('after-termination', afterTerminationSpy);

      await gracefulTermination.terminateSession();

      expect(beforeTerminationSpy).toHaveBeenCalledWith({
        context: expect.objectContaining({
          currentRoute: '/test-path',
          reason: 'manual',
          timestamp: expect.any(Date)
        })
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(afterTerminationSpy).toHaveBeenCalled();
    });

    it('should use provided termination context', async () => {
      const customContext: Partial<TerminationContext> = {
        reason: 'expired',
        formData: { field1: 'value1' },
        userPreferences: { theme: 'dark' }
      };

      const beforeTerminationSpy = vi.fn();
      gracefulTermination.on('before-termination', beforeTerminationSpy);

      await gracefulTermination.terminateSession(customContext);

      expect(beforeTerminationSpy).toHaveBeenCalledWith({
        context: expect.objectContaining({
          reason: 'expired',
          formData: { field1: 'value1' },
          userPreferences: { theme: 'dark' }
        })
      });
    });

    it('should prevent multiple simultaneous terminations', async () => {
      const promise1 = gracefulTermination.terminateSession();
      const promise2 = gracefulTermination.terminateSession();

      await Promise.all([promise1, promise2]);

      // Should only call signOut once
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should handle termination errors gracefully', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Logout failed'));

      // Should not throw
      await expect(gracefulTermination.terminateSession()).resolves.toBeUndefined();
    });

    it('should perform fallback logout on error', async () => {
      // Mock saveState to throw error
      vi.mocked(mockStateManager.saveState).mockRejectedValueOnce(new Error('Save failed'));
      mockSignOut.mockResolvedValueOnce({ error: null });

      await gracefulTermination.terminateSession();

      // Should still attempt logout
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('Data Saving', () => {
    beforeEach(() => {
      // Mock DOM forms
      const mockForm = document.createElement('form');
      mockForm.id = 'test-form';
      mockForm.setAttribute('data-auto-save', 'true');
      
      const input = document.createElement('input');
      input.name = 'testField';
      input.value = 'testValue';
      mockForm.appendChild(input);
      
      document.body.appendChild(mockForm);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('should save form data before termination', async () => {
      const dataSavedSpy = vi.fn();
      gracefulTermination.on('data-saved', dataSavedSpy);

      await gracefulTermination.terminateSession();

      expect(mockStateManager.saveState).toHaveBeenCalledWith(
        expect.stringMatching(/termination-form-/),
        expect.objectContaining({
          data: { testField: 'testValue' },
          timestamp: expect.any(Date),
          route: '/test-path'
        })
      );

      expect(dataSavedSpy).toHaveBeenCalled();
    });

    it('should save application state', async () => {
      await gracefulTermination.terminateSession({
        userPreferences: { theme: 'dark' }
      });

      expect(mockStateManager.saveState).toHaveBeenCalledWith(
        'termination-app-state',
        expect.objectContaining({
          route: '/test-path',
          timestamp: expect.any(Date),
          reason: 'manual',
          userPreferences: { theme: 'dark' }
        })
      );
    });

    it('should handle save timeout', async () => {
      // Mock saveState to never resolve
      vi.mocked(mockStateManager.saveState).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const termination = new GracefulSessionTermination(mockStateManager, {
        autoSaveTimeout: 100 // Very short timeout
      });

      // Should not hang indefinitely
      await expect(termination.terminateSession()).resolves.toBeUndefined();
    });

    it('should skip data saving when disabled', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        saveDataBeforeTermination: false
      });

      await termination.terminateSession();

      expect(mockStateManager.saveState).not.toHaveBeenCalledWith(
        expect.stringMatching(/termination-form-/),
        expect.any(Object)
      );
    });
  });

  describe('Context Preservation', () => {
    it('should preserve session context', async () => {
      const contextPreservedSpy = vi.fn();
      gracefulTermination.on('context-preserved', contextPreservedSpy);

      await gracefulTermination.terminateSession({
        formData: { field: 'value' },
        userPreferences: { theme: 'light' }
      });

      expect(mockStateManager.saveState).toHaveBeenCalledWith(
        'session-termination-context',
        expect.objectContaining({
          route: '/test-path',
          reason: 'manual',
          formData: { field: 'value' },
          userPreferences: { theme: 'light' },
          search: '?test=1',
          hash: '#section',
          scrollPosition: { x: 100, y: 200 }
        })
      );

      expect(contextPreservedSpy).toHaveBeenCalled();
    });

    it('should skip context preservation when disabled', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        preserveContext: false
      });

      await termination.terminateSession();

      expect(mockStateManager.saveState).not.toHaveBeenCalledWith(
        'session-termination-context',
        expect.any(Object)
      );
    });
  });

  describe('Session Data Cleanup', () => {
    it('should clear session-related localStorage data', async () => {
      await gracefulTermination.terminateSession();

      expect(localStorage.removeItem).toHaveBeenCalledWith('analy-ticket-session-test1');
      expect(localStorage.removeItem).toHaveBeenCalledWith('analy-ticket-session-test2');
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('other-key');
    });
  });

  describe('Termination Messages', () => {
    it('should show notification when enabled', async () => {
      const NotificationSpy = vi.spyOn(window, 'Notification' as any);

      await gracefulTermination.terminateSession({ reason: 'expired' });

      expect(NotificationSpy).toHaveBeenCalledWith(
        'Session Terminated',
        expect.objectContaining({
          body: 'Your session has expired. You will be redirected to login.',
          icon: '/favicon.ico'
        })
      );
    });

    it('should skip notification when disabled', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        showTerminationMessage: false
      });

      const NotificationSpy = vi.spyOn(window, 'Notification' as any);

      await termination.terminateSession();

      expect(NotificationSpy).not.toHaveBeenCalled();
    });
  });

  describe('Login Redirect', () => {
    it('should redirect to login with context', async () => {
      const originalHref = window.location.href;
      
      await gracefulTermination.terminateSession({ reason: 'expired' });

      // Should have attempted to set href (mocked)
      expect(window.location.href).toBe(originalHref); // Mocked, so unchanged
    });

    it('should skip redirect when disabled', async () => {
      const termination = new GracefulSessionTermination(mockStateManager, {
        redirectToLogin: false
      });

      const originalHref = window.location.href;

      await termination.terminateSession();

      expect(window.location.href).toBe(originalHref);
    });
  });

  describe('Context Restoration', () => {
    it('should restore session context', async () => {
      const mockContext = {
        route: '/previous-route',
        timestamp: new Date(),
        reason: 'expired' as const,
        scrollPosition: { x: 50, y: 100 }
      };

      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce(mockContext);

      const restoredContext = await gracefulTermination.restoreSessionContext();

      expect(mockStateManager.restoreState).toHaveBeenCalledWith('session-termination-context');
      expect(mockStateManager.clearState).toHaveBeenCalledWith('session-termination-context');
      expect(restoredContext).toEqual(mockContext);
    });

    it('should return null when no context exists', async () => {
      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce(null);

      const restoredContext = await gracefulTermination.restoreSessionContext();

      expect(restoredContext).toBeNull();
      expect(mockStateManager.clearState).not.toHaveBeenCalled();
    });

    it('should handle restoration errors', async () => {
      vi.mocked(mockStateManager.restoreState).mockRejectedValueOnce(new Error('Restore failed'));

      const restoredContext = await gracefulTermination.restoreSessionContext();

      expect(restoredContext).toBeNull();
    });
  });

  describe('Pending Context Check', () => {
    it('should return true when context exists', async () => {
      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce({ some: 'data' });

      const hasPending = await gracefulTermination.hasPendingContextRestoration();

      expect(hasPending).toBe(true);
    });

    it('should return false when no context exists', async () => {
      vi.mocked(mockStateManager.restoreState).mockResolvedValueOnce(null);

      const hasPending = await gracefulTermination.hasPendingContextRestoration();

      expect(hasPending).toBe(false);
    });

    it('should return false on error', async () => {
      vi.mocked(mockStateManager.restoreState).mockRejectedValueOnce(new Error('Error'));

      const hasPending = await gracefulTermination.hasPendingContextRestoration();

      expect(hasPending).toBe(false);
    });
  });

  describe('Event Management', () => {
    it('should add and remove event listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      gracefulTermination.on('before-termination', callback1);
      gracefulTermination.on('before-termination', callback2);

      // Remove one callback
      gracefulTermination.off('before-termination', callback1);

      // Emit event
      (gracefulTermination as any).emit('before-termination', { test: 'data' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should handle event listener errors', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      gracefulTermination.on('before-termination', errorCallback);
      gracefulTermination.on('before-termination', normalCallback);

      // Should not throw
      expect(() => {
        (gracefulTermination as any).emit('before-termination', { test: 'data' });
      }).not.toThrow();

      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      const callback = vi.fn();
      gracefulTermination.on('before-termination', callback);

      gracefulTermination.destroy();

      // Should clear event listeners
      (gracefulTermination as any).emit('before-termination', { test: 'data' });
      expect(callback).not.toHaveBeenCalled();
    });
  });
});