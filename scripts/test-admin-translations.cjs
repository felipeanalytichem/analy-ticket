#!/usr/bin/env node

/**
 * Admin Translation Testing Script
 * Tests admin components in German, Dutch, and French languages
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Admin Component Translations...\n');

// Load translation files
const languages = {
  'de-DE': 'German',
  'nl-NL': 'Dutch', 
  'fr-FR': 'French'
};

const adminKeys = [
  'admin.workloadDashboard.title',
  'admin.workloadDashboard.description',
  'admin.workloadDashboard.refresh',
  'admin.workloadDashboard.rebalance',
  'admin.categoryManagement.title',
  'admin.categoryManagement.description',
  'admin.categoryManagement.addCategory',
  'admin.categoryManagement.active',
  'admin.categoryManagement.inactive',
  'admin.assignmentRules.title',
  'admin.assignmentRules.description',
  'admin.assignmentRules.configuration'
];

let allTestsPassed = true;

for (const [langCode, langName] of Object.entries(languages)) {
  console.log(`📋 Testing ${langName} (${langCode})...`);
  
  try {
    const filePath = path.join(__dirname, '..', 'src', 'i18n', 'locales', `${langCode}.json`);
    const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let missingKeys = [];
    
    for (const key of adminKeys) {
      const keyParts = key.split('.');
      let current = translations;
      
      for (const part of keyParts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = null;
          break;
        }
      }
      
      if (!current || typeof current !== 'string' || current.trim() === '') {
        missingKeys.push(key);
      }
    }
    
    if (missingKeys.length === 0) {
      console.log(`  ✅ All ${adminKeys.length} admin keys found and translated`);
    } else {
      console.log(`  ❌ Missing ${missingKeys.length} admin keys:`);
      missingKeys.forEach(key => console.log(`    - ${key}`));
      allTestsPassed = false;
    }
    
  } catch (error) {
    console.log(`  ❌ Error loading ${langName} translations: ${error.message}`);
    allTestsPassed = false;
  }
  
  console.log('');
}

// Test specific admin component strings
console.log('🧪 Testing Specific Admin Component Strings...\n');

const testCases = [
  {
    component: 'WorkloadDashboard',
    keys: [
      'admin.workloadDashboard.totalActiveTickets',
      'admin.workloadDashboard.teamUtilization', 
      'admin.workloadDashboard.availableAgents',
      'admin.workloadDashboard.overloaded',
      'admin.workloadDashboard.busy',
      'admin.workloadDashboard.moderate',
      'admin.workloadDashboard.light'
    ]
  },
  {
    component: 'CategoryManagement',
    keys: [
      'admin.categoryManagement.noCategoriesYet',
      'admin.categoryManagement.createFirstCategory',
      'admin.categoryManagement.noSubcategories',
      'admin.categoryManagement.addSubcategory',
      'admin.categoryManagement.subcategoriesCount'
    ]
  }
];

for (const testCase of testCases) {
  console.log(`🔍 Testing ${testCase.component} component...`);
  
  for (const [langCode, langName] of Object.entries(languages)) {
    try {
      const filePath = path.join(__dirname, '..', 'src', 'i18n', 'locales', `${langCode}.json`);
      const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      let componentMissing = [];
      
      for (const key of testCase.keys) {
        const keyParts = key.split('.');
        let current = translations;
        
        for (const part of keyParts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            current = null;
            break;
          }
        }
        
        if (!current || typeof current !== 'string' || current.trim() === '') {
          componentMissing.push(key);
        }
      }
      
      if (componentMissing.length === 0) {
        console.log(`  ✅ ${langName}: All ${testCase.keys.length} keys found`);
      } else {
        console.log(`  ❌ ${langName}: Missing ${componentMissing.length} keys`);
        allTestsPassed = false;
      }
      
    } catch (error) {
      console.log(`  ❌ ${langName}: Error - ${error.message}`);
      allTestsPassed = false;
    }
  }
  
  console.log('');
}

// Summary
console.log('📊 Test Summary');
console.log('================');

if (allTestsPassed) {
  console.log('✅ All admin translation tests passed!');
  console.log('🎉 Admin components are ready for multilingual use in German, Dutch, and French.');
  process.exit(0);
} else {
  console.log('❌ Some admin translation tests failed.');
  console.log('🔧 Please review the missing translations above.');
  process.exit(1);
}