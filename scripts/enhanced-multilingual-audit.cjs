#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Enhanced configuration for multilingual audit
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  outputDir: path.join(__dirname, '../translation-audit-reports'),
  
  // Target languages for this audit (as specified in the task)
  targetLanguages: {
    'en-US': { name: 'English (US)', isBase: true },
    'de-DE': { name: 'German (Germany)', isBase: false },
    'nl-NL': { name: 'Dutch (Netherlands)', isBase: false },
    'fr-FR': { name: 'French (France)', isBase: false },
    'pt-BR': { name: 'Portuguese (Brazil)', isBase: false },
    'es-ES': { name: 'Spanish (Spain)', isBase: false }
  },
  
  fileExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build', '__tests__', 'test'],
  
  // Enhanced patterns for better hardcoded string detection
  hardcodedPatterns: [
    {
      name: 'jsx_text_content',
      pattern: />\s*([A-Z][^<>{}\n]*[a-zA-Z])\s*</g,
      priority: 'high',
      category: 'ui_text',
      description: 'JSX text content between tags'
    },
    {
      name: 'jsx_attributes',
      pattern: /(title|placeholder|aria-label|alt|label)\s*=\s*"([^"]{3,})"/g,
      priority: 'high',
      category: 'accessibility',
      description: 'JSX attributes that need translation'
    },
    {
      name: 'button_text',
      pattern: />\s*([A-Z][^<>{}\n]*)\s*<\/(button|Button)/gi,
      priority: 'high',
      category: 'interactive',
      description: 'Button text content'
    },
    {
      name: 'form_labels',
      pattern: /<label[^>]*>\s*([A-Z][^<>{}\n]*[a-zA-Z])\s*<\/label>/gi,
      priority: 'high',
      category: 'forms',
      description: 'Form label text'
    },
    {
      name: 'toast_messages',
      pattern: /(toast|alert|message|error|success|warning|notification)\s*[:\(]\s*["']([^"']{5,})["']/gi,
      priority: 'high',
      category: 'feedback',
      description: 'Toast and alert messages'
    },
    {
      name: 'error_messages',
      pattern: /(throw new Error|console\.error|setError)\s*\(\s*["']([^"']{5,})["']/gi,
      priority: 'medium',
      category: 'errors',
      description: 'Error messages'
    },
    {
      name: 'validation_messages',
      pattern: /(required|invalid|must|should|cannot|error)\s*:\s*["']([^"']{5,})["']/gi,
      priority: 'medium',
      category: 'validation',
      description: 'Form validation messages'
    },
    {
      name: 'heading_text',
      pattern: /<h[1-6][^>]*>\s*([A-Z][^<>{}\n]*[a-zA-Z])\s*<\/h[1-6]>/gi,
      priority: 'high',
      category: 'headings',
      description: 'Heading text content'
    }
  ],
  
  // Enhanced ignore patterns
  ignorePatterns: [
    /^[a-z_]+\.[a-z_]+$/i, // Translation keys like "common.save"
    /^[0-9\s\-\+\(\)]+$/, // Numbers and basic symbols
    /^[A-Z_]+$/, // Constants
    /^\$\{.*\}$/, // Template literals
    /^https?:\/\//, // URLs
    /^\/[\/\w\-]*$/, // Paths
    /^[a-z]+:[a-z]+$/i, // CSS properties or similar
    /^(true|false|null|undefined)$/i, // Literals
    /^(px|em|rem|%|vh|vw|auto|none|inherit|initial)$/i, // CSS units and values
    /^#[0-9a-f]{3,6}$/i, // Hex colors
    /^rgb\(|rgba\(/i, // RGB colors
    /^[0-9]{1,2}:[0-9]{2}/, // Time formats
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}/, // Date formats
    /^[a-z]+\([^)]*\)$/i, // Function calls
    /^[A-Z][a-z]*Component$/i, // Component names
    /^use[A-Z][a-zA-Z]*$/i, // Hook names
    /^on[A-Z][a-zA-Z]*$/i, // Event handler names
    /^(className|onClick|onChange|onSubmit|onFocus|onBlur)$/i, // React props
    /^(div|span|p|h[1-6]|ul|li|table|tr|td|th)$/i, // HTML tags
    /^(flex|grid|block|inline|absolute|relative|fixed)$/i, // CSS display values
  ]
};

class MultilingualTranslationAuditor {
  constructor() {
    this.translationFiles = {};
    this.hardcodedStrings = [];
    this.missingKeys = {};
    this.completionStats = {};
    this.consistencyIssues = [];
    this.scannedFiles = 0;
    this.totalFiles = 0;
  }

