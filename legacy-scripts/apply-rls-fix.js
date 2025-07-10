const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const SUPABASE_URL = "https://plbmgjqitlxedsmdqpld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNTIyMjYsImV4cCI6MjA2NDcyODIyNn0.m6MsXWqI6TbJQ1EeaX8R7L7GHzA23ZaffCmKrVdVD_U";

// You'll need to provide the service role key for admin operations
// This should be done securely, typically from environment variables
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "YOUR_SERVICE_ROLE_KEY_HERE";

async function applyRLSFix() {
    console.log('🔧 Starting RLS Policy Fix...');
    
    try {
        // Create client with service role key for admin operations
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Read the SQL fix file
        const sqlContent = fs.readFileSync('fix-chat-rls-policies.sql', 'utf8');
        
        console.log('📄 SQL file loaded, applying fix...');
        
        // Execute the SQL using the REST API
        const { data, error } = await supabaseAdmin.rpc('exec_sql', {
            sql: sqlContent
        });

        if (error) {
            console.error('❌ Error applying RLS fix:', error);
            return false;
        }

        console.log('✅ RLS policies fixed successfully!');
        console.log('📋 Result:', data);
        return true;

    } catch (error) {
        console.error('❌ Failed to apply RLS fix:', error.message);
        
        if (error.message.includes('SERVICE_KEY')) {
            console.log('\n🔑 You need to provide your Supabase Service Role Key:');
            console.log('1. Go to your Supabase Dashboard');
            console.log('2. Navigate to Settings > API');
            console.log('3. Copy the "service_role" key (not the anon key)');
            console.log('4. Set it as environment variable: SUPABASE_SERVICE_KEY=your_key_here');
            console.log('5. Or replace "YOUR_SERVICE_ROLE_KEY_HERE" in this script');
        }
        
        return false;
    }
}

// Alternative method using direct SQL execution
async function applyRLSFixDirect() {
    console.log('🔧 Attempting direct SQL execution...');
    
    try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Split the SQL into individual statements
        const sqlContent = fs.readFileSync('fix-chat-rls-policies.sql', 'utf8');
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`📄 Executing ${statements.length} SQL statements...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
            
            try {
                const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement });
                if (error) {
                    console.warn(`⚠️ Warning on statement ${i + 1}:`, error.message);
                }
            } catch (err) {
                console.warn(`⚠️ Warning on statement ${i + 1}:`, err.message);
            }
        }

        console.log('✅ SQL execution completed!');
        return true;

    } catch (error) {
        console.error('❌ Direct execution failed:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting Supabase RLS Policy Fix');
    console.log('🎯 Target: Chat system infinite recursion fix');
    console.log('');

    // Try the main method first
    const success = await applyRLSFix();
    
    if (!success) {
        console.log('\n📋 Manual Application Instructions:');
        console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Navigate to your project');
        console.log('3. Go to SQL Editor');
        console.log('4. Copy the content of "fix-chat-rls-policies.sql"');
        console.log('5. Paste and execute the SQL');
        console.log('');
        console.log('📄 SQL file location: ./fix-chat-rls-policies.sql');
    }
}

main().catch(console.error); 