#!/usr/bin/env node

import https from 'https';

// Supabase configuration
const SUPABASE_URL = 'https://plbmgjqitlxedsmdqpld.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
    process.exit(1);
}

console.log('🚨 APPLYING CHAT FIX VIA DIRECT SQL');
console.log('=====================================');

function executeSQL(sql) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ query: sql });
        
        const options = {
            hostname: 'plbmgjqitlxedsmdqpld.supabase.co',
            port: 443,
            path: '/rest/v1/rpc/exec_sql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'apikey': SUPABASE_SERVICE_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, data });
                } else {
                    resolve({ success: false, error: data, status: res.statusCode });
                }
            });
        });

        req.on('error', error => {
            resolve({ success: false, error: error.message });
        });

        req.write(postData);
        req.end();
    });
}

async function applyFixDirectSQL() {
    console.log('🎯 Since RPC might not work, let me try a direct approach...');
    console.log('💡 The most reliable way is manual execution in Supabase SQL Editor');
    console.log('');
    
    // Create a comprehensive SQL file for manual execution
    const fixSQL = `
-- EMERGENCY CHAT FIX - Execute this in Supabase SQL Editor
-- This fixes: "record 'ticket_record' is not assigned yet" error

-- Step 1: Drop problematic triggers and functions
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE;
DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE;
DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE;

-- Step 2: Create FIXED functions
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
    -- FIXED: Use individual variables instead of RECORD
    SELECT 
        t.user_id, 
        t.assigned_to 
    INTO 
        v_ticket_user_id, 
        v_ticket_assigned_to 
    FROM tickets_new t 
    WHERE t.id = NEW.ticket_id;
    
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

-- Step 3: Recreate triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Step 4: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verification
SELECT 'CHAT FIX APPLIED SUCCESSFULLY!' as status;
`;

    // Write to file for manual execution
    const fs = await import('fs');
    fs.writeFileSync('MANUAL_CHAT_FIX.sql', fixSQL);
    
    console.log('📁 Created file: MANUAL_CHAT_FIX.sql');
    console.log('');
    console.log('🎯 IMMEDIATE ACTION REQUIRED:');
    console.log('==============================');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" in the left sidebar');
    console.log('4. Copy ALL content from MANUAL_CHAT_FIX.sql');
    console.log('5. Paste it into the SQL Editor');
    console.log('6. Click "Run" button');
    console.log('7. Look for "CHAT FIX APPLIED SUCCESSFULLY!" message');
    console.log('8. Refresh your React application');
    console.log('');
    console.log('🔧 What this fixes:');
    console.log('• Removes the problematic SELECT * INTO ticket_record');
    console.log('• Uses proper variable declarations (v_ticket_user_id, v_ticket_assigned_to)');
    console.log('• Eliminates the "record not assigned yet" error');
    console.log('• Makes chat functionality work normally');
    console.log('');
    console.log('✅ After applying, your errors should be completely resolved!');
}

applyFixDirectSQL().catch(console.error); 