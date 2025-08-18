import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormAutoSave } from '../useFormAutoSave';
import { stateManager } from '@/services/StateManager';

// Mock StateManager
vi.mock('@/services/StateManager', () => ({
  stateManager: {
    enableAutoSave: vi.fn(),
    disableAutoSave: vi.fn(),
    saveState: vi.fn(),
    restoreFormData: vi.fn(),
    clearState: vi.fn()
  }
}));

// Mock DOM methods
const mockFormElement = {
  id: 'test-form',
  querySelectorAll: vi.fn(() => [
    { name: 'field1', value: 'value1', type: 'text' },
    { name: 'field2', value: 'value2', type: 'text' },
    { name: 'checkbox1', checked: true, type: 'checkbox' }
  ])
};

const mockFormData = new Map([
  ['field1', 'value1'],
  ['field2', 'value2']
]);

Object.defineProperty(document, 'getElementById', {
  value: vi.fn(() => mockFormElement)
});

Object.defineProperty(document, 'querySelector', {
  value: vi.fn(() => mockFormElement)
});

global.FormData = vi.fn().mockImplementation(() => ({
  forEach: (callback: (value: any, key: string) => void) => {
    mockFormData.forEach((value, key) => callback(value, key));
  }
})) as any;

describe('useFormAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (stateManager.enableAutoSave as Mock).mockImplementation(() => {});
    (stateManager.disableAutoSave as Mock).mockImplementation(() => {});
    (stateManager.saveState as Mock).mockResolvedValue(undefined);
    (stateManager.restoreFormData as Mock).mockResolvedValue(null);
    (stateManager.clearState as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should enable auto-save on mount when enabled is true', () => {
      renderHook(() => useFormAutoSave('test-form', { enabled: true }));

      expect(stateManager.enableAutoSave).toHaveBeenCalledWith('test-form', 30000);
    });

    it('should not enable auto-save on mount when enabled is false', () => {
      renderHook(() => useFormAutoSave('test-form', { enabled: false }));

      expect(stateManager.enableAutoSave).not.toHaveBeenCalled();
    });

    it('should use custom interval when provided', () => {
      renderHook(() => useFormAutoSave('test-form', { interval: 15000 }));

      expect(stateManager.enableAutoSave).toHaveBeenCalledWith('test-form', 15000);
    });

    it('should disable auto-save on unmount', () => {
      const { unmount } = renderHook(() => useFormAutoSave('test-form'));

      unmount();

      expect(stateManager.disableAutoSave).toHaveBeenCalledWith('test-form');
    });
  });

  describe('saveNow', () => {
    it('should save form data manually', async () => {
      const onSave = vi.fn();
      const { result } = renderHook(() => 
        useFormAutoSave('test-form', { onSave })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(stateManager.saveState).toHaveBeenCalledWith('form-test-form', {
        data: expect.objectContaining({
          field1: 'value1',
          field2: 'value2',
          checkbox1: true
        }),
        timestamp: expect.any(Number),
        formId: 'test-form'
      });
      expect(onSave).toHaveBeenCalled();
    });

    it('should exclude specified fields from saving', async () => {
      const { result } = renderHook(() => 
        useFormAutoSave('test-form', { excludeFields: ['field2'] })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      const savedData = (stateManager.saveState as Mock).mock.calls[0][1];
      expect(savedData.data).toHaveProperty('field1');
      expect(savedData.data).not.toHaveProperty('field2');
    });

    it('should handle form element not found', async () => {
      (document.getElementById as Mock).mockReturnValue(null);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.saveNow();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Form element not found: test-form');
      expect(stateManager.saveState).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle multiple values for same field name', async () => {
      global.FormData = vi.fn().mockImplementation(() => ({
        forEach: (callback: (value: any, key: string) => void) => {
          callback('value1', 'field1');
          callback('value2', 'field1'); // Same key
          callback('single', 'field2');
        }
      })) as any;

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.saveNow();
      });

      expect(stateManager.saveState).toHaveBeenCalled();
      const savedData = (stateManager.saveState as Mock).mock.calls[0][1];
      expect(savedData.data.field1).toEqual(['value1', 'value2']);
      expect(savedData.data.field2).toBe('single');
    });
  });

  describe('restoreData', () => {
    it('should restore form data and populate form fields', async () => {
      const mockSavedData = {
        data: {
          field1: 'restored1',
          field2: 'restored2',
          checkbox1: true
        },
        timestamp: Date.now(),
        formId: 'test-form'
      };

      (stateManager.restoreFormData as Mock).mockResolvedValue(mockSavedData);

      const mockField1 = { name: 'field1', type: 'text', value: '' };
      const mockField2 = { name: 'field2', type: 'text', value: '' };
      const mockCheckbox = { name: 'checkbox1', type: 'checkbox', checked: false };

      const mockFormElementWithQuery = {
        ...mockFormElement,
        querySelector: vi.fn()
          .mockReturnValueOnce(mockField1)
          .mockReturnValueOnce(mockField2)
          .mockReturnValueOnce(mockCheckbox)
      };

      (document.getElementById as Mock).mockReturnValue(mockFormElementWithQuery);

      const onRestore = vi.fn();
      const { result } = renderHook(() => 
        useFormAutoSave('test-form', { onRestore })
      );

      let restoredData;
      await act(async () => {
        restoredData = await result.current.restoreData();
      });

      expect(mockField1.value).toBe('restored1');
      expect(mockField2.value).toBe('restored2');
      expect(mockCheckbox.checked).toBe(true);
      expect(onRestore).toHaveBeenCalledWith(mockSavedData.data);
      expect(restoredData).toEqual(mockSavedData.data);
    });

    it('should handle array values when restoring', async () => {
      const mockSavedData = {
        data: {
          multiField: ['value1', 'value2']
        }
      };

      (stateManager.restoreFormData as Mock).mockResolvedValue(mockSavedData);

      const mockElement1 = { type: 'text', value: '' };
      const mockElement2 = { type: 'text', value: '' };

      const mockFormElementWithQueryAll = {
        ...mockFormElement,
        querySelector: vi.fn(() => null), // No single element found
        querySelectorAll: vi.fn(() => [mockElement1, mockElement2])
      };

      (document.getElementById as Mock).mockReturnValue(mockFormElementWithQueryAll);

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.restoreData();
      });

      expect(mockElement1.value).toBe('value1');
      expect(mockElement2.value).toBe('value2');
    });

    it('should return null when no saved data exists', async () => {
      (stateManager.restoreFormData as Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      let restoredData;
      await act(async () => {
        restoredData = await result.current.restoreData();
      });

      expect(restoredData).toBeNull();
    });

    it('should handle form element not found during restore', async () => {
      const mockSavedData = { data: { field1: 'value1' } };
      (stateManager.restoreFormData as Mock).mockResolvedValue(mockSavedData);
      (document.getElementById as Mock).mockReturnValue(null);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useFormAutoSave('test-form'));

      let restoredData;
      await act(async () => {
        restoredData = await result.current.restoreData();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Form element not found: test-form');
      expect(restoredData).toEqual(mockSavedData.data);

      consoleSpy.mockRestore();
    });
  });

  describe('clearSavedData', () => {
    it('should clear saved form data', async () => {
      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.clearSavedData();
      });

      expect(stateManager.clearState).toHaveBeenCalledWith('form-test-form');
    });

    it('should handle clear errors gracefully', async () => {
      (stateManager.clearState as Mock).mockRejectedValue(new Error('Clear failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.clearSavedData();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to clear saved form data:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('hasSavedData', () => {
    it('should return true when saved data exists', async () => {
      (stateManager.restoreFormData as Mock).mockResolvedValue({ data: { field1: 'value1' } });

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      let hasSaved;
      await act(async () => {
        hasSaved = await result.current.hasSavedData();
      });

      expect(hasSaved).toBe(true);
    });

    it('should return false when no saved data exists', async () => {
      (stateManager.restoreFormData as Mock).mockResolvedValue(null);

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      let hasSaved;
      await act(async () => {
        hasSaved = await result.current.hasSavedData();
      });

      expect(hasSaved).toBe(false);
    });
  });

  describe('enable/disable', () => {
    it('should enable auto-save when calling enable()', () => {
      const { result } = renderHook(() => useFormAutoSave('test-form', { enabled: false }));

      act(() => {
        result.current.enable();
      });

      expect(stateManager.enableAutoSave).toHaveBeenCalledWith('test-form', 30000);
    });

    it('should disable auto-save when calling disable()', () => {
      const { result } = renderHook(() => useFormAutoSave('test-form', { enabled: true }));

      act(() => {
        result.current.disable();
      });

      expect(stateManager.disableAutoSave).toHaveBeenCalledWith('test-form');
    });
  });

  describe('custom form selector', () => {
    it('should use custom form selector instead of formId', async () => {
      const customElement = { ...mockFormElement, id: 'custom-form' };
      (document.querySelector as Mock).mockReturnValue(customElement);

      const { result } = renderHook(() => 
        useFormAutoSave('test-form', { formSelector: '#custom-form' })
      );

      await act(async () => {
        await result.current.saveNow();
      });

      expect(document.querySelector).toHaveBeenCalledWith('#custom-form');
      expect(stateManager.saveState).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle save errors gracefully', async () => {
      (stateManager.saveState as Mock).mockRejectedValueOnce(new Error('Save failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      await act(async () => {
        await result.current.saveNow();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to save form data:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle restore errors gracefully', async () => {
      (stateManager.restoreFormData as Mock).mockRejectedValue(new Error('Restore failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useFormAutoSave('test-form'));

      let result_data;
      await act(async () => {
        result_data = await result.current.restoreData();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to restore form data:', expect.any(Error));
      expect(result_data).toBeNull();

      consoleSpy.mockRestore();
    });
  });
});