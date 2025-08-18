import { describe, it, expect } from 'vitest';

describe('Debug Import', () => {
  it('should debug import', async () => {
    try {
      const module = await import('../AutoReconnectionService');
      console.log('Module keys:', Object.keys(module));
      console.log('Module:', module);
      
      expect(true).toBe(true);
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  });
});