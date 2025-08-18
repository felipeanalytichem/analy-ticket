import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCleanupManager } from './useCleanupManager';

interface DebouncedSearchOptions {
  delay?: number;
  minLength?: number;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

interface SearchHistory {
  term: string;
  timestamp: number;
  resultCount?: number;
}

interface DebouncedSearchReturn<T> {
  searchTerm: string;
  debouncedTerm: string;
  isSearching: boolean;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  searchHistory: SearchHistory[];
  clearHistory: () => void;
  filteredResults: T[];
}

export function useDebouncedSearch<T>(
  items: T[],
  searchFunction: (items: T[], term: string) => T[],
  options: DebouncedSearchOptions = {}
): DebouncedSearchReturn<T> {
  const {
    delay = 300,
    minLength = 1,
    enableHistory = true,
    maxHistorySize = 10
  } = options;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  
  const cleanupManager = useCleanupManager();

  // Debounce search term
  useEffect(() => {
    if (searchTerm.length === 0) {
      setDebouncedTerm('');
      setIsSearching(false);
      return;
    }

    if (searchTerm.length < minLength) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setIsSearching(false);
      
      // Add to search history
      if (enableHistory && searchTerm.trim()) {
        setSearchHistory(prev => {
          const newEntry: SearchHistory = {
            term: searchTerm.trim(),
            timestamp: Date.now()
          };
          
          // Remove duplicate entries
          const filtered = prev.filter(entry => entry.term !== newEntry.term);
          
          // Add new entry and limit size
          const updated = [newEntry, ...filtered].slice(0, maxHistorySize);
          
          return updated;
        });
      }
    }, delay);

    cleanupManager.addTimer(timeoutId, 'timeout', `search_debounce_${searchTerm}`);

    return () => {
      clearTimeout(timeoutId);
      cleanupManager.clearTimer(timeoutId);
    };
  }, [searchTerm, delay, minLength, enableHistory, maxHistorySize, cleanupManager]);

  // Memoized filtered results
  const filteredResults = useMemo(() => {
    if (!debouncedTerm || debouncedTerm.length < minLength) {
      return items;
    }

    const startTime = performance.now();
    const results = searchFunction(items, debouncedTerm);
    const endTime = performance.now();
    
    // Log slow searches
    const searchTime = endTime - startTime;
    if (searchTime > 50) { // Log if search takes more than 50ms
      console.warn(`[DebouncedSearch] Slow search detected:`, {
        term: debouncedTerm,
        searchTime: `${searchTime.toFixed(2)}ms`,
        itemCount: items.length,
        resultCount: results.length
      });
    }

    // Update search history with result count
    if (enableHistory && debouncedTerm.trim()) {
      setSearchHistory(prev => 
        prev.map(entry => 
          entry.term === debouncedTerm.trim() 
            ? { ...entry, resultCount: results.length }
            : entry
        )
      );
    }

    return results;
  }, [items, debouncedTerm, searchFunction, minLength, enableHistory]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
    setIsSearching(false);
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    searchTerm,
    debouncedTerm,
    isSearching,
    setSearchTerm,
    clearSearch,
    searchHistory,
    clearHistory,
    filteredResults
  };
}