import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyMigration() {
  try {
    // First, apply the exec_sql function
    const execSqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20250626000022_create_exec_sql.sql');
    const execSqlMigration = fs.readFileSync(execSqlPath, 'utf8');
    
    console.log('Creating exec_sql function...');
    const { data: fnData, error: fnError } = await supabase
      .from('_sqlx')
      .insert({ query: execSqlMigration })
      .select();
    
    if (fnError) {
      console.error('Error creating exec_sql function:', fnError);
      throw fnError;
    }

    // Then read and apply the knowledge base migration
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250626000021_apply_knowledge_base.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Split the migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      console.log('Executing statement:', statement.substring(0, 100) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.error('Error executing statement:', error);
        throw error;
      }
    }

    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration(); 