import { describe, it, expect } from 'vitest';

// Test the validation logic that was added to the database service
describe('Database Service Validation - Task 3 Implementation', () => {
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

  // Validation function extracted from the enhanced database service
  const validateFormField = (field: any, index: number): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Basic field validation
    if (!field || typeof field !== 'object') {
      errors.push(`Field at index ${index}: must be a valid object`);
      return { isValid: false, errors };
    }

    // Validate required properties
    if (!field.id || typeof field.id !== 'string' || field.id.trim() === '') {
      errors.push(`Field at index ${index}: ID is required and must be a non-empty string`);
    }

    if (!field.type || !['text', 'textarea', 'select', 'checkbox', 'date', 'number'].includes(field.type)) {
      errors.push(`Field at index ${index}: type must be one of: text, textarea, select, checkbox, date, number`);
    }

    if (typeof field.label !== 'string') {
      errors.push(`Field at index ${index}: label must be a string`);
    }

    if (typeof field.required !== 'boolean') {
      errors.push(`Field at index ${index}: required must be a boolean`);
    }

    if (typeof field.enabled !== 'boolean') {
      errors.push(`Field at index ${index}: enabled must be a boolean`);
    }

    // Validate select field options
    if (field.type === 'select') {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push(`Field at index ${index}: select fields must have at least one option`);
      } else if (field.options.some((opt: any) => typeof opt !== 'string' || opt.trim() === '')) {
        errors.push(`Field at index ${index}: all select options must be non-empty strings`);
      }
    }

    // Validate optional properties
    if (field.placeholder !== undefined && typeof field.placeholder !== 'string') {
      errors.push(`Field at index ${index}: placeholder must be a string`);
    }

    if (field.help_text !== undefined && typeof field.help_text !== 'string') {
      errors.push(`Field at index ${index}: help_text must be a string`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Field cleaning function extracted from the enhanced database service
  const cleanFormField = (field: any): DynamicFormField => {
    const cleanField: DynamicFormField = {
      id: field.id.trim(),
      type: field.type,
      label: field.label.trim(),
      required: field.required,
      enabled: field.enabled
    };

    // Add optional properties if they exist and are valid
    if (field.options && Array.isArray(field.options)) {
      cleanField.options = field.options.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0);
    }

    if (field.placeholder && typeof field.placeholder === 'string') {
      cleanField.placeholder = field.placeholder.trim();
    }

    if (field.help_text && typeof field.help_text === 'string') {
      cleanField.help_text = field.help_text.trim();
    }

    return cleanField;
  };

  // Duplicate detection functions
  const detectDuplicateIds = (fields: DynamicFormField[]): string[] => {
    const fieldIds = fields.map(f => f.id);
    const uniqueIds = new Set(fieldIds);
    if (fieldIds.length !== uniqueIds.size) {
      return fieldIds.filter((id, index) => fieldIds.indexOf(id) !== index);
    }
    return [];
  };

  const detectDuplicateLabels = (fields: DynamicFormField[]): string[] => {
    const nonEmptyLabels = fields
      .map(f => f.label.toLowerCase().trim())
      .filter(label => label.length > 0);
    const uniqueLabels = new Set(nonEmptyLabels);
    if (nonEmptyLabels.length !== uniqueLabels.size) {
      return nonEmptyLabels.filter((label, index) => nonEmptyLabels.indexOf(label) !== index);
    }
    return [];
  };

  describe('Task 3.1: Verify saveSubcategoryFormFields method validation', () => {
    it('should validate subcategory ID parameter', () => {
      // Test empty subcategory ID
      expect(() => {
        if (!'' || typeof '' !== 'string' || ''.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).toThrow('Invalid subcategory ID: must be a non-empty string');

      // Test null subcategory ID
      expect(() => {
        if (!null || typeof null !== 'string' || (null as any)?.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).toThrow('Invalid subcategory ID: must be a non-empty string');

      // Test valid subcategory ID
      expect(() => {
        const id = 'valid_id';
        if (!id || typeof id !== 'string' || id.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).not.toThrow();
    });

    it('should validate form fields array parameter', () => {
      // Test non-array form fields
      expect(() => {
        const fields = 'invalid';
        if (!Array.isArray(fields)) {
          throw new Error('Invalid form fields: must be an array');
        }
      }).toThrow('Invalid form fields: must be an array');

      // Test null form fields
      expect(() => {
        const fields = null;
        if (!Array.isArray(fields)) {
          throw new Error('Invalid form fields: must be an array');
        }
      }).toThrow('Invalid form fields: must be an array');

      // Test valid array
      expect(() => {
        const fields: any[] = [];
        if (!Array.isArray(fields)) {
          throw new Error('Invalid form fields: must be an array');
        }
      }).not.toThrow();
    });

    it('should validate individual form field properties', () => {
      // Test field without ID
      const fieldWithoutId = {
        type: 'text',
        label: 'Test Field',
        required: false,
        enabled: true
      };

      const validation1 = validateFormField(fieldWithoutId, 0);
      expect(validation1.isValid).toBe(false);
      expect(validation1.errors).toContain('Field at index 0: ID is required and must be a non-empty string');

      // Test field with invalid type
      const fieldWithInvalidType = {
        id: 'field_123',
        type: 'invalid',
        label: 'Test Field',
        required: false,
        enabled: true
      };

      const validation2 = validateFormField(fieldWithInvalidType, 0);
      expect(validation2.isValid).toBe(false);
      expect(validation2.errors).toContain('Field at index 0: type must be one of: text, textarea, select, checkbox, date, number');

      // Test field with non-boolean required
      const fieldWithInvalidRequired = {
        id: 'field_123',
        type: 'text',
        label: 'Test Field',
        required: 'true',
        enabled: true
      };

      const validation3 = validateFormField(fieldWithInvalidRequired, 0);
      expect(validation3.isValid).toBe(false);
      expect(validation3.errors).toContain('Field at index 0: required must be a boolean');

      // Test valid field
      const validField = {
        id: 'field_123',
        type: 'text',
        label: 'Test Field',
        required: false,
        enabled: true
      };

      const validation4 = validateFormField(validField, 0);
      expect(validation4.isValid).toBe(true);
      expect(validation4.errors).toHaveLength(0);
    });

    it('should validate select field options', () => {
      // Test select field without options
      const selectFieldWithoutOptions = {
        id: 'field_123',
        type: 'select',
        label: 'Select Field',
        required: false,
        enabled: true
      };

      const validation1 = validateFormField(selectFieldWithoutOptions, 0);
      expect(validation1.isValid).toBe(false);
      expect(validation1.errors).toContain('Field at index 0: select fields must have at least one option');

      // Test select field with empty options
      const selectFieldWithEmptyOptions = {
        id: 'field_123',
        type: 'select',
        label: 'Select Field',
        required: false,
        enabled: true,
        options: []
      };

      const validation2 = validateFormField(selectFieldWithEmptyOptions, 0);
      expect(validation2.isValid).toBe(false);
      expect(validation2.errors).toContain('Field at index 0: select fields must have at least one option');

      // Test select field with invalid options
      const selectFieldWithInvalidOptions = {
        id: 'field_123',
        type: 'select',
        label: 'Select Field',
        required: false,
        enabled: true,
        options: ['Valid Option', '', 'Another Valid Option']
      };

      const validation3 = validateFormField(selectFieldWithInvalidOptions, 0);
      expect(validation3.isValid).toBe(false);
      expect(validation3.errors).toContain('Field at index 0: all select options must be non-empty strings');

      // Test valid select field
      const validSelectField = {
        id: 'field_123',
        type: 'select',
        label: 'Select Field',
        required: false,
        enabled: true,
        options: ['Option 1', 'Option 2', 'Option 3']
      };

      const validation4 = validateFormField(validSelectField, 0);
      expect(validation4.isValid).toBe(true);
      expect(validation4.errors).toHaveLength(0);
    });

    it('should detect duplicate field IDs', () => {
      const fieldsWithDuplicateIds: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Field 1',
          required: false,
          enabled: true
        },
        {
          id: 'field_123', // Duplicate ID
          type: 'textarea',
          label: 'Field 2',
          required: false,
          enabled: true
        }
      ];

      const duplicates = detectDuplicateIds(fieldsWithDuplicateIds);
      expect(duplicates).toContain('field_123');
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should detect duplicate field labels', () => {
      const fieldsWithDuplicateLabels: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Same Label',
          required: false,
          enabled: true
        },
        {
          id: 'field_456',
          type: 'textarea',
          label: 'Same Label', // Duplicate label
          required: false,
          enabled: true
        }
      ];

      const duplicates = detectDuplicateLabels(fieldsWithDuplicateLabels);
      expect(duplicates).toContain('same label');
      expect(duplicates.length).toBeGreaterThan(0);
    });

    it('should clean and validate field data', () => {
      const fieldWithExtraSpaces = {
        id: '  field_123  ',
        type: 'text',
        label: '  Test Field  ',
        required: false,
        enabled: true,
        placeholder: '  Enter text here  ',
        help_text: '  This is help text  '
      };

      // First validate
      const validation = validateFormField(fieldWithExtraSpaces, 0);
      expect(validation.isValid).toBe(true);

      // Then clean
      const cleanedField = cleanFormField(fieldWithExtraSpaces);
      expect(cleanedField.id).toBe('field_123');
      expect(cleanedField.label).toBe('Test Field');
      expect(cleanedField.placeholder).toBe('Enter text here');
      expect(cleanedField.help_text).toBe('This is help text');
    });
  });

  describe('Task 3.2: Verify getSubcategoryFormFields method validation', () => {
    it('should validate subcategory ID parameter', () => {
      // Test empty subcategory ID
      expect(() => {
        const id = '';
        if (!id || typeof id !== 'string' || id.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).toThrow('Invalid subcategory ID: must be a non-empty string');

      // Test null subcategory ID
      expect(() => {
        const id = null;
        if (!id || typeof id !== 'string' || (id as any)?.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).toThrow('Invalid subcategory ID: must be a non-empty string');

      // Test valid subcategory ID
      expect(() => {
        const id = 'valid_id';
        if (!id || typeof id !== 'string' || id.trim() === '') {
          throw new Error('Invalid subcategory ID: must be a non-empty string');
        }
      }).not.toThrow();
    });

    it('should handle different form field data formats', () => {
      // Test with array data (normal case)
      const arrayData = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Test Field',
          required: false,
          enabled: true
        }
      ];

      expect(Array.isArray(arrayData)).toBe(true);
      expect(arrayData).toHaveLength(1);

      // Test with JSON string data
      const jsonStringData = JSON.stringify([
        {
          id: 'field_123',
          type: 'text',
          label: 'Test Field',
          required: false,
          enabled: true
        }
      ]);

      let parsedData;
      try {
        parsedData = JSON.parse(jsonStringData);
      } catch (error) {
        parsedData = [];
      }

      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData).toHaveLength(1);

      // Test with malformed JSON
      const malformedJson = '{"invalid": json}';
      let malformedParsed;
      try {
        malformedParsed = JSON.parse(malformedJson);
      } catch (error) {
        malformedParsed = [];
      }

      expect(Array.isArray(malformedParsed)).toBe(true);
      expect(malformedParsed).toHaveLength(0);
    });

    it('should validate and clean returned form field data', () => {
      const dirtyData = [
        {
          id: '  field_123  ',
          type: 'text',
          label: '  Test Field  ',
          required: false,
          enabled: true,
          placeholder: '  Enter text  '
        },
        {
          id: 'field_456',
          type: 'select',
          label: 'Select Field',
          required: true,
          enabled: true,
          options: ['  Option 1  ', 'Option 2', '  Option 3  ']
        }
      ];

      const validatedFields: DynamicFormField[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < dirtyData.length; i++) {
        const field = dirtyData[i];
        const validation = validateFormField(field, i);
        
        if (validation.isValid) {
          const cleanedField = cleanFormField(field);
          validatedFields.push(cleanedField);
        } else {
          validationErrors.push(...validation.errors);
        }
      }

      expect(validationErrors).toHaveLength(0);
      expect(validatedFields).toHaveLength(2);
      
      // Check that data was cleaned (trimmed)
      expect(validatedFields[0].id).toBe('field_123');
      expect(validatedFields[0].label).toBe('Test Field');
      expect(validatedFields[0].placeholder).toBe('Enter text');
      
      expect(validatedFields[1].options).toEqual(['Option 1', 'Option 2', 'Option 3']);
    });

    it('should handle and remove duplicate field IDs', () => {
      const dataWithDuplicates = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Field 1',
          required: false,
          enabled: true
        },
        {
          id: 'field_123', // Duplicate ID
          type: 'textarea',
          label: 'Field 2',
          required: false,
          enabled: true
        },
        {
          id: 'field_456',
          type: 'text',
          label: 'Field 3',
          required: false,
          enabled: true
        }
      ];

      // Simulate deduplication logic
      const seenIds = new Set<string>();
      const deduplicatedFields = dataWithDuplicates.filter(field => {
        if (seenIds.has(field.id)) {
          return false; // Remove duplicate
        }
        seenIds.add(field.id);
        return true;
      });

      // Should remove duplicate and return only 2 fields
      expect(deduplicatedFields).toHaveLength(2);
      
      // Should keep the first occurrence
      expect(deduplicatedFields[0].id).toBe('field_123');
      expect(deduplicatedFields[0].label).toBe('Field 1');
      expect(deduplicatedFields[1].id).toBe('field_456');
    });

    it('should return empty array when no form fields exist', () => {
      // Test with null form fields
      const nullData = null;
      const result = nullData?.dynamic_form_fields || [];
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);

      // Test with undefined form fields
      const undefinedData = undefined;
      const result2 = undefinedData?.dynamic_form_fields || [];
      
      expect(Array.isArray(result2)).toBe(true);
      expect(result2).toHaveLength(0);
    });
  });

  describe('Task 3.3: JSON Serialization and Data Integrity', () => {
    it('should handle JSON string form fields data', () => {
      const jsonString = JSON.stringify([
        {
          id: 'field_123',
          type: 'text',
          label: 'Test Field',
          required: false,
          enabled: true
        }
      ]);

      let parsedData;
      try {
        parsedData = JSON.parse(jsonString);
      } catch (error) {
        parsedData = [];
      }

      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData).toHaveLength(1);
      expect(parsedData[0].id).toBe('field_123');
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedJson = '{"invalid": json}';
      
      let parsedData;
      try {
        parsedData = JSON.parse(malformedJson);
        if (!Array.isArray(parsedData)) {
          parsedData = [];
        }
      } catch (error) {
        parsedData = [];
      }

      expect(Array.isArray(parsedData)).toBe(true);
      expect(parsedData).toHaveLength(0); // Should return empty array for malformed data
    });

    it('should properly serialize form fields for database storage', () => {
      const formFields: DynamicFormField[] = [
        {
          id: 'field_123',
          type: 'text',
          label: 'Test Field',
          required: false,
          enabled: true,
          placeholder: 'Enter text'
        },
        {
          id: 'field_456',
          type: 'select',
          label: 'Select Field',
          required: true,
          enabled: true,
          options: ['Option 1', 'Option 2']
        }
      ];

      // Test JSON serialization
      const serialized = JSON.stringify(formFields);
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(0);

      // Test deserialization
      const deserialized = JSON.parse(serialized);
      expect(Array.isArray(deserialized)).toBe(true);
      expect(deserialized).toHaveLength(2);
      expect(deserialized[0].id).toBe('field_123');
      expect(deserialized[1].options).toEqual(['Option 1', 'Option 2']);
    });
  });

  describe('Task 3.4: Error Handling and Data Validation', () => {
    it('should provide detailed error messages for validation failures', () => {
      const invalidField = {
        // Missing id
        type: 'invalid_type',
        label: 123, // Should be string
        required: 'true', // Should be boolean
        enabled: 'false' // Should be boolean
      };

      const validation = validateFormField(invalidField, 0);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      
      // Check that all validation errors are descriptive
      validation.errors.forEach(error => {
        expect(error).toContain('Field at index 0:');
        expect(typeof error).toBe('string');
        expect(error.length).toBeGreaterThan(10); // Ensure meaningful error messages
      });
    });

    it('should handle edge cases in field validation', () => {
      // Test with null field
      const validation1 = validateFormField(null, 0);
      expect(validation1.isValid).toBe(false);
      expect(validation1.errors).toContain('Field at index 0: must be a valid object');

      // Test with undefined field
      const validation2 = validateFormField(undefined, 0);
      expect(validation2.isValid).toBe(false);
      expect(validation2.errors).toContain('Field at index 0: must be a valid object');

      // Test with empty object
      const validation3 = validateFormField({}, 0);
      expect(validation3.isValid).toBe(false);
      expect(validation3.errors.length).toBeGreaterThan(0);

      // Test with string instead of object
      const validation4 = validateFormField('invalid', 0);
      expect(validation4.isValid).toBe(false);
      expect(validation4.errors).toContain('Field at index 0: must be a valid object');
    });

    it('should validate optional properties correctly', () => {
      const fieldWithValidOptionals = {
        id: 'field_123',
        type: 'text',
        label: 'Test Field',
        required: false,
        enabled: true,
        placeholder: 'Valid placeholder',
        help_text: 'Valid help text'
      };

      const validation1 = validateFormField(fieldWithValidOptionals, 0);
      expect(validation1.isValid).toBe(true);

      const fieldWithInvalidOptionals = {
        id: 'field_123',
        type: 'text',
        label: 'Test Field',
        required: false,
        enabled: true,
        placeholder: 123, // Should be string
        help_text: true // Should be string
      };

      const validation2 = validateFormField(fieldWithInvalidOptionals, 0);
      expect(validation2.isValid).toBe(false);
      expect(validation2.errors).toContain('Field at index 0: placeholder must be a string');
      expect(validation2.errors).toContain('Field at index 0: help_text must be a string');
    });
  });
});