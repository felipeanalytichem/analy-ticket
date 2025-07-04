import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all files that might need updating
function findFilesWithPattern(dir, pattern) {
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories, but ignore node_modules and .git
      if (file !== 'node_modules' && file !== '.git') {
        results.push(...findFilesWithPattern(filePath, pattern));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      // Check if the file contains the import pattern
      const content = fs.readFileSync(filePath, 'utf8');
      if (pattern.test(content)) {
        results.push(filePath);
      }
    }
  }
  
  return results;
}

// Pattern to replace
const oldPattern = /import\s*{\s*DatabaseService\s*}\s*from\s*['"]([^'"]+)['"]/;
const newPattern = (importPath) => `import DatabaseService from '${importPath}'`;

// Find all files with the old import pattern
console.log('Scanning for files that need updates...');
const filesToUpdate = findFilesWithPattern('.', oldPattern);

console.log(`Found ${filesToUpdate.length} files to update.`);

// Update each file
let updatedCount = 0;
filesToUpdate.forEach(filePath => {
  try {
    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the import pattern
    const updatedContent = content.replace(oldPattern, (match, importPath) => {
      return newPattern(importPath);
    });
    
    // Write back to file if changed
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`✓ Updated: ${filePath}`);
      updatedCount++;
    } else {
      console.log(`- Skipped (no changes needed): ${filePath}`);
    }
  } catch (error) {
    console.error(`✕ Error updating ${filePath}:`, error.message);
  }
});

// Check for and remove duplicate createFeedbackRequestNotification methods in database.ts
try {
  const dbPath = './src/lib/database.ts';
  let dbContent = fs.readFileSync(dbPath, 'utf8');

  // Find all occurrences of createFeedbackRequestNotification method
  const methodRegex = /static\s+async\s+createFeedbackRequestNotification\s*\(\s*ticketId\s*:\s*string\s*,\s*userId\s*:\s*string\s*\)\s*{[\s\S]+?}/g;
  
  const matches = dbContent.match(methodRegex);
  
  if (matches && matches.length > 1) {
    console.log(`⚠️ Found ${matches.length} occurrences of createFeedbackRequestNotification method!`);
    
    // Keep only the first occurrence
    const firstOccurrence = matches[0];
    const restOccurrences = matches.slice(1);
    
    // Remove the additional occurrences
    for (const occurrence of restOccurrences) {
      dbContent = dbContent.replace(occurrence, '');
      console.log(`✓ Removed duplicate createFeedbackRequestNotification method`);
    }
    
    // Fix the first occurrence with our improved version
    const fixedMethod = `  static async createFeedbackRequestNotification(ticketId: string, userId: string) {
    try {
      // Use the database function to bypass RLS issues
      const { data, error } = await supabase.rpc('create_feedback_request_notification', {
        p_ticket_id: ticketId,
        p_user_id: userId
      });

      if (error) {
        console.error('Error in rpc call:', error);
        // Fallback: try direct insert with better error handling
        return await this.createFeedbackRequestNotificationFallback(ticketId, userId);
      } else {
        // Return data directly, don't attempt to call it as a function
        return data;
      }
    } catch (error) {
      console.error('Error in createFeedbackRequestNotification:', error);
      return await this.createFeedbackRequestNotificationFallback(ticketId, userId);
    }
  }`;
    
    dbContent = dbContent.replace(firstOccurrence, fixedMethod);
    console.log(`✓ Updated first createFeedbackRequestNotification method`);
    
    // Write back to file
    fs.writeFileSync(dbPath, dbContent, 'utf8');
    console.log(`✓ Fixed database.ts file`);
    updatedCount++;
  } else {
    console.log(`- No duplicate methods found in database.ts`);
  }
} catch (error) {
  console.error(`✕ Error fixing database.ts:`, error.message);
}

console.log(`Import update script completed. Updated ${updatedCount} files.`); 