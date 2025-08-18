#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Finding ALL Hardcoded Strings in Dashboard and Navigation Components...\n');

// Files to check for hardcoded strings
const filesToCheck = [
  'src/pages/DashboardPage.tsx',
  'src/pages/AgentDashboard.tsx',
  'src/components/layout/Header.tsx',
  'src/components/app-sidebar.tsx',
  'src/components/dashboard/StatsCards.tsx',
  'src/components/dashboard/AdvancedStatsCards.tsx',
  'src/components/dashboard/TicketCharts.tsx',
  'src/components/dashboard/DetailedAnalytics.tsx',
  'src/components/dashboard/ChartContainer.tsx',
  'src/components/dashboard/KPICard.tsx'
];

// Patterns to find hardcoded strings (excluding imports, comments, and technical strings)
const hardcodedStringPatterns = [
  // Double quoted strings that look like user-facing text
  /"[A-Z][a-zA-Z\s&\-:.,!?()0-9]+"/g,
  // Single quoted strings that look like user-facing text  
  /'[A-Z][a-zA-Z\s&\-:.,!?()0-9]+'/g,
  // Template literals with user-facing text
  /`[A-Z][a-zA-Z\s&\-:.,!?()0-9${}]+`/g
];

// Strings to ignore (technical/code-related)
const ignorePatterns = [
  /^"use /,
  /^'use /,
  /className/,
  /aria-/,
  /data-/,
  /^"[a-z-]+"/,  // CSS classes, HTML attributes
  /^'[a-z-]+'/,  // CSS classes, HTML attributes
  /^"#[0-9a-fA-F]+"/,  // Colors
  /^'#[0-9a-fA-F]+'/,  // Colors
  /^"[0-9]+"/,  // Numbers
  /^'[0-9]+'/,  // Numbers
  /^"[a-z_]+\.[a-z_]+"/,  // Object properties
  /^'[a-z_]+\.[a-z_]+'/,  // Object properties
  /^"[a-z]+:[a-z]+"/,  // CSS properties
  /^'[a-z]+:[a-z]+'/,  // CSS properties
  /import.*from/,
  /console\./,
  /\.log\(/,
  /\.error\(/,
  /\.warn\(/,
  /\.info\(/
];

function shouldIgnoreString(str) {
  return ignorePatterns.some(pattern => pattern.test(str));
}

function findHardcodedStrings(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const hardcodedStrings = [];

  lines.forEach((line, lineNumber) => {
    // Skip import lines and comments
    if (line.trim().startsWith('import ') || 
        line.trim().startsWith('//') || 
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*')) {
      return;
    }

    hardcodedStringPatterns.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach(match => {
          if (!shouldIgnoreString(match) && match.length > 3) {
            // Additional filtering for likely user-facing strings
            const cleanMatch = match.slice(1, -1); // Remove quotes
            if (cleanMatch.length > 2 && 
                /[A-Z]/.test(cleanMatch) && 
                !/^[a-z-]+$/.test(cleanMatch) && // Not just lowercase with hyphens
                !cleanMatch.includes('className') &&
                !cleanMatch.includes('aria-') &&
                !cleanMatch.includes('data-') &&
                !cleanMatch.startsWith('http') &&
                !cleanMatch.includes('px') &&
                !cleanMatch.includes('rem') &&
                !cleanMatch.includes('vh') &&
                !cleanMatch.includes('vw') &&
                !cleanMatch.includes('%') &&
                !/^\d+$/.test(cleanMatch)) {
              
              hardcodedStrings.push({
                string: match,
                line: lineNumber + 1,
                context: line.trim()
              });
            }
          }
        });
      }
    });
  });

  return hardcodedStrings;
}

// Check each file
let totalHardcodedStrings = 0;

filesToCheck.forEach(filePath => {
  console.log(`\n📄 ${filePath}:`);
  console.log('='.repeat(60));
  
  const hardcodedStrings = findHardcodedStrings(filePath);
  
  if (hardcodedStrings.length === 0) {
    console.log('✅ No hardcoded strings found');
  } else {
    console.log(`⚠️  Found ${hardcodedStrings.length} potential hardcoded strings:`);
    
    hardcodedStrings.forEach((item, index) => {
      console.log(`\n${index + 1}. Line ${item.line}: ${item.string}`);
      console.log(`   Context: ${item.context}`);
    });
    
    totalHardcodedStrings += hardcodedStrings.length;
  }
});

console.log('\n' + '='.repeat(80));
console.log(`📊 SUMMARY: Found ${totalHardcodedStrings} potential hardcoded strings across ${filesToCheck.length} files`);

if (totalHardcodedStrings > 0) {
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Review each hardcoded string above');
  console.log('2. Add appropriate translation keys to all language files');
  console.log('3. Replace hardcoded strings with t() function calls');
  console.log('4. Test in all supported languages');
} else {
  console.log('\n🎉 All dashboard and navigation components are properly internationalized!');
}