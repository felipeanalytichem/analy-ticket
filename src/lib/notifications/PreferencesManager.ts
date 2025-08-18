import { supabase } from '@/lib/supabase'
import {
  NotificationPreferences,
  NotificationPreferencesRow,
  NotificationPreferencesInsert,
  NotificationPreferencesUpdate,
  createDefaultNotificationPreferences,
  validateNotificationPreferences,
  transformToDbFormat,
  transformFromDbFormat,
  type NotificationType
} from '@/types/notifications'

export interface PreferencesManagerOptions {
  cacheTimeout?: number // Cache timeout in milliseconds
  enableCache?: boolean
}

export class PreferencesManager {
  private cache: Map<string, { preferences: NotificationPreferences; timestamp: number }> = new Map()
  private readonly cacheTimeout: number
  private readonly enableCache: boolean

  constructor(options: PreferencesManagerOptions = {}) {
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000 // 5 minutes default
    this.enableCache = options.enableCache !== false // enabled by default
  }

  /**
   * Get user notification preferences with caching
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      // Check cache first
      if (this.enableCache) {
        const cached = this.getCachedPreferences(userId)
        if (cached) {
          return cached
        }
      }

      // Try to get from database using the function
      const { data, error } = await supabase.rpc('get_user_notification_preferences', {
        user_uuid: userId
      })

      if (error) {
        console.error('Error fetching user preferences:', error)
        // Return defaults on error
        return createDefaultNotificationPreferences(userId)
      }

      if (!data || data.length === 0) {
        // No preferences found, return defaults
        const defaults = createDefaultNotificationPreferences(userId)
        
        // Try to create default preferences in database
        try {
          await this.createDefaultPreferences(userId)
        } catch (createError) {
          console.warn('Could not create default preferences:', createError)
        }
        
        return defaults
      }

      // Transform database format to API format
      const dbRow = data[0] as NotificationPreferencesRow
      const preferences = transformFromDbFormat(dbRow)

      // Cache the result
      if (this.enableCache) {
        this.setCachedPreferences(userId, preferences)
      }

      return preferences
    } catch (error) {
      console.error('Exception in getUserPreferences:', error)
      return createDefaultNotificationPreferences(userId)
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      // Validate the updates
      const validationErrors = validateNotificationPreferences(updates)
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`)
      }

      // Get current preferences to merge with updates
      const currentPreferences = await this.getUserPreferences(userId)
      const mergedPreferences = { ...currentPreferences, ...updates }

      // Transform to database format
      const dbFormat = transformToDbFormat(mergedPreferences)

      // Use the upsert function to update preferences
      const { data, error } = await supabase.rpc('upsert_user_notification_preferences', {
        user_uuid: userId,
        p_email_notifications: dbFormat.email_notifications,
        p_toast_notifications: dbFormat.toast_notifications,
        p_sound_notifications: dbFormat.sound_notifications,
        p_quiet_hours_enabled: dbFormat.quiet_hours_enabled,
        p_quiet_hours_start: dbFormat.quiet_hours_start,
        p_quiet_hours_end: dbFormat.quiet_hours_end,
        p_type_preferences: dbFormat.type_preferences as any,
        p_language: dbFormat.language,
        p_timezone: dbFormat.timezone
      })

      if (error) {
        console.error('Error updating user preferences:', error)
        throw new Error(`Failed to update preferences: ${error.message}`)
      }

      // Transform the result back to API format
      const updatedPreferences = transformFromDbFormat(data as NotificationPreferencesRow)

      // Update cache
      if (this.enableCache) {
        this.setCachedPreferences(userId, updatedPreferences)
      }

      return updatedPreferences
    } catch (error) {
      console.error('Exception in updateUserPreferences:', error)
      throw error
    }
  }

  /**
   * Check if user should receive a specific notification type
   */
  async shouldReceiveNotification(
    userId: string, 
    notificationType: NotificationType,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId)
      
      // Check if the notification type is enabled
      const typePreference = preferences.typePreferences[notificationType]
      if (!typePreference || !typePreference.enabled) {
        return false
      }

      // Check quiet hours if toast notifications are involved
      if (preferences.toastNotifications && this.isInQuietHours(preferences)) {
        // Allow high priority notifications during quiet hours
        if (priority !== 'high') {
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Error checking notification permission:', error)
      // Default to allowing notifications on error
      return true
    }
  }

