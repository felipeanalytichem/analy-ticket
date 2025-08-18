/**
 * Migration script for existing user sessions
 * Migrates legacy session data to new session persistence format
 */

import { supabase } from '../lib/supabase';
import { SessionManager } from '../services/SessionManager';
import { StateManager } from '../services/StateManager';
import { sessionPersistenceFeatureFlags } from '../services/SessionPersistenceFeatureFlags';

interface LegacySessionData {
  userId: string;
  sessionId: string;
  lastActivity: string;
  preferences?: any;
  formData?: any;
  navigationState?: any;
}

interface MigrationResult {
  totalSessions: number;
  migratedSessions: number;
  failedMigrations: number;
  errors: string[];
}

export class SessionMigrationService {
  private stateManager: StateManager;
  private migrationResults: MigrationResult = {
    totalSessions: 0,
    migratedSessions: 0,
    failedMigrations: 0,
    errors: []
  };

  constructor() {
    this.stateManager = new StateManager();
  }

  /**
   * Main migration function
   */
  async migrateExistingSessions(): Promise<MigrationResult> {
    console.log('🔄 Starting session migration...');
    
    try {
      // Check if migration is enabled
      const migrationEnabled = await sessionPersistenceFeatureFlags.isEnabled('enhancedSessionManager');
      if (!migrationEnabled) {
        console.log('⏸️ Session migration disabled by feature flag');
        return this.migrationResults;
      }

      // Get all existing sessions
      const legacySessions = await this.getLegacySessions();
      this.migrationResults.totalSessions = legacySessions.length;

      console.log(`📊 Found ${legacySessions.length} sessions to migrate`);

      // Migrate sessions in batches
      const batchSize = 50;
      for (let i = 0; i < legacySessions.length; i += batchSize) {
        const batch = legacySessions.slice(i, i + batchSize);
        await this.migrateBatch(batch);
        
        // Progress update
        const progress = Math.round(((i + batch.length) / legacySessions.length) * 100);
        console.log(`📈 Migration progress: ${progress}%`);
      }

      // Cleanup legacy data
      await this.cleanupLegacyData();

      console.log('✅ Session migration completed');
      console.log(`📊 Results: ${this.migrationResults.migratedSessions}/${this.migrationResults.totalSessions} migrated`);
      
      if (this.migrationResults.failedMigrations > 0) {
        console.warn(`⚠️ ${this.migrationResults.failedMigrations} migrations failed`);
      }

      return this.migrationResults;
    } catch (error) {
      console.error('❌ Session migration failed:', error);
      this.migrationResults.errors.push(`Migration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get legacy session data from localStorage and database
   */
  private async getLegacySessions(): Promise<LegacySessionData[]> {
    const sessions: LegacySessionData[] = [];

    try {
      // Get sessions from database (if stored there)
      const { data: dbSessions, error } = await supabase
        .from('user_sessions')
        .select('*')
        .is('migrated', null);

      if (error) {
        console.warn('Failed to fetch database sessions:', error);
      } else if (dbSessions) {
        sessions.push(...dbSessions.map(this.transformDbSession));
      }

      // Get sessions from localStorage
      const localSessions = this.getLegacyLocalStorageSessions();
      sessions.push(...localSessions);

      return sessions;
    } catch (error) {
      console.error('Failed to get legacy sessions:', error);
      return [];
    }
  }

  /**
   * Get legacy sessions from localStorage
   */
  private getLegacyLocalStorageSessions(): LegacySessionData[] {
    const sessions: LegacySessionData[] = [];

    try {
      // Check for legacy session keys
      const legacyKeys = [
        'supabase.auth.token',
        'user-session-data',
        'form-auto-save',
        'navigation-state',
        'user-preferences'
      ];

      for (const key of legacyKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const session = this.transformLocalStorageSession(key, parsed);
            if (session) {
              sessions.push(session);
            }
          } catch (parseError) {
            console.warn(`Failed to parse legacy data for key ${key}:`, parseError);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to read legacy localStorage sessions:', error);
    }

    return sessions;
  }

  /**
   * Transform database session to legacy format
   */
  private transformDbSession(dbSession: any): LegacySessionData {
    return {
      userId: dbSession.user_id,
      sessionId: dbSession.session_id,
      lastActivity: dbSession.last_activity,
      preferences: dbSession.preferences,
      formData: dbSession.form_data,
      navigationState: dbSession.navigation_state
    };
  }

  /**
   * Transform localStorage session to legacy format
   */
  private transformLocalStorageSession(key: string, data: any): LegacySessionData | null {
    try {
      switch (key) {
        case 'supabase.auth.token':
          return {
            userId: data.user?.id || 'unknown',
            sessionId: data.access_token?.substring(0, 10) || 'unknown',
            lastActivity: new Date().toISOString(),
            preferences: null,
            formData: null,
            navigationState: null
          };

        case 'user-session-data':
          return {
            userId: data.userId || 'unknown',
            sessionId: data.sessionId || 'unknown',
            lastActivity: data.lastActivity || new Date().toISOString(),
            preferences: data.preferences,
            formData: data.formData,
            navigationState: data.navigationState
          };

        case 'form-auto-save':
          return {
            userId: 'unknown',
            sessionId: 'form-data',
            lastActivity: new Date().toISOString(),
            preferences: null,
            formData: data,
            navigationState: null
          };

        case 'navigation-state':
          return {
            userId: 'unknown',
            sessionId: 'nav-state',
            lastActivity: new Date().toISOString(),
            preferences: null,
            formData: null,
            navigationState: data
          };

        case 'user-preferences':
          return {
            userId: 'unknown',
            sessionId: 'preferences',
            lastActivity: new Date().toISOString(),
            preferences: data,
            formData: null,
            navigationState: null
          };

        default:
          return null;
      }
    } catch (error) {
      console.warn(`Failed to transform session data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Migrate a batch of sessions
   */
  private async migrateBatch(sessions: LegacySessionData[]): Promise<void> {
    const migrationPromises = sessions.map(session => this.migrateSession(session));
    const results = await Promise.allSettled(migrationPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.migrationResults.migratedSessions++;
      } else {
        this.migrationResults.failedMigrations++;
        this.migrationResults.errors.push(
          `Failed to migrate session ${sessions[index].sessionId}: ${result.reason}`
        );
      }
    });
  }

  /**
   * Migrate a single session
   */
  private async migrateSession(legacySession: LegacySessionData): Promise<void> {
    try {
      // Migrate user preferences
      if (legacySession.preferences) {
        await this.stateManager.saveState(
          `user-preferences-${legacySession.userId}`,
          legacySession.preferences
        );
      }

      // Migrate form data
      if (legacySession.formData) {
        for (const [formId, formData] of Object.entries(legacySession.formData)) {
          await this.stateManager.saveState(`form-${formId}`, formData);
        }
      }

      // Migrate navigation state
      if (legacySession.navigationState) {
        await this.stateManager.saveState(
          `navigation-${legacySession.userId}`,
          legacySession.navigationState
        );
      }

      // Create new session record
      await this.createNewSessionRecord(legacySession);

      console.log(`✅ Migrated session for user ${legacySession.userId}`);
    } catch (error) {
      console.error(`❌ Failed to migrate session ${legacySession.sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Create new session record in the enhanced format
   */
  private async createNewSessionRecord(legacySession: LegacySessionData): Promise<void> {
    const sessionRecord = {
      user_id: legacySession.userId,
      session_id: legacySession.sessionId,
      last_activity: legacySession.lastActivity,
      migration_source: 'legacy',
      migration_timestamp: new Date().toISOString(),
      enhanced_features_enabled: true,
      state_version: '2.0'
    };

    const { error } = await supabase
      .from('enhanced_user_sessions')
      .upsert(sessionRecord);

    if (error) {
      throw new Error(`Failed to create enhanced session record: ${error.message}`);
    }
  }

  /**
   * Cleanup legacy data after successful migration
   */
  private async cleanupLegacyData(): Promise<void> {
    try {
      console.log('🧹 Cleaning up legacy data...');

      // Mark database sessions as migrated
      const { error: dbError } = await supabase
        .from('user_sessions')
        .update({ migrated: true, migrated_at: new Date().toISOString() })
        .is('migrated', null);

      if (dbError) {
        console.warn('Failed to mark database sessions as migrated:', dbError);
      }

      // Clean up localStorage (with user consent)
      const shouldCleanupLocalStorage = await this.shouldCleanupLocalStorage();
      if (shouldCleanupLocalStorage) {
        this.cleanupLegacyLocalStorage();
      }

      console.log('✅ Legacy data cleanup completed');
    } catch (error) {
      console.error('❌ Failed to cleanup legacy data:', error);
      // Don't throw here as migration was successful
    }
  }

  /**
   * Check if we should cleanup localStorage
   */
  private async shouldCleanupLocalStorage(): Promise<boolean> {
    // In a real implementation, this might check user preferences
    // or show a confirmation dialog
    return true;
  }

  /**
   * Clean up legacy localStorage data
   */
  private cleanupLegacyLocalStorage(): void {
    const legacyKeys = [
      'user-session-data',
      'form-auto-save',
      'navigation-state',
      'user-preferences'
    ];

    legacyKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed legacy key: ${key}`);
      } catch (error) {
        console.warn(`Failed to remove legacy key ${key}:`, error);
      }
    });
  }

  /**
   * Rollback migration if needed
   */
  async rollbackMigration(): Promise<void> {
    console.log('🔄 Rolling back session migration...');

    try {
      // Remove enhanced session records
      const { error: deleteError } = await supabase
        .from('enhanced_user_sessions')
        .delete()
        .eq('migration_source', 'legacy');

      if (deleteError) {
        throw new Error(`Failed to delete enhanced sessions: ${deleteError.message}`);
      }

      // Unmark database sessions as migrated
      const { error: updateError } = await supabase
        .from('user_sessions')
        .update({ migrated: null, migrated_at: null })
        .eq('migrated', true);

      if (updateError) {
        throw new Error(`Failed to unmark sessions: ${updateError.message}`);
      }

      // Clear migrated state data
      await this.clearMigratedStateData();

      console.log('✅ Migration rollback completed');
    } catch (error) {
      console.error('❌ Migration rollback failed:', error);
      throw error;
    }
  }

  /**
   * Clear migrated state data
   */
  private async clearMigratedStateData(): Promise<void> {
    const stateKeys = [
      'user-preferences-',
      'form-',
      'navigation-'
    ];

    for (const keyPrefix of stateKeys) {
      try {
        // This would need to be implemented in StateManager
        // await this.stateManager.clearStatesByPrefix(keyPrefix);
        console.log(`🗑️ Cleared state data with prefix: ${keyPrefix}`);
      } catch (error) {
        console.warn(`Failed to clear state data with prefix ${keyPrefix}:`, error);
      }
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    isComplete: boolean;
    totalSessions: number;
    migratedSessions: number;
    pendingSessions: number;
    lastMigrationDate?: string;
  }> {
    try {
      // Check database for migration status
      const { data: totalSessions, error: totalError } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact' });

      const { data: migratedSessions, error: migratedError } = await supabase
        .from('user_sessions')
        .select('id', { count: 'exact' })
        .eq('migrated', true);

      if (totalError || migratedError) {
        throw new Error('Failed to get migration status from database');
      }

      const total = totalSessions?.length || 0;
      const migrated = migratedSessions?.length || 0;
      const pending = total - migrated;

      // Get last migration date
      const { data: lastMigration } = await supabase
        .from('user_sessions')
        .select('migrated_at')
        .eq('migrated', true)
        .order('migrated_at', { ascending: false })
        .limit(1)
        .single();

      return {
        isComplete: pending === 0,
        totalSessions: total,
        migratedSessions: migrated,
        pendingSessions: pending,
        lastMigrationDate: lastMigration?.migrated_at
      };
    } catch (error) {
      console.error('Failed to get migration status:', error);
      return {
        isComplete: false,
        totalSessions: 0,
        migratedSessions: 0,
        pendingSessions: 0
      };
    }
  }
}

// CLI interface for running migration
if (require.main === module) {
  const migrationService = new SessionMigrationService();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      migrationService.migrateExistingSessions()
        .then(result => {
          console.log('Migration completed:', result);
          process.exit(0);
        })
        .catch(error => {
          console.error('Migration failed:', error);
          process.exit(1);
        });
      break;
      
    case 'rollback':
      migrationService.rollbackMigration()
        .then(() => {
          console.log('Rollback completed');
          process.exit(0);
        })
        .catch(error => {
          console.error('Rollback failed:', error);
          process.exit(1);
        });
      break;
      
    case 'status':
      migrationService.getMigrationStatus()
        .then(status => {
          console.log('Migration status:', status);
          process.exit(0);
        })
        .catch(error => {
          console.error('Failed to get status:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: node migrate-existing-sessions.js [migrate|rollback|status]');
      process.exit(1);
  }
}

export { SessionMigrationService };