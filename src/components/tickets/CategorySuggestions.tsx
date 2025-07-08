import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Lightbulb, 
  X, 
  CheckCircle, 
  Loader2, 
  Zap,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { CategorySuggestion } from '@/lib/categorySuggestionService';
import { cn } from '@/lib/utils';

interface CategorySuggestionsProps {
  suggestions: CategorySuggestion[];
  topCategory?: CategorySuggestion;
  topSubcategory?: CategorySuggestion;
  explanation: string;
  isAnalyzing: boolean;
  hasEnoughContent: boolean;
  isDismissed: boolean;
  onApplySuggestion: (suggestion: CategorySuggestion) => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Component to display category and subcategory suggestions
 */
export const CategorySuggestions: React.FC<CategorySuggestionsProps> = ({
  suggestions,
  topCategory,
  topSubcategory,
  explanation,
  isAnalyzing,
  hasEnoughContent,
  isDismissed,
  onApplySuggestion,
  onDismiss,
  className
}) => {
  // Don't show if dismissed or no content
  if (isDismissed || !hasEnoughContent) {
    return null;
  }

  // Show loading state
  if (isAnalyzing) {
    return (
      <Card className={cn("border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Analyzing description...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if no suggestions
  if (suggestions.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <Card className={cn("border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800", className)}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h4 className="font-medium text-blue-900 dark:text-blue-200">
              Smart Category Suggestions
            </h4>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Explanation */}
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {explanation}
        </p>

        {/* Top Suggestions */}
        {(topCategory || topSubcategory) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                Best Match
              </span>
            </div>
            
            {/* Best subcategory suggestion */}
            {topSubcategory && (
              <SuggestionCard
                suggestion={topSubcategory}
                onApply={onApplySuggestion}
                isTopSuggestion={true}
              />
            )}
            
            {/* Best category suggestion (if no subcategory) */}
            {!topSubcategory && topCategory && (
              <SuggestionCard
                suggestion={topCategory}
                onApply={onApplySuggestion}
                isTopSuggestion={true}
              />
            )}
          </div>
        )}

        {/* Other Suggestions */}
        {suggestions.length > 1 && (
          <>
            <Separator className="bg-blue-200 dark:bg-blue-800" />
            <div className="space-y-2">
              <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                Other Suggestions
              </span>
              <div className="space-y-2">
                {suggestions
                  .filter(s => s !== topCategory && s !== topSubcategory)
                  .slice(0, 3) // Show max 3 additional suggestions
                  .map((suggestion, index) => (
                    <SuggestionCard
                      key={`${suggestion.category.id}-${suggestion.subcategory?.id || 'no-sub'}-${index}`}
                      suggestion={suggestion}
                      onApply={onApplySuggestion}
                      isTopSuggestion={false}
                    />
                  ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Individual suggestion card component
 */
interface SuggestionCardProps {
  suggestion: CategorySuggestion;
  onApply: (suggestion: CategorySuggestion) => void;
  isTopSuggestion: boolean;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onApply,
  isTopSuggestion
}) => {
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-all duration-200 hover:shadow-sm",
        isTopSuggestion 
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-700" 
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Category and Subcategory */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
              {suggestion.category.name}
            </span>
            {suggestion.subcategory && (
              <>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <span className="font-medium text-blue-700 dark:text-blue-300 text-sm">
                  {suggestion.subcategory.name}
                </span>
              </>
            )}
          </div>

          {/* Confidence and Reason */}
          <div className="flex items-center gap-2 mb-2">
            <Badge 
              variant="secondary"
              className={cn("text-xs px-2 py-0.5", getConfidenceColor(suggestion.confidence))}
            >
              {getConfidenceText(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
            </Badge>
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            {suggestion.reason}
          </p>
        </div>

        {/* Apply Button */}
        <Button
          size="sm"
          variant={isTopSuggestion ? "default" : "outline"}
          onClick={() => onApply(suggestion)}
          className={cn(
            "h-8 px-3 text-xs",
            isTopSuggestion && "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Apply
        </Button>
      </div>
    </div>
  );
};

/**
 * Compact suggestion component for inline use
 */
interface QuickSuggestionProps {
  suggestion: CategorySuggestion;
  onApply: (suggestion: CategorySuggestion) => void;
  onDismiss: () => void;
  className?: string;
}

export const QuickSuggestion: React.FC<QuickSuggestionProps> = ({
  suggestion,
  onApply,
  onDismiss,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg", className)}>
      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-sm">
          <span className="font-medium text-blue-900 dark:text-blue-200">
            {suggestion.category.name}
          </span>
          {suggestion.subcategory && (
            <>
              <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-700 dark:text-blue-300">
                {suggestion.subcategory.name}
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-blue-600 dark:text-blue-400">
          {Math.round(suggestion.confidence * 100)}% confidence
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onApply(suggestion)}
          className="h-7 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/20"
        >
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}; 