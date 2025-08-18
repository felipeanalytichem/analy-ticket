#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  outputDir: path.join(__dirname, '../translation-audit-reports'),
  fileExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build'],
  // Patterns to detect hardcoded strings
  hardcodedPatterns: [
    // JSX text content
    />\s*([A-Z][^<>{}\n]*[a-zA-Z])\s*</g,
    // String literals in JSX attributes (title, placeholder, etc.)
    /(title|placeholder|aria-label|alt)\s*=\s*"([^"]{3,})"/g,
    // Button/link text
    />\s*([A-Z][^<>{}\n]*)\s*<\/(button|a|span)/gi,
    // Toast/alert messages
    /(toast|alert|message|error|success|warning)\s*[:\(]\s*["']([^"']{5,})["']/gi,
    // Console messages for user feedback
    /console\.(log|error|warn|info)\s*\(\s*["']([^"']{5,})["']/g,
  ],
  // Patterns to ignore (already translated or system strings)
  ignorePatterns: [
    /^[a-z_]+\.[a-z_]+$/i, // Translation keys like "common.save"
    /^[0-9\s\-\+\(\)]+$/, // Numbers and basic symbols
    /^[A-Z_]+$/, // Constants
    /^\$\{.*\}$/, // Template literals
    /^https?:\/\//, // URLs
    /^\/[\/\w\-]*$/, // Paths
    /^[a-z]+:[a-z]+$/i, // CSS properties or similar
    /^(true|false|null|undefined)$/i, // Literals
    /^(px|em|rem|%|vh|vw)$/i, // CSS units
    /^#[0-9a-f]{3,6}$/i, // Hex colors
    /^rgb\(|rgba\(/i, // RGB colors
    /^[0-9]{1,2}:[0-9]{2}/, // Time formats
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}/, // Date formats
  ]
};

class TranslationAuditor {
  constructor() {
    this.hardcodedStrings = [];
    this.missingKeys = [];
    this.duplicateKeys = [];
    this.translationFiles = {};
    this.scannedFiles = 0;
    this.totalFiles = 0;
  }

  async run() {
    console.log('🔍 Starting Translation Audit...\n');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      }

      // Load existing translation files
      await this.loadTranslationFiles();
      
      // Scan source files for hardcoded strings
      await this.scanSourceFiles();
      
      // Analyze translation completeness
      await this.analyzeTranslationCompleteness();
      
      // Generate reports
      await this.generateReports();
      
      console.log('\n✅ Translation audit completed successfully!');
      console.log(`📊 Reports generated in: ${CONFIG.outputDir}`);
      
    } catch (error) {
      console.error('❌ Error during translation audit:', error);
      process.exit(1);
    }
  }

  async loadTranslationFiles() {
    console.log('📚 Loading existing translation files...');
    
    const translationFiles = fs.readdirSync(CONFIG.translationDir)
      .filter(file => file.endsWith('.json'));
    
    for (const file of translationFiles) {
      const filePath = path.join(CONFIG.translationDir, file);
      const locale = path.basename(file, '.json');
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        this.translationFiles[locale] = JSON.parse(content);
        console.log(`  ✓ Loaded ${locale}: ${this.countKeys(this.translationFiles[locale])} keys`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to load ${file}:`, error.message);
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

  async scanSourceFiles() {
    console.log('\n🔍 Scanning source files for hardcoded strings...');
    
    const files = this.getAllSourceFiles(CONFIG.srcDir);
    this.totalFiles = files.length;
    
    for (const file of files) {
      await this.scanFile(file);
      this.scannedFiles++;
      
      if (this.scannedFiles % 10 === 0) {
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
      
      for (const pattern of CONFIG.hardcodedPatterns) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        
        while ((match = regex.exec(content)) !== null) {
          const text = this.extractTextFromMatch(match);
          
          if (text && this.isLikelyHardcodedString(text)) {
            const lineNumber = this.getLineNumber(content, match.index);
            const suggestedKey = this.generateTranslationKey(text, relativePath);
            
            this.hardcodedStrings.push({
              file: relativePath,
              line: lineNumber,
              text: text.trim(),
              suggestedKey,
              context: this.getContext(content, match.index)
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

  isLikelyHardcodedString(text) {
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

  async analyzeTranslationCompleteness() {
    console.log('\n📊 Analyzing translation completeness...');
    
    const locales = Object.keys(this.translationFiles);
    if (locales.length === 0) {
      console.warn('  ⚠️  No translation files found');
      return;
    }
    
    // Find missing keys across languages
    const allKeys = new Set();
    
    // Collect all keys from all languages
    for (const locale of locales) {
      const keys = this.getAllKeys(this.translationFiles[locale]);
      keys.forEach(key => allKeys.add(key));
    }
    
    // Check which keys are missing in each language
    for (const locale of locales) {
      const localeKeys = new Set(this.getAllKeys(this.translationFiles[locale]));
      
      for (const key of allKeys) {
        if (!localeKeys.has(key)) {
          this.missingKeys.push({
            key,
            locale,
            context: this.getKeyContext(key)
          });
        }
      }
    }
    
    // Find duplicate keys within each language
    for (const locale of locales) {
      const duplicates = this.findDuplicateValues(this.translationFiles[locale]);
      duplicates.forEach(dup => {
        this.duplicateKeys.push({
          locale,
          value: dup.value,
          keys: dup.keys
        });
      });
    }
    
    console.log(`  📊 Found ${this.missingKeys.length} missing translation keys`);
    console.log(`  🔄 Found ${this.duplicateKeys.length} duplicate translations`);
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

  getKeyContext(key) {
    const parts = key.split('.');
    return parts.slice(0, -1).join('.');
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
          if (!values.has(value)) {
            values.set(value, []);
          }
          values.get(value).push(fullKey);
        }
      }
    };
    
    collectValues(obj, prefix);
    
    for (const [value, keys] of values) {
      if (keys.length > 1 && value.length > 3) {
        duplicates.push({ value, keys });
      }
    }
    
    return duplicates;
  }

  async generateReports() {
    console.log('\n📝 Generating reports...');
    
    // Generate hardcoded strings report
    await this.generateHardcodedStringsReport();
    
    // Generate missing keys report
    await this.generateMissingKeysReport();
    
    // Generate duplicate keys report
    await this.generateDuplicateKeysReport();
    
    // Generate summary report
    await this.generateSummaryReport();
    
    // Generate suggested translation keys
    await this.generateSuggestedTranslations();
  }

  async generateHardcodedStringsReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.totalFiles,
        scannedFiles: this.scannedFiles,
        hardcodedStrings: this.hardcodedStrings.length
      },
      findings: this.hardcodedStrings.map(item => ({
        file: item.file,
        line: item.line,
        text: item.text,
        suggestedKey: item.suggestedKey,
        context: item.context
      }))
    };
    
    const filePath = path.join(CONFIG.outputDir, 'hardcoded-strings.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    // Also generate a CSV for easy viewing
    const csvPath = path.join(CONFIG.outputDir, 'hardcoded-strings.csv');
    const csvContent = [
      'File,Line,Text,Suggested Key',
      ...this.hardcodedStrings.map(item => 
        `"${item.file}",${item.line},"${item.text.replace(/"/g, '""')}","${item.suggestedKey}"`
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`  ✓ Hardcoded strings report: ${filePath}`);
  }

  async generateMissingKeysReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMissingKeys: this.missingKeys.length,
        affectedLocales: [...new Set(this.missingKeys.map(k => k.locale))]
      },
      missingByLocale: {}
    };
    
    // Group by locale
    for (const missing of this.missingKeys) {
      if (!report.missingByLocale[missing.locale]) {
        report.missingByLocale[missing.locale] = [];
      }
      report.missingByLocale[missing.locale].push({
        key: missing.key,
        context: missing.context
      });
    }
    
    const filePath = path.join(CONFIG.outputDir, 'missing-keys.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Missing keys report: ${filePath}`);
  }

  async generateDuplicateKeysReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalDuplicates: this.duplicateKeys.length
      },
      duplicatesByLocale: {}
    };
    
    // Group by locale
    for (const duplicate of this.duplicateKeys) {
      if (!report.duplicatesByLocale[duplicate.locale]) {
        report.duplicatesByLocale[duplicate.locale] = [];
      }
      report.duplicatesByLocale[duplicate.locale].push({
        value: duplicate.value,
        keys: duplicate.keys
      });
    }
    
    const filePath = path.join(CONFIG.outputDir, 'duplicate-keys.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Duplicate keys report: ${filePath}`);
  }

  async generateSummaryReport() {
    const locales = Object.keys(this.translationFiles);
    const totalKeys = locales.length > 0 ? this.getAllKeys(this.translationFiles[locales[0]]).length : 0;
    
    const summary = {
      timestamp: new Date().toISOString(),
      audit: {
        filesScanned: this.scannedFiles,
        totalFiles: this.totalFiles,
        hardcodedStrings: this.hardcodedStrings.length,
        missingKeys: this.missingKeys.length,
        duplicateKeys: this.duplicateKeys.length
      },
      translations: {
        supportedLocales: locales,
        totalKeys: totalKeys,
        keysByLocale: {}
      },
      recommendations: this.generateRecommendations()
    };
    
    // Count keys by locale
    for (const locale of locales) {
      summary.translations.keysByLocale[locale] = this.getAllKeys(this.translationFiles[locale]).length;
    }
    
    const filePath = path.join(CONFIG.outputDir, 'summary.json');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
    console.log(`  ✓ Summary report: ${filePath}`);
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.hardcodedStrings.length > 0) {
      recommendations.push({
        type: 'hardcoded_strings',
        priority: 'high',
        message: `Found ${this.hardcodedStrings.length} hardcoded strings that should be moved to translation files`,
        action: 'Replace hardcoded strings with translation keys using the SafeTranslation component'
      });
    }
    
    if (this.missingKeys.length > 0) {
      recommendations.push({
        type: 'missing_keys',
        priority: 'medium',
        message: `Found ${this.missingKeys.length} missing translation keys across languages`,
        action: 'Add missing keys to ensure consistent translations across all supported languages'
      });
    }
    
    if (this.duplicateKeys.length > 0) {
      recommendations.push({
        type: 'duplicate_keys',
        priority: 'low',
        message: `Found ${this.duplicateKeys.length} duplicate translation values`,
        action: 'Consider consolidating duplicate translations to reduce maintenance overhead'
      });
    }
    
    return recommendations;
  }

  async generateSuggestedTranslations() {
    const suggestions = {
      timestamp: new Date().toISOString(),
      newKeys: {}
    };
    
    // Group suggested keys by context
    for (const item of this.hardcodedStrings) {
      const keyParts = item.suggestedKey.split('.');
      const context = keyParts.slice(0, -1).join('.');
      const key = keyParts[keyParts.length - 1];
      
      if (!suggestions.newKeys[context]) {
        suggestions.newKeys[context] = {};
      }
      
      suggestions.newKeys[context][key] = item.text;
    }
    
    const filePath = path.join(CONFIG.outputDir, 'suggested-translations.json');
    fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));
    console.log(`  ✓ Suggested translations: ${filePath}`);
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  const auditor = new TranslationAuditor();
  auditor.run().catch(console.error);
}

module.exports = TranslationAuditor;