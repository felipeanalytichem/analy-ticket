import * as React from "react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const isMobile = useIsMobile();
    
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Mobile-specific improvements
          isMobile ? [
            "h-12", // Larger height for better touch targets
            "text-base", // 16px font size to prevent iOS zoom
            "touch-manipulation", // Better touch handling
            "transition-all duration-200", // Smooth transitions
            "focus:ring-2 focus:ring-ring", // Enhanced focus states
            "active:bg-accent/5" // Subtle touch feedback
          ] : [
            "h-10",
            "text-sm md:text-sm" // Responsive text sizing
          ],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
