import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const migrations = [
  '20250626000025_create_knowledge_tables.sql',
  '20250626000026_create_knowledge_functions.sql',
  '20250626000027_create_knowledge_policies.sql',
  '20250626000028_refresh_schema_cache.sql'
];

function splitSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDollarQuote = false;
  let dollarTag = '';
  
  // Split into lines to handle comments
  const lines = sql.split('\n');
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.trim().startsWith('--')) {
      continue;
    }

    currentStatement += line + '\n';

    // Check for dollar quotes
    const matches = line.match(/\$[^$]*\$/g);
    if (matches) {
      for (const match of matches) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match;
        } else if (match === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        }
      }
    }

    // Only split on semicolon if we're not inside a dollar quote
    if (!inDollarQuote && line.trim().endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add the last statement if there is one
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

async function applyMigration(migrationFile) {
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = splitSqlStatements(sql);

    console.log(`Found ${statements.length} SQL statements in ${migrationFile}`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length} from ${migrationFile}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`Error executing statement ${i + 1} from ${migrationFile}:`, error);
        console.error('Statement:', statement);
        return false;
      }
    }

    console.log(`Successfully applied migration ${migrationFile}`);
    return true;
  } catch (error) {
    console.error(`Error applying migration ${migrationFile}:`, error);
    return false;
  }
}

async function applyMigrations() {
  for (const migration of migrations) {
    console.log(`Applying migration ${migration}...`);
    const success = await applyMigration(migration);
    if (!success) {
      console.error(`Failed to apply migration ${migration}. Stopping.`);
      return;
    }
  }
  console.log('Successfully applied all migrations');
}

applyMigrations(); 