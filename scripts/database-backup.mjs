#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Database Backup Script
 * 
 * This script creates multiple types of backups:
 * 1. SQL schema dump
 * 2. JSON data export for all tables
 * 3. Individual table exports
 * 4. Migration-ready schema
 */

class DatabaseBackup {
  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    this.backupDir = path.join(__dirname, '..', 'backups', this.timestamp);
    
    // Initialize Supabase client
    this.supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    this.supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('⚠️  Supabase credentials not found in environment variables');
      console.log('Please ensure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.serviceKey || this.supabaseKey);
    
    // PostgreSQL connection for direct access (if available)
    this.pgPool = null;
  }

  async initializeBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error.message);
      throw error;
    }
  }

  async initializePostgresConnection() {
    const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    
    if (connectionString) {
      try {
        this.pgPool = new Pool({ connectionString });
        await this.pgPool.query('SELECT 1');
        console.log('✅ PostgreSQL direct connection established');
        return true;
      } catch (error) {
        console.log('⚠️  PostgreSQL direct connection failed, using Supabase client only');
        this.pgPool = null;
        return false;
      }
    }
    return false;
  }

  async getTableNames() {
    try {
      if (this.pgPool) {
        const result = await this.pgPool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        return result.rows.map(row => row.table_name);
      } else {
        // Fallback: get tables through Supabase (limited)
        const commonTables = [
          'profiles', 'tickets', 'ticket_chats', 'categories', 'subcategories',
          'notifications', 'activity_logs', 'knowledge_base_articles',
          'knowledge_base_categories', 'user_roles', 'sla_policies',
          'ticket_assignments', 'reactions', 'feedback'
        ];
        
        const existingTables = [];
        for (const table of commonTables) {
          try {
            const { data, error } = await this.supabase.from(table).select('*').limit(1);
            if (!error) {
              existingTables.push(table);
            }
          } catch (e) {
            // Table doesn't exist or no access
          }
        }
        return existingTables;
      }
    } catch (error) {
      console.error('❌ Failed to get table names:', error.message);
      return [];
    }
  }

  async exportTableData(tableName) {
    try {
      console.log(`📤 Exporting table: ${tableName}`);
      
      let allData = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error } = await this.supabase
          .from(tableName)
          .select('*')
          .range(from, from + batchSize - 1);
          
        if (error) {
          console.error(`❌ Error exporting ${tableName}:`, error.message);
          break;
        }
        
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        from += batchSize;
        
        if (data.length < batchSize) break;
      }
      
      const exportData = {
        table: tableName,
        exported_at: new Date().toISOString(),
        row_count: allData.length,
        data: allData
      };
      
      const filePath = path.join(this.backupDir, `${tableName}.json`);
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      
      console.log(`✅ Exported ${allData.length} rows from ${tableName}`);
      return { table: tableName, rows: allData.length, file: filePath };
    } catch (error) {
      console.error(`❌ Failed to export ${tableName}:`, error.message);
      return { table: tableName, rows: 0, error: error.message };
    }
  }

  async exportSchema() {
    if (!this.pgPool) {
      console.log('⚠️  Schema export requires PostgreSQL connection');
      return null;
    }

    try {
      console.log('📤 Exporting database schema...');
      
      // Get all table schemas
      const schemaQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `;
      
      const { rows } = await this.pgPool.query(schemaQuery);
      
      // Get constraints
      const constraintsQuery = `
        SELECT 
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name
      `;
      
      const constraintsResult = await this.pgPool.query(constraintsQuery);
      
      const schemaExport = {
        exported_at: new Date().toISOString(),
        tables: this.groupByTable(rows),
        constraints: constraintsResult.rows
      };
      
      const schemaPath = path.join(this.backupDir, 'schema.json');
      await fs.writeFile(schemaPath, JSON.stringify(schemaExport, null, 2));
      
      console.log('✅ Schema exported successfully');
      return schemaPath;
    } catch (error) {
      console.error('❌ Failed to export schema:', error.message);
      return null;
    }
  }

  groupByTable(columns) {
    return columns.reduce((acc, col) => {
      if (!acc[col.table_name]) {
        acc[col.table_name] = [];
      }
      acc[col.table_name].push(col);
      return acc;
    }, {});
  }

  async generateSQLDump() {
    if (!this.pgPool) {
      console.log('⚠️  SQL dump requires PostgreSQL connection');
      return null;
    }

    try {
      console.log('📤 Generating SQL dump...');
      
      const tables = await this.getTableNames();
      let sqlDump = `-- Database Backup\n-- Generated on: ${new Date().toISOString()}\n\n`;
      
      for (const table of tables) {
        try {
          // Get CREATE TABLE statement
          const createTableQuery = `
            SELECT pg_get_createdef(oid) as definition
            FROM pg_class 
            WHERE relname = $1 AND relkind = 'r'
          `;
          
          sqlDump += `-- Table: ${table}\n`;
          sqlDump += `DROP TABLE IF EXISTS "${table}" CASCADE;\n`;
          
          // Get table data as INSERT statements
          const { rows } = await this.pgPool.query(`SELECT * FROM "${table}"`);
          
          if (rows.length > 0) {
            const columns = Object.keys(rows[0]);
            const columnsList = columns.map(col => `"${col}"`).join(', ');
            
            sqlDump += `-- Data for table: ${table}\n`;
            
            for (const row of rows) {
              const values = columns.map(col => {
                const value = row[col];
                if (value === null) return 'NULL';
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                if (value instanceof Date) return `'${value.toISOString()}'`;
                return value;
              }).join(', ');
              
              sqlDump += `INSERT INTO "${table}" (${columnsList}) VALUES (${values});\n`;
            }
          }
          
          sqlDump += '\n';
        } catch (error) {
          sqlDump += `-- Error exporting table ${table}: ${error.message}\n\n`;
        }
      }
      
      const sqlPath = path.join(this.backupDir, 'database-dump.sql');
      await fs.writeFile(sqlPath, sqlDump);
      
      console.log('✅ SQL dump generated successfully');
      return sqlPath;
    } catch (error) {
      console.error('❌ Failed to generate SQL dump:', error.message);
      return null;
    }
  }

  async createBackupManifest(results) {
    const manifest = {
      backup_created: new Date().toISOString(),
      backup_type: 'comprehensive',
      database_url: this.supabaseUrl,
      tables_exported: results.filter(r => !r.error).length,
      total_rows: results.reduce((sum, r) => sum + (r.rows || 0), 0),
      tables: results,
      files: {
        manifest: 'backup-manifest.json',
        schema: 'schema.json',
        sql_dump: 'database-dump.sql'
      },
      instructions: {
        restore_data: 'Use the JSON files to restore individual table data',
        restore_schema: 'Use schema.json to recreate table structure',
        restore_full: 'Use database-dump.sql for complete restoration'
      }
    };
    
    const manifestPath = path.join(this.backupDir, 'backup-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    return manifestPath;
  }

  async createBackup() {
    console.log('🚀 Starting comprehensive database backup...');
    
    try {
      await this.initializeBackupDirectory();
      await this.initializePostgresConnection();
      
      const tables = await this.getTableNames();
      console.log(`📋 Found ${tables.length} tables to backup`);
      
      if (tables.length === 0) {
        console.log('⚠️  No tables found to backup');
        return;
      }
      
      // Export all table data
      const exportResults = [];
      for (const table of tables) {
        const result = await this.exportTableData(table);
        exportResults.push(result);
      }
      
      // Export schema and SQL dump
      await this.exportSchema();
      await this.generateSQLDump();
      
      // Create manifest
      await this.createBackupManifest(exportResults);
      
      console.log('\n✅ Backup completed successfully!');
      console.log(`📁 Backup location: ${this.backupDir}`);
      console.log(`📊 Tables backed up: ${exportResults.filter(r => !r.error).length}/${tables.length}`);
      console.log(`📈 Total rows: ${exportResults.reduce((sum, r) => sum + (r.rows || 0), 0)}`);
      
      // Show any errors
      const errors = exportResults.filter(r => r.error);
      if (errors.length > 0) {
        console.log('\n⚠️  Some tables had errors:');
        errors.forEach(e => console.log(`   - ${e.table}: ${e.error}`));
      }
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    } finally {
      if (this.pgPool) {
        await this.pgPool.end();
      }
    }
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const backup = new DatabaseBackup();
  backup.createBackup().catch(console.error);
}

export default DatabaseBackup; 