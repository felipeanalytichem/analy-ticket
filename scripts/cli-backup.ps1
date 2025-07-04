# Supabase CLI Database Backup Script (PowerShell)
# This script creates comprehensive backups using the official Supabase CLI

param(
    [string]$BackupType = "full",
    [string]$OutputDir = "",
    [switch]$DryRun = $false,
    [switch]$Help = $false
)

function Show-Help {
    Write-Host "Supabase CLI Backup Script" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cli-backup.ps1 [options]"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -BackupType   Type of backup: 'full', 'data', 'schema' (default: full)"
    Write-Host "  -OutputDir    Custom output directory (default: cli-backups/timestamp)"
    Write-Host "  -DryRun       Show commands without executing"
    Write-Host "  -Help         Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cli-backup.ps1                    # Full backup"
    Write-Host "  .\scripts\cli-backup.ps1 -BackupType data   # Data only"
    Write-Host "  .\scripts\cli-backup.ps1 -DryRun            # Preview commands"
    Write-Host ""
}

if ($Help) {
    Show-Help
    exit 0
}

# Configuration
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
if ($OutputDir -eq "") {
    $OutputDir = "cli-backups\$timestamp"
}

# Create output directory
Write-Host "🚀 Starting Supabase CLI backup..." -ForegroundColor Green
Write-Host "📁 Output directory: $OutputDir" -ForegroundColor Cyan

if (-not $DryRun) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Check if project is linked
Write-Host "🔗 Checking project link..." -ForegroundColor Cyan
$linkStatus = & supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Project not linked or Supabase not running locally" -ForegroundColor Yellow
    Write-Host "   Using remote database connection..." -ForegroundColor Yellow
}

# Define backup commands based on type
$commands = @()

switch ($BackupType.ToLower()) {
    "full" {
        $cmd = "supabase db dump --file `"$OutputDir\full-backup.sql`""
        Write-Host "📦 Creating full backup..." -ForegroundColor Green
    }
    "data" {
        $cmd = "supabase db dump --data-only --file `"$OutputDir\data-backup.sql`""
        Write-Host "📊 Creating data backup..." -ForegroundColor Green
    }
    "schema" {
        $cmd = "supabase db dump --file `"$OutputDir\schema-backup.sql`""
        Write-Host "🏗️ Creating schema backup..." -ForegroundColor Green
    }
    default {
        Write-Host "❌ Invalid backup type: $BackupType" -ForegroundColor Red
        Write-Host "   Valid types: full, data, schema" -ForegroundColor Yellow
        exit 1
    }
}

# Execute commands
$successCount = 0
$totalCommands = $commands.Count

foreach ($cmd in $commands) {
    Write-Host ""
    Write-Host "📤 Creating: $($cmd.Description)" -ForegroundColor Green
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] $($cmd.Command)" -ForegroundColor Yellow
        $successCount++
    } else {
        Write-Host "   Executing: $($cmd.Command)" -ForegroundColor Gray
        
        try {
            Invoke-Expression $cmd.Command
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Success: $($cmd.Name)" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "   ❌ Failed: $($cmd.Name)" -ForegroundColor Red
            }
        } catch {
            Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Create backup manifest
if (-not $DryRun) {
    $manifest = @{
        backup_created = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        backup_type = $BackupType
        cli_version = (& supabase --version 2>$null)
        success_count = $successCount
        total_commands = $totalCommands
        output_directory = $OutputDir
        files_created = $commands | ForEach-Object { $_.Name }
    }
    
    $manifestJson = $manifest | ConvertTo-Json -Depth 3
    $manifestPath = "$OutputDir\backup-manifest.json"
    $manifestJson | Out-File -FilePath $manifestPath -Encoding UTF8
    Write-Host "📋 Created manifest: backup-manifest.json" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "✅ Backup completed!" -ForegroundColor Green
Write-Host "📊 Success rate: $successCount/$totalCommands" -ForegroundColor Cyan
Write-Host "📁 Output: $OutputDir" -ForegroundColor Cyan

if ($successCount -lt $totalCommands) {
    Write-Host ""
    Write-Host "⚠️  Some operations failed. Check the output above for details." -ForegroundColor Yellow
    Write-Host "   Common issues:" -ForegroundColor Yellow
    Write-Host "   - Project not linked: Run 'supabase link --project-ref YOUR_PROJECT_REF'" -ForegroundColor Yellow
    Write-Host "   - Not logged in: Run 'supabase login'" -ForegroundColor Yellow
    Write-Host "   - Network issues: Check your internet connection" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 Next steps:" -ForegroundColor Yellow
Write-Host "   - Review backup files in: $OutputDir" -ForegroundColor Gray
Write-Host "   - Test restoration in a development environment" -ForegroundColor Gray
Write-Host "   - Schedule regular backups" -ForegroundColor Gray 