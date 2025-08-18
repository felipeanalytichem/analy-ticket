import { describe, it, expect } from 'vitest'
import {
  createDefaultNotificationPreferences,
  validateNotificationPreferences,
  transformToDbFormat,
  transformFromDbFormat,
  type NotificationPreferences,
  type NotificationPreferencesRow,
  type NotificationTypePreference
} from '../notifications'

describe('Notification Preferences Data Models', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000'

  describe('createDefaultNotificationPreferences', () => {
    it('should create default preferences with correct structure', () => {
      const defaults = createDefaultNotificationPreferences(mockUserId)

      expect(defaults.userId).toBe(mockUserId)
      expect(defaults.emailNotifications).toBe(true)
      expect(defaults.toastNotifications).toBe(true)
      expect(defaults.soundNotifications).toBe(false)
      expect(defaults.quietHours.enabled).toBe(false)
      expect(defaults.quietHours.start).toBe('22:00')
      expect(defaults.quietHours.end).toBe('08:00')
      expect(defaults.language).toBe('en')
      expect(defaults.timezone).toBeDefined()
    })

    it('should create preferences for all notification types', () => {
      const defaults = createDefaultNotificationPreferences(mockUserId)
      
      const expectedTypes = [
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

      expectedTypes.forEach(type => {
        expect(defaults.typePreferences[type as keyof typeof defaults.typePreferences]).toBeDefined()
        expect(defaults.typePreferences[type as keyof typeof defaults.typePreferences].enabled).toBe(true)
      })
    })

    it('should set high priority for SLA notifications', () => {
      const defaults = createDefaultNotificationPreferences(mockUserId)

      expect(defaults.typePreferences.sla_breach.priority).toBe('high')
      expect(defaults.typePreferences.sla_warning.priority).toBe('high')
      expect(defaults.typePreferences.ticket_created.priority).toBe('medium')
    })
  })

  describe('validateNotificationPreferences', () => {
    it('should return no errors for valid preferences', () => {
      const validPreferences: Partial<NotificationPreferences> = {
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '08:00'
        },
        language: 'en'
      }

      const errors = validateNotificationPreferences(validPreferences)
      expect(errors).toHaveLength(0)
    })

    it('should validate quiet hours time format', () => {
      const invalidPreferences: Partial<NotificationPreferences> = {
        quietHours: {
          enabled: true,
          start: '25:00', // Invalid hour
          end: '08:70'    // Invalid minute
        }
      }

      const errors = validateNotificationPreferences(invalidPreferences)
      expect(errors).toHaveLength(2)
      expect(errors[0]).toContain('Invalid quiet hours start time format')
      expect(errors[1]).toContain('Invalid quiet hours end time format')
    })

    it('should validate language support', () => {
      const invalidPreferences: Partial<NotificationPreferences> = {
        language: 'fr' // Unsupported language
      }

      const errors = validateNotificationPreferences(invalidPreferences)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('Unsupported language')
    })

    it('should accept valid time formats', () => {
      const validTimes = ['00:00', '12:30', '23:59', '09:15']
      
      validTimes.forEach(time => {
        const preferences: Partial<NotificationPreferences> = {
          quietHours: {
            enabled: true,
            start: time,
            end: time
          }
        }
        
        const errors = validateNotificationPreferences(preferences)
        expect(errors).toHaveLength(0)
      })
    })
  })

  describe('transformToDbFormat', () => {
    it('should transform API format to database format', () => {
      const apiPreferences = createDefaultNotificationPreferences(mockUserId)
      const dbFormat = transformToDbFormat(apiPreferences)

      expect(dbFormat.user_id).toBe(mockUserId)
      expect(dbFormat.email_notifications).toBe(apiPreferences.emailNotifications)
      expect(dbFormat.toast_notifications).toBe(apiPreferences.toastNotifications)
      expect(dbFormat.sound_notifications).toBe(apiPreferences.soundNotifications)
      expect(dbFormat.quiet_hours_enabled).toBe(apiPreferences.quietHours.enabled)
      expect(dbFormat.quiet_hours_start).toBe(apiPreferences.quietHours.start)
      expect(dbFormat.quiet_hours_end).toBe(apiPreferences.quietHours.end)
      expect(dbFormat.type_preferences).toEqual(apiPreferences.typePreferences)
      expect(dbFormat.language).toBe(apiPreferences.language)
      expect(dbFormat.timezone).toBe(apiPreferences.timezone)
    })
  })

  describe('transformFromDbFormat', () => {
    it('should transform database format to API format', () => {
      const mockTypePreferences: Record<string, NotificationTypePreference> = {
        ticket_created: { enabled: true, priority: 'medium', delivery: 'instant' },
        ticket_updated: { enabled: true, priority: 'medium', delivery: 'instant' }
      }

      const dbRow: NotificationPreferencesRow = {
        user_id: mockUserId,
        email_notifications: true,
        toast_notifications: false,
        sound_notifications: true,
        quiet_hours_enabled: true,
        quiet_hours_start: '23:00',
        quiet_hours_end: '07:00',
        type_preferences: mockTypePreferences as any,
        language: 'pt',
        timezone: 'America/Sao_Paulo',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      const apiFormat = transformFromDbFormat(dbRow)

      expect(apiFormat.userId).toBe(mockUserId)
      expect(apiFormat.emailNotifications).toBe(true)
      expect(apiFormat.toastNotifications).toBe(false)
      expect(apiFormat.soundNotifications).toBe(true)
      expect(apiFormat.quietHours.enabled).toBe(true)
      expect(apiFormat.quietHours.start).toBe('23:00')
      expect(apiFormat.quietHours.end).toBe('07:00')
      expect(apiFormat.typePreferences).toEqual(mockTypePreferences)
      expect(apiFormat.language).toBe('pt')
      expect(apiFormat.timezone).toBe('America/Sao_Paulo')
      expect(apiFormat.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(apiFormat.updatedAt).toBe('2024-01-02T00:00:00Z')
    })
  })

  describe('NotificationTypePreference', () => {
    it('should have correct structure', () => {
      const preference: NotificationTypePreference = {
        enabled: true,
        priority: 'high',
        delivery: 'batched'
      }

      expect(preference.enabled).toBe(true)
      expect(['low', 'medium', 'high']).toContain(preference.priority)
      expect(['instant', 'batched', 'digest']).toContain(preference.delivery)
    })
  })

  describe('QuietHours', () => {
    it('should handle edge cases for time validation', () => {
      const edgeCases = [
        { start: '24:00', end: '08:00', shouldFail: true },
        { start: '12:60', end: '08:00', shouldFail: true },
        { start: '12:30', end: '25:00', shouldFail: true },
        { start: '12:30', end: '08:60', shouldFail: true },
        { start: '0:00', end: '8:00', shouldFail: false }, // Leading zeros optional
        { start: '00:00', end: '08:00', shouldFail: false }
      ]

      edgeCases.forEach(({ start, end, shouldFail }) => {
        const preferences: Partial<NotificationPreferences> = {
          quietHours: { enabled: true, start, end }
        }
        
        const errors = validateNotificationPreferences(preferences)
        if (shouldFail) {
          expect(errors.length).toBeGreaterThan(0)
        } else {
          expect(errors).toHaveLength(0)
        }
      })
    })
  })

  describe('Integration with Database Types', () => {
    it('should be compatible with Supabase types', () => {
      const preferences = createDefaultNotificationPreferences(mockUserId)
      const dbFormat = transformToDbFormat(preferences)

      // Verify the structure matches what Supabase expects
      expect(typeof dbFormat.user_id).toBe('string')
      expect(typeof dbFormat.email_notifications).toBe('boolean')
      expect(typeof dbFormat.toast_notifications).toBe('boolean')
      expect(typeof dbFormat.sound_notifications).toBe('boolean')
      expect(typeof dbFormat.quiet_hours_enabled).toBe('boolean')
      expect(typeof dbFormat.quiet_hours_start).toBe('string')
      expect(typeof dbFormat.quiet_hours_end).toBe('string')
      expect(typeof dbFormat.type_preferences).toBe('object')
      expect(typeof dbFormat.language).toBe('string')
      expect(typeof dbFormat.timezone).toBe('string')
    })
  })
})