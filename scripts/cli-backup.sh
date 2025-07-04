#!/bin/bash

# Supabase CLI Database Backup Script (Bash)
# Cross-platform backup script using official Supabase CLI

set -e  # Exit on any error

# Default values
BACKUP_TYPE=${1:-"full"}
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_DIR="cli-backups/$TIMESTAMP"
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Help function
show_help() {
    echo -e "${GREEN}Supabase CLI Backup Script${NC}"
    echo ""
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./scripts/cli-backup.sh [options]"
    echo ""
    echo -e "${YELLOW}Options:${NC}"
    echo "  -t, --type      Backup type: 'full', 'data', 'schema' (default: full)"
    echo "  -o, --output    Custom output directory (default: cli-backups/timestamp)"
    echo "  -d, --dry-run   Show commands without executing"
    echo "  -v, --verbose   Enable verbose output"
    echo "  -h, --help      Show this help message"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./scripts/cli-backup.sh                    # Full backup"
    echo "  ./scripts/cli-backup.sh -t data            # Data only"
    echo "  ./scripts/cli-backup.sh -d                 # Preview commands"
    echo "  ./scripts/cli-backup.sh -o my-backup       # Custom directory"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Set default output directory if not provided
if [ -z "$OUTPUT_DIR" ]; then
    TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
    OUTPUT_DIR="cli-backups/$TIMESTAMP"
fi

# Logging function
log() {
    echo -e "$1"
    if [ "$VERBOSE" = true ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$OUTPUT_DIR/backup.log"
    fi
}

# Check if Supabase CLI is installed
check_cli() {
    if ! command -v supabase &> /dev/null; then
        log "${RED}❌ Supabase CLI not found${NC}"
        log "${YELLOW}   Install it from: https://supabase.com/docs/guides/cli${NC}"
        exit 1
    fi
    
    CLI_VERSION=$(supabase --version 2>/dev/null || echo "unknown")
    log "${CYAN}🔧 Supabase CLI version: $CLI_VERSION${NC}"
}

# Check project status
check_project() {
    log "${CYAN}🔗 Checking project status...${NC}"
    
    if supabase status >/dev/null 2>&1; then
        log "${GREEN}✅ Local project running${NC}"
    else
        log "${YELLOW}⚠️  Local project not running, will connect to remote${NC}"
    fi
}

# Create backup directory
create_directory() {
    if [ "$DRY_RUN" = false ]; then
        mkdir -p "$OUTPUT_DIR"
        log "${GREEN}📁 Created backup directory: $OUTPUT_DIR${NC}"
        
        if [ "$VERBOSE" = true ]; then
            touch "$OUTPUT_DIR/backup.log"
        fi
    else
        log "${YELLOW}[DRY RUN] Would create directory: $OUTPUT_DIR${NC}"
    fi
}

# Execute backup command
execute_backup() {
    local cmd="$1"
    local description="$2"
    local filename="$3"
    
    log "${GREEN}📤 $description${NC}"
    
    if [ "$DRY_RUN" = true ]; then
        log "${YELLOW}[DRY RUN] $cmd${NC}"
        return 0
    fi
    
    if [ "$VERBOSE" = true ]; then
        log "${BLUE}   Executing: $cmd${NC}"
    fi
    
    if eval "$cmd"; then
        if [ -f "$OUTPUT_DIR/$filename" ]; then
            FILE_SIZE=$(du -h "$OUTPUT_DIR/$filename" | cut -f1)
            log "${GREEN}   ✅ Success: $filename ($FILE_SIZE)${NC}"
            return 0
        else
            log "${RED}   ❌ File not created: $filename${NC}"
            return 1
        fi
    else
        log "${RED}   ❌ Command failed: $description${NC}"
        return 1
    fi
}

# Create backup manifest
create_manifest() {
    if [ "$DRY_RUN" = false ]; then
        local manifest_file="$OUTPUT_DIR/backup-manifest.json"
        cat > "$manifest_file" << EOF
{
  "backup_created": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "backup_type": "$BACKUP_TYPE",
  "cli_version": "$CLI_VERSION",
  "output_directory": "$OUTPUT_DIR",
  "platform": "$(uname -s)",
  "success_count": $SUCCESS_COUNT,
  "total_commands": $TOTAL_COMMANDS,
  "files_created": [
EOF

        # Add file list
        local files=($(ls "$OUTPUT_DIR"/*.sql 2>/dev/null || true))
        for i in "${!files[@]}"; do
            echo "    \"$(basename "${files[$i]}")\"" >> "$manifest_file"
            if [ $i -lt $((${#files[@]} - 1)) ]; then
                echo "," >> "$manifest_file"
            fi
        done

        cat >> "$manifest_file" << EOF
  ]
}
EOF
        log "${GREEN}📋 Created manifest: backup-manifest.json${NC}"
    fi
}

# Main backup function
run_backup() {
    local success_count=0
    local total_commands=0
    
    case "$BACKUP_TYPE" in
        "full")
            log "${CYAN}📦 Preparing full backup (schema + data)...${NC}"
            
            # Full backup
            if execute_backup "supabase db dump --file \"$OUTPUT_DIR/full-backup.sql\" --keep-comments" \
                             "Creating complete backup" "full-backup.sql"; then
                ((success_count++))
            fi
            ((total_commands++))
            
            # Data only backup
            if execute_backup "supabase db dump --data-only --file \"$OUTPUT_DIR/data-only.sql\" --use-copy" \
                             "Creating data-only backup" "data-only.sql"; then
                ((success_count++))
            fi
            ((total_commands++))
            
            # Schema only backup (attempt different approaches)
            if execute_backup "supabase db dump --file \"$OUTPUT_DIR/schema-only.sql\"" \
                             "Creating schema-only backup" "schema-only.sql"; then
                ((success_count++))
            fi
            ((total_commands++))
            ;;
            
        "data")
            log "${CYAN}📊 Preparing data-only backup...${NC}"
            if execute_backup "supabase db dump --data-only --file \"$OUTPUT_DIR/data-backup.sql\" --use-copy" \
                             "Creating data backup" "data-backup.sql"; then
                ((success_count++))
            fi
            ((total_commands++))
            ;;
            
        "schema")
            log "${CYAN}🏗️ Preparing schema-only backup...${NC}"
            if execute_backup "supabase db dump --file \"$OUTPUT_DIR/schema-backup.sql\"" \
                             "Creating schema backup" "schema-backup.sql"; then
                ((success_count++))
            fi
            ((total_commands++))
            ;;
            
        *)
            log "${RED}❌ Invalid backup type: $BACKUP_TYPE${NC}"
            log "${YELLOW}   Valid types: full, data, schema${NC}"
            exit 1
            ;;
    esac
    
    SUCCESS_COUNT=$success_count
    TOTAL_COMMANDS=$total_commands
}

# Main execution
main() {
    log "${GREEN}🚀 Starting Supabase CLI backup...${NC}"
    log "${CYAN}📁 Output directory: $OUTPUT_DIR${NC}"
    log "${CYAN}📦 Backup type: $BACKUP_TYPE${NC}"
    
    check_cli
    check_project
    create_directory
    run_backup
    create_manifest
    
    # Summary
    echo ""
    log "${GREEN}✅ Backup completed!${NC}"
    log "${CYAN}📊 Success rate: $SUCCESS_COUNT/$TOTAL_COMMANDS${NC}"
    log "${CYAN}📁 Output: $OUTPUT_DIR${NC}"
    
    if [ $SUCCESS_COUNT -lt $TOTAL_COMMANDS ]; then
        echo ""
        log "${YELLOW}⚠️  Some operations failed. Common issues:${NC}"
        log "${YELLOW}   - Project not linked: Run 'supabase link --project-ref YOUR_PROJECT_REF'${NC}"
        log "${YELLOW}   - Not logged in: Run 'supabase login'${NC}"
        log "${YELLOW}   - Network issues: Check your internet connection${NC}"
    fi
    
    echo ""
    log "${YELLOW}📚 Next steps:${NC}"
    log "   - Review backup files in: $OUTPUT_DIR"
    log "   - Test restoration in a development environment"
    log "   - Schedule regular backups"
}

# Run main function
main "$@" 