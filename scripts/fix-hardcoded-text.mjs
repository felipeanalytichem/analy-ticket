#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Common hardcoded text patterns to find and replace
const HARDCODED_PATTERNS = [
  // Placeholders
  { 
    pattern: /placeholder="([^"]*[a-zA-Z]{2,}[^"]*)"(?![^>]*\{t\()/g, 
    type: 'placeholder',
    needsTranslation: true
  },
  
  // Aria labels
  { 
    pattern: /aria-label="([^"]*[a-zA-Z]{2,}[^"]*)"(?![^>]*\{t\()/g, 
    type: 'aria-label',
    needsTranslation: true
  },
  
  // Titles
  { 
    pattern: /title="([^"]*[a-zA-Z]{2,}[^"]*)"(?![^>]*\{t\()/g, 
    type: 'title',
    needsTranslation: true
  },
  
  // Common Portuguese words
  { 
    pattern: /["']([^"']*(?:Digite|Buscar|Adicionar|Remover|Excluir|Cancelar|Salvar|Enviar|Confirmar)[^"']*)["']/g, 
    type: 'portuguese',
    needsTranslation: true
  },
  
  // Common English UI words
  { 
    pattern: /["']([^"']*(?:Search|Add|Remove|Delete|Cancel|Save|Send|Submit|Edit|Create|Update|Loading|Error|Success)[^"']*)["']/g, 
    type: 'english-ui',
    needsTranslation: true
  },
  
  // Toast messages
  { 
    pattern: /toast\.(success|error|info|warning)\s*\(\s*["']([^"']+)["']/g, 
    type: 'toast',
    needsTranslation: true
  }
];

// Suggested translation key mappings
const TRANSLATION_MAPPINGS = {
  // Common placeholders
  'Search...': 'common.searchPlaceholder',
  'Type your message...': 'chat.typePlaceholder', 
  'Search messages...': 'chat.searchPlaceholder',
  'Digite sua mensagem...': 'chat.typePlaceholder',
  'Buscar mensagens...': 'chat.searchPlaceholder',
  'Adicionar comentário...': 'comments.addPlaceholder',
  'Digite o título...': 'common.titlePlaceholder',
  'Digite a descrição...': 'common.descriptionPlaceholder',
  
  // Common aria labels
  'Delete': 'common.delete',
  'Edit': 'common.edit', 
  'Save': 'common.save',
  'Cancel': 'common.cancel',
  'Close': 'common.close',
  'Remove': 'common.remove',
  'Remover': 'common.remove',
  'Excluir': 'common.delete',
  'Editar': 'common.edit',
  'Salvar': 'common.save',
  'Cancelar': 'common.cancel',
  
  // Common titles
  'Loading...': 'common.loading',
  'Error': 'common.error',
  'Success': 'common.success',
  'Preview': 'common.preview',
  'Download': 'common.download',
  'Upload': 'common.upload',
  
  // Portuguese specific
  'Carregando...': 'common.loading',
  'Erro': 'common.error',
  'Sucesso': 'common.success',
  'Visualizar': 'common.preview',
  'Baixar': 'common.download',
  'Enviar': 'common.send'
};

// Files to scan (TypeScript/React files)
const FILE_EXTENSIONS = ['.tsx', '.ts'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next'];

class HardcodedTextFixer {
  constructor() {
    this.findings = [];
    this.fixedCount = 0;
    this.missingTranslations = new Set();
  }

  // Find all files to scan
  findFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !EXCLUDE_DIRS.includes(item)) {
        this.findFiles(fullPath, files);
      } else if (stat.isFile() && FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // Scan a file for hardcoded text
  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const findings = [];
    
    for (const { pattern, type, needsTranslation } of HARDCODED_PATTERNS) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1] || match[2]; // Handle different capture groups
        
        // Skip if already using translation
        if (text.includes('t(') || text.includes('{{')) continue;
        
        // Skip technical terms, CSS classes, etc.
        if (this.shouldSkip(text)) continue;
        
        findings.push({
          file: filePath,
          type,
          text,
          fullMatch: match[0],
          line: this.getLineNumber(content, match.index),
          needsTranslation
        });
        
        if (needsTranslation) {
          this.missingTranslations.add(text);
        }
      }
    }
    
    return findings;
  }

  // Check if text should be skipped
  shouldSkip(text) {
    const skipPatterns = [
      // Technical terms
      /^[a-z-]+$/,  // CSS classes, HTML attributes
      /^#[0-9a-fA-F]+$/, // Colors
      /^\d+$/, // Numbers only
      /^[A-Z_]+$/, // Constants
      /^[a-z]+\.[a-z]+/, // Method calls
      /^https?:\/\//, // URLs
      /^\/[\/\w-]*/, // Paths
      /^\w+@\w+/, // Emails
      
      // Short meaningless text
      /^[a-zA-Z]{1,2}$/, // Single/double letters
      /^(px|em|rem|vh|vw|%)$/, // CSS units
      
      // Already processed
      /\{.*\}/, // Template variables
    ];
    
    return skipPatterns.some(pattern => pattern.test(text.trim()));
  }

  // Get line number for a character index
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  // Generate translation key from text
  generateTranslationKey(text, type) {
    // Check if we have a predefined mapping
    if (TRANSLATION_MAPPINGS[text]) {
      return TRANSLATION_MAPPINGS[text];
    }
    
    // Generate key based on type and text
    const cleanText = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '')
      .slice(0, 20);
    
    switch (type) {
      case 'placeholder':
        return `placeholders.${cleanText}`;
      case 'aria-label':
        return `aria.${cleanText}`;
      case 'title':
        return `titles.${cleanText}`;
      case 'toast':
        return `messages.${cleanText}`;
      case 'portuguese':
      case 'english-ui':
        return `common.${cleanText}`;
      default:
        return `misc.${cleanText}`;
    }
  }

  // Scan all files
  scanAll() {
    console.log('🔍 Scanning for hardcoded text...\n');
    
    const srcDir = path.join(__dirname, '..', 'src');
    const files = this.findFiles(srcDir);
    
    console.log(`📂 Found ${files.length} files to scan\n`);
    
    for (const file of files) {
      const findings = this.scanFile(file);
      if (findings.length > 0) {
        this.findings.push(...findings);
        console.log(`📄 ${path.relative(srcDir, file)}: ${findings.length} issues`);
      }
    }
    
    return this.findings;
  }

  // Generate report
  generateReport() {
    console.log('\n📊 HARDCODED TEXT AUDIT REPORT');
    console.log('='.repeat(50));
    
    const byType = {};
    for (const finding of this.findings) {
      byType[finding.type] = (byType[finding.type] || 0) + 1;
    }
    
    console.log('\n📈 Findings by Type:');
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count} instances`);
    }
    
    console.log(`\n🔢 Total Issues: ${this.findings.length}`);
    console.log(`🔤 Unique Texts Needing Translation: ${this.missingTranslations.size}`);
    
    // Show most common hardcoded texts
    const textCounts = {};
    for (const finding of this.findings) {
      textCounts[finding.text] = (textCounts[finding.text] || 0) + 1;
    }
    
    const sorted = Object.entries(textCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    console.log('\n🔥 Most Common Hardcoded Texts:');
    for (const [text, count] of sorted) {
      console.log(`  "${text}": ${count}x`);
    }
    
    // Generate missing translation keys
    console.log('\n📝 Suggested Translation Keys:');
    const keys = {};
    for (const text of this.missingTranslations) {
      const key = this.generateTranslationKey(text, 'common');
      keys[key] = text;
    }
    
    console.log('\n// Add these to your i18n files:');
    for (const [key, text] of Object.entries(keys).slice(0, 20)) {
      console.log(`"${key}": "${text}",`);
    }
    
    return {
      findings: this.findings,
      missingTranslations: Array.from(this.missingTranslations),
      summary: byType
    };
  }
}

// Run the scanner
async function main() {
  const fixer = new HardcodedTextFixer();
  
  const findings = fixer.scanAll();
  const report = fixer.generateReport();
  
  // Save detailed report
  const reportPath = path.join(__dirname, '..', 'hardcoded-text-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  console.log('\n✅ Scan complete! Use this data to systematically fix all hardcoded text.');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { HardcodedTextFixer }; 