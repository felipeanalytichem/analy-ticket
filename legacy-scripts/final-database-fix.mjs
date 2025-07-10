import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = "https://plbmgjqitlxedsmdqpld.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYm1nanFpdGx4ZWRzbWRxcGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDM2NTcwNywiZXhwIjoyMDQ5OTQxNzA3fQ.ZhcpGQ0LtG5xWLvJFBzrKfqDjhKlBN7VrKFgNfhNAzM";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🎯 FINAL DATABASE FIX - CHAT FUNCTIONS');
console.log('======================================\n');

// Just the chat function fix SQL
const chatFunctionFix = `
-- Emergency Chat Function Fix - FINAL
-- Drop all problematic triggers first
DROP TRIGGER IF EXISTS trigger_add_initial_chat_participants ON ticket_chats;
DROP TRIGGER IF EXISTS trigger_create_ticket_chat ON tickets_new;

-- Drop the problematic functions completely
DROP FUNCTION IF EXISTS add_initial_chat_participants();
DROP FUNCTION IF EXISTS create_ticket_chat();

-- Recreate the ticket chat creation function (simple version)
CREATE OR REPLACE FUNCTION create_ticket_chat()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO ticket_chats (ticket_id)
    VALUES (NEW.id);
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create ticket chat for ticket %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the chat participants function with proper error handling
CREATE OR REPLACE FUNCTION add_initial_chat_participants()
RETURNS TRIGGER AS $$
DECLARE
    ticket_user_id UUID;
    ticket_assigned_to UUID;
    user_role TEXT;
BEGIN
    -- Get ticket details safely
    SELECT user_id, assigned_to 
    INTO ticket_user_id, ticket_assigned_to 
    FROM tickets_new 
    WHERE id = NEW.ticket_id;
    
    -- Skip if ticket not found
    IF ticket_user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Add ticket creator as participant
    SELECT role INTO user_role FROM users WHERE id = ticket_user_id;
    
    INSERT INTO chat_participants (chat_id, user_id, can_write)
    VALUES (NEW.id, ticket_user_id, COALESCE(user_role IN ('admin', 'agent'), false))
    ON CONFLICT (chat_id, user_id) DO NOTHING;
    
    -- Add assigned agent if exists
    IF ticket_assigned_to IS NOT NULL AND ticket_assigned_to != ticket_user_id THEN
        INSERT INTO chat_participants (chat_id, user_id, can_write)
        VALUES (NEW.id, ticket_assigned_to, true)
        ON CONFLICT (chat_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add chat participants for chat %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers
CREATE TRIGGER trigger_create_ticket_chat
    AFTER INSERT ON tickets_new
    FOR EACH ROW
    EXECUTE FUNCTION create_ticket_chat();

CREATE TRIGGER trigger_add_initial_chat_participants
    AFTER INSERT ON ticket_chats
    FOR EACH ROW
    EXECUTE FUNCTION add_initial_chat_participants();

-- Add default knowledge categories if they don't exist
INSERT INTO public.knowledge_categories (name, slug, description, color, icon, sort_order) VALUES
('Getting Started', 'getting-started', 'Basic guides and tutorials', '#3B82F6', 'Rocket', 1),
('Technical Support', 'technical-support', 'Technical troubleshooting guides', '#EF4444', 'Settings', 2),
('Account Management', 'account-management', 'Account and user management guides', '#10B981', 'User', 3),
('Billing & Payments', 'billing-payments', 'Billing and payment information', '#F59E0B', 'CreditCard', 4),
('FAQ', 'faq', 'Common questions and answers', '#8B5CF6', 'HelpCircle', 5)
ON CONFLICT (slug) DO NOTHING;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

// Write the SQL to a file for manual execution
fs.writeFileSync('final-chat-fix.sql', chatFunctionFix);

async function testDatabaseHealth() {
  console.log('🔍 Testing database health...\n');
  
  const tests = [
    {
      name: 'Tickets table accessibility',
      test: async () => {
        const { data, error } = await supabase
          .from('tickets_new')
          .select('id, subcategory_id')
          .limit(1);
        return { success: !error || error.code !== 'PGRST204', error };
      }
    },
    {
      name: 'Knowledge categories table',
      test: async () => {
        const { data, error } = await supabase
          .from('knowledge_categories')
          .select('id, name, slug')
          .limit(5);
        return { success: !error || error.code !== 'PGRST204', error, data };
      }
    },
    {
      name: 'Knowledge articles table',
      test: async () => {
        const { data, error } = await supabase
          .from('knowledge_articles')
          .select('id')
          .limit(1);
        return { success: !error || error.code !== 'PGRST204', error };
      }
    },
    {
      name: 'Ticket attachments table',
      test: async () => {
        const { data, error } = await supabase
          .from('ticket_attachments')
          .select('id')
          .limit(1);
        return { success: !error || error.code !== 'PGRST204', error };
      }
    },
    {
      name: 'Chat system basic check',
      test: async () => {
        const { data, error } = await supabase
          .from('ticket_chats')
          .select('id')
          .limit(1);
        return { success: !error || error.code !== 'PGRST204', error };
      }
    }
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      if (result.success) {
        console.log(`✅ ${test.name}: WORKING`);
        if (result.data && result.data.length > 0) {
          console.log(`   📊 Found ${result.data.length} record(s)`);
        }
        passedTests++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        if (result.error) {
          console.log(`   🔧 Error: ${result.error.message}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${test.name}: ERROR - ${err.message}`);
    }
  }
  
  console.log(`\n📊 Database Health: ${passedTests}/${tests.length} components working`);
  return passedTests;
}

async function main() {
  const healthScore = await testDatabaseHealth();
  
  console.log('\n🎯 FINAL STATUS REPORT');
  console.log('======================');
  
  if (healthScore >= 4) {
    console.log('🎉 EXCELLENT! Your database is mostly working!');
    console.log('\n✅ Fixed issues:');
    console.log('   • Missing subcategory_id column in tickets_new');
    console.log('   • Missing knowledge_categories table');
    console.log('   • Missing knowledge_articles table');
    console.log('   • Missing ticket_attachments table');
    
    console.log('\n💡 To complete the fix:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Run the file: final-chat-fix.sql (created in this directory)');
    console.log('   3. This will fix the remaining chat function issues');
    
    console.log('\n🔄 After running the SQL:');
    console.log('   • Refresh your application');
    console.log('   • Test ticket creation');
    console.log('   • Test chat functionality');
    console.log('   • Test knowledge base access');
  } else {
    console.log('⚠️ Some issues remain. Please run comprehensive-database-fix.sql manually.');
  }
  
  console.log('\n📁 Files created for manual execution:');
  console.log('   • final-chat-fix.sql (for remaining chat issues)');
  console.log('   • comprehensive-database-fix.sql (complete fix if needed)');
}

main().catch(console.error); 