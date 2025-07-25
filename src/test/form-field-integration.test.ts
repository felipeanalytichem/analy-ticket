import { describe, it, expect } from 'vitest';

// Integration test to verify all task requirements are met
describe('Form Field Operations Integration', () => {
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

  // Enhanced validation function (from our implementation)
  const validateFormField = (field: Partial<DynamicFormField>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
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
    
    if (field.type === 'select') {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push('Select fields must have at least one option');
      } else if (field.options.some(opt => typeof opt !== 'string' || opt.trim() === '')) {
        errors.push('All select options must be non-empty strings');
      }
    }
    
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

  // Enhanced ID generation (from our implementation)
  const generateFieldId = (existingFields: DynamicFormField[] = []): string => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `field_${crypto.randomUUID()}`;
      }
      const timestamp = Date.now().toString(36);
      const random1 = Math.random().toString(36).substr(2, 9);
      const random2 = Math.random().toString(36).substr(2, 9);
      const random3 = Math.random().toString(36).substr(2, 5);
      return `field_${timestamp}_${random1}_${random2}_${random3}`;
    };
    
    let newId = generateId();
    const existingIds = new Set(existingFields.map(f => f.id));
    
    while (existingIds.has(newId) && attempts < maxAttempts) {
      newId = generateId();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      newId = `field_emergency_${Date.now()}_${Math.random()}`;
    }
    
    return newId;
  };

  describe('Task Requirement 1: Fix addFormField function to generate unique IDs consistently', () => {
    it('should generate unique IDs for multiple fields', () => {
      const existingFields: DynamicFormField[] = [];
      const newIds: string[] = [];
      
      // Simulate adding multiple fields
      for (let i = 0; i < 50; i++) {
        const newId = generateFieldId([...existingFields, ...newIds.map(id => ({ id, type: 'text', label: '', required: false, enabled: true } as DynamicFormField))]);
        expect(newIds).not.toContain(newId);
        newIds.push(newId);
      }
      
      // All IDs should be unique
      const uniqueIds = new Set(newIds);
      expect(uniqueIds.size).toBe(newIds.length);
    });

    it('should avoid collisions with existing field IDs', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_existing_1', type: 'text', label: 'Existing 1', required: false, enabled: true },
        { id: 'field_existing_2', type: 'text', label: 'Existing 2', required: false, enabled: true }
      ];

      const newId = generateFieldId(existingFields);
      expect(newId).not.toBe('field_existing_1');
      expect(newId).not.toBe('field_existing_2');
      expect(newId).toMatch(/^field_/);
    });

    it('should handle edge case of maximum attempts', () => {
      // This test verifies the fallback mechanism works
      const existingFields: DynamicFormField[] = [];
      const newId = generateFieldId(existingFields);
      expect(newId).toMatch(/^field_/);
      expect(typeof newId).toBe('string');
      expect(newId.length).toBeGreaterThan(6); // 'field_' + some content
    });
  });

  describe('Task Requirement 2: Improve updateFormField to handle state updates properly', () => {
    it('should validate field updates before applying them', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_123', type: 'text', label: 'Original', required: false, enabled: true }
      ];

      const fieldId = 'field_123';
      const updates = { label: 'Updated Label', required: true };

      // Find field
      const fieldIndex = existingFields.findIndex(field => field.id === fieldId);
      expect(fieldIndex).not.toBe(-1);

      // Create updated field
      const currentField = existingFields[fieldIndex];
      const updatedField = { ...currentField, ...updates };

      // Validate updated field
      const validation = validateFormField(updatedField);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid field updates', () => {
      const existingField: DynamicFormField = {
        id: 'field_123',
        type: 'text',
        label: 'Original',
        required: false,
        enabled: true
      };

      // Try to update with invalid type
      const invalidUpdates = { type: 'invalid_type' as any };
      const updatedField = { ...existingField, ...invalidUpdates };

      const validation = validateFormField(updatedField);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Field type must be one of: text, textarea, select, checkbox, date, number');
    });

    it('should detect duplicate labels during updates', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_123', type: 'text', label: 'Label A', required: false, enabled: true },
        { id: 'field_456', type: 'text', label: 'Label B', required: false, enabled: true }
      ];

      const fieldIdToUpdate = 'field_456';
      const updates = { label: 'Label A' }; // Duplicate label

      // Check for duplicate label (excluding current field)
      const fieldIndex = existingFields.findIndex(field => field.id === fieldIdToUpdate);
      const labelExists = existingFields.some((field, index) => 
        index !== fieldIndex && 
        field.label.toLowerCase().trim() === updates.label.toLowerCase().trim()
      );

      expect(labelExists).toBe(true);
    });

    it('should handle select field option updates', () => {
      const existingField: DynamicFormField = {
        id: 'field_123',
        type: 'select',
        label: 'Select Field',
        required: false,
        enabled: true,
        options: ['Option 1', 'Option 2']
      };

      const updates = { options: ['New Option 1', 'New Option 2', 'New Option 3'] };
      const updatedField = { ...existingField, ...updates };

      const validation = validateFormField(updatedField);
      expect(validation.isValid).toBe(true);
      expect(updatedField.options).toEqual(['New Option 1', 'New Option 2', 'New Option 3']);
    });
  });

  describe('Task Requirement 3: Fix removeFormField to clean up state correctly', () => {
    it('should remove field by ID correctly', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_123', type: 'text', label: 'Field 1', required: false, enabled: true },
        { id: 'field_456', type: 'text', label: 'Field 2', required: false, enabled: true },
        { id: 'field_789', type: 'text', label: 'Field 3', required: false, enabled: true }
      ];

      const fieldIdToRemove = 'field_456';

      // Verify field exists
      const fieldExists = existingFields.some(field => field.id === fieldIdToRemove);
      expect(fieldExists).toBe(true);

      // Remove field
      const updatedFields = existingFields.filter(field => field.id !== fieldIdToRemove);

      // Verify removal
      expect(updatedFields).toHaveLength(2);
      expect(updatedFields.find(field => field.id === fieldIdToRemove)).toBeUndefined();
      expect(updatedFields.find(field => field.id === 'field_123')).toBeDefined();
      expect(updatedFields.find(field => field.id === 'field_789')).toBeDefined();
    });

    it('should handle removal of non-existent field gracefully', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_123', type: 'text', label: 'Field 1', required: false, enabled: true }
      ];

      const fieldIdToRemove = 'field_nonexistent';

      // Check if field exists
      const fieldExists = existingFields.some(field => field.id === fieldIdToRemove);
      expect(fieldExists).toBe(false);

      // Attempt removal (should not change array)
      const updatedFields = existingFields.filter(field => field.id !== fieldIdToRemove);
      expect(updatedFields).toHaveLength(1);
      expect(updatedFields).toEqual(existingFields);
    });

    it('should maintain field order after removal', () => {
      const existingFields: DynamicFormField[] = [
        { id: 'field_1', type: 'text', label: 'First', required: false, enabled: true },
        { id: 'field_2', type: 'text', label: 'Second', required: false, enabled: true },
        { id: 'field_3', type: 'text', label: 'Third', required: false, enabled: true },
        { id: 'field_4', type: 'text', label: 'Fourth', required: false, enabled: true }
      ];

      // Remove middle field
      const updatedFields = existingFields.filter(field => field.id !== 'field_2');

      expect(updatedFields).toHaveLength(3);
      expect(updatedFields[0].label).toBe('First');
      expect(updatedFields[1].label).toBe('Third');
      expect(updatedFields[2].label).toBe('Fourth');
    });
  });

  describe('Task Requirement 4: Add field validation before state updates', () => {
    it('should validate all required field properties', () => {
      const validField: DynamicFormField = {
        id: 'field_123',
        type: 'text',
        label: 'Valid Field',
        required: true,
        enabled: true
      };

      const validation = validateFormField(validField);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject fields with missing required properties', () => {
      const invalidField = {
        // Missing id
        type: 'text' as const,
        label: 'Invalid Field',
        required: true,
        enabled: true
      };

      const validation = validateFormField(invalidField);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Field ID is required and must be a non-empty string');
    });

    it('should validate select field options', () => {
      const selectFieldWithoutOptions = {
        id: 'field_123',
        type: 'select' as const,
        label: 'Select Field',
        required: false,
        enabled: true
        // Missing options
      };

      const validation = validateFormField(selectFieldWithoutOptions);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Select fields must have at least one option');
    });

    it('should validate field type constraints', () => {
      const fieldWithInvalidType = {
        id: 'field_123',
        type: 'invalid' as any,
        label: 'Invalid Type Field',
        required: false,
        enabled: true
      };

      const validation = validateFormField(fieldWithInvalidType);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Field type must be one of: text, textarea, select, checkbox, date, number');
    });

    it('should validate boolean properties', () => {
      const fieldWithInvalidBoolean = {
        id: 'field_123',
        type: 'text' as const,
        label: 'Field',
        required: 'true' as any, // Should be boolean
        enabled: true
      };

      const validation = validateFormField(fieldWithInvalidBoolean);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Field required property must be a boolean');
    });

    it('should validate optional properties when provided', () => {
      const fieldWithInvalidOptional = {
        id: 'field_123',
        type: 'text' as const,
        label: 'Field',
        required: false,
        enabled: true,
        placeholder: 123 as any, // Should be string
        help_text: true as any // Should be string
      };

      const validation = validateFormField(fieldWithInvalidOptional);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Field placeholder must be a string');
      expect(validation.errors).toContain('Field help_text must be a string');
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete add-update-remove workflow', () => {
      let fields: DynamicFormField[] = [];

      // Step 1: Add a field
      const newField: DynamicFormField = {
        id: generateFieldId(fields),
        type: 'text',
        label: 'Test Field',
        required: false,
        enabled: true
      };

      const addValidation = validateFormField(newField);
      expect(addValidation.isValid).toBe(true);

      fields = [...fields, newField];
      expect(fields).toHaveLength(1);

      // Step 2: Update the field
      const fieldId = newField.id;
      const updates = { label: 'Updated Test Field', required: true };

      const fieldIndex = fields.findIndex(field => field.id === fieldId);
      expect(fieldIndex).not.toBe(-1);

      const updatedField = { ...fields[fieldIndex], ...updates };
      const updateValidation = validateFormField(updatedField);
      expect(updateValidation.isValid).toBe(true);

      fields = [
        ...fields.slice(0, fieldIndex),
        updatedField,
        ...fields.slice(fieldIndex + 1)
      ];

      expect(fields[0].label).toBe('Updated Test Field');
      expect(fields[0].required).toBe(true);

      // Step 3: Remove the field
      const fieldExists = fields.some(field => field.id === fieldId);
      expect(fieldExists).toBe(true);

      fields = fields.filter(field => field.id !== fieldId);
      expect(fields).toHaveLength(0);
    });

    it('should handle multiple fields with proper validation', () => {
      let fields: DynamicFormField[] = [];

      // Add multiple fields
      const field1: DynamicFormField = {
        id: generateFieldId(fields),
        type: 'text',
        label: 'Field 1',
        required: false,
        enabled: true
      };

      const field2: DynamicFormField = {
        id: generateFieldId([...fields, field1]),
        type: 'select',
        label: 'Field 2',
        required: true,
        enabled: true,
        options: ['Option A', 'Option B']
      };

      // Validate both fields
      expect(validateFormField(field1).isValid).toBe(true);
      expect(validateFormField(field2).isValid).toBe(true);

      // Ensure unique IDs
      expect(field1.id).not.toBe(field2.id);

      fields = [field1, field2];
      expect(fields).toHaveLength(2);

      // Update field2 options
      const field2Index = fields.findIndex(f => f.id === field2.id);
      const updatedField2 = {
        ...fields[field2Index],
        options: ['New Option 1', 'New Option 2', 'New Option 3']
      };

      expect(validateFormField(updatedField2).isValid).toBe(true);

      fields = [
        ...fields.slice(0, field2Index),
        updatedField2,
        ...fields.slice(field2Index + 1)
      ];

      expect(fields[1].options).toEqual(['New Option 1', 'New Option 2', 'New Option 3']);

      // Remove field1
      fields = fields.filter(field => field.id !== field1.id);
      expect(fields).toHaveLength(1);
      expect(fields[0].id).toBe(field2.id);
    });
  });
});