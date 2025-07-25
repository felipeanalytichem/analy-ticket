import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormInput, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { Category, Subcategory } from '@/lib/database';

interface SubcategoriesSectionProps {
  category: Category;
  subcategories: Subcategory[];
  onManageFields: (subcategoryId: string) => void;
  isOnline: boolean;
}

const SubcategoriesSection: React.FC<SubcategoriesSectionProps> = ({
  category,
  subcategories,
  onManageFields,
  isOnline
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  
  // Configuration for display limits
  const INITIAL_DISPLAY_COUNT = 3;
  const EXPANDED_DISPLAY_COUNT = 6;
  
  // Determine how many items to show
  const getDisplayCount = () => {
    if (showAll) return subcategories.length;
    if (isExpanded) return Math.min(EXPANDED_DISPLAY_COUNT, subcategories.length);
    return Math.min(INITIAL_DISPLAY_COUNT, subcategories.length);
  };
  
  const displayCount = getDisplayCount();
  const visibleSubcategories = subcategories.slice(0, displayCount);
  const remainingCount = subcategories.length - displayCount;
  
  // Different layout approaches based on number of items
  const getLayoutClass = () => {
    if (subcategories.length <= 2) {
      return "space-y-2"; // Simple vertical stack for few items
    } else if (subcategories.length <= 6) {
      return "grid grid-cols-1 sm:grid-cols-2 gap-2"; // 2-column grid for medium count
    } else {
      return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"; // 3-column grid for many items
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-gray-700 dark:text-gray-300 text-sm font-semibold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Subcategories
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {subcategories.length} items
          </span>
          {subcategories.length > INITIAL_DISPLAY_COUNT && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  More
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Subcategories Display */}
      <div className={getLayoutClass()}>
        {visibleSubcategories.map((sub, index) => (
          <div
            key={sub.id}
            className="group/sub relative p-3 bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-700 dark:via-gray-700 dark:to-gray-600 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
          >
            {/* Subcategory Content */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {sub.name}
                  </h5>
                  {sub.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {sub.description}
                    </p>
                  )}
                  
                  {/* Subcategory Metadata */}
                  <div className="flex items-center gap-2 mt-2">
                    {sub.response_time_hours && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {sub.response_time_hours}h response
                      </Badge>
                    )}
                    {sub.dynamic_form_fields && sub.dynamic_form_fields.length > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        {sub.dynamic_form_fields.length} fields
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex-shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onManageFields(sub.id)}
                  className="text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 text-xs px-2 py-1 h-7"
                  disabled={!isOnline}
                  title="Manage custom fields for this subcategory"
                >
                  <FormInput className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Hover Indicator */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-200 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Show More/Less Controls */}
      {remainingCount > 0 && (
        <div className="flex items-center justify-center pt-2">
          {!showAll ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(true)}
              className="text-xs px-3 py-1.5 h-7 border-dashed"
            >
              <MoreHorizontal className="h-3 w-3 mr-1" />
              Show {remainingCount} more
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAll(false);
                setIsExpanded(false);
              }}
              className="text-xs px-3 py-1.5 h-7"
            >
              <ChevronUp className="h-3 w-3 mr-1" />
              Show less
            </Button>
          )}
        </div>
      )}

      {/* Compact Summary for Many Items */}
      {subcategories.length > 10 && !showAll && (
        <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-300">
              {subcategories.length} total subcategories
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowAll(true)}
              className="text-blue-600 dark:text-blue-400 text-xs p-0 h-auto"
            >
              View all →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubcategoriesSection;