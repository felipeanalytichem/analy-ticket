import { renderHook, act } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { vi } from 'vitest';

interface TestItem {
  id: string;
  name: string;
  email: string;
}

const mockItems: TestItem[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com' }
];

const mockSearchFunction = (items: TestItem[], term: string) => {
  const searchTerm = term.toLowerCase();
  return items.filter(item => 
    item.name.toLowerCase().includes(searchTerm) ||
    item.email.toLowerCase().includes(searchTerm)
  );
};

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should initialize with empty search term', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction)
    );

    expect(result.current.searchTerm).toBe('');
    expect(result.current.debouncedTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.filteredResults).toEqual(mockItems);
  });

  it('should debounce search term updates', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { delay: 300 })
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    expect(result.current.searchTerm).toBe('john');
    expect(result.current.debouncedTerm).toBe('');
    expect(result.current.isSearching).toBe(true);

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedTerm).toBe('john');
    expect(result.current.isSearching).toBe(false);
  });

  it('should filter results based on debounced term', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { delay: 300 })
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.filteredResults).toEqual([
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '3', name: 'Bob Johnson', email: 'bob@example.com' }
    ]);
  });

  it('should respect minimum length requirement', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { 
        delay: 300,
        minLength: 3
      })
    );

    act(() => {
      result.current.setSearchTerm('jo');
    });

    expect(result.current.isSearching).toBe(false);
    expect(result.current.filteredResults).toEqual(mockItems);

    act(() => {
      result.current.setSearchTerm('joh');
    });

    expect(result.current.isSearching).toBe(true);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedTerm).toBe('joh');
  });

  it('should maintain search history when enabled', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { 
        delay: 300,
        enableHistory: true,
        maxHistorySize: 5
      })
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.searchHistory).toHaveLength(1);
    expect(result.current.searchHistory[0].term).toBe('john');

    act(() => {
      result.current.setSearchTerm('jane');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.searchHistory).toHaveLength(2);
    expect(result.current.searchHistory[0].term).toBe('jane');
    expect(result.current.searchHistory[1].term).toBe('john');
  });

  it('should limit search history size', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { 
        delay: 100,
        enableHistory: true,
        maxHistorySize: 2
      })
    );

    const searchTerms = ['john', 'jane', 'bob'];

    searchTerms.forEach(term => {
      act(() => {
        result.current.setSearchTerm(term);
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });
    });

    expect(result.current.searchHistory).toHaveLength(2);
    expect(result.current.searchHistory[0].term).toBe('bob');
    expect(result.current.searchHistory[1].term).toBe('jane');
  });

  it('should clear search correctly', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction)
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedTerm).toBe('john');

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.debouncedTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.filteredResults).toEqual(mockItems);
  });

  it('should clear search history', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { 
        enableHistory: true
      })
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.searchHistory).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.searchHistory).toHaveLength(0);
  });

  it('should cancel previous debounce when new search term is set', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction, { delay: 300 })
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    expect(result.current.isSearching).toBe(true);

    // Set new term before debounce completes
    act(() => {
      result.current.setSearchTerm('jane');
    });

    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.debouncedTerm).toBe('');
    expect(result.current.isSearching).toBe(true);

    // Complete the debounce
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.debouncedTerm).toBe('jane');
    expect(result.current.isSearching).toBe(false);
  });

  it('should handle empty search terms correctly', () => {
    const { result } = renderHook(() => 
      useDebouncedSearch(mockItems, mockSearchFunction)
    );

    act(() => {
      result.current.setSearchTerm('john');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.filteredResults.length).toBeLessThan(mockItems.length);

    act(() => {
      result.current.setSearchTerm('');
    });

    expect(result.current.debouncedTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.filteredResults).toEqual(mockItems);
  });
});