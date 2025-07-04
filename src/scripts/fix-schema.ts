import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://plbmgjqitlxedsmdqpld.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function fixSchema() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_KEY environment variable is not set');
    console.log('\n🔑 Please set your Supabase Service Role Key:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to Settings > API');
    console.log('3. Copy the "service_role" key (not the anon key)');
    console.log('4. Set it as environment variable: SUPABASE_SERVICE_KEY=your_key_here');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('🔧 Checking database schema...');

    // Check if subcategories table exists
    const { data: subcategoriesExists, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('id')
      .limit(1);

    if (subcategoriesError) {
      console.error('❌ Error checking subcategories table:', subcategoriesError);
      return;
    }

    // Execute SQL to fix schema
    const sql = `
      -- Drop and recreate subcategory_id column
      ALTER TABLE public.tickets_new 
      DROP COLUMN IF EXISTS subcategory_id CASCADE;

      ALTER TABLE public.tickets_new 
      ADD COLUMN subcategory_id UUID REFERENCES public.subcategories(id);

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON public.tickets_new(subcategory_id);

      -- Grant permissions
      GRANT ALL ON public.tickets_new TO authenticated;

      -- Refresh schema cache
      NOTIFY pgrst, 'reload schema';
    `;

    const { error: sqlError } = await supabase.rpc('exec', { sql });

    if (sqlError) {
      console.error('❌ Error executing SQL:', sqlError);
      return;
    }

    console.log('✅ Schema fixed successfully!');
    console.log('✅ Added subcategory_id column');
    console.log('✅ Created index');
    console.log('✅ Granted permissions');
    console.log('✅ Refreshed schema cache');

    // Verify the changes
    const { data: verifyData, error: verifyError } = await supabase
      .from('tickets_new')
      .select('subcategory_id')
      .limit(1);

    if (verifyError) {
      console.error('❌ Error verifying changes:', verifyError);
      return;
    }

    console.log('✅ Changes verified successfully!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixSchema().catch(console.error); 