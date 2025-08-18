import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi } from 'vitest';
import { SafeTranslation, useSafeTranslation, getSafeTranslation } from '../SafeTranslation';

// Mock i18n instance for testing
const createMockI18n = (resources: any = {}) => {
  const mockI18n = i18n.createInstance();
  mockI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          'test.key': 'Test Translation',
          'test.withValues': 'Hello {{name}}!',
          'test.nested.key': 'Nested Translation',
          ...resources
        }
      }
    },
    interpolation: {
      escapeValue: false
    }
  });
  return mockI18n;
};

// Test component that uses the hook
const TestHookComponent: React.FC<{ i18nKey: string; fallback?: string }> = ({ 
  i18nKey, 
  fallback 
}) => {
  const translation = useSafeTranslation(i18nKey, fallback);
  return <div data-testid="hook-result">{translation}</div>;
};

describe('SafeTranslation Component', () => {
  let mockI18n: any;

  beforeEach(() => {
    mockI18n = createMockI18n();
    // Suppress console warnings in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SafeTranslation Component', () => {
    it('renders existing translation correctly', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="test.key" />
        </I18nextProvider>
      );

      expect(screen.getByText('Test Translation')).toBeInTheDocument();
    });

    it('renders fallback text for missing translation', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="missing.key" fallback="Fallback Text" />
        </I18nextProvider>
      );

      expect(screen.getByText('Fallback Text')).toBeInTheDocument();
    });

    it('renders key as fallback when no fallback provided', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="missing.key" />
        </I18nextProvider>
      );

      expect(screen.getByText('missing.key')).toBeInTheDocument();
    });

    it('handles interpolation values correctly', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation 
            i18nKey="test.withValues" 
            values={{ name: 'World' }} 
          />
        </I18nextProvider>
      );

      expect(screen.getByText('Hello World!')).toBeInTheDocument();
    });

    it('renders with custom component', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation 
            i18nKey="test.key" 
            as="h1" 
            data-testid="custom-component"
          />
        </I18nextProvider>
      );

      const element = screen.getByTestId('custom-component');
      expect(element.tagName).toBe('H1');
      expect(element).toHaveTextContent('Test Translation');
    });

    it('passes through additional props', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation 
            i18nKey="test.key" 
            className="test-class"
            data-testid="props-test"
          />
        </I18nextProvider>
      );

      const element = screen.getByTestId('props-test');
      expect(element).toHaveClass('test-class');
    });

    it('logs warning for missing translation in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="missing.key" context="test-context" />
        </I18nextProvider>
      );

      expect(console.warn).toHaveBeenCalledWith(
        '[SafeTranslation] Missing translation for key: "missing.key" (context: test-context)'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('useSafeTranslation Hook', () => {
    it('returns existing translation', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <TestHookComponent i18nKey="test.key" />
        </I18nextProvider>
      );

      expect(screen.getByTestId('hook-result')).toHaveTextContent('Test Translation');
    });

    it('returns fallback for missing translation', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <TestHookComponent i18nKey="missing.key" fallback="Hook Fallback" />
        </I18nextProvider>
      );

      expect(screen.getByTestId('hook-result')).toHaveTextContent('Hook Fallback');
    });

    it('returns key when no fallback provided', () => {
      render(
        <I18nextProvider i18n={mockI18n}>
          <TestHookComponent i18nKey="missing.key" />
        </I18nextProvider>
      );

      expect(screen.getByTestId('hook-result')).toHaveTextContent('missing.key');
    });
  });

  describe('getSafeTranslation Utility', () => {
    it('returns existing translation', () => {
      const t = mockI18n.t.bind(mockI18n);
      const result = getSafeTranslation(t, 'test.key');
      expect(result).toBe('Test Translation');
    });

    it('returns fallback for missing translation', () => {
      const t = mockI18n.t.bind(mockI18n);
      const result = getSafeTranslation(t, 'missing.key', 'Utility Fallback');
      expect(result).toBe('Utility Fallback');
    });

    it('returns key when no fallback provided', () => {
      const t = mockI18n.t.bind(mockI18n);
      const result = getSafeTranslation(t, 'missing.key');
      expect(result).toBe('missing.key');
    });

    it('handles interpolation values', () => {
      const t = mockI18n.t.bind(mockI18n);
      const result = getSafeTranslation(t, 'test.withValues', undefined, { name: 'Test' });
      expect(result).toBe('Hello Test!');
    });
  });

  describe('Error Handling', () => {
    it('handles i18n errors gracefully', () => {
      const brokenI18n = createMockI18n();
      // Mock the t function to throw an error
      vi.spyOn(brokenI18n, 't').mockImplementation(() => {
        throw new Error('i18n error');
      });

      render(
        <I18nextProvider i18n={brokenI18n}>
          <SafeTranslation i18nKey="test.key" fallback="Error Fallback" />
        </I18nextProvider>
      );

      expect(screen.getByText('Error Fallback')).toBeInTheDocument();
    });

    it('logs errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const brokenI18n = createMockI18n();
      // Mock the t function to throw an error
      vi.spyOn(brokenI18n, 't').mockImplementation(() => {
        throw new Error('i18n error');
      });

      render(
        <I18nextProvider i18n={brokenI18n}>
          <SafeTranslation i18nKey="test.key" fallback="Error Fallback" />
        </I18nextProvider>
      );

      expect(console.error).toHaveBeenCalledWith(
        '[SafeTranslation] Error translating key "test.key":',
        expect.any(Error)
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Development Mode Features', () => {
    it('adds visual indicators for missing translations in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="missing.key" data-testid="dev-indicator" />
        </I18nextProvider>
      );

      const element = screen.getByTestId('dev-indicator');
      expect(element).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 0, 0.2)',
        border: '1px dashed orange'
      });
      expect(element).toHaveAttribute('title', 'Missing translation: missing.key');

      process.env.NODE_ENV = originalEnv;
    });

    it('does not add visual indicators in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <I18nextProvider i18n={mockI18n}>
          <SafeTranslation i18nKey="missing.key" data-testid="prod-indicator" />
        </I18nextProvider>
      );

      const element = screen.getByTestId('prod-indicator');
      expect(element).not.toHaveStyle({
        backgroundColor: 'rgba(255, 255, 0, 0.2)'
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});