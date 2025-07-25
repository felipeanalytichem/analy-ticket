import { describe, it, expect } from 'vitest';

// Test the form field validation logic
describe('Form Field Operations', () => {
  // Mock DynamicFormField interface
  interface DynamicFormField {
    id: string;
    type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number';
    label: string;
    required: boolean;
    enabled: boolean;
    options?: string[];
    placeholder?: string;
    help_text?: string;
  }

  // Validation function (extracted from component)
  const validateFormField = (field: Partial<DynamicFormField>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Validate required properties
    if (!field.id || typeof field.id !== 'string' || field.id.trim() === '') {
      errors.push('Field ID is required and must be a non-empty string');
    }
    
    if (!field.type || !['text', 'textarea', 'select', 'checkbox', 'date', 'number'].includes(field.type)) {
      errors.push('Field type must be one of: text, textarea, select, checkbox, date, number');
    }
    
    if (field.label !== undefined && typeof field.label !== 'string') {
      errors.push('Field label must be a string');
    }
    
    if (field.required !== undefined && typeof field.required !== 'boolean') {
      errors.push('Field required property must be a boolean');
    }
    
    if (field.enabled !== undefined && typeof field.enabled !== 'boolean') {
      errors.push('Field enabled property must be a boolean');
    }
    
    // Validate select field options
    if (field.type === 'select') {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push('Select fields must have at least one option');
      } else if (field.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
        errors.push('All select options must be non-empty strings');
      }
    }
    
    // Validate placeholder and help_text if provided
    if (field.placeholder !== undefined && typeof field.placeholder !== 'string') {
      errors.push('Field placeholder must be a string');
    }
    
    if (field.help_text !== undefined && typeof field.help_text !== 'string') {
      errors.push('Field help_text must be a string');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // ID generation function (extracted from component)
  const generateFieldId = (existingFields: DynamicFormField[] = []): string => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `field_${crypto.randomUUID()}`;
      }
      // Enhanced fallback with timestamp and multiple random components
      const timestamp = Date.now().toString(36);
      const random1 = Math.random().toString(36).substr(2, 9);
      const random2 = Math.random().toString(36).substr(2, 9);
      const random3 = Math.random().toString(36).substr(2, 5);
      return `field_${timestamp}_${random1}_${random2}_${random3}`;
    };
    
    // Ensure uniqueness by checking against existing fields
    let newId = generateId();
    const existingIds = new Set(existingFields.map(f => f.id));
    
    while (existingIds.has(newId) && attempts < maxAttempts) {
      newId = generateId();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.error('Failed to generate unique field ID after maximum attempts');
      // Use timestamp as last resort
      newId = `field_emergency_${Date.now()}_${Math.random()}`;
    }
    
    return newId;
  };

  describe('Field Validation', () => {
    it('should validate a complete valid field', () => {
      const field: DynamicFormField = {
        id: 'field_123',
        type: 'text',
        label: 'Test Field',
        required: true,
        enabled: true
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject field without ID', () => {
      const field = {
        type: 'text' as const,
        label: 'Test Field',
        required: true,
        enabled: true
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field ID is required and must be a non-empty string');
    });

    it('should reject field with invalid type', () => {
      const field = {
        id: 'field_123',
        type: 'invalid' as any,
        label: 'Test Field',
        required: true,
        enabled: true
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field type must be one of: text, textarea, select, checkbox, date, number');
    });

    it('should validate select field with options', () => {
      const field: DynamicFormField = {
        id: 'field_123',
        type: 'select',
        label: 'Test Select',
        required: false,
        enabled: true,
        options: ['Option 1', 'Option 2', 'Option 3']
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject select field without options', () => {
      const field = {
        id: 'field_123',
        type: 'select' as const,
        label: 'Test Select',
        required: false,
        enabled: true
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Select fields must have at least one option');
    });

    it('should reject select field with empty options', () => {
      const field = {
        id: 'field_123',
        type: 'select' as const,
        label: 'Test Select',
        required: false,
        enabled: true,
        options: ['Option 1', '', 'Option 3']
      };

      const result = validateFormField(field);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All select options must be non-empty strings');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateFieldId();
      const id2 = generateFieldId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^field_/);
      expect(id2).toMatch(/^field_/);
    });

    it('should avoid duplicate IDs when existing fields are provided', () => {
      const existingFields: DynamicFormField[] = [
        {
          id: 'field_existing_1',
          type: 'text',
          label: 'Existing Field',
          required: false,
          enabled: true
        }
      ];

      const newId = generateFieldId(existingFields);
      expect(newId).not.toBe('field_existing_1');
      expect(newId).toMatch(/^field_/);
    });

    it('should generate multiple unique IDs', () => {
      const ids = new Set();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const id = generateFieldId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(count);
    });
  });

  describe('Field Operations Logic', () => {
    it('should simulate adding a field', () => {
      const existingFields: DynamicFormField[] = [];
      
      // Simulate addFormField logic
      const newField: DynamicFormField = {
        id: generateFieldId(existingFields),
        type: 'text',
        label: '',
        required: false,
        enabled: true
      };

      const validation = validateFormField(newField);
      expect(validation.isValid).toBe(true);

      const updatedFields = [...existingFields, newField];
      expect(updatedFields).toHaveLength(1);
      expect(updatedFields[0].id).toMatch(/^field_/);
    });

    it('should simulate updating a field', () => {
      const existingFields: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Original Label',
          required: false,
          enabled: true
        }
      ];

      const fieldId = 'field_123';
      const updates = { label: 'Updated Label', required: true };

      // Find field to update
      const fieldIndex = existingFields.findIndex(field => field.id === fieldId);
      expect(fieldIndex).not.toBe(-1);

      // Create updated field
      const currentField = existingFields[fieldIndex];
      const updatedField = { ...currentField, ...updates };

      // Validate updated field
      const validation = validateFormField(updatedField);
      expect(validation.isValid).toBe(true);

      // Create updated array
      const updatedFields = [
        ...existingFields.slice(0, fieldIndex),
        updatedField,
        ...existingFields.slice(fieldIndex + 1)
      ];

      expect(updatedFields[0].label).toBe('Updated Label');
      expect(updatedFields[0].required).toBe(true);
    });

    it('should simulate removing a field', () => {
      const existingFields: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Field to Remove',
          required: false,
          enabled: true
        },
        {
          id: 'field_456',
          type: 'textarea',
          label: 'Field to Keep',
          required: true,
          enabled: true
        }
      ];

      const fieldIdToRemove = 'field_123';

      // Check if field exists
      const fieldExists = existingFields.some(field => field.id === fieldIdToRemove);
      expect(fieldExists).toBe(true);

      // Remove field
      const updatedFields = existingFields.filter(field => field.id !== fieldIdToRemove);

      expect(updatedFields).toHaveLength(1);
      expect(updatedFields[0].id).toBe('field_456');
      expect(updatedFields[0].label).toBe('Field to Keep');
    });

    it('should handle duplicate label detection', () => {
      const existingFields: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Existing Label',
          required: false,
          enabled: true
        },
        {
          id: 'field_456',
          type: 'textarea',
          label: 'Another Label',
          required: true,
          enabled: true
        }
      ];

      const fieldIdToUpdate = 'field_456';
      const updates = { label: 'Existing Label' }; // Duplicate label

      // Check for duplicate label (excluding current field)
      const fieldIndex = existingFields.findIndex(field => field.id === fieldIdToUpdate);
      const labelExists = existingFields.some((field, index) => 
        index !== fieldIndex && 
        field.label.toLowerCase().trim() === updates.label.toLowerCase().trim()
      );

      expect(labelExists).toBe(true);
    });
  });
});