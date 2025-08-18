import React, { useState, useEffect } from 'react';
import { Save, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormAutoSaveIndicatorProps {
  /**
   * Current save status
   */
  status: 'idle' | 'saving' | 'saved' | 'error';
  
  /**
   * Last save timestamp
   */
  lastSaved?: Date;
  
  /**
   * Error message if status is 'error'
   */
  errorMessage?: string;
  
  /**
   * Whether to show the indicator
   */
  show?: boolean;
  
  /**
   * Position of the indicator
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  /**
   * Custom className
   */
  className?: string;
  
  /**
   * Callback when user clicks retry (for error state)
   */
  onRetry?: () => void;
}

/**
 * Visual indicator for form auto-save status
 * 
 * @example
 * ```tsx
 * function MyForm() {
 *   const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 *   const [lastSaved, setLastSaved] = useState<Date>();
 * 
 *   const { saveNow } = useFormAutoSave('my-form', {
 *     onSave: () => {
 *       setSaveStatus('saved');
 *       setLastSaved(new Date());
 *     }
 *   });
 * 
 *   return (
 *     <div className="relative">
 *       <form id="my-form">
 *         // form fields
 *       </form>
 *       <FormAutoSaveIndicator
 *         status={saveStatus}
 *         lastSaved={lastSaved}
 *         position="top-right"
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function FormAutoSaveIndicator({
  status,
  lastSaved,
  errorMessage,
  show = true,
  position = 'top-right',
  className,
  onRetry
}: FormAutoSaveIndicatorProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show && status !== 'idle') {
      setIsVisible(true);
      
      // Auto-hide after successful save
      if (status === 'saved') {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [show, status]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (status) {
      case 'saving':
        return <Save className="h-4 w-4 animate-pulse" />;
      case 'saved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : 'Saved';
      case 'error':
        return errorMessage || 'Save failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'saving':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'saved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPositionClasses = () => {
    if (position === 'inline') return '';
    
    const baseClasses = 'absolute z-50';
    switch (position) {
      case 'top-right':
        return `${baseClasses} top-2 right-2`;
      case 'top-left':
        return `${baseClasses} top-2 left-2`;
      case 'bottom-right':
        return `${baseClasses} bottom-2 right-2`;
      case 'bottom-left':
        return `${baseClasses} bottom-2 left-2`;
      default:
        return `${baseClasses} top-2 right-2`;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center space-x-2 px-3 py-2 rounded-md border text-sm font-medium transition-all duration-200',
        getStatusColor(),
        getPositionClasses(),
        className
      )}
    >
      {getIcon()}
      <span>{getMessage()}</span>
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-2 text-xs underline hover:no-underline focus:outline-none"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Hook to manage auto-save indicator state
 */
export function useAutoSaveIndicator() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const setSaving = () => {
    setStatus('saving');
    setErrorMessage(undefined);
  };

  const setSaved = () => {
    setStatus('saved');
    setLastSaved(new Date());
    setErrorMessage(undefined);
  };

  const setError = (message?: string) => {
    setStatus('error');
    setErrorMessage(message);
  };

  const reset = () => {
    setStatus('idle');
    setErrorMessage(undefined);
  };

  return {
    status,
    lastSaved,
    errorMessage,
    setSaving,
    setSaved,
    setError,
    reset
  };
}