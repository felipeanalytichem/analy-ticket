#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Enhanced configuration with better patterns and prioritization
const CONFIG = {
  srcDir: path.join(__dirname, '../src'),
  translationDir: path.join(__dirname, '../src/i18n/locales'),
  outputDir: path.join(__dirname, '../translation-audit-reports'),
  fileExtensions: ['.tsx', '.ts', '.jsx', '.js'],
  excludeDirs: ['node_modules', '.git', 'dist', 'build', '__tests__', 'test'],
  
  // Enhanced patterns with better categorization
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
    },
    {
      name: 'link_text',
      pattern: /<a[^>]*>\s*([A-Z][^<>{}\n]*[a-zA-Z])\s*<\/a>/gi,
      priority: 'medium',
      category: 'navigation',
      description: 'Link text content'
    },
    {
      name: 'status_text',
      pattern: /(status|state)\s*:\s*["']([A-Z][^"']{2,})["']/gi,
      priority: 'medium',
      category: 'status',
      description: 'Status and state text'
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
  ],

  // File-specific ignore patterns
  fileIgnorePatterns: {
    'types/': [/^[A-Z][a-zA-Z]*$/], // Type names
    'hooks/': [/^use[A-Z][a-zA-Z]*$/], // Hook names
    'utils/': [/^[a-z][a-zA-Z]*$/], // Utility function names
    'constants/': [/^[A-Z_]+$/], // Constants
  },

  // Priority weights for scoring
  priorityWeights: {
    high: 10,
    medium: 5,
    low: 1
  },

  // Category weights for user visibility
  categoryWeights: {
    ui_text: 10,
    interactive: 9,
    accessibility: 8,
    forms: 8,
    headings: 7,
    feedback: 7,
    navigation: 6,
    errors: 5,
    validation: 5,
    status: 4
  }
};

class EnhancedTranslationAuditor {
  constructor() {
    this.hardcodedStrings = [];
    this.categorizedStrings = {};
    this.prioritizedStrings = {};
    this.frequencyMap = new Map();
    this.translationFiles = {};
    this.scannedFiles = 0;
    this.totalFiles = 0;
  }

  async run() {
    console.log('🔍 Starting Enhanced Translation Audit...\n');
    
    try {
      // Ensure output directory exists
      if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
      }

      // Load existing translation files
      await this.loadTranslationFiles();
      
      // Scan source files for hardcoded strings
      await this.scanSourceFiles();
      
      // Analyze and categorize findings
      await this.analyzeFindings();
      
      // Generate enhanced reports
      await this.generateEnhancedReports();
      
      console.log('\n✅ Enhanced translation audit completed successfully!');
      console.log(`📊 Reports generated in: ${CONFIG.outputDir}`);
      
    } catch (error) {
      console.error('❌ Error during enhanced translation audit:', error);
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
            const userVisibilityScore = this.calculateUserVisibilityScore(text, patternConfig, relativePath);
            
            const hardcodedString = {
              file: relativePath,
              line: lineNumber,
              text: text.trim(),
              suggestedKey,
              context: this.getContext(content, match.index),
              pattern: patternConfig.name,
              priority: patternConfig.priority,
              category: patternConfig.category,
              description: patternConfig.description,
              userVisibilityScore,
              frequency: this.updateFrequency(text.trim())
            };

            this.hardcodedStrings.push(hardcodedString);
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
    
    // Check general ignore patterns
    for (const pattern of CONFIG.ignorePatterns) {
      if (pattern.test(text)) return false;
    }

    // Check file-specific ignore patterns
    for (const [pathPattern, patterns] of Object.entries(CONFIG.fileIgnorePatterns)) {
      if (filePath.includes(pathPattern)) {
        for (const pattern of patterns) {
          if (pattern.test(text)) return false;
        }
      }
    }
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(text)) return false;
    
    // Skip if it looks like a translation key
    if (/^[a-z]+(\.[a-z]+)+$/i.test(text)) return false;
    
