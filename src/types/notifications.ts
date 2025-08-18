import { Database } from '@/integrations/supabase/types'

// Extract notification types from database
export type NotificationType = Database['public']['Enums']['notification_type']
export type NotificationPriority = Database['public']['Enums']['notification_priority']

// Notification preferences interfaces
export interface NotificationTypePreference {
  enabled: boolean
  priority: 'low' | 'medium' | 'high'
  delivery: 'instant' | 'batched' | 'digest'
}

export interface QuietHours {
  enabled: boolean
  start: string // HH:mm format
  end: string   // HH:mm format
}

export interface NotificationPreferences {
  userId: string
  emailNotifications: boolean
  toastNotifications: boolean
  soundNotifications: boolean
  quietHours: QuietHours
  typePreferences: {
    [key in NotificationType]: NotificationTypePreference
  }
  language: string
  timezone: string
  createdAt?: string
  updatedAt?: string
}

// Database row type for notification_preferences table
export interface NotificationPreferencesRow {
  user_id: string
  email_notifications: boolean
  toast_notifications: boolean
  sound_notifications: boolean
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  type_preferences: Record<NotificationType, NotificationTypePreference>
  language: string
  timezone: string
  created_at: string
  updated_at: string
}

// Insert type for notification_preferences table
export interface NotificationPreferencesInsert {
  user_id: string
  email_notifications?: boolean
  toast_notifications?: boolean
  sound_notifications?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  type_preferences?: Record<NotificationType, NotificationTypePreference>
  language?: string
  timezone?: string
}

// Update type for notification_preferences table
export interface NotificationPreferencesUpdate {
  email_notifications?: boolean
  toast_notifications?: boolean
  sound_notifications?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  type_preferences?: Record<NotificationType, NotificationTypePreference>
  language?: string
  timezone?: string
  updated_at?: string
}

// Default preferences factory
export const createDefaultNotificationPreferences = (userId: string): NotificationPreferences => {
  const defaultTypePreference: NotificationTypePreference = {
    enabled: true,
    priority: 'medium',
    delivery: 'instant'
  }

  const typePreferences = {} as Record<NotificationType, NotificationTypePreference>
  
  // Set defaults for all notification types
  const notificationTypes: NotificationType[] = [
    'ticket_created',
    'ticket_updated', 
    'ticket_assigned',
    'comment_added',
    'status_changed',
    'priority_changed',
    'assignment_changed',
    'sla_warning',
    'sla_breach'
  ]

  notificationTypes.forEach(type => {
    typePreferences[type] = { ...defaultTypePreference }
  })

  // Set higher priority for critical notifications
  typePreferences.sla_breach = {
    enabled: true,
    priority: 'high',
    delivery: 'instant'
  }

  typePreferences.sla_warning = {
    enabled: true,
    priority: 'high', 
    delivery: 'instant'
  }

  return {
    userId,
    emailNotifications: true,
    toastNotifications: true,
    soundNotifications: false,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    typePreferences,
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

// Utility functions for preference validation
export const validateNotificationPreferences = (preferences: Partial<NotificationPreferences>): string[] => {
  const errors: string[] = []

  if (preferences.quietHours) {
    const { start, end } = preferences.quietHours
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

    if (start && !timeRegex.test(start)) {
      errors.push('Invalid quiet hours start time format. Use HH:mm format.')
    }

    if (end && !timeRegex.test(end)) {
      errors.push('Invalid quiet hours end time format. Use HH:mm format.')
    }
  }

  if (preferences.language && !['en', 'pt', 'es'].includes(preferences.language)) {
    errors.push('Unsupported language. Supported languages: en, pt, es')
  }

  return errors
}

// Transform functions between API and database formats
export const transformToDbFormat = (preferences: NotificationPreferences): NotificationPreferencesInsert => {
  return {
    user_id: preferences.userId,
    email_notifications: preferences.emailNotifications,
    toast_notifications: preferences.toastNotifications,
    sound_notifications: preferences.soundNotifications,
    quiet_hours_enabled: preferences.quietHours.enabled,
    quiet_hours_start: preferences.quietHours.start,
    quiet_hours_end: preferences.quietHours.end,
    type_preferences: preferences.typePreferences,
    language: preferences.language,
    timezone: preferences.timezone
  }
}

export const transformFromDbFormat = (row: NotificationPreferencesRow): NotificationPreferences => {
  return {
    userId: row.user_id,
    emailNotifications: row.email_notifications,
    toastNotifications: row.toast_notifications,
    soundNotifications: row.sound_notifications,
    quietHours: {
      enabled: row.quiet_hours_enabled,
      start: row.quiet_hours_start,
      end: row.quiet_hours_end
    },
    typePreferences: row.type_preferences,
    language: row.language,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}