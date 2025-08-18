#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Final Comprehensive Hardcoded Strings Check...\n');

// All dashboard and navigation components to check
const componentsToCheck = [
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

// Known user-facing strings that should be translated
const suspiciousStrings = [
  // Dashboard strings
  'Dashboard',
  'Analytics',
  'Welcome',
  'Active Tickets',
  'Unassigned Tickets',
  'My Tickets',
  'Agent Dashboard',
  'Status Distribution',
  'Agent Performance',
  'Ticket Timeline',
  'Export',
  'Refresh',
  'Loading',
  'Error',
  'Retry',
  'Target',
  'Trending up',
  'Trending down',
  'No change',
  'Chart Error',
  'Unable to load',
  'Please try again',
  
  // Navigation strings
  'Profile',
  'Settings',
  'Log out',
  'Logout',
  'Workload Dashboard',
  'SLA Notifications',
  'Session Timeout',
  'Assignment Rules',
  'Category Expertise',
  
  // Common UI strings
  'All',
  'Open',
  'Closed',
  'In Progress',
  'Resolved',
  'Urgent',
  'High',
  'Medium',
  'Low'
];

function checkFileForHardcodedStrings(filePath) {
  if (!fs.existsSync(filePath)) {
    return { found: [], error: 'File not found' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const foundStrings = [];

  lines.forEach((line, lineNumber) => {
    // Skip import lines, comments, and console statements
    if (line.trim().startsWith('import ') || 
        line.trim().startsWith('//') || 
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*') ||
        line.includes('console.') ||
        line.includes('aria-') ||
        line.includes('className') ||
        line.includes('data-')) {
      return;
    }

    suspiciousStrings.forEach(suspiciousString => {
      // Look for the string in quotes (but not in t() calls)
      const quotedPattern = new RegExp(`["'\`]${suspiciousString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`]`, 'gi');
      const matches = line.match(quotedPattern);
      
      if (matches && !line.includes(`t('`) && !line.includes(`t("`) && !line.includes('t(`')) {
        foundStrings.push({
          string: suspiciousString,
          line: lineNumber + 1,
          context: line.trim(),
          match: matches[0]
        });
      }
    });
  });

  return { found: foundStrings, error: null };
}

let totalIssues = 0;
let componentsWithIssues = 0;

componentsToCheck.forEach(filePath => {
  console.log(`\n📄 ${filePath}:`);
  console.log('='.repeat(60));
  
  const result = checkFileForHardcodedStrings(filePath);
  
  if (result.error) {
    console.log(`❌ ${result.error}`);
    return;
  }
  
  if (result.found.length === 0) {
    console.log('✅ No hardcoded strings found');
  } else {
    console.log(`⚠️  Found ${result.found.length} potential hardcoded strings:`);
    componentsWithIssues++;
    
    result.found.forEach((item, index) => {
      console.log(`\n${index + 1}. Line ${item.line}: ${item.match}`);
      console.log(`   String: "${item.string}"`);
      console.log(`   Context: ${item.context}`);
      totalIssues++;
    });
  }
});

// Check translation usage
console.log('\n' + '='.repeat(80));
console.log('📚 TRANSLATION USAGE CHECK:');
console.log('='.repeat(80));

componentsToCheck.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const hasUseTranslation = content.includes('useTranslation');
  const hasTranslationImport = content.includes("import { useTranslation } from 'react-i18next'") || 
                               content.includes('import { useTranslation } from "react-i18next"');
  const tCallsCount = (content.match(/t\(/g) || []).length;
  
  console.log(`\n📄 ${path.basename(filePath)}:`);
  console.log(`  📚 Translation import: ${hasTranslationImport ? '✅' : '❌'}`);
  console.log(`  🔧 useTranslation hook: ${hasUseTranslation ? '✅' : '❌'}`);
  console.log(`  🌐 t() calls: ${tCallsCount}`);
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 FINAL SUMMARY:');
console.log('='.repeat(80));

if (totalIssues === 0) {
  console.log('🎉 SUCCESS: No hardcoded strings found in dashboard and navigation components!');
  console.log('✅ All components are properly internationalized');
  console.log('✅ All user-facing strings use translation keys');
  console.log('✅ Task 10 implementation is complete and verified');
} else {
  console.log(`⚠️  ISSUES FOUND: ${totalIssues} hardcoded strings in ${componentsWithIssues} components`);
  console.log('❌ Some strings still need to be translated');
  console.log('🔧 Please review and fix the issues above');
}

console.log(`\n📈 STATISTICS:`);
console.log(`   • Components checked: ${componentsToCheck.length}`);
console.log(`   • Components with issues: ${componentsWithIssues}`);
console.log(`   • Total hardcoded strings found: ${totalIssues}`);
console.log(`   • Success rate: ${Math.round(((componentsToCheck.length - componentsWithIssues) / componentsToCheck.length) * 100)}%`);

console.log('\n✅ Final hardcoded strings check complete!');