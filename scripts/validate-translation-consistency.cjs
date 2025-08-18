#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration for validation
const CONFIG = {
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  outputDir: path.join(__dirname, '../translation-audit-reports'),
  
  // Target languages for validation
  targetLanguages: {
    'en-US': { name: 'English (US)', isBase: true },
    'de-DE': { name: 'German (Germany)', isBase: false },
    'nl-NL': { name: 'Dutch (Netherlands)', isBase: false },
    'fr-FR': { name: 'French (France)', isBase: false },
    'pt-BR': { name: 'Portuguese (Brazil)', isBase: false },
    'es-ES': { name: 'Spanish (Spain)', isBase: false }
  }
};

class TranslationValidator {
  constructor() {
    this.translationFiles = {};
    this.validationResults = {};
    this.errors = [];
    this.warnings = [];
  }

  async run() {
    console.log('🔍 Starting Translation Consistency Validation...\n');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      }

      // Load all translation files
      await this.loadTranslationFiles();
      
      // Validate JSON syntax
      await this.validateJsonSyntax();
      
      // Validate key consistency
      await this.validateKeyConsistency();
      
      // Validate translation completeness
      await this.validateTranslationCompleteness();
      
      // Generate validation report
      await this.generateValidationReport();
      
      console.log('\n✅ Translation consistency validation completed!');
      console.log(`📊 Validation report generated in: ${CONFIG.outputDir}`);
      
    } catch (error) {
      console.error('❌ Error during translation validation:', error);
      process.exit(1);
    }
  }

  async loadTranslationFiles() {
    console.log('📚 Loading translation files for validation...');
    
    for (const [locale, config] of Object.entries(CONFIG.targetLanguages)) {
      const filePath = path.join(CONFIG.translationDir, `${locale}.json`);
      
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.translationFiles[locale] = {
            content: content,
            parsed: JSON.parse(content),
            config: config
          };
          console.log(`  ✓ Loaded ${config.name}`);
        } catch (error) {
          this.errors.push({
            type: 'file_load_error',
            locale: locale,
            message: `Failed to load ${locale}: ${error.message}`
          });
          console.error(`  ❌ Failed to load ${locale}:`, error.message);
        }
      } else {
        this.errors.push({
          type: 'file_missing',
          locale: locale,
          message: `Translation file not found: ${locale}`
        });
        console.warn(`  ⚠️  Translation file not found: ${locale}`);
      }
    }
  }

  async validateJsonSyntax() {
    console.log('\n🔍 Validating JSON syntax...');
    
    for (const [locale, data] of Object.entries(this.translationFiles)) {
      try {
        // Try to parse again to ensure valid JSON
        JSON.parse(data.content);
        
        // Check for common JSON issues
        this.checkJsonFormatting(locale, data.content);
        
        console.log(`  ✓ ${data.config.name}: Valid JSON syntax`);
      } catch (error) {
        this.errors.push({
          type: 'json_syntax_error',
          locale: locale,
          message: `Invalid JSON syntax: ${error.message}`
        });
        console.error(`  ❌ ${data.config.name}: Invalid JSON syntax`);
      }
    }
  }

  checkJsonFormatting(locale, content) {
    // Check for trailing commas
    if (content.includes(',\n  }') || content.includes(',\n}')) {
      this.warnings.push({
        type: 'trailing_comma',
        locale: locale,
        message: 'Contains trailing commas which may cause issues in some environments'
      });
    }
    
    // Check for inconsistent indentation
    const lines = content.split('\n');
    let inconsistentIndentation = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() && line.startsWith(' ')) {
        const spaces = line.match(/^ */)[0].length;
        if (spaces % 2 !== 0) {
          inconsistentIndentation = true;
          break;
        }
      }
    }
    
    if (inconsistentIndentation) {
      this.warnings.push({
        type: 'inconsistent_indentation',
        locale: locale,
        message: 'Inconsistent indentation detected'
      });
    }
  }

  async validateKeyConsistency() {
    console.log('\n🔍 Validating key consistency...');
    
    const baseLocale = 'en-US';
    const baseKeys = this.getAllKeys(this.translationFiles[baseLocale]?.parsed || {});
    
    for (const [locale, data] of Object.entries(this.translationFiles)) {
      if (locale === baseLocale) continue;
      
      const localeKeys = this.getAllKeys(data.parsed);
      
      // Find missing keys
      const missingKeys = baseKeys.filter(key => !localeKeys.includes(key));
      if (missingKeys.length > 0) {
        this.validationResults[locale] = this.validationResults[locale] || {};
        this.validationResults[locale].missingKeys = missingKeys;
      }
      
      // Find extra keys
      const extraKeys = localeKeys.filter(key => !baseKeys.includes(key));
      if (extraKeys.length > 0) {
        this.validationResults[locale] = this.validationResults[locale] || {};
        this.validationResults[locale].extraKeys = extraKeys;
      }
      
      // Check for duplicate values
      const duplicates = this.findDuplicateValues(data.parsed);
      if (duplicates.length > 0) {
        this.validationResults[locale] = this.validationResults[locale] || {};
        this.validationResults[locale].duplicateValues = duplicates;
      }
      
      console.log(`  📊 ${data.config.name}: ${missingKeys.length} missing, ${extraKeys.length} extra, ${duplicates.length} duplicates`);
    }
  }

  getAllKeys(obj, prefix = '') {
    const keys = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...this.getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  findDuplicateValues(obj, prefix = '') {
    const values = new Map();
    const duplicates = [];
    
    const collectValues = (current, currentPrefix) => {
      for (const key in current) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;
        
        if (typeof current[key] === 'object' && current[key] !== null) {
          collectValues(current[key], fullKey);
        } else {
          const value = current[key];
          if (value && typeof value === 'string' && value.length > 3) {
            if (!values.has(value)) {
              values.set(value, []);
            }
            values.get(value).push(fullKey);
          }
        }
      }
    };
    
    collectValues(obj, prefix);
    
    for (const [value, keys] of values) {
      if (keys.length > 1) {
        duplicates.push({ value, keys });
      }
    }
    
    return duplicates;
  }

  async validateTranslationCompleteness() {
    console.log('\n🔍 Validating translation completeness...');
    
    for (const [locale, data] of Object.entries(this.translationFiles)) {
      const emptyValues = this.findEmptyValues(data.parsed);
      const untranslatedValues = this.findUntranslatedValues(data.parsed, locale);
      
      if (emptyValues.length > 0 || untranslatedValues.length > 0) {
        this.validationResults[locale] = this.validationResults[locale] || {};
        this.validationResults[locale].emptyValues = emptyValues;
        this.validationResults[locale].untranslatedValues = untranslatedValues;
      }
      
      console.log(`  📊 ${data.config.name}: ${emptyValues.length} empty values, ${untranslatedValues.length} potentially untranslated`);
    }
  }

  findEmptyValues(obj, prefix = '') {
    const emptyKeys = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        emptyKeys.push(...this.findEmptyValues(obj[key], fullKey));
      } else if (!obj[key] || obj[key].toString().trim() === '') {
        emptyKeys.push(fullKey);
      }
    }
    
    return emptyKeys;
  }

  findUntranslatedValues(obj, locale, prefix = '') {
    const untranslatedKeys = [];
    
    // Skip base language
    if (locale === 'en-US') return untranslatedKeys;
    
    const baseObj = this.translationFiles['en-US']?.parsed || {};
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const baseValue = this.getNestedValue(baseObj, fullKey);
        if (baseValue && typeof baseValue === 'object') {
          untranslatedKeys.push(...this.findUntranslatedValues(obj[key], locale, fullKey));
        }
      } else {
        const baseValue = this.getNestedValue(baseObj, fullKey);
        if (baseValue && obj[key] === baseValue) {
          untranslatedKeys.push(fullKey);
        }
      }
    }
    
    return untranslatedKeys;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  async generateValidationReport() {
    console.log('\n📝 Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLanguages: Object.keys(CONFIG.targetLanguages).length,
        validatedLanguages: Object.keys(this.translationFiles).length,
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length,
        languagesWithIssues: Object.keys(this.validationResults).length
      },
      errors: this.errors,
      warnings: this.warnings,
      validationResults: {},
      recommendations: this.generateRecommendations()
    };
    
    // Process validation results for each language
    for (const [locale, results] of Object.entries(this.validationResults)) {
      const config = CONFIG.targetLanguages[locale];
      report.validationResults[locale] = {
        name: config?.name || locale,
        issues: {
          missingKeys: results.missingKeys?.length || 0,
          extraKeys: results.extraKeys?.length || 0,
          emptyValues: results.emptyValues?.length || 0,
          untranslatedValues: results.untranslatedValues?.length || 0,
          duplicateValues: results.duplicateValues?.length || 0
        },
        details: results
      };
    }
    
    const filePath = path.join(CONFIG.outputDir, 'translation-validation-report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    console.log(`  ✓ Validation report: ${filePath}`);
    
    // Generate summary for console
    this.printSummary(report);
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.errors.length > 0) {
      recommendations.push({
        type: 'critical_errors',
        priority: 'high',
        message: `Found ${this.errors.length} critical errors that need immediate attention`,
        action: 'Fix JSON syntax errors and missing files before proceeding'
      });
    }
    
    const totalMissingKeys = Object.values(this.validationResults)
      .reduce((sum, result) => sum + (result.missingKeys?.length || 0), 0);
    
    if (totalMissingKeys > 0) {
      recommendations.push({
        type: 'missing_keys',
        priority: 'high',
        message: `Found ${totalMissingKeys} missing translation keys across all languages`,
        action: 'Add missing translation keys to ensure complete localization'
      });
    }
    
    const totalEmptyValues = Object.values(this.validationResults)
      .reduce((sum, result) => sum + (result.emptyValues?.length || 0), 0);
    
    if (totalEmptyValues > 0) {
      recommendations.push({
        type: 'empty_values',
        priority: 'medium',
        message: `Found ${totalEmptyValues} empty translation values`,
        action: 'Fill in empty translation values with appropriate translations'
      });
    }
    
    if (this.warnings.length > 0) {
      recommendations.push({
        type: 'formatting_warnings',
        priority: 'low',
        message: `Found ${this.warnings.length} formatting warnings`,
        action: 'Review and fix formatting issues for better maintainability'
      });
    }
    
    return recommendations;
  }

  printSummary(report) {
    console.log('\n📊 Validation Summary:');
    console.log(`  Languages validated: ${report.summary.validatedLanguages}/${report.summary.totalLanguages}`);
    console.log(`  Critical errors: ${report.summary.totalErrors}`);
    console.log(`  Warnings: ${report.summary.totalWarnings}`);
    console.log(`  Languages with issues: ${report.summary.languagesWithIssues}`);
    
    if (report.summary.totalErrors === 0 && report.summary.totalWarnings === 0) {
      console.log('  🎉 All translation files are valid and consistent!');
    } else {
      console.log('\n🔧 Issues found:');
      
      for (const [locale, results] of Object.entries(report.validationResults)) {
        const issues = results.issues;
        const totalIssues = Object.values(issues).reduce((sum, count) => sum + count, 0);
        
        if (totalIssues > 0) {
          console.log(`  📋 ${results.name}:`);
          if (issues.missingKeys > 0) console.log(`    - ${issues.missingKeys} missing keys`);
          if (issues.extraKeys > 0) console.log(`    - ${issues.extraKeys} extra keys`);
          if (issues.emptyValues > 0) console.log(`    - ${issues.emptyValues} empty values`);
          if (issues.untranslatedValues > 0) console.log(`    - ${issues.untranslatedValues} untranslated values`);
          if (issues.duplicateValues > 0) console.log(`    - ${issues.duplicateValues} duplicate values`);
        }
      }
    }
  }
}

// Run the validation if this script is executed directly
if (require.main === module) {
  const validator = new TranslationValidator();
  validator.run().catch(console.error);
}

module.exports = TranslationValidator;