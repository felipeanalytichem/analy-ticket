# Database Backup Guide

This guide provides comprehensive backup solutions for your Supabase database.

## Quick Start

For an immediate backup, run:
```bash
node scripts/quick-backup.mjs
```

## Backup Methods

### 1. Quick Backup (Recommended)
- Fast JSON exports
- Simple setup with Supabase credentials only
- Perfect for regular backups

### 2. Comprehensive Backup
- Complete schema + data + SQL dumps
- Requires PostgreSQL connection
- Best for full system backups

## Setup

Create `.env` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

```bash
# Quick backup
node scripts/quick-backup.mjs

# Comprehensive backup
node scripts/database-backup.mjs
```

## Output

Backups are saved to:
- `quick-backups/TIMESTAMP/` for quick backups
- `backups/YYYY-MM-DD/` for comprehensive backups

## 📋 Backup Options Overview

| Method | Speed | Features | Requirements |
|--------|-------|----------|--------------|
| Quick Backup | ⚡ Fast | JSON exports, Simple setup | Supabase credentials only |
| Comprehensive Backup | 🔄 Complete | Schema + Data + SQL dumps | PostgreSQL connection preferred |
| Supabase CLI | 🛠️ Professional | Full database backup | Supabase CLI installed |
| Manual Export | 👥 Simple | Dashboard export | Browser access |

## 🔧 Setup Requirements

### Environment Variables

Create a `.env` file in your project root with:

```env
# Required for all backup methods
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional but recommended for better access
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional for comprehensive backup (direct PostgreSQL access)
DATABASE_URL=postgresql://user:pass@host:port/database
SUPABASE_DB_URL=your_direct_db_connection_string
```

### How to Get Your Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > API
4. Copy the Project URL and anon/public key
5. For service role key: Copy the service_role key (keep this secret!)

## 📦 Method 1: Quick Backup (Recommended for Most Users)

### What it does:
- Exports all accessible tables to JSON format
- Works with just Supabase credentials
- Fast and reliable
- Perfect for regular backups

### How to run:
```bash
# Make sure you have your environment variables set
node scripts/quick-backup.mjs
```

### Output:
- Creates `quick-backups/TIMESTAMP/` directory
- Individual JSON files for each table
- `backup-summary.json` with metadata

### Example output structure:
```
quick-backups/2024-01-15T10-30-00-000Z/
├── profiles.json
├── tickets.json
├── ticket_chats.json
├── categories.json
├── notifications.json
├── activity_logs.json
└── backup-summary.json
```

## 🔍 Method 2: Comprehensive Backup (Advanced Users)

### What it does:
- Complete database schema export
- Full SQL dumps for restoration
- JSON data exports
- PostgreSQL schema information
- Constraint and relationship mapping

### How to run:
```bash
# Requires PostgreSQL connection for full features
node scripts/database-backup.mjs
```

### Output:
- Creates `backups/YYYY-MM-DD/` directory
- Individual table JSON files
- `schema.json` with complete database structure
- `database-dump.sql` for full restoration
- `backup-manifest.json` with metadata

### Example output structure:
```
backups/2024-01-15/
├── profiles.json
├── tickets.json
├── schema.json
├── database-dump.sql
└── backup-manifest.json
```

## 🛠️ Method 3: Supabase CLI Backup

### Prerequisites:
Install Supabase CLI:
```bash
npm install -g @supabase/cli
```

### Login to Supabase:
```bash
supabase login
```

### Create backup:
```bash
# Link your project (first time only)
supabase link --project-ref your-project-ref

# Create a database dump
supabase db dump --data-only > data-backup.sql
supabase db dump --schema-only > schema-backup.sql
supabase db dump > full-backup.sql
```

### Restore from backup:
```bash
# Restore schema
psql -h your-db-host -U your-user -d your-database < schema-backup.sql

# Restore data
psql -h your-db-host -U your-user -d your-database < data-backup.sql
```

## 📊 Method 4: Manual Supabase Dashboard Export

