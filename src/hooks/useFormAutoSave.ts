import { useEffect, useRef, useCallback } from 'react';
import { stateManager } from '@/services/StateManager';

export interface UseFormAutoSaveOptions {
  /**
   * Auto-save interval in milliseconds
   * @default 30000 (30 seconds)
   */
  interval?: number;
  
  /**
   * Whether to enable auto-save
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Custom form selector (if not using formId)
   */
  formSelector?: string;
  
  /**
   * Callback when form data is auto-saved
   */
  onSave?: (data: any) => void;
  
  /**
   * Callback when form data is restored
   */
  onRestore?: (data: any) => void;
  
  /**
   * Fields to exclude from auto-save (e.g., passwords, sensitive data)
   */
  excludeFields?: string[];
}

export interface UseFormAutoSaveReturn {
  /**
   * Manually trigger a save
   */
  saveNow: () => Promise<void>;
  
  /**
   * Restore saved form data
   */
  restoreData: () => Promise<any>;
  
  /**
   * Clear saved form data
   */
  clearSavedData: () => Promise<void>;
  
  /**
   * Check if there's saved data available
   */
  hasSavedData: () => Promise<boolean>;
  
  /**
   * Enable auto-save (if disabled)
   */
  enable: () => void;
  
  /**
   * Disable auto-save
   */
  disable: () => void;
  
  /**
   * Current auto-save status
   */
  isEnabled: boolean;
}

/**
 * Hook for automatic form data saving and restoration
 * 
 * @param formId - The ID of the form element to auto-save
 * @param options - Configuration options
 * @returns Object with methods to control auto-save behavior
 * 
 * @example
 * ```tsx
 * function MyForm() {
 *   const { saveNow, restoreData, hasSavedData } = useFormAutoSave('my-form', {
 *     interval: 15000, // Save every 15 seconds
 *     excludeFields: ['password', 'confirmPassword'],
 *     onSave: (data) => console.log('Form saved:', data),
 *     onRestore: (data) => console.log('Form restored:', data)
 *   });
 * 
 *   useEffect(() => {
 *     // Restore data on component mount
 *     restoreData();
 *   }, []);
 * 
 *   return (
 *     <form id="my-form">
 *       // form fields
 *     </form>
 *   );
 * }
 * ```
 */
export function useFormAutoSave(
  formId: string,
  options: UseFormAutoSaveOptions = {}
): UseFormAutoSaveReturn {
  const {
    interval = 30000,
    enabled = true,
    formSelector,
    onSave,
    onRestore,
    excludeFields = []
  } = options;

  const isEnabledRef = useRef(enabled);
  const optionsRef = useRef(options);

  // Update refs when options change
  useEffect(() => {
    optionsRef.current = options;
    isEnabledRef.current = enabled;
  }, [options, enabled]);

  // Enable auto-save when component mounts or when enabled changes
  useEffect(() => {
    if (enabled && formId) {
      stateManager.enableAutoSave(formId, interval);
    } else {
      stateManager.disableAutoSave(formId);
    }

    return () => {
      stateManager.disableAutoSave(formId);
    };
  }, [formId, interval, enabled]);

  const getFormElement = useCallback((): HTMLFormElement | null => {
    if (formSelector) {
      return document.querySelector(formSelector) as HTMLFormElement;
    }
    return document.getElementById(formId) as HTMLFormElement;
  }, [formId, formSelector]);

  const filterFormData = useCallback((data: Record<string, any>): Record<string, any> => {
    if (excludeFields.length === 0) return data;
    
    const filtered = { ...data };
    excludeFields.forEach(field => {
      delete filtered[field];
    });
    return filtered;
  }, [excludeFields]);

  const saveNow = useCallback(async (): Promise<void> => {
    try {
      const formElement = getFormElement();
      if (!formElement) {
        console.warn(`Form element not found: ${formId}`);
        return;
      }

      const formData = new FormData(formElement);
      const data: Record<string, any> = {};

      // Convert FormData to plain object
      formData.forEach((value, key) => {
        if (data[key]) {
          // Handle multiple values for same key
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      });

      // Also capture input values that might not be in FormData
      const inputs = formElement.querySelectorAll('input, textarea, select');
      inputs.forEach((input: any) => {
        if (input.name && !data[input.name]) {
          if (input.type === 'checkbox' || input.type === 'radio') {
            data[input.name] = input.checked;
          } else {
            data[input.name] = input.value;
          }
        }
      });

      const filteredData = filterFormData(data);
      
      await stateManager.saveState(`form-${formId}`, {
        data: filteredData,
        timestamp: Date.now(),
        formId
      });

      onSave?.(filteredData);
    } catch (error) {
      console.error('Failed to save form data:', error);
    }
  }, [formId, getFormElement, filterFormData, onSave]);

  const restoreData = useCallback(async (): Promise<any> => {
    try {
      const savedData = await stateManager.restoreFormData(formId);
      if (!savedData?.data) return null;

      const formElement = getFormElement();
      if (!formElement) {
        console.warn(`Form element not found: ${formId}`);
        return savedData.data;
      }

      // Restore form values
      Object.entries(savedData.data).forEach(([key, value]) => {
        const element = formElement.querySelector(`[name="${key}"]`) as HTMLInputElement;
        if (element) {
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = Boolean(value);
          } else if (Array.isArray(value)) {
            // Handle multiple values (e.g., multiple checkboxes with same name)
            const elements = formElement.querySelectorAll(`[name="${key}"]`);
            elements.forEach((el: any, index) => {
              if (value[index] !== undefined) {
                if (el.type === 'checkbox' || el.type === 'radio') {
                  el.checked = Boolean(value[index]);
                } else {
                  el.value = value[index];
                }
              }
            });
          } else {
            element.value = String(value);
          }
        }
      });

      onRestore?.(savedData.data);
      return savedData.data;
    } catch (error) {
      console.error('Failed to restore form data:', error);
      return null;
    }
  }, [formId, getFormElement, onRestore]);

  const clearSavedData = useCallback(async (): Promise<void> => {
    try {
      await stateManager.clearState(`form-${formId}`);
    } catch (error) {
      console.error('Failed to clear saved form data:', error);
    }
  }, [formId]);

  const hasSavedData = useCallback(async (): Promise<boolean> => {
    try {
      const savedData = await stateManager.restoreFormData(formId);
      return savedData?.data != null;
    } catch (error) {
      console.error('Failed to check for saved form data:', error);
      return false;
    }
  }, [formId]);

  const enable = useCallback(() => {
    isEnabledRef.current = true;
    stateManager.enableAutoSave(formId, interval);
  }, [formId, interval]);

  const disable = useCallback(() => {
    isEnabledRef.current = false;
    stateManager.disableAutoSave(formId);
  }, [formId]);

  return {
    saveNow,
    restoreData,
    clearSavedData,
    hasSavedData,
    enable,
    disable,
    isEnabled: isEnabledRef.current
  };
}