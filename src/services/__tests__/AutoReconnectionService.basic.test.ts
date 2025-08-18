import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AutoReconnectionService Basic Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import AutoReconnectionService correctly', async () => {
    const { AutoReconnectionService } = await import('../AutoReconnectionService');
    expect(AutoReconnectionService).toBeDefined();
    expect(typeof AutoReconnectionService).toBe('function');
  });

  it('should create instance with ConnectionMonitor', async () => {
    const { AutoReconnectionService } = await import('../AutoReconnectionService');
    
    // Mock ConnectionMonitor
    const mockConnectionMonitor = {
      performHealthCheck: vi.fn(),
      getConnectionQuality: vi.fn(),
      getConnectionStatus: vi.fn(),
      onConnectionLost: vi.fn(),
      onReconnected: vi.fn(),
      onConnectionChange: vi.fn()
    } as any;

    const service = AutoReconnectionService.createInstance(mockConnectionMonitor);
    expect(service).toBeDefined();
    expect(typeof service.start).toBe('function');
    expect(typeof service.stop).toBe('function');
    
    service.cleanup();
  });
});