### Steps:
1. Go to your Supabase Dashboard
2. Navigate to Database > Tables
3. Select each table you want to backup
4. Click "Export" > "CSV" or "JSON"
5. Download the files

### Pros:
- No technical setup required
- Visual interface
- Can select specific tables

### Cons:
- Manual process for each table
- No schema information
- Time-consuming for many tables

## 🔄 Automated Backup Scripts

### Add to package.json:
```json
{
  "scripts": {
    "backup:quick": "node scripts/quick-backup.mjs",
    "backup:full": "node scripts/database-backup.mjs",
    "backup:daily": "node scripts/quick-backup.mjs && echo 'Daily backup completed'"
  }
}
```

### Run automated backups:
```bash
npm run backup:quick
npm run backup:full
npm run backup:daily
```

### Schedule with cron (Linux/Mac):
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/your/project && npm run backup:quick
```

### Schedule with Task Scheduler (Windows):
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly, etc.)
4. Set action to run: `node scripts/quick-backup.mjs`
5. Set start in: Your project directory

## 📁 Backup Directory Structure

```
project-root/
├── backups/                  # Comprehensive backups
│   └── YYYY-MM-DD/
│       ├── *.json
│       ├── schema.json
│       ├── database-dump.sql
│       └── backup-manifest.json
├── quick-backups/           # Quick backups
│   └── TIMESTAMP/
│       ├── *.json
│       └── backup-summary.json
└── scripts/
    ├── database-backup.mjs
    └── quick-backup.mjs
```

## 🔒 Security Best Practices

1. **Never commit credentials** to version control
2. **Use service role key** for automated backups
3. **Store backups securely** (encrypted storage)
4. **Rotate backup credentials** regularly
5. **Test restore procedures** periodically

## 🚨 Troubleshooting

### Common Issues:

#### "Missing Supabase credentials"
- Check your `.env` file
- Ensure environment variables are set
- Verify variable names match exactly

#### "PostgreSQL connection failed"
- This is normal for quick backup
- For comprehensive backup, check DATABASE_URL
- Ensure firewall allows connections

#### "Table not found or no access"
- Normal for non-existent tables
- Check RLS policies if using service role key
- Verify user permissions

#### "Permission denied"
- Use service role key for full access
- Check Row Level Security (RLS) policies
- Ensure user has proper permissions

### Getting Help:

1. Check the backup logs for specific error messages
2. Verify your Supabase project is accessible
3. Test connection with simple query first
4. Check Supabase status page for outages

## 📈 Monitoring Backup Health

### Backup Validation:
```bash
# Check if backup files exist and have content
ls -la backups/
ls -la quick-backups/

# Verify JSON files are valid
node -e "console.log(JSON.parse(require('fs').readFileSync('quick-backups/latest/profiles.json')))"
```

### Backup Size Monitoring:
```bash
# Check backup sizes
du -sh backups/*
du -sh quick-backups/*
```

## 🔄 Restoration Guide

### From Quick Backup JSON:
```javascript
// Example restoration script
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(url, key);
const backup = JSON.parse(fs.readFileSync('profiles.json'));

for (const row of backup.data) {
  await supabase.from('profiles').insert(row);
}
```

### From SQL Dump:
```bash
# Using psql
psql -h your-host -U your-user -d your-db < database-dump.sql

# Using Supabase CLI
supabase db reset
psql -h localhost -p 54322 -U postgres < database-dump.sql
```

## 📅 Backup Strategy Recommendations

### For Development:
- Quick backup before major changes
- Weekly comprehensive backup
- Keep last 5 backups

### For Production:
- Daily automated quick backups
- Weekly comprehensive backups
- Monthly long-term storage
- Test restoration monthly

### For Critical Systems:
- Multiple daily backups
- Real-time replication
- Offsite backup storage
- Automated monitoring

---

## 🚀 Get Started Now

1. Set up your environment variables
2. Run your first backup:
   ```bash
   node scripts/quick-backup.mjs
   ```
3. Schedule regular backups
4. Test restoration process

Your data is valuable - protect it with regular backups! 🛡️ 