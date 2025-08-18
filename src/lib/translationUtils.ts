import { TFunction } from 'i18next';

/**
 * Translation utility functions for safe translation handling
 */

/**
 * Safely translates a key with fallback support
 */
export const safeTranslate = (
  t: TFunction,
  key: string,
  fallback?: string,
  options?: any
): string => {
  try {
    const translation = t(key, options);
    
    // Check if translation was found (react-i18next returns the key if not found)
    if (translation === key) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[safeTranslate] Missing translation for key: "${key}"`);
      }
      return fallback || key;
    }
    
    return translation;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[safeTranslate] Error translating key "${key}":`, error);
    }
    return fallback || key;
  }
};

/**
 * Validates if a translation key exists
 */
export const hasTranslation = (t: TFunction, key: string): boolean => {
  try {
    const translation = t(key);
    return translation !== key;
  } catch {
    return false;
  }
};

/**
 * Gets a translation with automatic fallback to English
 */
export const getTranslationWithFallback = (
  t: TFunction,
  key: string,
  fallbackLocale = 'en-US',
  options?: any
): string => {
  try {
    // Try current locale first
    const translation = t(key, options);
    if (translation !== key) {
      return translation;
    }
    
    // Try fallback locale
    const fallbackTranslation = t(key, { ...options, lng: fallbackLocale });
    if (fallbackTranslation !== key) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[getTranslationWithFallback] Using fallback locale for key: "${key}"`
        );
      }
      return fallbackTranslation;
    }
    
    // Return key as last resort
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[getTranslationWithFallback] No translation found for key: "${key}"`
      );
    }
    return key;
    
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[getTranslationWithFallback] Error translating key "${key}":`,
        error
      );
    }
    return key;
  }
};

/**
 * Pluralization helper with safe fallback
 */
export const safePlural = (
  t: TFunction,
  key: string,
  count: number,
  fallback?: string,
  options?: any
): string => {
  try {
    const translation = t(key, { count, ...options });
    
    if (translation === key) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[safePlural] Missing plural translation for key: "${key}"`);
      }
      
      // Try to construct a basic plural fallback
      if (fallback) {
        return count === 1 ? fallback : `${fallback}s`;
      }
      
      return `${count} ${key}`;
    }
    
    return translation;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[safePlural] Error with plural translation "${key}":`, error);
    }
    
    if (fallback) {
      return count === 1 ? fallback : `${fallback}s`;
    }
    
    return `${count} ${key}`;
  }
};

/**
 * Date formatting with translation support
 */
export const formatDateWithTranslation = (
  t: TFunction,
  date: Date | string,
  formatKey = 'common.dateFormat',
  fallbackFormat = 'MMM dd, yyyy'
): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    // Try to get localized date format
    const format = safeTranslate(t, formatKey, fallbackFormat);
    
    // Basic date formatting (you might want to use a proper date library like date-fns)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    };
    
    return dateObj.toLocaleDateString(undefined, options);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[formatDateWithTranslation] Error formatting date:', error);
    }
    return 'Invalid Date';
  }
};

/**
 * Number formatting with translation support
 */
export const formatNumberWithTranslation = (
  t: TFunction,
  number: number,
  formatKey = 'common.numberFormat',
  fallbackOptions: Intl.NumberFormatOptions = {}
): string => {
  try {
    // You could extend this to read format options from translations
    return number.toLocaleString(undefined, fallbackOptions);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[formatNumberWithTranslation] Error formatting number:', error);
    }
    return number.toString();
  }
};

/**
 * Currency formatting with translation support
 */
export const formatCurrencyWithTranslation = (
  t: TFunction,
  amount: number,
  currencyKey = 'common.currency',
  fallbackCurrency = 'USD'
): string => {
  try {
    const currency = safeTranslate(t, currencyKey, fallbackCurrency);
    
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency
    }).format(amount);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[formatCurrencyWithTranslation] Error formatting currency:', error);
    }
    return `${fallbackCurrency} ${amount}`;
  }
};

/**
 * Validation helper for translation keys
 */
export const validateTranslationKey = (key: string): boolean => {
  // Basic validation for translation key format
  const keyPattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;
  return keyPattern.test(key);
};

/**
 * Helper to extract namespace from translation key
 */
export const getTranslationNamespace = (key: string): string => {
  const parts = key.split('.');
  return parts.length > 1 ? parts[0] : 'translation';
};

/**
 * Helper to build nested translation keys
 */
export const buildTranslationKey = (...parts: string[]): string => {
  return parts.filter(Boolean).join('.');
};

export default {
  safeTranslate,
  hasTranslation,
  getTranslationWithFallback,
  safePlural,
  formatDateWithTranslation,
  formatNumberWithTranslation,
  formatCurrencyWithTranslation,
  validateTranslationKey,
  getTranslationNamespace,
  buildTranslationKey
};