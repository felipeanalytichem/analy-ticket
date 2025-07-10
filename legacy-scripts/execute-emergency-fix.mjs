import pg from 'pg';

const client = new pg.Client({
    user: 'postgres',
    host: 'db.plbmgjqitlxedsmdqpld.supabase.co',
    database: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

console.log('🚨 EMERGENCY CHAT FIX - Direct PostgreSQL Execution');
console.log('==================================================');

async function emergencyFix() {
    try {
        console.log('🔌 Connecting...');
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Drop problematic components
        console.log('🗑️  Dropping problematic functions...');
        await client.query('DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats CASCADE');
        await client.query('DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new CASCADE');
        await client.query('DROP FUNCTION IF EXISTS add_initial_chat_participants() CASCADE');
        await client.query('DROP FUNCTION IF EXISTS create_ticket_chat() CASCADE');
        console.log('✅ Dropped problematic components');

        // Create fixed functions
        console.log('🔨 Creating fixed functions...');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION create_ticket_chat()
            RETURNS TRIGGER AS $$
            BEGIN
                INSERT INTO ticket_chats (ticket_id) VALUES (NEW.id);
                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create chat for ticket %: %', NEW.id, SQLERRM;
                    RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await client.query(`
            CREATE OR REPLACE FUNCTION add_initial_chat_participants()
            RETURNS TRIGGER AS $$
            DECLARE
                v_user_id UUID;
                v_assigned_to UUID;
                v_role TEXT;
            BEGIN
                SELECT user_id, assigned_to INTO v_user_id, v_assigned_to 
                FROM tickets_new WHERE id = NEW.ticket_id;
                
                IF v_user_id IS NULL THEN
                    RETURN NEW;
                END IF;
                
                SELECT role INTO v_role FROM users WHERE id = v_user_id;
                
                INSERT INTO chat_participants (chat_id, user_id, can_write)
                VALUES (NEW.id, v_user_id, COALESCE(v_role IN ('admin', 'agent'), false))
                ON CONFLICT (chat_id, user_id) DO NOTHING;
                
                IF v_assigned_to IS NOT NULL AND v_assigned_to != v_user_id THEN
                    INSERT INTO chat_participants (chat_id, user_id, can_write)
                    VALUES (NEW.id, v_assigned_to, true)
                    ON CONFLICT (chat_id, user_id) DO NOTHING;
                END IF;
                
                RETURN NEW;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to add participants: %', SQLERRM;
                    RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // Recreate triggers
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

        // Refresh schema
        await client.query("NOTIFY pgrst, 'reload schema'");
        
        console.log('✅ Functions and triggers recreated');
        console.log('🎉 EMERGENCY FIX APPLIED SUCCESSFULLY!');
        console.log('💡 Please refresh your app and test chat functionality');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

emergencyFix().catch(console.error); 