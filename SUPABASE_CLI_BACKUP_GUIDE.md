# Supabase CLI Backup Guide

This guide covers using the **official Supabase CLI** for database backups - the most reliable and feature-complete backup method.

## 🚀 Quick Start

```bash
# Install Supabase CLI (if not installed)
npm install -g @supabase/cli

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run backup
npm run backup:cli
```

## 📋 Available CLI Backup Commands

| Command | Description | Output |
|---------|-------------|--------|
| `npm run backup:cli` | Full backup (schema + data) | `cli-backups/timestamp/full-backup.sql` |
| `npm run backup:cli-data` | Data only backup | `cli-backups/timestamp/data-backup.sql` |
| `npm run backup:cli-schema` | Schema only backup | `cli-backups/timestamp/schema-backup.sql` |
| `npm run backup:cli-ps` | PowerShell script (Windows) | Multiple files |
| `npm run backup:cli-bash` | Bash script (Unix/Mac) | Multiple files |

## 🔧 Setup Requirements

### 1. Install Supabase CLI

#### Option A: npm (Recommended)
```bash
npm install -g @supabase/cli
```

#### Option B: Direct Download
Visit [Supabase CLI releases](https://github.com/supabase/cli/releases) and download for your platform.

#### Option C: Package Managers
```bash
# macOS with Homebrew
brew install supabase/tap/supabase

# Windows with Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Authenticate with Supabase

```bash
supabase login
```

This will open your browser to authenticate with your Supabase account.

### 3. Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings > General
4. Copy the "Reference ID"

## 📦 Backup Methods

### Method 1: Node.js Wrapper (Recommended)

Our custom Node.js wrapper provides the easiest experience:

```bash
# Full backup
npm run backup:cli

# Data only
npm run backup:cli-data

# Schema only
npm run backup:cli-schema
```

**Features:**
- ✅ Automatic directory creation
- ✅ Timestamped backups
- ✅ Error handling
- ✅ Progress feedback
- ✅ Cross-platform compatibility

### Method 2: PowerShell Script (Windows)

```bash
npm run backup:cli-ps
```

Or run directly:
```powershell
.\scripts\cli-backup.ps1 -BackupType full
.\scripts\cli-backup.ps1 -BackupType data
.\scripts\cli-backup.ps1 -BackupType schema
```

### Method 3: Bash Script (Unix/Mac/Linux)

```bash
npm run backup:cli-bash
```

Or run directly:
```bash
./scripts/cli-backup.sh full
./scripts/cli-backup.sh data
./scripts/cli-backup.sh schema
```

### Method 4: Direct CLI Commands

```bash
# Full backup
supabase db dump --file backup.sql

# Data only
supabase db dump --data-only --file data-backup.sql --use-copy

# Schema only (multiple approaches)
supabase db dump --file schema-backup.sql --schema-only
```

## 📂 Backup Output Structure

```
cli-backups/
└── 2024-01-15T10-30-00-000Z/
    ├── full-backup.sql       # Complete database
    ├── data-backup.sql       # Data only
    ├── schema-backup.sql     # Schema only
    └── backup-manifest.json  # Metadata
```

## 🔍 CLI Command Options

### Basic Options
```bash
supabase db dump [flags]
```

### Key Flags
- `--file string` - Output file path
- `--data-only` - Export data only (no schema)
- `--schema-only` - Export schema only (no data)
- `--use-copy` - Use COPY statements (faster for large datasets)
- `--keep-comments` - Preserve comments in output
- `--exclude strings` - Exclude specific tables
- `--schema strings` - Include specific schemas only
- `--dry-run` - Show what would be executed
- `--local` - Use local database instead of remote

### Advanced Examples
```bash
# Exclude specific tables
supabase db dump --data-only --exclude public.logs,public.temp_data --file clean-data.sql

# Specific schemas only
supabase db dump --schema public,auth --file schemas.sql

# Use COPY for better performance
supabase db dump --data-only --use-copy --file fast-data.sql

# Preview commands without executing
supabase db dump --dry-run --file preview.sql
```

## 🛡️ Security and Best Practices

### 1. Credentials Management
- Use `supabase login` instead of hardcoded tokens
- Credentials are stored securely by the CLI
- Automatic token refresh

### 2. Project Linking
- Link once per project: `supabase link --project-ref REF`
- No need to re-link for subsequent backups
- Project info stored in `supabase/config.toml`

### 3. Backup Storage
- Store backups in secure, versioned storage
- Consider encryption for sensitive data
- Regular cleanup of old backups

### 4. Access Control
- Use service role for automated backups
- Implement Row Level Security (RLS) appropriately
- Audit backup access regularly

## 🔄 Automation and Scheduling

### Using npm Scripts in CI/CD

```yaml
# GitHub Actions example
- name: Backup Database
  run: |
    npm install -g @supabase/cli
    echo "${{ secrets.SUPABASE_ACCESS_TOKEN }}" | supabase login --token -
    supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
    npm run backup:cli
```

### Cron Jobs (Linux/Mac)

```bash
# Edit crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * cd /path/to/project && npm run backup:cli

# Weekly full backup on Sunday
0 3 * * 0 cd /path/to/project && npm run backup:cli
```

### Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly)
4. Action: Start a program
5. Program: `npm`
6. Arguments: `run backup:cli`
7. Start in: Your project directory

## 🚨 Troubleshooting

### Common Issues and Solutions

#### "Project not linked"
```bash
# Solution: Link your project
supabase link --project-ref YOUR_PROJECT_REF
```

#### "Not authenticated"
```bash
# Solution: Login to Supabase
supabase login
```

#### "Permission denied"
```bash
# Solution: Check project permissions or use service role
# In your Supabase dashboard, verify user has backup permissions
```

#### "Command not found: supabase"
```bash
# Solution: Install Supabase CLI
npm install -g @supabase/cli

# Or update to latest version
npm update -g @supabase/cli
```

#### "Connection timeout"
```bash
# Solution: Check network and try with longer timeout
supabase db dump --file backup.sql --timeout 300
```

### Debug Mode
```bash
# Enable debug output
supabase --debug db dump --file backup.sql
```

## 📊 Backup Verification

### Check Backup File
```bash
# Check file size
ls -lh cli-backups/latest/*.sql

# Verify SQL syntax
psql --dry-run < backup.sql

# Count lines/statements
wc -l backup.sql
grep -c "INSERT INTO" backup.sql
```

### Test Restoration (Safe)
```bash
# Create test database
createdb test_restore

# Restore backup
psql test_restore < backup.sql

# Verify data
psql test_restore -c "SELECT count(*) FROM your_main_table;"

# Cleanup
dropdb test_restore
```

## 🎯 Which Method to Choose?

### For Regular Backups
- **Use**: `npm run backup:cli` (Node.js wrapper)
- **Why**: Easy, automated, cross-platform

### For CI/CD Pipelines
- **Use**: Direct CLI commands with authentication
- **Why**: Better control, explicit configuration

### For Development
- **Use**: `npm run backup:cli-data` for quick data snapshots
- **Why**: Faster, focuses on data you need

### For Production Migration
- **Use**: `supabase db dump` with specific flags
- **Why**: Full control over what's included/excluded

## 💡 Pro Tips

1. **Regular Testing**: Test your restore process monthly
2. **Multiple Formats**: Keep both full and data-only backups
3. **Monitoring**: Set up alerts for backup failures
4. **Versioning**: Use timestamp-based directory structure
5. **Compression**: Compress large backups to save space
6. **Documentation**: Document your backup/restore procedures

## 🔗 Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Database Backup Best Practices](https://supabase.com/docs/guides/database/backups)
- [Migration and Restore Guide](https://supabase.com/docs/guides/database/migrating-between-projects)

---

## ✅ Quick Verification

Test your setup:
```bash
# 1. Check CLI installation
supabase --version

# 2. Check authentication
supabase projects list

# 3. Check project link
supabase status

# 4. Run test backup
npm run backup:cli
```

Your Supabase CLI backup system is ready! 🚀 