#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

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

console.log('🚨 APPLYING EMERGENCY CHAT FIX');
console.log('================================');

const EMERGENCY_CHAT_FIX = `
-- Emergency Chat Function Fix - Applied via direct PostgreSQL connection
-- Drop problematic triggers and functions
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;
DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;

-- Create FIXED functions
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

-- Recreate triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
`;

async function applyEmergencyFix() {
    try {
        console.log('🔌 Connecting to Supabase PostgreSQL database...');
        await client.connect();
        console.log('✅ Connected successfully!');

        console.log('🔧 Executing emergency chat fix...');
        const result = await client.query(EMERGENCY_CHAT_FIX);
        
        console.log('✅ Emergency chat fix applied successfully!');
        console.log('📊 Query result:', result);

        // Test the fix
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
            console.log('🎉 SUCCESS: Chat fix applied completely! The "ticket_record" error should be resolved.');
        } else {
            console.log('⚠️  WARNING: Some functions may still have issues. Manual verification recommended.');
        }

    } catch (error) {
        console.error('❌ Error applying emergency fix:', error);
        console.log('💡 You may need to apply the fix manually via Supabase SQL Editor');
        console.log('📁 Use the file: MANUAL_CHAT_FIX.sql');
    } finally {
        try {
            await client.end();
            console.log('🔌 Database connection closed.');
        } catch (err) {
            console.error('Warning: Error closing connection:', err.message);
        }
    }
}

applyEmergencyFix(); 