  /**
   * Check if current time is within user's quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours.enabled) {
      return false
    }

    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5) // HH:mm format
    
    const { start, end } = preferences.quietHours

    // Handle cases where quiet hours span midnight
    if (start > end) {
      // e.g., 22:00 to 08:00 (spans midnight)
      return currentTime >= start || currentTime <= end
    } else {
      // e.g., 13:00 to 17:00 (same day)
      return currentTime >= start && currentTime <= end
    }
  }

  /**
   * Get notification delivery method for a user and notification type
   */
  async getDeliveryMethod(
    userId: string, 
    notificationType: NotificationType
  ): Promise<'instant' | 'batched' | 'digest'> {
    try {
      const preferences = await this.getUserPreferences(userId)
      const typePreference = preferences.typePreferences[notificationType]
      
      return typePreference?.delivery || 'instant'
    } catch (error) {
      console.error('Error getting delivery method:', error)
      return 'instant'
    }
  }

  /**
   * Sanitize and validate preference updates
   */
  private sanitizePreferences(preferences: Partial<NotificationPreferences>): Partial<NotificationPreferences> {
    const sanitized = { ...preferences }

    // Sanitize quiet hours
    if (sanitized.quietHours) {
      const { start, end } = sanitized.quietHours
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

      if (start && !timeRegex.test(start)) {
        delete sanitized.quietHours.start
      }
      if (end && !timeRegex.test(end)) {
        delete sanitized.quietHours.end
      }
    }

    // Sanitize language
    if (sanitized.language && !['en', 'pt', 'es'].includes(sanitized.language)) {
      delete sanitized.language
    }

    // Sanitize type preferences
    if (sanitized.typePreferences) {
      Object.keys(sanitized.typePreferences).forEach(type => {
        const preference = sanitized.typePreferences![type as NotificationType]
        if (preference) {
          // Ensure valid priority values
          if (!['low', 'medium', 'high'].includes(preference.priority)) {
            preference.priority = 'medium'
          }
          // Ensure valid delivery values
          if (!['instant', 'batched', 'digest'].includes(preference.delivery)) {
            preference.delivery = 'instant'
          }
        }
      })
    }

    return sanitized
  }

  /**
   * Create default preferences for a new user
   */
  private async createDefaultPreferences(userId: string): Promise<void> {
    const defaults = createDefaultNotificationPreferences(userId)
    const dbFormat = transformToDbFormat(defaults)

    const { error } = await supabase
      .from('notification_preferences')
      .insert(dbFormat)

    if (error) {
      console.error('Error creating default preferences:', error)
      throw error
    }
  }

  /**
   * Cache management methods
   */
  private getCachedPreferences(userId: string): NotificationPreferences | null {
    if (!this.enableCache) return null

    const cached = this.cache.get(userId)
    if (!cached) return null

    const isExpired = Date.now() - cached.timestamp > this.cacheTimeout
    if (isExpired) {
      this.cache.delete(userId)
      return null
    }

    return cached.preferences
  }

  private setCachedPreferences(userId: string, preferences: NotificationPreferences): void {
    if (!this.enableCache) return

    this.cache.set(userId, {
      preferences,
      timestamp: Date.now()
    })
  }

  /**
   * Clear cache for a specific user or all users
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size
    }
  }

  /**
   * Bulk update preferences for multiple users (admin function)
   */
  async bulkUpdatePreferences(
    updates: Array<{ userId: string; preferences: Partial<NotificationPreferences> }>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] }

    for (const update of updates) {
      try {
        await this.updateUserPreferences(update.userId, update.preferences)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push(`User ${update.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return results
  }

  /**
   * Get preferences for multiple users (admin function)
   */
  async getBulkPreferences(userIds: string[]): Promise<Record<string, NotificationPreferences>> {
    const preferences: Record<string, NotificationPreferences> = {}

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          preferences[userId] = await this.getUserPreferences(userId)
        } catch (error) {
          console.error(`Error getting preferences for user ${userId}:`, error)
          preferences[userId] = createDefaultNotificationPreferences(userId)
        }
      })
    )

    return preferences
  }

  /**
   * Reset user preferences to defaults
   */
  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    const defaults = createDefaultNotificationPreferences(userId)
    return await this.updateUserPreferences(userId, defaults)
  }

  /**
   * Export user preferences (for data portability)
   */
  async exportPreferences(userId: string): Promise<string> {
    const preferences = await this.getUserPreferences(userId)
    return JSON.stringify(preferences, null, 2)
  }

  /**
   * Import user preferences (for data portability)
   */
  async importPreferences(userId: string, preferencesJson: string): Promise<NotificationPreferences> {
    try {
      const preferences = JSON.parse(preferencesJson) as Partial<NotificationPreferences>
      
      // Validate the imported preferences
      const validationErrors = validateNotificationPreferences(preferences)
      if (validationErrors.length > 0) {
        throw new Error(`Invalid preferences format: ${validationErrors.join(', ')}`)
      }

      return await this.updateUserPreferences(userId, preferences)
    } catch (error) {
      console.error('Error importing preferences:', error)
      throw new Error('Failed to import preferences: Invalid format or data')
    }
  }
}

// Export singleton instance
export const preferencesManager = new PreferencesManager()