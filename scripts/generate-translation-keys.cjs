#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Script to generate translation key suggestions based on audit results
class TranslationKeyGenerator {
  constructor() {
    this.auditReportsDir = path.join(__dirname, '../translation-audit-reports');
    this.translationDir = path.join(__dirname, '../src/i18n/locales');
    this.outputDir = path.join(__dirname, '../translation-audit-reports');
  }

  async run() {
    console.log('🔧 Generating Translation Key Suggestions...\n');
    
    try {
      // Load audit results
      const frequencyData = this.loadFrequencyData();
      const prioritizedData = this.loadPrioritizedData();
      
      // Generate key suggestions
      const keySuggestions = this.generateKeySuggestions(frequencyData, prioritizedData);
      
      // Generate implementation templates
      const implementationTemplates = this.generateImplementationTemplates(keySuggestions);
      
      // Save results
      await this.saveResults(keySuggestions, implementationTemplates);
      
      console.log('✅ Translation key suggestions generated successfully!');
      
    } catch (error) {
      console.error('❌ Error generating translation keys:', error);
      process.exit(1);
    }
  }

  loadFrequencyData() {
    const filePath = path.join(this.auditReportsDir, 'frequency-analysis.json');
    if (!fs.existsSync(filePath)) {
      throw new Error('Frequency analysis file not found. Run enhanced audit first.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`📊 Loaded frequency data: ${data.topFrequentStrings.length} frequent strings`);
    return data;
  }

  loadPrioritizedData() {
    const filePath = path.join(this.auditReportsDir, 'prioritized-hardcoded-strings.json');
    if (!fs.existsSync(filePath)) {
      throw new Error('Prioritized strings file not found. Run enhanced audit first.');
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`🎯 Loaded prioritized data: ${data.topPriorityStrings.length} priority strings`);
    return data;
  }

  generateKeySuggestions(frequencyData, prioritizedData) {
    const suggestions = {
      common: {},
      forms: {},
      dialogs: {},
      admin: {},
      tickets: {},
      dashboard: {},
      auth: {},
      accessibility: {}
    };

    // Process frequent strings first
    for (const item of frequencyData.topFrequentStrings.slice(0, 50)) {
      const key = this.generateKeyFromText(item.text);
      const category = this.categorizeString(item.text);
      
      if (!suggestions[category]) {
        suggestions[category] = {};
      }
      
      suggestions[category][key] = {
        text: item.text,
        frequency: item.frequency,
        suggestedKey: `${category}.${key}`,
        priority: 'high'
      };
    }

    // Process high priority strings
    for (const item of prioritizedData.topPriorityStrings.slice(0, 100)) {
      const key = this.generateKeyFromText(item.text);
      const category = this.categorizeString(item.text, item.file);
      
      if (!suggestions[category]) {
        suggestions[category] = {};
      }
      
      // Avoid duplicates but update with file context
      if (!suggestions[category][key]) {
        suggestions[category][key] = {
          text: item.text,
          frequency: item.frequency || 1,
          suggestedKey: item.suggestedKey,
          priority: item.priority,
          category: item.category,
          files: [item.file]
        };
      } else {
        suggestions[category][key].files = suggestions[category][key].files || [];
        if (!suggestions[category][key].files.includes(item.file)) {
          suggestions[category][key].files.push(item.file);
        }
      }
    }

    return suggestions;
  }

  generateKeyFromText(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30)
      .replace(/_+$/, ''); // Remove trailing underscores
  }

  categorizeString(text, filePath = '') {
    // Common action words
    if (/^(save|cancel|delete|edit|add|submit|close|ok|yes|no)$/i.test(text)) {
      return 'common';
    }
    
    // Form-related
    if (/^(name|email|password|description|title|message|search|filter)$/i.test(text) ||
        text.includes('placeholder') || text.includes('label')) {
      return 'forms';
    }
    
    // Dialog-related
    if (/^(confirm|warning|alert|modal|dialog)$/i.test(text) ||
        text.includes('are you sure') || text.includes('confirm')) {
      return 'dialogs';
    }
    
    // Accessibility
    if (text.includes('aria-') || text.includes('alt') || 
        /^(close|open|expand|collapse|menu|navigation)$/i.test(text)) {
      return 'accessibility';
    }
    
    // File path based categorization
    if (filePath) {
      if (filePath.includes('admin/')) return 'admin';
      if (filePath.includes('tickets/')) return 'tickets';
      if (filePath.includes('dashboard/')) return 'dashboard';
      if (filePath.includes('auth/')) return 'auth';
    }
    
    return 'common';
  }

  generateImplementationTemplates(suggestions) {
    const templates = {
      translationFiles: {},
      componentExamples: {},
      testExamples: {}
    };

    // Generate translation file structure
    for (const [category, items] of Object.entries(suggestions)) {
      templates.translationFiles[category] = {};
      
      for (const [key, data] of Object.entries(items)) {
        templates.translationFiles[category][key] = data.text;
      }
    }

    // Generate component implementation examples
    templates.componentExamples = {
      button: {
        before: '<Button onClick={handleSave}>Save</Button>',
        after: '<Button onClick={handleSave}><SafeTranslation i18nKey="common.save" fallback="Save" /></Button>'
      },
      input: {
        before: '<Input placeholder="Enter your name" />',
        after: '<Input placeholder={useSafeTranslation("forms.name_placeholder", "Enter your name")} />'
      },
      heading: {
        before: '<h2>User Management</h2>',
        after: '<h2><SafeTranslation i18nKey="admin.users.title" fallback="User Management" /></h2>'
      },
      accessibility: {
        before: '<button aria-label="Close dialog">×</button>',
        after: '<button aria-label={useSafeTranslation("accessibility.close_dialog", "Close dialog")}>×</button>'
      }
    };

    // Generate test examples
    templates.testExamples = {
      component: `
describe('Translation Integration', () => {
  it('should display translated text', () => {
    render(<Component />, { wrapper: I18nWrapper });
    expect(screen.getByText('Translated Text')).toBeInTheDocument();
  });
  
  it('should fallback when translation missing', () => {
    render(<Component />, { wrapper: I18nWrapperWithMissingKeys });
    expect(screen.getByText('Fallback Text')).toBeInTheDocument();
  });
});`,
      hook: `
const { result } = renderHook(() => 
  useSafeTranslation('common.save', 'Save')
);
expect(result.current).toBe('Save');`
    };

    return templates;
  }

  async saveResults(keySuggestions, implementationTemplates) {
    // Save key suggestions
    const suggestionsPath = path.join(this.outputDir, 'translation-key-suggestions.json');
    fs.writeFileSync(suggestionsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalCategories: Object.keys(keySuggestions).length,
        totalKeys: Object.values(keySuggestions).reduce((sum, cat) => sum + Object.keys(cat).length, 0)
      },
      suggestions: keySuggestions
    }, null, 2));
    
    console.log(`✓ Key suggestions saved: ${suggestionsPath}`);

    // Save implementation templates
    const templatesPath = path.join(this.outputDir, 'implementation-templates.json');
    fs.writeFileSync(templatesPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      templates: implementationTemplates
    }, null, 2));
    
    console.log(`✓ Implementation templates saved: ${templatesPath}`);

    // Generate ready-to-use translation files
    for (const [category, translations] of Object.entries(implementationTemplates.translationFiles)) {
      if (Object.keys(translations).length > 0) {
        const categoryPath = path.join(this.outputDir, `suggested-${category}-translations.json`);
        fs.writeFileSync(categoryPath, JSON.stringify(translations, null, 2));
        console.log(`✓ ${category} translations saved: ${categoryPath}`);
      }
    }

    // Generate implementation checklist
    const checklistPath = path.join(this.outputDir, 'implementation-checklist.md');
    const checklist = this.generateImplementationChecklist(keySuggestions);
    fs.writeFileSync(checklistPath, checklist);
    console.log(`✓ Implementation checklist saved: ${checklistPath}`);
  }

  generateImplementationChecklist(suggestions) {
    const totalKeys = Object.values(suggestions).reduce((sum, cat) => sum + Object.keys(cat).length, 0);
    
    let checklist = `# Translation Implementation Checklist

Generated: ${new Date().toISOString()}
Total Keys to Implement: ${totalKeys}

## Phase 1: High-Frequency Common Strings

### Common Actions
`;

    // Generate checklist items for each category
    for (const [category, items] of Object.entries(suggestions)) {
      if (Object.keys(items).length === 0) continue;
      
      checklist += `\n### ${category.charAt(0).toUpperCase() + category.slice(1)} (${Object.keys(items).length} keys)\n\n`;
      
      for (const [key, data] of Object.entries(items)) {
        checklist += `- [ ] \`${data.suggestedKey}\` - "${data.text}" (frequency: ${data.frequency})\n`;
        if (data.files && data.files.length > 0) {
          checklist += `  - Files: ${data.files.slice(0, 3).join(', ')}${data.files.length > 3 ? '...' : ''}\n`;
        }
      }
    }

    checklist += `\n## Implementation Steps

1. **Add translation keys** to all language files (en-US, de-DE, es-ES, fr-FR, nl-NL, pt-BR)
2. **Replace hardcoded strings** with SafeTranslation components
3. **Test fallback behavior** for missing translations
4. **Verify accessibility** attributes are properly translated
5. **Update component tests** to include translation testing

## Verification

- [ ] All keys added to translation files
- [ ] SafeTranslation components implemented
- [ ] Fallback text provided for all keys
- [ ] Tests updated and passing
- [ ] Manual testing completed for each language
- [ ] Accessibility testing completed
`;

    return checklist;
  }
}

// Run the generator if this script is executed directly
if (require.main === module) {
  const generator = new TranslationKeyGenerator();
  generator.run().catch(console.error);
}

module.exports = TranslationKeyGenerator;