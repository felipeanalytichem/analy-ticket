#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const supabaseUrl = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NTU0NzQsImV4cCI6MjA1MDAzMTQ3NH0.YdJlrJhqSuYKhKJJWJQOQOQOQOQOQOQOQOQOQOQOQOQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupCategoryExpertise() {
  try {
    console.log('🚀 Setting up category expertise tables...');

    // Read the SQL file
    const sqlPath = join(__dirname, 'create-category-expertise-tables.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    // Split into individual statements and execute them
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          
          // For CREATE TABLE, CREATE INDEX, etc., we need to use rpc
          const { error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key value')) {
              console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
            } else {
              console.error(`❌ Error in statement ${i + 1}:`, error.message);
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    }

    // Test the tables
    console.log('🔍 Testing table access...');
    
    const { data: testData, error: testError } = await supabase
      .from('agent_category_expertise')
      .select('count', { count: 'exact', head: true });
    
    if (testError) {
      console.error('❌ Table test failed:', testError.message);
      console.log('💡 You may need to run this with admin privileges or apply the migration manually');
    } else {
      console.log('✅ Tables created successfully!');
      console.log('🎉 Category expertise system is ready to use!');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n💡 Alternative setup options:');
    console.log('1. Run the SQL manually in your Supabase dashboard');
    console.log('2. Apply the migration: supabase migration up --include-all');
    console.log('3. Contact your database administrator');
  }
}

setupCategoryExpertise();