    // Skip if it's mostly symbols or numbers
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount / text.length < 0.5) return false;
    
    // Skip common React/HTML patterns
    if (/^(className|style|key|ref|id)$/i.test(text)) return false;
    
    return true;
  }

  updateFrequency(text) {
    const current = this.frequencyMap.get(text) || 0;
    const newCount = current + 1;
    this.frequencyMap.set(text, newCount);
    return newCount;
  }

  calculateUserVisibilityScore(text, patternConfig, filePath) {
    let score = 0;
    
    // Base score from pattern priority
    score += CONFIG.priorityWeights[patternConfig.priority] || 1;
    
    // Category weight
    score += CONFIG.categoryWeights[patternConfig.category] || 1;
    
    // File location weight
    if (filePath.includes('pages/')) score += 5; // Pages are highly visible
    if (filePath.includes('components/ui/')) score += 4; // UI components are visible
    if (filePath.includes('components/auth/')) score += 3; // Auth is important
    if (filePath.includes('components/admin/')) score += 2; // Admin is less visible to end users
    
    // Text length weight (longer text is more important)
    if (text.length > 50) score += 3;
    else if (text.length > 20) score += 2;
    else if (text.length > 10) score += 1;
    
    // Frequency weight (more frequent = more important)
    const frequency = this.frequencyMap.get(text) || 1;
    if (frequency > 10) score += 5;
    else if (frequency > 5) score += 3;
    else if (frequency > 2) score += 1;
    
    return score;
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

  async analyzeFindings() {
    console.log('\n📊 Analyzing and categorizing findings...');
    
    // Categorize strings
    for (const item of this.hardcodedStrings) {
      if (!this.categorizedStrings[item.category]) {
        this.categorizedStrings[item.category] = [];
      }
      this.categorizedStrings[item.category].push(item);
    }
    
    // Prioritize strings
    for (const item of this.hardcodedStrings) {
      if (!this.prioritizedStrings[item.priority]) {
        this.prioritizedStrings[item.priority] = [];
      }
      this.prioritizedStrings[item.priority].push(item);
    }
    
    // Sort by user visibility score
    this.hardcodedStrings.sort((a, b) => b.userVisibilityScore - a.userVisibilityScore);
    
    console.log(`  📊 Categorized into ${Object.keys(this.categorizedStrings).length} categories`);
    console.log(`  🎯 Prioritized into ${Object.keys(this.prioritizedStrings).length} priority levels`);
  }

  async generateEnhancedReports() {
    console.log('\n📝 Generating enhanced reports...');
    
    // Generate prioritized hardcoded strings report
    await this.generatePrioritizedReport();
    
    // Generate category analysis report
    await this.generateCategoryReport();
    
    // Generate frequency analysis report
    await this.generateFrequencyReport();
    
    // Generate implementation roadmap
    await this.generateImplementationRoadmap();
    
    // Generate enhanced summary
    await this.generateEnhancedSummary();
  }

  async generatePrioritizedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.totalFiles,
        scannedFiles: this.scannedFiles,
        hardcodedStrings: this.hardcodedStrings.length,
        highPriority: this.prioritizedStrings.high?.length || 0,
        mediumPriority: this.prioritizedStrings.medium?.length || 0,
        lowPriority: this.prioritizedStrings.low?.length || 0
      },
      topPriorityStrings: this.hardcodedStrings.slice(0, 100).map(item => ({
        file: item.file,
        line: item.line,
        text: item.text,
        suggestedKey: item.suggestedKey,
        priority: item.priority,
        category: item.category,
        userVisibilityScore: item.userVisibilityScore,
        frequency: item.frequency,
        description: item.description
      }))
    };
    
    const filePath = path.join(CONFIG.outputDir, 'prioritized-hardcoded-strings.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    // Generate CSV for top priority items
    const csvPath = path.join(CONFIG.outputDir, 'top-priority-hardcoded-strings.csv');
    const csvContent = [
      'File,Line,Text,Suggested Key,Priority,Category,Visibility Score,Frequency',
      ...report.topPriorityStrings.map(item => 
        `"${item.file}",${item.line},"${item.text.replace(/"/g, '""')}","${item.suggestedKey}","${item.priority}","${item.category}",${item.userVisibilityScore},${item.frequency}`
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    console.log(`  ✓ Prioritized report: ${filePath}`);
  }

  async generateCategoryReport() {
    const categoryStats = {};
    
    for (const [category, items] of Object.entries(this.categorizedStrings)) {
      categoryStats[category] = {
        count: items.length,
        averageVisibilityScore: items.reduce((sum, item) => sum + item.userVisibilityScore, 0) / items.length,
        topItems: items
          .sort((a, b) => b.userVisibilityScore - a.userVisibilityScore)
          .slice(0, 10)
          .map(item => ({
            file: item.file,
            text: item.text,
            suggestedKey: item.suggestedKey,
            visibilityScore: item.userVisibilityScore
          }))
      };
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCategories: Object.keys(categoryStats).length,
        categoryBreakdown: Object.entries(categoryStats).map(([category, stats]) => ({
          category,
          count: stats.count,
          averageVisibilityScore: Math.round(stats.averageVisibilityScore * 100) / 100
        })).sort((a, b) => b.averageVisibilityScore - a.averageVisibilityScore)
      },
      categoryDetails: categoryStats
    };
    
    const filePath = path.join(CONFIG.outputDir, 'category-analysis.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Category analysis: ${filePath}`);
  }

  async generateFrequencyReport() {
    const frequencyArray = Array.from(this.frequencyMap.entries())
      .map(([text, frequency]) => ({ text, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 50);
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        uniqueStrings: this.frequencyMap.size,
        totalOccurrences: Array.from(this.frequencyMap.values()).reduce((sum, freq) => sum + freq, 0),
        averageFrequency: Array.from(this.frequencyMap.values()).reduce((sum, freq) => sum + freq, 0) / this.frequencyMap.size
      },
      topFrequentStrings: frequencyArray
    };
    
    const filePath = path.join(CONFIG.outputDir, 'frequency-analysis.json');
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`  ✓ Frequency analysis: ${filePath}`);
  }

  async generateImplementationRoadmap() {
    const phases = {
      phase1: {
        name: 'Critical User-Facing Text',
        description: 'High-priority strings that users see frequently',
        items: this.hardcodedStrings
          .filter(item => item.userVisibilityScore >= 20)
          .slice(0, 50)
      },
      phase2: {
        name: 'Interactive Elements',
        description: 'Buttons, forms, and interactive components',
        items: this.hardcodedStrings
          .filter(item => ['interactive', 'forms', 'accessibility'].includes(item.category))
          .slice(0, 100)
      },
      phase3: {
        name: 'Content and Navigation',
        description: 'Headings, navigation, and content text',
        items: this.hardcodedStrings
          .filter(item => ['headings', 'navigation', 'ui_text'].includes(item.category))
          .slice(0, 150)
      },
      phase4: {
        name: 'Feedback and Status',
        description: 'Error messages, status text, and user feedback',
        items: this.hardcodedStrings
          .filter(item => ['feedback', 'errors', 'validation', 'status'].includes(item.category))
      }
    };
    
    const roadmap = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPhases: Object.keys(phases).length,
        estimatedEffort: {
          phase1: `${phases.phase1.items.length} strings - 1-2 weeks`,
          phase2: `${phases.phase2.items.length} strings - 2-3 weeks`,
          phase3: `${phases.phase3.items.length} strings - 3-4 weeks`,
          phase4: `${phases.phase4.items.length} strings - 2-3 weeks`
        }
      },
      phases: Object.entries(phases).map(([phaseId, phase]) => ({
        id: phaseId,
        name: phase.name,
        description: phase.description,
        itemCount: phase.items.length,
        items: phase.items.map(item => ({
          file: item.file,
          line: item.line,
          text: item.text,
          suggestedKey: item.suggestedKey,
          priority: item.priority,
          category: item.category,
          visibilityScore: item.userVisibilityScore
        }))
      }))
    };
    
    const filePath = path.join(CONFIG.outputDir, 'implementation-roadmap.json');
    fs.writeFileSync(filePath, JSON.stringify(roadmap, null, 2));
    console.log(`  ✓ Implementation roadmap: ${filePath}`);
  }

  async generateEnhancedSummary() {
    const summary = {
      timestamp: new Date().toISOString(),
      audit: {
        filesScanned: this.scannedFiles,
        totalFiles: this.totalFiles,
        hardcodedStrings: this.hardcodedStrings.length,
        uniqueStrings: this.frequencyMap.size
      },
      priorityBreakdown: {
        high: this.prioritizedStrings.high?.length || 0,
        medium: this.prioritizedStrings.medium?.length || 0,
        low: this.prioritizedStrings.low?.length || 0
      },
      categoryBreakdown: Object.entries(this.categorizedStrings).map(([category, items]) => ({
        category,
        count: items.length,
        percentage: Math.round((items.length / this.hardcodedStrings.length) * 100)
      })).sort((a, b) => b.count - a.count),
      topFiles: this.getTopFilesByStringCount(),
      recommendations: this.generateEnhancedRecommendations(),
      estimatedEffort: this.calculateEstimatedEffort()
    };
    
    const filePath = path.join(CONFIG.outputDir, 'enhanced-summary.json');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
    console.log(`  ✓ Enhanced summary: ${filePath}`);
  }

  getTopFilesByStringCount() {
    const fileCount = {};
    
    for (const item of this.hardcodedStrings) {
      fileCount[item.file] = (fileCount[item.file] || 0) + 1;
    }
    
    return Object.entries(fileCount)
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  generateEnhancedRecommendations() {
    const recommendations = [];
    
    const highPriorityCount = this.prioritizedStrings.high?.length || 0;
    if (highPriorityCount > 0) {
      recommendations.push({
        type: 'high_priority_strings',
        priority: 'critical',
        message: `Found ${highPriorityCount} high-priority hardcoded strings that need immediate attention`,
        action: 'Start with the top 50 highest visibility score strings for maximum user impact',
        estimatedTime: '1-2 weeks'
      });
    }
    
    const interactiveCount = this.categorizedStrings.interactive?.length || 0;
    if (interactiveCount > 0) {
      recommendations.push({
        type: 'interactive_elements',
        priority: 'high',
        message: `Found ${interactiveCount} hardcoded strings in interactive elements (buttons, forms)`,
        action: 'Focus on buttons and form elements as they directly impact user interaction',
        estimatedTime: '1 week'
      });
    }
    
    const accessibilityCount = this.categorizedStrings.accessibility?.length || 0;
    if (accessibilityCount > 0) {
      recommendations.push({
        type: 'accessibility_strings',
        priority: 'high',
        message: `Found ${accessibilityCount} hardcoded accessibility strings (aria-labels, alt text)`,
        action: 'Prioritize accessibility strings to ensure inclusive user experience',
        estimatedTime: '3-5 days'
      });
    }
    
    return recommendations;
  }

  calculateEstimatedEffort() {
    const totalStrings = this.hardcodedStrings.length;
    const stringsPerDay = 50; // Estimated strings that can be processed per day
    const totalDays = Math.ceil(totalStrings / stringsPerDay);
    
    return {
      totalStrings,
      estimatedDays: totalDays,
      estimatedWeeks: Math.ceil(totalDays / 5),
      breakdown: {
        phase1: Math.ceil((this.prioritizedStrings.high?.length || 0) / stringsPerDay),
        phase2: Math.ceil((this.prioritizedStrings.medium?.length || 0) / stringsPerDay),
        phase3: Math.ceil((this.prioritizedStrings.low?.length || 0) / stringsPerDay)
      }
    };
  }
}

// Run the enhanced audit if this script is executed directly
if (require.main === module) {
  const auditor = new EnhancedTranslationAuditor();
  auditor.run().catch(console.error);
}

module.exports = EnhancedTranslationAuditor;