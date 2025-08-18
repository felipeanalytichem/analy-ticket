import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeNetworkError, createNetworkRetryHandler, withNetworkErrorHandling } from '../networkErrorHandler';

describe('networkErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeNetworkError', () => {
    it('should identify ERR_INSUFFICIENT_RESOURCES errors', () => {
      const error = {
        message: 'TypeError: Failed to fetch',
        details: 'ERR_INSUFFICIENT_RESOURCES'
      };

      const result = analyzeNetworkError(error);

      expect(result.type).toBe('insufficient_resources');
      expect(result.retryable).toBe(true);
      expect(result.suggestedDelay).toBe(2000);
    });

    it('should identify Failed to fetch errors', () => {
      const error = {
        message: 'Failed to fetch'
      };

      const result = analyzeNetworkError(error);

      expect(result.type).toBe('failed_fetch');
      expect(result.retryable).toBe(true);
      expect(result.suggestedDelay).toBe(1500);
    });

    it('should identify network errors', () => {
      const error = {
        message: 'NetworkError when attempting to fetch resource'
      };

      const result = analyzeNetworkError(error);

      expect(result.type).toBe('network_error');
      expect(result.retryable).toBe(true);
      expect(result.suggestedDelay).toBe(3000);
    });

    it('should identify timeout errors', () => {
      const error = {
        message: 'Request timeout'
      };

      const result = analyzeNetworkError(error);

      expect(result.type).toBe('timeout');
      expect(result.retryable).toBe(true);
      expect(result.suggestedDelay).toBe(5000);
    });

    it('should handle unknown errors', () => {
      const error = {
        message: 'Some other error'
      };

      const result = analyzeNetworkError(error);

      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
      expect(result.suggestedDelay).toBe(1000);
    });
  });

  describe('createNetworkRetryHandler', () => {
    it('should retry retryable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce({ message: 'Failed to fetch' })
        .mockResolvedValueOnce('success');

      const retryHandler = createNetworkRetryHandler(mockOperation, { maxRetries: 2 });

      const result = await retryHandler({ message: 'Failed to fetch' });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2); // Called twice: first fails, second succeeds
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn();
      const retryHandler = createNetworkRetryHandler(mockOperation, { maxRetries: 2 });

      await expect(retryHandler({ message: 'Some other error' })).rejects.toThrow('Some other error');
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should respect maxRetries limit', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue({ message: 'Failed to fetch' });

      const retryHandler = createNetworkRetryHandler(mockOperation, { maxRetries: 2 });

      await expect(retryHandler({ message: 'Failed to fetch' })).rejects.toThrow('Failed to fetch');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('withNetworkErrorHandling', () => {
    it('should handle successful operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await withNetworkErrorHandling(mockOperation, { showToast: false });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce({ message: 'Failed to fetch' })
        .mockResolvedValueOnce('success');

      const result = await withNetworkErrorHandling(mockOperation, { 
        showToast: false,
        maxRetries: 1
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should throw on non-retryable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue({ message: 'Some other error' });

      await expect(withNetworkErrorHandling(mockOperation, { showToast: false }))
        .rejects.toThrow('Some other error');
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});