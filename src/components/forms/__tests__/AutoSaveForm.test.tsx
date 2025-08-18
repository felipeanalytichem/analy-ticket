import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AutoSaveForm } from '../AutoSaveForm';

// Mock the hooks
vi.mock('@/hooks/useFormAutoSave', () => ({
  useFormAutoSave: vi.fn(() => ({
    saveNow: vi.fn(),
    restoreData: vi.fn(),
    clearSavedData: vi.fn(),
    hasSavedData: vi.fn(() => Promise.resolve(false)),
    enable: vi.fn(),
    disable: vi.fn(),
    isEnabled: true
  }))
}));

vi.mock('../FormAutoSaveIndicator', () => ({
  FormAutoSaveIndicator: vi.fn(({ status, onRetry }) => (
    <div data-testid="auto-save-indicator">
      <span data-testid="status">{status}</span>
      {onRetry && (
        <button data-testid="retry-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )),
  useAutoSaveIndicator: vi.fn(() => ({
    status: 'idle',
    lastSaved: undefined,
    errorMessage: undefined,
    setSaving: vi.fn(),
    setSaved: vi.fn(),
    setError: vi.fn(),
    reset: vi.fn()
  }))
}));

import { useFormAutoSave } from '@/hooks/useFormAutoSave';
import { useAutoSaveIndicator } from '../FormAutoSaveIndicator';

describe('AutoSaveForm', () => {
  const mockUseFormAutoSave = useFormAutoSave as Mock;
  const mockUseAutoSaveIndicator = useAutoSaveIndicator as Mock;

  let mockAutoSave: any;
  let mockIndicator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAutoSave = {
      saveNow: vi.fn(),
      restoreData: vi.fn(),
      clearSavedData: vi.fn(),
      hasSavedData: vi.fn(() => Promise.resolve(false)),
      enable: vi.fn(),
      disable: vi.fn(),
      isEnabled: true
    };

    mockIndicator = {
      status: 'idle',
      lastSaved: undefined,
      errorMessage: undefined,
      setSaving: vi.fn(),
      setSaved: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn()
    };

    mockUseFormAutoSave.mockReturnValue(mockAutoSave);
    mockUseAutoSaveIndicator.mockReturnValue(mockIndicator);
  });

  describe('rendering', () => {
    it('should render form with correct id', () => {
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
        </AutoSaveForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('id', 'test-form');
    });

    it('should render children correctly', () => {
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" placeholder="Test input" />
          <button type="submit">Submit</button>
        </AutoSaveForm>
      );

      expect(screen.getByPlaceholderText('Test input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('should show auto-save indicator by default', () => {
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
        </AutoSaveForm>
      );

      expect(screen.getByTestId('auto-save-indicator')).toBeInTheDocument();
    });

    it('should hide auto-save indicator when showIndicator is false', () => {
      render(
        <AutoSaveForm formId="test-form" showIndicator={false}>
          <input name="test" />
        </AutoSaveForm>
      );

      expect(screen.queryByTestId('auto-save-indicator')).not.toBeInTheDocument();
    });

    it('should include manual save button (hidden)', () => {
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
        </AutoSaveForm>
      );

      const saveButton = screen.getByTestId('manual-save-button');
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toHaveClass('sr-only');
    });
  });

  describe('auto-save configuration', () => {
    it('should pass auto-save options to useFormAutoSave hook', () => {
      const autoSaveOptions = {
        interval: 15000,
        excludeFields: ['password'],
        enabled: true
      };

      render(
        <AutoSaveForm formId="test-form" autoSaveOptions={autoSaveOptions}>
          <input name="test" />
        </AutoSaveForm>
      );

      expect(mockUseFormAutoSave).toHaveBeenCalledWith('test-form', expect.objectContaining({
        interval: 15000,
        excludeFields: ['password'],
        enabled: true
      }));
    });

    it('should handle onSave callback', () => {
      const onDataSaved = vi.fn();
      const testData = { field1: 'value1' };

      render(
        <AutoSaveForm formId="test-form" onDataSaved={onDataSaved}>
          <input name="test" />
        </AutoSaveForm>
      );

      // Get the onSave callback passed to useFormAutoSave
      const onSaveCallback = mockUseFormAutoSave.mock.calls[0][1].onSave;
      onSaveCallback(testData);

      expect(onDataSaved).toHaveBeenCalledWith(testData);
      expect(mockIndicator.setSaved).toHaveBeenCalled();
    });

    it('should handle onRestore callback', () => {
      const onDataRestored = vi.fn();
      const testData = { field1: 'value1' };

      render(
        <AutoSaveForm formId="test-form" onDataRestored={onDataRestored}>
          <input name="test" />
        </AutoSaveForm>
      );

      // Get the onRestore callback passed to useFormAutoSave
      const onRestoreCallback = mockUseFormAutoSave.mock.calls[0][1].onRestore;
      onRestoreCallback(testData);

      expect(onDataRestored).toHaveBeenCalledWith(testData);
    });
  });

  describe('data restoration', () => {
    it('should restore data on mount when restoreOnMount is true', async () => {
      mockAutoSave.hasSavedData.mockResolvedValue(true);
      mockAutoSave.restoreData.mockResolvedValue({ field1: 'value1' });

      render(
        <AutoSaveForm formId="test-form" restoreOnMount={true}>
          <input name="test" />
        </AutoSaveForm>
      );

      await waitFor(() => {
        expect(mockAutoSave.hasSavedData).toHaveBeenCalled();
        expect(mockAutoSave.restoreData).toHaveBeenCalled();
      });
    });

    it('should not restore data on mount when restoreOnMount is false', async () => {
      render(
        <AutoSaveForm formId="test-form" restoreOnMount={false}>
          <input name="test" />
        </AutoSaveForm>
      );

      // Wait a bit to ensure no restoration happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAutoSave.hasSavedData).not.toHaveBeenCalled();
      expect(mockAutoSave.restoreData).not.toHaveBeenCalled();
    });

    it('should not restore data if no saved data exists', async () => {
      mockAutoSave.hasSavedData.mockResolvedValue(false);

      render(
        <AutoSaveForm formId="test-form" restoreOnMount={true}>
          <input name="test" />
        </AutoSaveForm>
      );

      await waitFor(() => {
        expect(mockAutoSave.hasSavedData).toHaveBeenCalled();
      });

      expect(mockAutoSave.restoreData).not.toHaveBeenCalled();
    });
  });

  describe('manual save functionality', () => {
    it('should trigger manual save when save button is clicked', async () => {
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
        </AutoSaveForm>
      );

      const saveButton = screen.getByTestId('manual-save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockIndicator.setSaving).toHaveBeenCalled();
        expect(mockAutoSave.saveNow).toHaveBeenCalled();
      });
    });

    it('should handle save errors', async () => {
      const onSaveError = vi.fn();
      const saveError = new Error('Save failed');
      mockAutoSave.saveNow.mockRejectedValue(saveError);

      render(
        <AutoSaveForm formId="test-form" onSaveError={onSaveError}>
          <input name="test" />
        </AutoSaveForm>
      );

      const saveButton = screen.getByTestId('manual-save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockIndicator.setError).toHaveBeenCalledWith('Failed to save form data');
        expect(onSaveError).toHaveBeenCalledWith(saveError);
      });
    });

    it('should handle retry functionality', async () => {
      mockIndicator.status = 'error';
      
      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
        </AutoSaveForm>
      );

      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockIndicator.reset).toHaveBeenCalled();
        expect(mockIndicator.setSaving).toHaveBeenCalled();
        expect(mockAutoSave.saveNow).toHaveBeenCalled();
      });
    });
  });

  describe('form submission', () => {
    it('should clear saved data on form submission', async () => {
      const onSubmit = vi.fn((e) => e.preventDefault());

      render(
        <AutoSaveForm formId="test-form" onSubmit={onSubmit}>
          <input name="test" />
          <button type="submit">Submit</button>
        </AutoSaveForm>
      );

      const form = screen.getByRole('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockAutoSave.clearSavedData).toHaveBeenCalled();
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    it('should handle clear data errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAutoSave.clearSavedData.mockRejectedValue(new Error('Clear failed'));

      render(
        <AutoSaveForm formId="test-form">
          <input name="test" />
          <button type="submit">Submit</button>
        </AutoSaveForm>
      );

      const form = screen.getByRole('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to clear saved data:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('form props forwarding', () => {
    it('should forward form props correctly', () => {
      render(
        <AutoSaveForm 
          formId="test-form" 
          className="custom-form"
          data-testid="custom-form"
          method="post"
          action="/submit"
        >
          <input name="test" />
        </AutoSaveForm>
      );

      const form = screen.getByTestId('custom-form');
      expect(form).toHaveClass('custom-form');
      expect(form).toHaveAttribute('method', 'post');
      expect(form).toHaveAttribute('action', '/submit');
    });

    it('should merge className with default classes', () => {
      render(
        <AutoSaveForm formId="test-form" className="custom-class">
          <input name="test" />
        </AutoSaveForm>
      );

      const form = screen.getByRole('form');
      expect(form).toHaveClass('relative', 'custom-class');
    });
  });

  describe('indicator positioning', () => {
    it('should pass indicator position to FormAutoSaveIndicator', () => {
      const { FormAutoSaveIndicator } = require('../FormAutoSaveIndicator');

      render(
        <AutoSaveForm formId="test-form" indicatorPosition="bottom-left">
          <input name="test" />
        </AutoSaveForm>
      );

      expect(FormAutoSaveIndicator).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 'bottom-left'
        }),
        expect.anything()
      );
    });
  });

  describe('error handling', () => {
    it('should handle restoration errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAutoSave.hasSavedData.mockRejectedValue(new Error('Check failed'));

      render(
        <AutoSaveForm formId="test-form" restoreOnMount={true}>
          <input name="test" />
        </AutoSaveForm>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to restore form data:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});