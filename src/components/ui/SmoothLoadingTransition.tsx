import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SmoothLoadingTransitionProps {
  isLoading: boolean;
  loadingComponent: React.ReactNode;
  children: React.ReactNode;
  minLoadingTime?: number;
  fadeTransition?: boolean;
  className?: string;
}

/**
 * A component that provides smooth transitions between loading and loaded states
 * to prevent flickering and improve perceived performance
 */
export const SmoothLoadingTransition: React.FC<SmoothLoadingTransitionProps> = ({
  isLoading,
  loadingComponent,
  children,
  minLoadingTime = 300,
  fadeTransition = true,
  className = ''
}) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const loadingStartTime = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      // Starting to load
      loadingStartTime.current = Date.now();
      setShowLoading(true);
      setIsTransitioning(false);
      
      // Clear any pending transition
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    } else if (showLoading) {
      // Finished loading - check if we need to wait for minimum time
      const elapsedTime = loadingStartTime.current 
        ? Date.now() - loadingStartTime.current 
        : minLoadingTime;
      
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        // Wait for minimum loading time before transitioning
        transitionTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(true);
          
          // If fade transition is enabled, wait for fade out before showing content
          if (fadeTransition) {
            setTimeout(() => {
              setShowLoading(false);
              setIsTransitioning(false);
            }, 150); // Half of the CSS transition duration
          } else {
            setShowLoading(false);
            setIsTransitioning(false);
          }
        }, remainingTime);
      } else {
        // Can transition immediately
        setIsTransitioning(true);
        
        if (fadeTransition) {
          setTimeout(() => {
            setShowLoading(false);
            setIsTransitioning(false);
          }, 150);
        } else {
          setShowLoading(false);
          setIsTransitioning(false);
        }
      }
    }

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [isLoading, showLoading, minLoadingTime, fadeTransition]);

  // Reset loading start time when component unmounts
  useEffect(() => {
    return () => {
      loadingStartTime.current = null;
    };
  }, []);

  const transitionClasses = fadeTransition ? {
    entering: 'opacity-0',
    entered: 'opacity-100',
    exiting: 'opacity-0',
    exited: 'opacity-100'
  } : {};

  const getTransitionClass = () => {
    if (!fadeTransition) return '';
    
    if (showLoading && !isTransitioning) return 'opacity-100';
    if (showLoading && isTransitioning) return 'opacity-0';
    if (!showLoading && !isTransitioning) return 'opacity-100';
    return 'opacity-0';
  };

  return (
    <div className={cn('relative', className)}>
      {showLoading ? (
        <div 
          className={cn(
            'transition-opacity duration-300 ease-in-out',
            getTransitionClass()
          )}
        >
          {loadingComponent}
        </div>
      ) : (
        <div 
          className={cn(
            'transition-opacity duration-300 ease-in-out',
            getTransitionClass()
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};