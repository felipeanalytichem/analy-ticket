import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type TrendDirection = 'up' | 'down' | 'neutral';
export type KPIColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple';
export type KPIFormat = 'time' | 'percentage' | 'number';

export interface KPICardProps {
  title: string;
  value: string | number;
  target?: string | number;
  trend?: TrendDirection;
  color: KPIColor;
  icon: LucideIcon;
  format?: KPIFormat;
  loading?: boolean;
  className?: string;
}

const colorConfig = {
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    accent: "bg-blue-600 dark:bg-blue-400"
  },
  green: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    accent: "bg-green-600 dark:bg-green-400"
  },
  yellow: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800",
    accent: "bg-yellow-600 dark:bg-yellow-400"
  },
  red: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    accent: "bg-red-600 dark:bg-red-400"
  },
  purple: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-200 dark:border-purple-800",
    accent: "bg-purple-600 dark:bg-purple-400"
  }
};

const getTrendIcon = (trend: TrendDirection) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    case 'down':
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    case 'neutral':
    default:
      return <Minus className="h-3 w-3 text-gray-400" />;
  }
};

const getTrendColor = (trend: TrendDirection) => {
  switch (trend) {
    case 'up':
      return "text-green-600 dark:text-green-400";
    case 'down':
      return "text-red-600 dark:text-red-400";
    case 'neutral':
    default:
      return "text-gray-500 dark:text-gray-400";
  }
};

const formatValue = (value: string | number, format?: KPIFormat): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'percentage':
      return `${value}%`;
    case 'time':
      // Assuming value is in hours, format as hours:minutes
      if (value === 0) return '0m';
      const hours = Math.floor(value);
      const minutes = Math.round((value - hours) * 60);
      if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
      } else {
        return `${Math.round(value * 60)}m`;
      }
    case 'number':
    default:
      return value.toLocaleString();
  }
};

const calculateProgress = (value: string | number, target: string | number): number => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const numTarget = typeof target === 'string' ? parseFloat(target) : target;
  
  if (numTarget === 0) return 0;
  return Math.min((numValue / numTarget) * 100, 100);
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  target,
  trend,
  color,
  icon: Icon,
  format,
  loading = false,
  className
}) => {
  const isMobile = useIsMobile();
  const colors = colorConfig[color];
  
  if (loading) {
    return (
      <Card className={cn(
        "animate-pulse",
        "border-l-4",
        colors.border,
        colors.bg,
        className
      )}>
        <CardHeader className={cn(
          "pb-2",
          isMobile && "p-4 pb-2"
        )}>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
        </CardHeader>
        <CardContent className={cn(
          isMobile && "p-4 pt-0"
        )}>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </CardContent>
      </Card>
    );
  }

  const formattedValue = formatValue(value, format);
  const formattedTarget = target ? formatValue(target, format) : undefined;
  const progress = target ? calculateProgress(value, target) : undefined;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-200",
      "hover:shadow-lg hover:scale-[1.02]",
      "border-l-4",
      colors.border,
      colors.bg,
      isMobile && [
        "active:scale-[0.98]",
        "touch-manipulation"
      ],
      className
    )}>
      <CardHeader className={cn(
        "pb-2",
        isMobile && "p-4 pb-2"
      )}>
        <CardTitle className={cn(
          "text-sm font-medium",
          "text-gray-600 dark:text-gray-300",
          isMobile && "text-xs"
        )}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(
        isMobile && "p-4 pt-0"
      )}>
        <div className="flex items-end justify-between">
          <div className="flex flex-col flex-1">
            <div className={cn(
              "font-bold",
              colors.text,
              isMobile ? "text-2xl" : "text-3xl"
            )}>
              {formattedValue}
            </div>
            
            {/* Target vs Actual Display */}
            {target && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Target: {formattedTarget}</span>
                  <span>{progress?.toFixed(0)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-2"
                />
              </div>
            )}
            
            {/* Trend Indicator */}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 mt-2",
                getTrendColor(trend),
                isMobile && "text-xs"
              )}>
                {getTrendIcon(trend)}
                <span className="text-xs">
                  {trend === 'up' && 'Trending up'}
                  {trend === 'down' && 'Trending down'}
                  {trend === 'neutral' && 'No change'}
                </span>
              </div>
            )}
          </div>
          
          {/* Icon Display */}
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center ml-4",
            colors.bg,
            "opacity-50",
            isMobile && "w-8 h-8"
          )}>
            <Icon className={cn(
              "w-6 h-6",
              colors.text,
              isMobile && "w-4 h-4"
            )} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};