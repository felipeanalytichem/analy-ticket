import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = "https://plbmgjqitlxedsmdqpld.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applySql() {
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250626000029_setup_knowledge_base_direct.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the SQL directly
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      return;
    }

    console.log('Successfully applied migration');
  } catch (error) {
    console.error('Error:', error);
  }
}

applySql(); 