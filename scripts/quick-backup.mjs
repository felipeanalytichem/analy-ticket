#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quick Database Backup Script
 * 
 * A simplified backup script that exports all accessible tables to JSON
 * without requiring PostgreSQL connection or complex setup.
 */

class QuickBackup {
  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(__dirname, '..', 'quick-backups', this.timestamp);
    
    // Get Supabase credentials from environment
    this.supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    this.supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    this.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error('❌ Missing Supabase credentials!');
      console.log('Please set environment variables:');
      console.log('- VITE_SUPABASE_URL');
      console.log('- VITE_SUPABASE_ANON_KEY');
      console.log('- SUPABASE_SERVICE_ROLE_KEY (optional, for better access)');
      process.exit(1);
    }
    
    this.supabase = createClient(this.supabaseUrl, this.serviceKey || this.supabaseKey);
    
    // Common tables to try backing up
    this.tables = [
      'profiles',
      'tickets',
      'ticket_chats',
      'categories',
      'subcategories',
      'notifications',
      'activity_logs',
      'knowledge_base_articles',
      'knowledge_base_categories',
      'user_roles',
      'sla_policies',
      'ticket_assignments',
      'reactions',
      'feedback',
      'todo_items'
    ];
  }

  async createBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error.message);
      throw error;
    }
  }

  async exportTable(tableName) {
    try {
      console.log(`📤 Exporting ${tableName}...`);
      
      let allData = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data, error, count } = await this.supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .range(from, from + batchSize - 1);
        
        if (error) {
          if (error.code === 'PGRST116' || error.message.includes('not found')) {
            console.log(`⚠️  Table ${tableName} not found or no access`);
            return null;
          }
          throw error;
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

  async runBackup() {
    console.log('🚀 Starting quick database backup...');
    console.log(`🔗 Supabase URL: ${this.supabaseUrl}`);
    
    try {
      await this.createBackupDirectory();
      
      const results = [];
      
      for (const table of this.tables) {
        const result = await this.exportTable(table);
        if (result) {
          results.push(result);
        }
      }
      
      // Create summary
      const summary = {
        backup_created: new Date().toISOString(),
        backup_type: 'quick',
        supabase_url: this.supabaseUrl,
        tables_found: results.filter(r => !r.error).length,
        tables_with_errors: results.filter(r => r.error).length,
        total_rows: results.reduce((sum, r) => sum + (r.rows || 0), 0),
        results
      };
      
      const summaryPath = path.join(this.backupDir, 'backup-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log('\n✅ Quick backup completed!');
      console.log(`📁 Backup location: ${this.backupDir}`);
      console.log(`📊 Tables backed up: ${results.filter(r => !r.error).length}`);
      console.log(`📈 Total rows: ${results.reduce((sum, r) => sum + (r.rows || 0), 0)}`);
      
      if (results.filter(r => r.error).length > 0) {
        console.log('\n⚠️  Some tables had errors (this is normal):');
        results.filter(r => r.error).forEach(r => 
          console.log(`   - ${r.table}: ${r.error}`)
        );
      }
      
      console.log('\n📋 Files created:');
      results.filter(r => !r.error).forEach(r => 
        console.log(`   - ${path.basename(r.file)}`)
      );
      console.log('   - backup-summary.json');
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const backup = new QuickBackup();
  backup.runBackup().catch(console.error);
}

export default QuickBackup; 