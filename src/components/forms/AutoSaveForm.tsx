import React, { useEffect, useRef, useState } from 'react';
import { useFormAutoSave, UseFormAutoSaveOptions } from '@/hooks/useFormAutoSave';
import { FormAutoSaveIndicator, useAutoSaveIndicator } from './FormAutoSaveIndicator';
import { cn } from '@/lib/utils';

export interface AutoSaveFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /**
   * Unique identifier for the form (used for auto-save)
   */
  formId: string;
  
  /**
   * Auto-save configuration options
   */
  autoSaveOptions?: UseFormAutoSaveOptions;
  
  /**
   * Whether to show the auto-save indicator
   */
  showIndicator?: boolean;
  
  /**
   * Position of the auto-save indicator
   */
  indicatorPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  /**
   * Whether to restore saved data on mount
   */
  restoreOnMount?: boolean;
  
  /**
   * Callback when form data is restored
   */
  onDataRestored?: (data: any) => void;
  
  /**
   * Callback when form data is saved
   */
  onDataSaved?: (data: any) => void;
  
  /**
   * Callback when save fails
   */
  onSaveError?: (error: any) => void;
  
  /**
   * Children components
   */
  children: React.ReactNode;
}

/**
 * Form component with built-in auto-save functionality
 * 
 * @example
 * ```tsx
 * function MyForm() {
 *   return (
 *     <AutoSaveForm
 *       formId="user-profile-form"
 *       autoSaveOptions={{
 *         interval: 15000,
 *         excludeFields: ['password']
 *       }}
 *       showIndicator={true}
 *       restoreOnMount={true}
 *       onDataRestored={(data) => console.log('Restored:', data)}
 *       onDataSaved={(data) => console.log('Saved:', data)}
 *     >
 *       <div className="space-y-4">
 *         <input name="firstName" placeholder="First Name" />
 *         <input name="lastName" placeholder="Last Name" />
 *         <input name="email" type="email" placeholder="Email" />
 *         <button type="submit">Save</button>
 *       </div>
 *     </AutoSaveForm>
 *   );
 * }
 * ```
 */
export function AutoSaveForm({
  formId,
  autoSaveOptions = {},
  showIndicator = true,
  indicatorPosition = 'top-right',
  restoreOnMount = true,
  onDataRestored,
  onDataSaved,
  onSaveError,
  children,
  className,
  ...formProps
}: AutoSaveFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [hasRestoredData, setHasRestoredData] = useState(false);
  
  const {
    status,
    lastSaved,
    errorMessage,
    setSaving,
    setSaved,
    setError,
    reset
  } = useAutoSaveIndicator();

  const {
    saveNow,
    restoreData,
    clearSavedData,
    hasSavedData
  } = useFormAutoSave(formId, {
    ...autoSaveOptions,
    onSave: (data) => {
      setSaved();
      onDataSaved?.(data);
      autoSaveOptions.onSave?.(data);
    },
    onRestore: (data) => {
      onDataRestored?.(data);
      autoSaveOptions.onRestore?.(data);
    }
  });

  // Restore data on mount if enabled
  useEffect(() => {
    if (restoreOnMount && !hasRestoredData) {
      const restoreFormData = async () => {
        try {
          const hasData = await hasSavedData();
          if (hasData) {
            await restoreData();
            setHasRestoredData(true);
          }
        } catch (error) {
          console.error('Failed to restore form data:', error);
        }
      };
      
      restoreFormData();
    }
  }, [restoreOnMount, hasRestoredData, hasSavedData, restoreData]);

  const handleManualSave = async () => {
    try {
      setSaving();
      await saveNow();
    } catch (error) {
      setError('Failed to save form data');
      onSaveError?.(error);
    }
  };

  const handleRetry = () => {
    reset();
    handleManualSave();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // Clear saved data on successful submit
    try {
      await clearSavedData();
    } catch (error) {
      console.error('Failed to clear saved data:', error);
    }
    
    // Call original onSubmit if provided
    formProps.onSubmit?.(event);
  };

  return (
    <div className="relative">
      <form
        ref={formRef}
        id={formId}
        className={cn('relative', className)}
        {...formProps}
        onSubmit={handleSubmit}
      >
        {children}
        
        {/* Manual save button (hidden by default, can be styled by parent) */}
        <button
          type="button"
          onClick={handleManualSave}
          className="sr-only"
          data-testid="manual-save-button"
        >
          Save Draft
        </button>
      </form>
      
      {showIndicator && (
        <FormAutoSaveIndicator
          status={status}
          lastSaved={lastSaved}
          errorMessage={errorMessage}
          position={indicatorPosition}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}

/**
 * Hook to access auto-save functionality from within an AutoSaveForm
 */
export function useAutoSaveContext(formId: string) {
  const autoSave = useFormAutoSave(formId);
  const indicator = useAutoSaveIndicator();
  
  const saveWithIndicator = async () => {
    try {
      indicator.setSaving();
      await autoSave.saveNow();
      indicator.setSaved();
    } catch (error) {
      indicator.setError('Save failed');
      throw error;
    }
  };
  
  return {
    ...autoSave,
    ...indicator,
    saveWithIndicator
  };
}