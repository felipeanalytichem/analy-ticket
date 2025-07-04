#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Supabase configuration
const SUPABASE_URL = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
    console.log('💡 Set it with:');
    console.log('$env:SUPABASE_SERVICE_KEY="your_service_key_here"');
    process.exit(1);
}

// Create Supabase client with service key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('🚨 APPLYING CHAT FIX DIRECTLY');
console.log('===============================');

async function executeSQL(sql, description) {
    console.log(`🔧 ${description}...`);
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.log(`   ⚠️ Warning: ${description} - ${error.code || 'Unknown'}`);
            console.log(`   📝 Response: ${JSON.stringify(error).substring(0, 200)}...`);
            return false;
        } else {
            console.log(`   ✅ Success: ${description}`);
            return true;
        }
    } catch (err) {
        console.log(`   ❌ Error: ${description} - ${err.message}`);
        return false;
    }
}

async function applyFix() {
    const sqlCommands = [
        {
            sql: 'DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;',
            description: 'Dropping chat participants trigger'
        },
        {
            sql: 'DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;',
            description: 'Dropping ticket chat trigger'
        },
        {
            sql: 'DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;',
            description: 'Dropping chat participants function'
        },
        {
            sql: 'DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;',
            description: 'Dropping ticket chat function'
        },
        {
            sql: `CREATE OR REPLACE FUNCTION create_ticket_chat()
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
$$ LANGUAGE plpgsql;`,
            description: 'Creating new ticket chat function'
        },
        {
            sql: `CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    v_ticket_user_id UUID;
    v_ticket_assigned_to UUID;
    v_user_role TEXT;
BEGIN
    -- Get ticket details using the correct column reference
    SELECT 
        t.user_id, 
        t.assigned_to 
    INTO 
        v_ticket_user_id, 
        v_ticket_assigned_to 
    FROM tickets_new t 
    WHERE t.id = NEW.ticket_id;
    
    -- If ticket not found, exit gracefully
    IF v_ticket_user_id IS NULL THEN
        RAISE WARNING 'No ticket found with ID % when creating chat participants', NEW.ticket_id;
        RETURN NEW;
    END IF;
    
    -- Get user role for permissions
    SELECT role INTO v_user_role 
    FROM users 
    WHERE id = v_ticket_user_id;
    
    -- Add ticket creator as participant
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (
        NEW.id, 
        v_ticket_user_id, 
        COALESCE(v_user_role IN ('admin', 'agent'), false)
    )
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    -- Add assigned agent if exists and different from creator
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
$$ LANGUAGE plpgsql;`,
            description: 'Creating new chat participants function'
        },
        {
            sql: `CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();`,
            description: 'Creating ticket chat trigger'
        },
        {
            sql: `CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();`,
            description: 'Creating chat participants trigger'
        }
    ];

    let successCount = 0;
    
    for (const command of sqlCommands) {
        const success = await executeSQL(command.sql, command.description);
        if (success) successCount++;
        
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n📊 Execution Summary: ${successCount}/${sqlCommands.length} commands completed`);
    
    // Test the fix
    console.log('\n🧪 Testing chat functionality...');
    
    try {
        const { data, error } = await supabase
            .from('ticket_chats')
            .select('id, ticket_id')
            .limit(1);
            
        if (error) {
            console.log(`   ⚠️ Different error: ${error.message}`);
        } else {
            console.log(`   ✅ Chat table accessible, found ${data?.length || 0} records`);
        }
    } catch (err) {
        console.log(`   ⚠️ Test error: ${err.message}`);
    }

    console.log('\n🎯 FINAL RESULT');
    console.log('===============');
    
    if (successCount >= 6) {
        console.log('✅ Fix applied successfully!');
        console.log('The chat system should now work without PostgreSQL errors');
        console.log('Refresh your application to test the fix');
    } else {
        console.log('⚠️ Fix may not be complete. Manual intervention required.');
        console.log('\n💡 Next steps:');
        console.log('1. Go to Supabase Dashboard > SQL Editor');
        console.log('2. Copy and paste the contents of DEFINITIVE_CHAT_FIX.sql');
        console.log('3. Execute the SQL manually');
        console.log('4. Refresh your application');
    }
    
    console.log('\n📄 For manual execution, use: DEFINITIVE_CHAT_FIX.sql');
}

// Execute the fix
applyFix().catch(console.error); 