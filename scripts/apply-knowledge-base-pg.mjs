import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const pool = new Pool({
  host: 'plbmgjqitlxedsmdqpld.supabase.co',
  database: 'postgres',
  user: 'postgres.plbmgjqitlxedsmdqpld',
  password: process.env.SUPABASE_DB_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function applySql() {
  const client = await pool.connect();
  
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250626000024_setup_knowledge_base_complete.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Start transaction
    await client.query('BEGIN');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await client.query(statement);
      } catch (error) {
        console.error(`Error executing statement ${i + 1}:`, error);
        await client.query('ROLLBACK');
        return;
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Successfully applied all SQL statements');
  } catch (error) {
    console.error('Error:', error);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

applySql(); 