# Supabase CLI Backup Guide

The most reliable way to backup your database using the official Supabase CLI.

## Quick Setup

1. **Install Supabase CLI**:
```bash
npm install -g @supabase/cli
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link your project**:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

4. **Run backup**:
```bash
npm run backup:cli
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run backup:cli` | Full backup (schema + data) |
| `npm run backup:cli-data` | Data only backup |
| `npm run backup:cli-schema` | Schema only backup |

## Direct CLI Usage

```bash
# Full backup
supabase db dump --file backup.sql

# Data only
supabase db dump --data-only --file data.sql

# Schema only  
supabase db dump --file schema.sql --schema-only
```

## Output

Backups are saved to `cli-backups/timestamp/` with:
- `full-backup.sql` - Complete database
- `data-backup.sql` - Data only
- `schema-backup.sql` - Schema only

## Troubleshooting

- **Not linked**: Run `supabase link --project-ref YOUR_REF`
- **Not authenticated**: Run `supabase login`
- **CLI not found**: Install with `npm install -g @supabase/cli`

## Getting Your Project REF

1. Go to Supabase Dashboard
2. Select your project
3. Settings → General
4. Copy "Reference ID" 