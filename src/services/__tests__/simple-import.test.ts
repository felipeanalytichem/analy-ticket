import { describe, it, expect } from 'vitest';

describe('Simple Import', () => {
  it('should import simple service', async () => {
    const { AutoReconnectionService } = await import('../AutoReconnectionService.simple');
    console.log('AutoReconnectionService:', AutoReconnectionService);
    expect(AutoReconnectionService).toBeDefined();
    
    const service = new AutoReconnectionService();
    expect(service).toBeDefined();
  });
});