#!/usr/bin/env node

/**
 * Supabase CLI Backup Wrapper
 * 
 * A Node.js wrapper around Supabase CLI for easier backup management
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SupabaseCLIBackup {
  constructor() {
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupDir = path.join(process.cwd(), 'cli-backups', this.timestamp);
  }

  async checkCLI() {
    try {
      const { stdout } = await execAsync('supabase --version');
      console.log('✅ Supabase CLI found:', stdout.trim());
      return true;
    } catch (error) {
      console.error('❌ Supabase CLI not found');
      return false;
    }
  }

  async checkProjectStatus() {
    try {
      const { stdout } = await execAsync('supabase status');
      console.log('🔗 Project status checked');
      return true;
    } catch (error) {
      console.log('⚠️  Local project not running, will use remote connection');
      return false;
    }
  }

  async createBackupDirectory() {
    await fs.mkdir(this.backupDir, { recursive: true });
    console.log(`📁 Created: ${this.backupDir}`);
  }

  async executeBackup(command, description, filename) {
    try {
      console.log(`📤 ${description}...`);
      console.log(`   Command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('UPDATE') && !stderr.includes('WARNING')) {
        console.warn('⚠️  Warning:', stderr);
      }
      
      // Check if file was created
      const filePath = path.join(this.backupDir, filename);
      try {
        const stats = await fs.stat(filePath);
        const sizeKB = Math.round(stats.size / 1024);
        console.log(`   ✅ Success: ${filename} (${sizeKB} KB)`);
        return true;
      } catch (fileError) {
        console.error(`   ❌ File not created: ${filename}`);
        return false;
      }
    } catch (error) {
      console.error(`   ❌ Failed: ${description}`);
      console.error(`   Error: ${error.message}`);
      return false;
    }
  }

  async runFullBackup() {
    console.log('📦 Starting full backup (schema + data)...');
    
    const commands = [
      {
        command: `supabase db dump --file "${path.join(this.backupDir, 'full-backup.sql')}" --keep-comments`,
        description: 'Creating complete backup',
        filename: 'full-backup.sql'
      },
      {
        command: `supabase db dump --data-only --file "${path.join(this.backupDir, 'data-only.sql')}" --use-copy`,
        description: 'Creating data-only backup',
        filename: 'data-only.sql'
      }
    ];

    let successCount = 0;
    for (const cmd of commands) {
      if (await this.executeBackup(cmd.command, cmd.description, cmd.filename)) {
        successCount++;
      }
    }

    return { success: successCount, total: commands.length };
  }

  async runDataBackup() {
    console.log('📊 Starting data-only backup...');
    
    const success = await this.executeBackup(
      `supabase db dump --data-only --file "${path.join(this.backupDir, 'data-backup.sql')}" --use-copy`,
      'Creating data backup',
      'data-backup.sql'
    );

    return { success: success ? 1 : 0, total: 1 };
  }

  async runSchemaBackup() {
    console.log('🏗️ Starting schema-only backup...');
    
    const success = await this.executeBackup(
      `supabase db dump --file "${path.join(this.backupDir, 'schema-backup.sql')}"`,
      'Creating schema backup',
      'schema-backup.sql'
    );

    return { success: success ? 1 : 0, total: 1 };
  }

  async createManifest(results) {
    const manifest = {
      backup_created: new Date().toISOString(),
      backup_type: this.backupType,
      cli_version: await this.getCLIVersion(),
      success_count: results.success,
      total_commands: results.total,
      output_directory: this.backupDir,
      platform: process.platform,
      files_created: await this.getCreatedFiles()
    };

    const manifestPath = path.join(this.backupDir, 'backup-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('📋 Created manifest: backup-manifest.json');
  }

  async getCLIVersion() {
    try {
      const { stdout } = await execAsync('supabase --version');
      return stdout.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  async getCreatedFiles() {
    try {
      const files = await fs.readdir(this.backupDir);
      return files.filter(f => f.endsWith('.sql'));
    } catch (error) {
      return [];
    }
  }

  async runBackup(type = 'full') {
    console.log('🚀 Starting Supabase CLI backup...');
    
    if (!(await this.checkCLI())) {
      process.exit(1);
    }

    await this.createBackupDirectory();

    const filename = `${type}-backup.sql`;
    const filePath = path.join(this.backupDir, filename);
    
    let command;
    switch (type) {
      case 'full':
        command = `supabase db dump --file "${filePath}"`;
        break;
      case 'data':
        command = `supabase db dump --data-only --file "${filePath}"`;
        break;
      case 'schema':
        command = `supabase db dump --file "${filePath}"`;
        break;
      default:
        console.error('❌ Invalid type:', type);
        process.exit(1);
    }

    try {
      console.log(`📤 Creating ${type} backup...`);
      await execAsync(command);
      console.log(`✅ Backup completed: ${filename}`);
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
    }
  }
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupType = process.argv[2] || 'full';
  const backup = new SupabaseCLIBackup();
  backup.runBackup(backupType);
}

export default SupabaseCLIBackup; 