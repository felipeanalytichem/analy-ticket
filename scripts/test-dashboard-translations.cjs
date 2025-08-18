#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Dashboard and Navigation Translation Implementation...\n');

// Read translation files
const enTranslations = JSON.parse(fs.readFileSync('src/i18n/locales/en-US.json', 'utf8'));
const ptTranslations = JSON.parse(fs.readFileSync('src/i18n/locales/pt-BR.json', 'utf8'));
const esTranslations = JSON.parse(fs.readFileSync('src/i18n/locales/es-ES.json', 'utf8'));

// Test dashboard translation keys
const dashboardKeys = [
  'dashboard.title',
  'dashboard.welcome',
  'dashboard.myActiveTickets',
  'dashboard.unassignedTickets',
  'dashboard.yourTicketsDescription',
  'dashboard.unassignedTicketsDescription',
  'dashboard.legacyAnalyticsTitle',
  'dashboard.detailedAnalyticsTitle',
  'dashboard.detailedAnalyticsSubtitle',
  'dashboard.realTimeData',
  'dashboard.keyPerformanceIndicators',
  'dashboard.statusDistribution',
  'dashboard.statusDistributionDescription',
  'dashboard.agentPerformance',
  'dashboard.agentPerformanceDescription',
  'dashboard.ticketTimeline',
  'dashboard.ticketTimelineDescription',
  'dashboard.noDataAvailable',
  'dashboard.noAgentsWithTickets',
  'dashboard.noTimelineData',
  'dashboard.exportData',
  'dashboard.refreshData',
  'dashboard.last7Days',
  'dashboard.last30Days',
  'dashboard.ticketAnalyticsCharts'
];

// Test header translation keys
const headerKeys = [
  'header.profile',
  'header.settings',
  'header.logout'
];

// Test sidebar translation keys
const sidebarKeys = [
  'sidebar.workloadDashboard',
  'sidebar.slaNotifications',
  'sidebar.sessionTimeout',
  'sidebar.assignmentRules',
  'sidebar.categoryExpertise'
];

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

function testTranslationKeys(keys, language, translations) {
  console.log(`\n📋 Testing ${language} translations:`);
  let missingKeys = [];
  
  keys.forEach(key => {
    const value = getNestedValue(translations, key);
    if (!value) {
      missingKeys.push(key);
      console.log(`  ❌ Missing: ${key}`);
    } else {
      console.log(`  ✅ Found: ${key} = "${value}"`);
    }
  });
  
  return missingKeys;
}

// Test all languages
const allKeys = [...dashboardKeys, ...headerKeys, ...sidebarKeys];

const enMissing = testTranslationKeys(allKeys, 'English', enTranslations);
const ptMissing = testTranslationKeys(allKeys, 'Portuguese', ptTranslations);
const esMissing = testTranslationKeys(allKeys, 'Spanish', esTranslations);

// Test component files for translation usage
console.log('\n🔍 Testing component files for translation usage...\n');

const componentFiles = [
  'src/pages/DashboardPage.tsx',
  'src/components/layout/Header.tsx',
  'src/components/app-sidebar.tsx',
  'src/pages/AgentDashboard.tsx',
  'src/components/dashboard/TicketCharts.tsx',
  'src/components/dashboard/DetailedAnalytics.tsx'
];

componentFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`📄 ${filePath}:`);
    
    // Check for useTranslation import
    if (content.includes("import { useTranslation } from 'react-i18next'") || 
        content.includes('import { useTranslation } from "react-i18next"')) {
      console.log('  ✅ useTranslation imported');
    } else {
      console.log('  ❌ useTranslation not imported');
    }
    
    // Check for t() usage
    const tUsageMatches = content.match(/t\(['"`][^'"`]+['"`]\)/g);
    if (tUsageMatches) {
      console.log(`  ✅ Found ${tUsageMatches.length} t() calls`);
      tUsageMatches.slice(0, 3).forEach(match => {
        console.log(`    - ${match}`);
      });
      if (tUsageMatches.length > 3) {
        console.log(`    ... and ${tUsageMatches.length - 3} more`);
      }
    } else {
      console.log('  ❌ No t() calls found');
    }
    
    // Check for remaining hardcoded strings (basic check)
    const hardcodedStrings = [
      'Dashboard & Analytics',
      'My Active Tickets',
      'Unassigned Tickets',
      'Profile',
      'Settings',
      'Log out',
      'Workload Dashboard',
      'SLA Notifications',
      'Session Timeout',
      'Assignment Rules',
      'Category Expertise'
    ];
    
    const foundHardcoded = hardcodedStrings.filter(str => content.includes(`"${str}"`));
    if (foundHardcoded.length > 0) {
      console.log(`  ⚠️  Found ${foundHardcoded.length} potential hardcoded strings:`);
      foundHardcoded.forEach(str => console.log(`    - "${str}"`));
    } else {
      console.log('  ✅ No obvious hardcoded strings found');
    }
    
    console.log('');
  } else {
    console.log(`❌ File not found: ${filePath}\n`);
  }
});

// Summary
console.log('\n📊 SUMMARY:');
console.log(`English missing keys: ${enMissing.length}`);
console.log(`Portuguese missing keys: ${ptMissing.length}`);
console.log(`Spanish missing keys: ${esMissing.length}`);

if (enMissing.length === 0 && ptMissing.length === 0 && esMissing.length === 0) {
  console.log('\n🎉 All translation keys are present in all languages!');
} else {
  console.log('\n⚠️  Some translation keys are missing. Please add them to complete the implementation.');
}

console.log('\n✅ Dashboard and Navigation Translation Test Complete!');