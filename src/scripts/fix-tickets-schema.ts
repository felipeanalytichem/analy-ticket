import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://plbmgjqitlxedsmdqpld.supabase.co";
// Note: Replace this with your actual service role key from Supabase dashboard
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function fixTicketsSchema() {
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
    console.log('🔧 Fixing tickets_new table schema...');

    // Execute the SQL to add subcategory_id column
    const { error: alterError } = await supabase.rpc('exec', {
      query: `
        ALTER TABLE public.tickets_new 
        ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id);
        
        CREATE INDEX IF NOT EXISTS idx_tickets_subcategory ON public.tickets_new(subcategory_id);
        
        GRANT ALL ON public.tickets_new TO authenticated;
        
        NOTIFY pgrst, 'reload schema';
      `
    });

    if (alterError) {
      throw alterError;
    }

    console.log('✅ Successfully added subcategory_id column to tickets_new table');
    console.log('✅ Created index on subcategory_id');
    console.log('✅ Granted permissions to authenticated users');
    console.log('✅ Refreshed schema cache');

  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  }
}

fixTicketsSchema().catch(console.error); 