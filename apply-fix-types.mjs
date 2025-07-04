import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Supabase client setup
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Migration files to run in sequence
const migrationFiles = [
  'supabase/migrations/20250626000019_fix_priority_type.sql',
  'supabase/migrations/20250626000020_fix_ticket_types.sql',
  'supabase/migrations/20250626000021_fix_tickets_table.sql',
  'supabase/migrations/20250626000022_fix_status_values.sql',
  'supabase/migrations/20250626000023_fix_status_casting.sql',
  'supabase/migrations/20250626000024_fix_enum_casting.sql',
  'supabase/migrations/20250626000025_fix_activity_log_casting.sql'
]

async function runMigrations() {
  console.log('🚀 Starting type fix migrations...')
  
  for (const file of migrationFiles) {
    try {
      console.log(`📄 Reading migration file: ${file}`)
      const filePath = path.join(__dirname, file)
      const sql = fs.readFileSync(filePath, 'utf8')
      
      console.log(`⚙️ Executing migration: ${file}`)
      const { error } = await supabase.rpc('exec_sql', { sql })
      
      if (error) {
        console.error(`❌ Migration failed for ${file}:`, error)
        process.exit(1)
      }
      
      console.log(`✅ Migration successful: ${file}`)
    } catch (err) {
      console.error(`❌ Error processing ${file}:`, err)
      process.exit(1)
    }
  }
  
  console.log('🎉 All type fix migrations completed successfully!')
}

runMigrations().catch(err => {
  console.error('❌ Migration process failed:', err)
  process.exit(1)
}) 