  async run() {
    console.log('🌍 Starting Multilingual Translation Audit...\n');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      }

      // Load all translation files
      await this.loadTranslationFiles();
      
      // Analyze translation completeness and consistency
      await this.analyzeTranslationCompleteness();
      
      // Scan for hardcoded strings
      await this.scanForHardcodedStrings();
      
      // Validate translation consistency
      await this.validateTranslationConsistency();
      
      // Generate comprehensive reports
      await this.generateReports();
      
      console.log('\n✅ Multilingual translation audit completed successfully!');
      console.log(`📊 Reports generated in: ${CONFIG.outputDir}`);
      
    } catch (error) {
      console.error('❌ Error during multilingual translation audit:', error);
      process.exit(1);
    }
  }

  async loadTranslationFiles() {
    console.log('📚 Loading translation files for target languages...');
    
    for (const [locale, config] of Object.entries(CONFIG.targetLanguages)) {
      const filePath = path.join(CONFIG.translationDir, `${locale}.json`);
      
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.translationFiles[locale] = JSON.parse(content);
          const keyCount = this.countKeys(this.translationFiles[locale]);
          console.log(`  ✓ Loaded ${config.name}: ${keyCount} keys`);
        } catch (error) {
          console.warn(`  ⚠️  Failed to load ${locale}:`, error.message);
          this.translationFiles[locale] = {};
        }
      } else {
        console.warn(`  ⚠️  Translation file not found: ${locale}`);
        this.translationFiles[locale] = {};
      }
    }
  }

  countKeys(obj, prefix = '') {
    let count = 0;
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countKeys(obj[key], prefix + key + '.');
      } else {
        count++;
      }
    }
    return count;
  }

  async analyzeTranslationCompleteness() {
    console.log('\n📊 Analyzing translation completeness...');
    
    // Get base language (English) as reference
    const baseLocale = 'en-US';
    const baseKeys = this.getAllKeys(this.translationFiles[baseLocale] || {});
    
    console.log(`  📋 Base language (${baseLocale}) has ${baseKeys.length} keys`);
    
    // Analyze each target language
    for (const [locale, config] of Object.entries(CONFIG.targetLanguages)) {
      if (locale === baseLocale) continue;
      
      const localeKeys = this.getAllKeys(this.translationFiles[locale] || {});
      const missingKeys = baseKeys.filter(key => !localeKeys.includes(key));
      const extraKeys = localeKeys.filter(key => !baseKeys.includes(key));
      
      const completionPercentage = baseKeys.length > 0 
        ? Math.round(((baseKeys.length - missingKeys.length) / baseKeys.length) * 100)
        : 0;
      
      this.completionStats[locale] = {
        name: config.name,
        totalKeys: localeKeys.length,
        expectedKeys: baseKeys.length,
        missingKeys: missingKeys,
        extraKeys: extraKeys,
        completionPercentage: completionPercentage
      };
      
      this.missingKeys[locale] = missingKeys;
      
      console.log(`  📈 ${config.name}: ${completionPercentage}% complete (${missingKeys.length} missing, ${extraKeys.length} extra)`);
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

  async scanForHardcodedStrings() {
    console.log('\n🔍 Scanning for hardcoded strings...');
    
    const files = this.getAllSourceFiles(CONFIG.srcDir);
    this.totalFiles = files.length;
    
    for (const file of files) {
      await this.scanFile(file);
      this.scannedFiles++;
      
      if (this.scannedFiles % 25 === 0) {
        console.log(`  📄 Scanned ${this.scannedFiles}/${this.totalFiles} files...`);
      }
    }
    
    console.log(`  ✓ Scanned ${this.scannedFiles} files`);
    console.log(`  🔍 Found ${this.hardcodedStrings.length} potential hardcoded strings`);
  }

  getAllSourceFiles(dir) {
    const files = [];
    
    const scanDir = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!CONFIG.excludeDirs.includes(item)) {
            scanDir(fullPath);
          }
        } else if (CONFIG.fileExtensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    scanDir(dir);
    return files;
  }

  async scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(CONFIG.srcDir, filePath);
      
      // Skip files that are primarily configuration or types
      if (this.shouldSkipFile(relativePath, content)) {
        return;
      }
      
      for (const patternConfig of CONFIG.hardcodedPatterns) {
        let match;
        const regex = new RegExp(patternConfig.pattern.source, patternConfig.pattern.flags);
        
        while ((match = regex.exec(content)) !== null) {
          const text = this.extractTextFromMatch(match);
          
          if (text && this.isLikelyHardcodedString(text, relativePath)) {
            const lineNumber = this.getLineNumber(content, match.index);
            const suggestedKey = this.generateTranslationKey(text, relativePath);
            
            this.hardcodedStrings.push({
              file: relativePath,
              line: lineNumber,
              text: text.trim(),
              suggestedKey,
              context: this.getContext(content, match.index),
              pattern: patternConfig.name,
              priority: patternConfig.priority,
              category: patternConfig.category,
              description: patternConfig.description
            });
          }
        }
      }
    } catch (error) {
      console.warn(`  ⚠️  Failed to scan ${filePath}:`, error.message);
    }
  }

  shouldSkipFile(relativePath, content) {
    // Skip type definition files
    if (relativePath.includes('.d.ts') || relativePath.includes('types/')) {
      return true;
    }
    
    // Skip test files
    if (relativePath.includes('test') || relativePath.includes('spec')) {
      return true;
    }
    
    // Skip files that are mostly imports and exports
    const lines = content.split('\n');
    const codeLines = lines.filter(line => 
      !line.trim().startsWith('import ') && 
      !line.trim().startsWith('export ') &&
      !line.trim().startsWith('//') &&
      !line.trim().startsWith('/*') &&
      line.trim().length > 0
    );
    
    return codeLines.length < 5;
  }

  extractTextFromMatch(match) {
    // Extract the actual text from different match patterns
    if (match[2]) return match[2]; // For attribute patterns
    if (match[1]) return match[1]; // For content patterns
    return match[0];
  }

  isLikelyHardcodedString(text, filePath) {
    // Clean the text
    text = text.trim();
    
    // Must be at least 3 characters
    if (text.length < 3) return false;
    
    // Check ignore patterns
    for (const pattern of CONFIG.ignorePatterns) {
      if (pattern.test(text)) return false;
    }
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(text)) return false;
    
    // Skip if it looks like a translation key
    if (/^[a-z]+(\.[a-z]+)+$/i.test(text)) return false;
    
    // Skip if it's mostly symbols or numbers
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount / text.length < 0.5) return false;
    
    return true;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  generateTranslationKey(text, filePath) {
    // Extract component/page name from file path
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(filePath).split(path.sep).pop();
    
    // Create a base key from the file context
    let baseKey = '';
    if (dirName === 'pages') {
      baseKey = fileName.toLowerCase().replace(/page$/, '');
    } else if (dirName === 'components') {
      baseKey = fileName.toLowerCase();
    } else {
      baseKey = `${dirName}.${fileName}`.toLowerCase();
    }
    
    // Create a key from the text
    const textKey = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);
    
    return `${baseKey}.${textKey}`;
  }

  getContext(content, index) {
    const lines = content.split('\n');
    const lineIndex = this.getLineNumber(content, index) - 1;
    const start = Math.max(0, lineIndex - 1);
    const end = Math.min(lines.length, lineIndex + 2);
    
    return lines.slice(start, end).join('\n');
  }

  async validateTranslationConsistency() {
    console.log('\n🔍 Validating translation consistency...');
    
    const baseLocale = 'en-US';
    const baseTranslations = this.translationFiles[baseLocale] || {};
    
    // Check for inconsistent translations across languages
    for (const [locale, config] of Object.entries(CONFIG.targetLanguages)) {
      if (locale === baseLocale) continue;
      
      const localeTranslations = this.translationFiles[locale] || {};
      
      // Check for empty values
      const emptyValues = this.findEmptyValues(localeTranslations, locale);
      if (emptyValues.length > 0) {
        this.consistencyIssues.push({
          type: 'empty_values',
          locale: locale,
          count: emptyValues.length,
          keys: emptyValues
        });
      }
      
      // Check for untranslated values (same as English)
      const untranslatedValues = this.findUntranslatedValues(baseTranslations, localeTranslations, locale);
      if (untranslatedValues.length > 0) {
        this.consistencyIssues.push({
          type: 'untranslated_values',
          locale: locale,
          count: untranslatedValues.length,
          keys: untranslatedValues
        });
      }
    }
    
    console.log(`  🔍 Found ${this.consistencyIssues.length} consistency issues`);
  }

  findEmptyValues(obj, locale, prefix = '') {
    const emptyKeys = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        emptyKeys.push(...this.findEmptyValues(obj[key], locale, fullKey));
      } else if (!obj[key] || obj[key].toString().trim() === '') {
        emptyKeys.push(fullKey);
      }
    }
    
    return emptyKeys;
  }

  findUntranslatedValues(baseObj, localeObj, locale, prefix = '') {
    const untranslatedKeys = [];
    
    for (const key in baseObj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof baseObj[key] === 'object' && baseObj[key] !== null) {
        if (localeObj[key] && typeof localeObj[key] === 'object') {
          untranslatedKeys.push(...this.findUntranslatedValues(baseObj[key], localeObj[key], locale, fullKey));
        }
      } else if (localeObj[key] && baseObj[key] === localeObj[key]) {
        // Same value as base language - likely untranslated
        untranslatedKeys.push(fullKey);
      }
    }
    
    return untranslatedKeys;
  }

  async generateReports() {
    console.log('\n📝 Generating comprehensive reports...');
    
    // Generate completion report
    await this.generateCompletionReport();
    
    // Generate missing keys report
    await this.generateMissingKeysReport();
    
    // Generate consistency report
    await this.generateConsistencyReport();
    
    // Generate hardcoded strings report
    await this.generateHardcodedStringsReport();
    
    // Generate summary report
    await this.generateSummaryReport();
  }

  async generateCompletionReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalLanguages: Object.keys(CONFIG.targetLanguages).length,
        baseLanguage: 'en-US',
        averageCompletion: this.calculateAverageCompletion()
      },
      languageStats: {}
    };
    
    for (const [locale, stats] of Object.entries(this.completionStats)) {
      report.languageStats[locale] = {
        name: stats.name,
        completionPercentage: stats.completionPercentage,
        totalKeys: stats.totalKeys,
        expectedKeys: stats.expectedKeys,
        missingKeysCount: stats.missingKeys.length,
        extraKeysCount: stats.extraKeys.length,
        status: this.getCompletionStatus(stats.completionPercentage)
      };
    }
    
    const filePath = path.join(CONFIG.outputDir, 'multilingual-completion-report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Completion report: ${filePath}`);
  }

  calculateAverageCompletion() {
    const completions = Object.values(this.completionStats).map(s => s.completionPercentage);
    return completions.length > 0 
      ? Math.round(completions.reduce((sum, comp) => sum + comp, 0) / completions.length)
      : 0;
  }

  getCompletionStatus(percentage) {
    if (percentage >= 95) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'fair';
    return 'needs_attention';
  }

  async generateMissingKeysReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMissingKeys: Object.values(this.missingKeys).reduce((sum, keys) => sum + keys.length, 0),
        affectedLanguages: Object.keys(this.missingKeys).length
      },
      missingKeysByLanguage: {}
    };
    
    for (const [locale, missingKeys] of Object.entries(this.missingKeys)) {
      const languageName = CONFIG.targetLanguages[locale]?.name || locale;
      report.missingKeysByLanguage[locale] = {
        name: languageName,
        missingCount: missingKeys.length,
        missingKeys: missingKeys.map(key => ({
          key: key,
          namespace: key.split('.')[0],
          section: key.split('.').slice(0, 2).join('.')
        }))
      };
    }
    
    const filePath = path.join(CONFIG.outputDir, 'multilingual-missing-keys.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Missing keys report: ${filePath}`);
  }

  async generateConsistencyReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.consistencyIssues.length,
        issueTypes: [...new Set(this.consistencyIssues.map(i => i.type))]
      },
      issuesByType: {},
      issuesByLanguage: {}
    };
    
    // Group by type
    for (const issue of this.consistencyIssues) {
      if (!report.issuesByType[issue.type]) {
        report.issuesByType[issue.type] = [];
      }
      report.issuesByType[issue.type].push(issue);
    }
    
    // Group by language
    for (const issue of this.consistencyIssues) {
      if (!report.issuesByLanguage[issue.locale]) {
        report.issuesByLanguage[issue.locale] = [];
      }
      report.issuesByLanguage[issue.locale].push(issue);
    }
    
    const filePath = path.join(CONFIG.outputDir, 'multilingual-consistency-report.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Consistency report: ${filePath}`);
  }

  async generateHardcodedStringsReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.totalFiles,
        scannedFiles: this.scannedFiles,
        hardcodedStrings: this.hardcodedStrings.length,
        priorityBreakdown: this.getPriorityBreakdown(),
        categoryBreakdown: this.getCategoryBreakdown()
      },
      findings: this.hardcodedStrings.map(item => ({
        file: item.file,
        line: item.line,
        text: item.text,
        suggestedKey: item.suggestedKey,
        priority: item.priority,
        category: item.category,
        description: item.description
      }))
    };
    
    const filePath = path.join(CONFIG.outputDir, 'multilingual-hardcoded-strings.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Hardcoded strings report: ${filePath}`);
  }

  getPriorityBreakdown() {
    const breakdown = {};
    for (const item of this.hardcodedStrings) {
      breakdown[item.priority] = (breakdown[item.priority] || 0) + 1;
    }
    return breakdown;
  }

  getCategoryBreakdown() {
    const breakdown = {};
    for (const item of this.hardcodedStrings) {
      breakdown[item.category] = (breakdown[item.category] || 0) + 1;
    }
    return breakdown;
  }

  async generateSummaryReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      auditScope: {
        targetLanguages: Object.entries(CONFIG.targetLanguages).map(([code, config]) => ({
          code,
          name: config.name,
          isBase: config.isBase
        })),
        filesScanned: this.scannedFiles,
        totalFiles: this.totalFiles
      },
      completionOverview: {
        averageCompletion: this.calculateAverageCompletion(),
        languageStats: Object.entries(this.completionStats).map(([locale, stats]) => ({
          locale,
          name: stats.name,
          completion: stats.completionPercentage,
          status: this.getCompletionStatus(stats.completionPercentage)
        })).sort((a, b) => b.completion - a.completion)
      },
      issuesSummary: {
        hardcodedStrings: this.hardcodedStrings.length,
        missingKeys: Object.values(this.missingKeys).reduce((sum, keys) => sum + keys.length, 0),
        consistencyIssues: this.consistencyIssues.length
      },
      recommendations: this.generateRecommendations(),
      nextSteps: this.generateNextSteps()
    };
    
    const filePath = path.join(CONFIG.outputDir, 'multilingual-audit-summary.json');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
    console.log(`  ✓ Summary report: ${filePath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check completion rates
    const lowCompletionLanguages = Object.entries(this.completionStats)
      .filter(([_, stats]) => stats.completionPercentage < 80)
      .map(([locale, stats]) => ({ locale, name: stats.name, completion: stats.completionPercentage }));
    
    if (lowCompletionLanguages.length > 0) {
      recommendations.push({
        type: 'low_completion',
        priority: 'high',
        message: `${lowCompletionLanguages.length} languages have completion rates below 80%`,
        languages: lowCompletionLanguages,
        action: 'Focus on completing missing translations for these languages first'
      });
    }
    
    // Check hardcoded strings
    if (this.hardcodedStrings.length > 0) {
      const highPriorityStrings = this.hardcodedStrings.filter(s => s.priority === 'high').length;
      recommendations.push({
        type: 'hardcoded_strings',
        priority: 'high',
        message: `Found ${this.hardcodedStrings.length} hardcoded strings (${highPriorityStrings} high priority)`,
        action: 'Replace hardcoded strings with translation keys, starting with high priority items'
      });
    }
    
    // Check consistency issues
    if (this.consistencyIssues.length > 0) {
      recommendations.push({
        type: 'consistency_issues',
        priority: 'medium',
        message: `Found ${this.consistencyIssues.length} consistency issues across languages`,
        action: 'Review and fix empty values and untranslated content'
      });
    }
    
    return recommendations;
  }

  generateNextSteps() {
    const steps = [];
    
    // Step 1: Complete missing translations
    const totalMissingKeys = Object.values(this.missingKeys).reduce((sum, keys) => sum + keys.length, 0);
    if (totalMissingKeys > 0) {
      steps.push({
        step: 1,
        title: 'Complete Missing Translations',
        description: `Add ${totalMissingKeys} missing translation keys across all languages`,
        estimatedTime: `${Math.ceil(totalMissingKeys / 50)} days`,
        priority: 'high'
      });
    }
    
    // Step 2: Replace hardcoded strings
    if (this.hardcodedStrings.length > 0) {
      steps.push({
        step: 2,
        title: 'Replace Hardcoded Strings',
        description: `Replace ${this.hardcodedStrings.length} hardcoded strings with translation keys`,
        estimatedTime: `${Math.ceil(this.hardcodedStrings.length / 30)} days`,
        priority: 'high'
      });
    }
    
    // Step 3: Fix consistency issues
    if (this.consistencyIssues.length > 0) {
      steps.push({
        step: 3,
        title: 'Fix Consistency Issues',
        description: `Resolve ${this.consistencyIssues.length} consistency issues`,
        estimatedTime: '2-3 days',
        priority: 'medium'
      });
    }
    
    // Step 4: Validation and testing
    steps.push({
      step: steps.length + 1,
      title: 'Validation and Testing',
      description: 'Test all languages for proper display and functionality',
      estimatedTime: '3-5 days',
      priority: 'medium'
    });
    
    return steps;
  }
}

// Run the multilingual audit if this script is executed directly
if (require.main === module) {
  const auditor = new MultilingualTranslationAuditor();
  auditor.run().catch(console.error);
}

module.exports = MultilingualTranslationAuditor;