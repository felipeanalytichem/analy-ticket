import { useState, useEffect, useCallback, useMemo } from 'react';
import { CategorySuggestionService, SuggestionResult, CategorySuggestion } from '@/lib/categorySuggestionService';
import { Category, Subcategory } from '@/lib/database';
import { useCategoryManagement } from './useCategoryManagement';

interface UseCategorySuggestionProps {
  title?: string;
  description: string;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseCategorySuggestionReturn {
  suggestions: CategorySuggestion[];
  topCategory?: CategorySuggestion;
  topSubcategory?: CategorySuggestion;
  explanation: string;
  isAnalyzing: boolean;
  hasEnoughContent: boolean;
  applySuggestion: (suggestion: CategorySuggestion) => {
    categoryId: string;
    subcategoryId?: string;
  };
  dismissSuggestions: () => void;
  isDismissed: boolean;
}

/**
 * Custom hook for category suggestions based on ticket description
 */
export const useCategorySuggestion = ({
  title = '',
  description,
  debounceMs = 500,
  enabled = true
}: UseCategorySuggestionProps): UseCategorySuggestionReturn => {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [topCategory, setTopCategory] = useState<CategorySuggestion | undefined>();
  const [topSubcategory, setTopSubcategory] = useState<CategorySuggestion | undefined>();
  const [explanation, setExplanation] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  const [debouncedDescription, setDebouncedDescription] = useState(description);

  const { getEnabledCategories } = useCategoryManagement();

  // Debounce the title and description
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      setDebouncedTitle(title);
      setDebouncedDescription(description);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [title, description, debounceMs, enabled]);

  // Get available categories and subcategories
  const { availableCategories, availableSubcategories } = useMemo(() => {
    const categories = getEnabledCategories();
    const subcategories: Subcategory[] = [];
    
    categories.forEach(cat => {
      if (cat.subcategories) {
        subcategories.push(...cat.subcategories);
      }
    });

    return {
      availableCategories: categories,
      availableSubcategories: subcategories
    };
  }, [getEnabledCategories]);

  // Check if title or description has enough content
  const hasEnoughContent = useMemo(() => {
    const combinedText = `${debouncedTitle} ${debouncedDescription}`.trim();
    return CategorySuggestionService.hasEnoughContent(combinedText) || 
           CategorySuggestionService.hasEnoughContent(debouncedTitle) ||
           CategorySuggestionService.hasEnoughContent(debouncedDescription);
  }, [debouncedTitle, debouncedDescription]);

  // Reset dismissed state when title or description changes significantly
  useEffect(() => {
    if (title.length === 0 && description.length === 0) {
      setIsDismissed(false);
    }
  }, [title, description]);

  // Analyze title and description and generate suggestions
  useEffect(() => {
    if (!enabled || !hasEnoughContent || isDismissed || availableCategories.length === 0) {
      setSuggestions([]);
      setTopCategory(undefined);
      setTopSubcategory(undefined);
      setExplanation('');
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);

    // Simulate small delay for better UX (shows loading state)
    const analyzeTimer = setTimeout(() => {
      try {
        const result: SuggestionResult = CategorySuggestionService.suggestCategoriesFromTitleAndDescription(
          debouncedTitle,
          debouncedDescription,
          availableCategories,
          availableSubcategories
        );

        setSuggestions(result.suggestions);
        setTopCategory(result.topCategory);
        setTopSubcategory(result.topSubcategory);
        
        // Generate explanation based on combined text
        const combinedText = `${debouncedTitle} ${debouncedDescription}`.trim();
        setExplanation(CategorySuggestionService.getExplanation(combinedText));
      } catch (error) {
        console.error('Error analyzing text for suggestions:', error);
        setSuggestions([]);
        setTopCategory(undefined);
        setTopSubcategory(undefined);
        setExplanation('Error analyzing text');
      } finally {
        setIsAnalyzing(false);
      }
    }, 100);

    return () => clearTimeout(analyzeTimer);
  }, [
    debouncedTitle,
    debouncedDescription,
    enabled,
    hasEnoughContent,
    isDismissed,
    availableCategories,
    availableSubcategories
  ]);

  // Apply a suggestion and return the IDs
  const applySuggestion = useCallback((suggestion: CategorySuggestion) => {
    setIsDismissed(true); // Dismiss suggestions after applying one
    
    return {
      categoryId: suggestion.category.id,
      subcategoryId: suggestion.subcategory?.id
    };
  }, []);

  // Dismiss suggestions manually
  const dismissSuggestions = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    suggestions,
    topCategory,
    topSubcategory,
    explanation,
    isAnalyzing,
    hasEnoughContent,
    applySuggestion,
    dismissSuggestions,
    isDismissed
  };
};

/**
 * Hook to get a single best suggestion for quick apply
 */
export const useQuickSuggestion = (title: string, description: string, enabled: boolean = true) => {
  const { topSubcategory, topCategory, hasEnoughContent, isAnalyzing } = useCategorySuggestion({
    title,
    description,
    enabled,
    debounceMs: 800 // Slightly longer debounce for quick suggestion
  });

  const bestSuggestion = useMemo(() => {
    // Prefer subcategory suggestions as they're more specific
    return topSubcategory || topCategory;
  }, [topSubcategory, topCategory]);

  return {
    suggestion: bestSuggestion,
    hasEnoughContent,
    isAnalyzing,
    confidence: bestSuggestion?.confidence || 0
  };
}; 