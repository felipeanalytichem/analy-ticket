@echo off
echo Organizing MD and SQL files...

:: Move SQL Migration Files
move "add-employee-onboarding-fields.sql" "database-scripts\migrations\" 2>nul
move "add-todo-columns.sql" "database-scripts\migrations\" 2>nul
move "create-categories-tables.sql" "database-scripts\migrations\" 2>nul
move "create-onboarding-guides-fixed.sql" "database-scripts\migrations\" 2>nul
move "create-onboarding-guides-minimal.sql" "database-scripts\migrations\" 2>nul
move "create-onboarding-guides-simple.sql" "database-scripts\migrations\" 2>nul
move "create-onboarding-guides.sql" "database-scripts\migrations\" 2>nul
move "create-reactions-table.sql" "database-scripts\migrations\" 2>nul
move "apply-categories-migration.sql" "database-scripts\migrations\" 2>nul

:: Move SQL Fix Files
move "APPLY_FORM_MIGRATION_FIX.sql" "database-scripts\fixes\" 2>nul
move "APPLY_THIS_IN_SUPABASE.sql" "database-scripts\fixes\" 2>nul
move "APPLY_TICKET_ATTACHMENTS_FIX.sql" "database-scripts\fixes\" 2>nul
move "APPLY_TICKET_NUMBER_FIX.sql" "database-scripts\fixes\" 2>nul
move "fix-*.sql" "database-scripts\fixes\" 2>nul
move "force-*.sql" "database-scripts\fixes\" 2>nul
move "emergency_*.sql" "database-scripts\fixes\" 2>nul
move "final-*.sql" "database-scripts\fixes\" 2>nul
move "definitive-*.sql" "database-scripts\fixes\" 2>nul
move "comprehensive-*.sql" "database-scripts\fixes\" 2>nul
move "ULTIMATE_*.sql" "database-scripts\fixes\" 2>nul
move "URGENT_*.sql" "database-scripts\fixes\" 2>nul
move "supabase-*.sql" "database-scripts\fixes\" 2>nul
move "migrate-*.sql" "database-scripts\fixes\" 2>nul

:: Move SQL Backup Files
move "database-backup.sql" "database-scripts\backups\" 2>nul
move "full-backup.sql" "database-scripts\backups\" 2>nul

:: Move SQL Diagnostic Files  
move "check-*.sql" "database-scripts\fixes\" 2>nul
move "diagnose-*.sql" "database-scripts\fixes\" 2>nul
move "debug-*.sql" "database-scripts\fixes\" 2>nul
move "clear-*.sql" "database-scripts\fixes\" 2>nul
move "cp_schema.sql" "database-scripts\fixes\" 2>nul

:: Move Documentation - Setup Guides
move "*_SETUP_*.md" "documentation\guides\" 2>nul
move "*_GUIDE.md" "documentation\guides\" 2>nul
move "*BACKUP*.md" "documentation\guides\" 2>nul
move "backup-setup.md" "documentation\guides\" 2>nul

:: Move Documentation - Fix Reports
move "*_FIX*.md" "documentation\fixes\" 2>nul
move "*_FIXES*.md" "documentation\fixes\" 2>nul
move "*ERRORS*.md" "documentation\fixes\" 2>nul
move "*NOTIFICATIONS*.md" "documentation\fixes\" 2>nul

:: Move Documentation - Implementation 
move "*IMPLEMENTATION*.md" "documentation\implementation\" 2>nul
move "*MIGRATION*.md" "documentation\implementation\" 2>nul
move "*WORKING*.md" "documentation\implementation\" 2>nul
move "*COMPLETE*.md" "documentation\implementation\" 2>nul
move "*SUMMARY*.md" "documentation\implementation\" 2>nul

:: Move Script Files to Legacy
move "apply-*.mjs" "legacy-scripts\" 2>nul
move "execute-*.mjs" "legacy-scripts\" 2>nul
move "final-*.mjs" "legacy-scripts\" 2>nul
move "direct-*.mjs" "legacy-scripts\" 2>nul
move "restore-*.mjs" "legacy-scripts\" 2>nul
move "check-*.mjs" "legacy-scripts\" 2>nul
move "pg-test.mjs" "legacy-scripts\" 2>nul
move "apply-*.js" "legacy-scripts\" 2>nul
move "deploy-*.js" "legacy-scripts\" 2>nul
move "deploy-*.cjs" "legacy-scripts\" 2>nul
move "restore-*.js" "legacy-scripts\" 2>nul
move "verify-*.js" "legacy-scripts\" 2>nul
move "update-*.js" "legacy-scripts\" 2>nul
move "run-*.js" "legacy-scripts\" 2>nul
move "test-*.js" "legacy-scripts\" 2>nul
move "test-*.ts" "legacy-scripts\" 2>nul
move "test-*.html" "legacy-scripts\" 2>nul

echo File organization complete!
echo.
echo Organized into:
echo - database-scripts\migrations\ (SQL creation and migration files)
echo - database-scripts\fixes\ (SQL fix and diagnostic files)  
echo - database-scripts\backups\ (SQL backup files)
echo - documentation\guides\ (Setup and backup guides)
echo - documentation\fixes\ (Fix documentation)
echo - documentation\implementation\ (Implementation documentation)
echo - legacy-scripts\ (JavaScript/TypeScript helper scripts) 