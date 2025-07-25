import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  height?: number;
  className?: string;
  onRetry?: () => void;
  description?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  children,
  actions,
  loading = false,
  error = null,
  height = 320,
  className,
  onRetry,
  description
}) => {
  const isMobile = useIsMobile();

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div 
      className="flex items-center justify-center bg-gray-50 dark:bg-gray-900/20 rounded-lg animate-pulse"
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Loading chart data...
        </div>
      </div>
    </div>
  );

  // Error fallback component
  const ErrorFallback = () => (
    <div 
      className="flex items-center justify-center bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800"
      style={{ height: `${height}px` }}
    >
      <div className="flex flex-col items-center gap-4 text-center p-6">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium text-red-900 dark:text-red-100">
            Chart Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 max-w-sm">
            {error || "Unable to load chart data. Please try again."}
          </p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className={cn(
      "transition-all duration-200",
      "hover:shadow-lg",
      // Mobile optimizations
      isMobile && [
        "mx-0", // Remove negative margins on mobile
        "rounded-lg" // Ensure proper border radius
      ],
      className
    )}>
      <CardHeader className={cn(
        "pb-4",
        isMobile && "p-4 pb-3"
      )}>
        <div className={cn(
          "flex justify-between items-start gap-4",
          isMobile && "flex-col gap-2"
        )}>
          <div className="flex-1 min-w-0">
            <CardTitle className={cn(
              "font-semibold text-gray-900 dark:text-white",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {title}
            </CardTitle>
            {description && (
              <p className={cn(
                "text-gray-600 dark:text-gray-400 mt-1",
                isMobile ? "text-xs" : "text-sm"
              )}>
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className={cn(
              "flex-shrink-0",
              isMobile && "w-full flex justify-end"
            )}>
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className={cn(
        isMobile && "p-4 pt-0"
      )}>
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorFallback />
        ) : (
          <div 
            className={cn(
              "w-full",
              // Responsive chart sizing
              isMobile && "overflow-x-auto"
            )}
            style={{ 
              height: `${height}px`,
              // Ensure minimum width on mobile for chart readability
              minWidth: isMobile ? "300px" : "auto"
            }}
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Skeleton loading component for multiple charts
export const ChartContainerSkeleton: React.FC<{
  count?: number;
  height?: number;
  className?: string;
}> = ({ 
  count = 1, 
  height = 320,
  className 
}) => {
  const isMobile = useIsMobile();
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className={cn("animate-pulse", className)}>
          <CardHeader className={cn(
            "pb-4",
            isMobile && "p-4 pb-3"
          )}>
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            </div>
          </CardHeader>
          <CardContent className={cn(
            isMobile && "p-4 pt-0"
          )}>
            <div 
              className="bg-gray-100 dark:bg-gray-800 rounded-lg"
              style={{ height: `${height}px` }}
            />
          </CardContent>
        </Card>
      ))}
    </>
  );
};