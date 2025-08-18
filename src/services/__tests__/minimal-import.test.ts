import { describe, it, expect } from 'vitest';

describe('Minimal Import', () => {
  it('should import minimal service', async () => {
    const { AutoReconnectionService } = await import('../AutoReconnectionService.minimal');
    console.log('AutoReconnectionService:', AutoReconnectionService);
    expect(AutoReconnectionService).toBeDefined();
    
    const service = new AutoReconnectionService();
    expect(service).toBeDefined();
    service.start();
  });
});