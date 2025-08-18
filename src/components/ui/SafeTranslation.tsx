import React from 'react';
import { useTranslation } from 'react-i18next';

interface SafeTranslationProps {
  /** The translation key to look up */
  i18nKey: string;
  /** Fallback text to display if translation is missing */
  fallback?: string;
  /** Values to interpolate into the translation */
  values?: Record<string, any>;
  /** Additional context for debugging */
  context?: string;
  /** Component to render as (default: span) */
  as?: keyof JSX.IntrinsicElements;
  /** Additional props to pass to the rendered component */
  [key: string]: any;
}

/**
 * SafeTranslation component that handles translation failures gracefully
 * 
 * Features:
 * - Fallback to provided fallback text or key name
 * - Development warnings for missing translations
 * - Support for interpolation values
 * - Customizable rendering component
 * - Graceful degradation when i18n fails
 */
export const SafeTranslation: React.FC<SafeTranslationProps> = ({
  i18nKey,
  fallback,
  values,
  context,
  as: Component = 'span',
  ...props
}) => {
  const { t, ready } = useTranslation();

  // Handle case where i18n is not ready
  if (!ready) {
    const loadingText = fallback || i18nKey;
    return <Component {...props}>{loadingText}</Component>;
  }

  try {
    // Attempt to get the translation
    const translation = t(i18nKey, values);
    
    // Check if translation was found (react-i18next returns the key if not found)
    const isTranslationMissing = translation === i18nKey;
    
    if (isTranslationMissing) {
      // Log warning in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[SafeTranslation] Missing translation for key: "${i18nKey}"${
            context ? ` (context: ${context})` : ''
          }`
        );
      }
      
      // Use fallback or key as last resort
      const displayText = fallback || i18nKey;
      
      // In development, add visual indicator for missing translations
      if (process.env.NODE_ENV === 'development') {
        return (
          <Component 
            {...props} 
            style={{ 
              ...props.style, 
              backgroundColor: 'rgba(255, 255, 0, 0.2)',
              border: '1px dashed orange',
              padding: '1px 2px'
            }}
            title={`Missing translation: ${i18nKey}`}
          >
            {displayText}
          </Component>
        );
      }
      
      return <Component {...props}>{displayText}</Component>;
    }
    
    return <Component {...props}>{translation}</Component>;
    
  } catch (error) {
    // Handle any errors during translation
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[SafeTranslation] Error translating key "${i18nKey}":`,
        error
      );
    }
    
    const errorText = fallback || i18nKey;
    return <Component {...props}>{errorText}</Component>;
  }
};

/**
 * Hook version of SafeTranslation for use in components that need the translation value
 */
export const useSafeTranslation = (
  i18nKey: string,
  fallback?: string,
  values?: Record<string, any>,
  context?: string
): string => {
  const { t, ready } = useTranslation();

  // Handle case where i18n is not ready
  if (!ready) {
    return fallback || i18nKey;
  }

  try {
    const translation = t(i18nKey, values);
    const isTranslationMissing = translation === i18nKey;
    
    if (isTranslationMissing) {
      // Log warning in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[useSafeTranslation] Missing translation for key: "${i18nKey}"${
            context ? ` (context: ${context})` : ''
          }`
        );
      }
      
      return fallback || i18nKey;
    }
    
    return translation;
    
  } catch (error) {
    // Handle any errors during translation
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[useSafeTranslation] Error translating key "${i18nKey}":`,
        error
      );
    }
    
    return fallback || i18nKey;
  }
};

/**
 * Utility function to safely get a translation without React context
 */
export const getSafeTranslation = (
  t: (key: string, options?: any) => string,
  i18nKey: string,
  fallback?: string,
  values?: Record<string, any>
): string => {
  try {
    const translation = t(i18nKey, values);
    const isTranslationMissing = translation === i18nKey;
    
    if (isTranslationMissing) {
      return fallback || i18nKey;
    }
    
    return translation;
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[getSafeTranslation] Error translating key "${i18nKey}":`,
        error
      );
    }
    
    return fallback || i18nKey;
  }
};

export default SafeTranslation;