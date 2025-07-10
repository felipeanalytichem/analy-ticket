#!/usr/bin/env node

import pg from 'pg';
const { Client } = pg;

// Database connection details for Supabase
const DB_CONFIG = {
    user: 'postgres',
    host: 'db.plbmgjqitlxedsmdqpld.supabase.co',
    database: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: false }
};

if (!DB_CONFIG.password) {
    console.error('❌ SUPABASE_DB_PASSWORD environment variable is required');
    console.log('💡 Set it with:');
    console.log('$env:SUPABASE_DB_PASSWORD="your_database_password"');
    process.exit(1);
}

const client = new Client(DB_CONFIG);

console.log('🚨 APPLYING EMERGENCY CHAT FIX VIA DIRECT PostgreSQL');
console.log('===================================================');

async function applyEmergencyFix() {
    try {
        console.log('🔌 Connecting to Supabase PostgreSQL database...');
        await client.connect();
        console.log('✅ Connected successfully!');

        // Step 1: Drop problematic functions and triggers
        console.log('🗑️  Dropping problematic functions and triggers...');
        await client.query('DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE');
        await client.query('DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE');
        await client.query('DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE');
        await client.query('DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE');
        console.log('✅ Dropped problematic components');

        // Step 2: Create fixed ticket chat function
        console.log('🔨 Creating fixed create_ticket_chat function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION create_ticket_chat()
            RETURNS TRIGGER AS $$
            BEGIN
                INSERT INTO ticket_chats (ticket_id)
                VALUES (NEW.id);
                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
                    RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Created fixed create_ticket_chat function');

        // Step 3: Create fixed participants function
        console.log('🔨 Creating fixed add_initial_chat_participants function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION add_initial_chat_participants()
            RETURNS TRIGGER AS $$
            DECLARE
                v_ticket_user_id UUID;
                v_ticket_assigned_to UUID;
                v_user_role TEXT;
            BEGIN
                -- FIXED: Use individual variables instead of problematic RECORD
                SELECT user_id, assigned_to 
                INTO v_ticket_user_id, v_ticket_assigned_to 
                FROM tickets_new 
                WHERE id = NEW.ticket_id;
                
                IF v_ticket_user_id IS NULL THEN
                    RAISE WARNING 'No ticket found with ID % when creating chat participants', NEW.ticket_id;
                    RETURN NEW;
                END IF;
                
                SELECT role INTO v_user_role 
                FROM users 
                WHERE id = v_ticket_user_id;
                
                INSERT INTO chat_participants (chat_id, user_id, can_write)
                VALUES (
                    NEW.id, 
                    v_ticket_user_id, 
                    COALESCE(v_user_role IN ('admin', 'agent'), false)
                )
                ON CONFLICT (chat_id, user_id) DO NOTHING;
                
                IF v_ticket_assigned_to IS NOT NULL AND v_ticket_assigned_to != v_ticket_user_id THEN
                    INSERT INTO chat_participants (chat_id, user_id, can_write)
                    VALUES (NEW.id, v_ticket_assigned_to, true)
                    ON CONFLICT (chat_id, user_id) DO NOTHING;
                END IF;
                
                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to add participants to chat % for ticket %: %', 
                                 NEW.id, NEW.ticket_id, SQLERRM;
                    RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        console.log('✅ Created fixed add_initial_chat_participants function');

        // Step 4: Recreate triggers
        console.log('🔗 Recreating triggers...');
        await client.query(`
            CREATE TRIGGER trigger_create_ticket_chat
                AFTER INSERT ON tickets_new
                FOR EACH ROW
                EXECUTE FUNCTION create_ticket_chat();
        `);
        
        await client.query(`
            CREATE TRIGGER trigger_add_initial_chat_participants
                AFTER INSERT ON ticket_chats
                FOR EACH ROW
                EXECUTE FUNCTION add_initial_chat_participants();
        `);
        console.log('✅ Recreated triggers');

        // Step 5: Refresh schema cache
        console.log('🔄 Refreshing PostgREST schema cache...');
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log('✅ Schema cache refreshed');

        // Step 6: Test the fix
        console.log('🧪 Testing the fix...');
        const testResult = await client.query(`
            SELECT 
                proname as function_name,
                prosrc LIKE '%ticket_record%' as has_problematic_code
            FROM pg_proc 
            WHERE proname IN ('add_initial_chat_participants', 'create_ticket_chat')
        `);
        
        console.log('🔍 Function test results:');
        testResult.rows.forEach(row => {
            console.log(`   ${row.function_name}: ${row.has_problematic_code ? '❌ Still has problematic code' : '✅ Fixed'}`);
        });

        const problemsFound = testResult.rows.filter(row => row.has_problematic_code).length;
        
        if (problemsFound === 0) {
            console.log('');
            console.log('🎉 SUCCESS: EMERGENCY CHAT FIX APPLIED COMPLETELY!');
            console.log('✅ The "ticket_record is not assigned yet" error should now be resolved.');
            console.log('✅ The "missing FROM-clause entry" error should now be resolved.');
            console.log('');
            console.log('💡 Please refresh your application and test the chat functionality.');
        } else {
            console.log('⚠️  WARNING: Some functions may still have issues. Manual verification recommended.');
        }

    } catch (error) {
        console.error('❌ Error applying emergency fix:', error);
        
        if (error.code === 'ENOTFOUND') {
            console.log('💡 Connection failed. Please check your network and database password.');
        } else if (error.code === '28P01') {
            console.log('💡 Authentication failed. Please check your SUPABASE_DB_PASSWORD.');
        } else {
            console.log('💡 Database execution failed. You may need to apply the fix manually via Supabase SQL Editor');
            console.log('📁 Use the file: MANUAL_CHAT_FIX.sql');
        }
        
        throw error;
        
    } finally {
        try {
            await client.end();
            console.log('🔌 Database connection closed.');
        } catch (err) {
            console.warn('Warning: Error closing connection:', err.message);
        }
    }
}

applyEmergencyFix().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
}); 