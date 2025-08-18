import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConsolidatedLoading } from '@/hooks/useConsolidatedLoading';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

// Mock useAuth for useOptimizedAuth tests
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('UserManagement Hooks Stability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useConsolidatedLoading', () => {
    it('should handle loading state transitions without flickering', async () => {
      const { result } = renderHook(() => 
        useConsolidatedLoading({
          maxRetries: 3,
          retryDelay: 1000,
          enableGracefulDegradation: true
        })
      );

      // Initial state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.retryCount).toBe(0);

      // Execute loading operation
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      let loadingPromise: Promise<any>;
      act(() => {
        loadingPromise = result.current.executeWithLoading(
          mockOperation,
          'initial',
          'test operation'
        );
      });

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.loadingType).toBe('initial');
      expect(result.current.operation).toBe('test operation');

      // Wait for completion
      await act(async () => {
        await loadingPromise!;
      });

      // Should be completed
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle retry operations with stable state transitions', async () => {
      let callCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve('success');
      });

      const { result } = renderHook(() => 
        useConsolidatedLoading({
          maxRetries: 3,
          retryDelay: 100
        })
      );

      // First attempt should fail
      let loadingPromise: Promise<any>;
      act(() => {
        loadingPromise = result.current.executeWithLoading(
          mockOperation,
          'initial',
          'test operation'
        );
      });

      await act(async () => {
        try {
          await loadingPromise!;
        } catch (error) {
          // Expected to fail
        }
      });

      // Should have error and be retryable
      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);

      // Retry should succeed
      act(() => {
        loadingPromise = result.current.retry();
      });

      await act(async () => {
        await loadingPromise!;
      });

      // Should be successful
      expect(result.current.error).toBe(null);
      expect(result.current.retryCount).toBe(2);
    });
  });

  describe('usePerformanceMonitor', () => {
    it('should track render performance without memory leaks', () => {
      const { result, rerender } = renderHook(() => 
        usePerformanceMonitor({
          componentName: 'TestComponent',
          enableMemoryTracking: true,
          logThreshold: 16
        })
      );

      // Initial state
      expect(result.current.metrics.componentName).toBe('TestComponent');
      expect(result.current.metrics.renderCount).toBe(0);

      // Trigger multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender();
      }

      // Should track renders
      expect(result.current.metrics.renderCount).toBeGreaterThan(0);
      expect(result.current.metrics.renderCount).toBeLessThanOrEqual(10);
    });

    it('should reset metrics correctly', () => {
      const { result, rerender } = renderHook(() => 
        usePerformanceMonitor({
          componentName: 'TestComponent'
        })
      );

      // Trigger some renders
      rerender();
      rerender();

      // Reset metrics
      act(() => {
        result.current.resetMetrics();
      });

      // Should be reset
      expect(result.current.metrics.renderCount).toBe(0);
      expect(result.current.metrics.lastRenderTime).toBe(0);
      expect(result.current.metrics.averageRenderTime).toBe(0);
    });
  });

  describe('useDebouncedSearch', () => {
    it('should debounce search operations to prevent excessive filtering', async () => {
      const mockData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      const searchFunction = vi.fn((data, term) => 
        data.filter(item => 
          item.name.toLowerCase().includes(term.toLowerCase()) ||
          item.email.toLowerCase().includes(term.toLowerCase())
        )
      );

      const { result } = renderHook(() => 
        useDebouncedSearch(mockData, searchFunction, {
          delay: 300,
          minLength: 1
        })
      );

      // Initial state
      expect(result.current.filteredResults).toEqual(mockData);
      expect(result.current.searchTerm).toBe('');

      // Rapid search term changes
      act(() => {
        result.current.setSearchTerm('J');
      });
      
      act(() => {
        result.current.setSearchTerm('Jo');
      });
      
      act(() => {
        result.current.setSearchTerm('Joh');
      });

      // Should not have called search function yet (debounced)
      expect(searchFunction).not.toHaveBeenCalled();

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
      });

      // Should have called search function once with final term
      expect(searchFunction).toHaveBeenCalledTimes(1);
      expect(searchFunction).toHaveBeenCalledWith(mockData, 'Joh');
    });

    it('should handle search history correctly', async () => {
      const mockData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' }
      ];

      const searchFunction = vi.fn((data, term) => 
        data.filter(item => item.name.toLowerCase().includes(term.toLowerCase()))
      );

      const { result } = renderHook(() => 
        useDebouncedSearch(mockData, searchFunction, {
          delay: 100,
          enableHistory: true,
          maxHistorySize: 5
        })
      );

      // Perform multiple searches
      const searchTerms = ['John', 'Jane', 'Bob', 'Alice'];
      
      for (const term of searchTerms) {
        act(() => {
          result.current.setSearchTerm(term);
        });

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 150));
        });
      }

      // Should have search history
      expect(result.current.searchHistory).toHaveLength(4);
      expect(result.current.searchHistory).toEqual(searchTerms);
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple hooks working together without conflicts', async () => {
      const { result: loadingResult } = renderHook(() => 
        useConsolidatedLoading({ maxRetries: 2 })
      );

      const { result: performanceResult } = renderHook(() => 
        usePerformanceMonitor({ componentName: 'Integration' })
      );

      const { result: searchResult } = renderHook(() => 
        useDebouncedSearch([], vi.fn(), { delay: 100 })
      );

      // All hooks should be initialized
      expect(loadingResult.current.isLoading).toBe(false);
      expect(performanceResult.current.metrics.componentName).toBe('Integration');
      expect(searchResult.current.searchTerm).toBe('');

      // Perform operations
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      let loadingPromise: Promise<any>;
      act(() => {
        loadingPromise = loadingResult.current.executeWithLoading(
          mockOperation,
          'initial',
          'integration test'
        );
        searchResult.current.setSearchTerm('test');
      });

      // Should handle concurrent operations
      expect(loadingResult.current.isLoading).toBe(true);
      expect(searchResult.current.searchTerm).toBe('test');

      await act(async () => {
        await loadingPromise!;
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Should complete successfully
      expect(loadingResult.current.isLoading).toBe(false);
      expect(loadingResult.current.error).toBe(null);
    });
  });
});