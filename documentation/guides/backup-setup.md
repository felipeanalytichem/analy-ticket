# Backup Setup Guide

## Environment Configuration

To use the backup scripts, you need to set up environment variables with your Supabase credentials.

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to Settings > API
4. Copy the following values:
   - Project URL
   - anon/public key
   - service_role key (optional but recommended)

### Step 2: Create Environment File

Create a `.env` file in your project root:

```env
# Required
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional but recommended for full access
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Test Your Setup

Run a quick backup to verify everything works:

```bash
node scripts/quick-backup.mjs
```

## Available Backup Scripts

### Quick Backup
- **File**: `scripts/quick-backup.mjs`
- **Purpose**: Fast JSON exports of all tables
- **Requirements**: Just Supabase credentials
- **Output**: `quick-backups/TIMESTAMP/`

### Comprehensive Backup
- **File**: `scripts/database-backup.mjs`
- **Purpose**: Full schema + data + SQL dumps
- **Requirements**: Supabase credentials + optional PostgreSQL connection
- **Output**: `backups/YYYY-MM-DD/`

## Usage Examples

```bash
# Run quick backup
node scripts/quick-backup.mjs

# Run comprehensive backup
node scripts/database-backup.mjs

# Add to package.json scripts
npm run backup:quick
npm run backup:full
```

## Security Notes

- Never commit `.env` file to version control
- Keep service role key secret
- Store backups in secure location
- Test restore procedures regularly 