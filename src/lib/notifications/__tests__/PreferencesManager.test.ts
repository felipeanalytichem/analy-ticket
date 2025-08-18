import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PreferencesManager } from '../PreferencesManager'
import { createDefaultNotificationPreferences, type NotificationPreferences } from '@/types/notifications'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      insert: vi.fn()
    }))
  }
}))

import { supabase } from '@/lib/supabase'
const mockSupabase = supabase as any

describe('PreferencesManager', () => {
  let preferencesManager: PreferencesManager
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    preferencesManager = new PreferencesManager({ enableCache: false }) // Disable cache for testing
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getUserPreferences', () => {
    it('should return user preferences from database', async () => {
      const mockDbRow = {
        user_id: mockUserId,
        email_notifications: true,
        toast_notifications: false,
        sound_notifications: true,
        quiet_hours_enabled: true,
        quiet_hours_start: '23:00',
        quiet_hours_end: '07:00',
        type_preferences: {
          ticket_created: { enabled: true, priority: 'high', delivery: 'instant' }
        },
        language: 'pt',
        timezone: 'America/Sao_Paulo',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValue({ data: [mockDbRow], error: null })

      const preferences = await preferencesManager.getUserPreferences(mockUserId)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_notification_preferences', {
        user_uuid: mockUserId
      })
      expect(preferences.userId).toBe(mockUserId)
      expect(preferences.emailNotifications).toBe(true)
      expect(preferences.toastNotifications).toBe(false)
      expect(preferences.soundNotifications).toBe(true)
      expect(preferences.quietHours.enabled).toBe(true)
      expect(preferences.quietHours.start).toBe('23:00')
      expect(preferences.quietHours.end).toBe('07:00')
      expect(preferences.language).toBe('pt')
      expect(preferences.timezone).toBe('America/Sao_Paulo')
    })

    it('should return defaults when no preferences exist', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const preferences = await preferencesManager.getUserPreferences(mockUserId)

      expect(preferences.userId).toBe(mockUserId)
      expect(preferences.emailNotifications).toBe(true)
      expect(preferences.toastNotifications).toBe(true)
      expect(preferences.soundNotifications).toBe(false)
      expect(preferences.quietHours.enabled).toBe(false)
      expect(preferences.language).toBe('en')
    })

    it('should return defaults on database error', async () => {
      mockSupabase.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      const preferences = await preferencesManager.getUserPreferences(mockUserId)

      expect(preferences.userId).toBe(mockUserId)
      // Should return defaults
      const defaults = createDefaultNotificationPreferences(mockUserId)
      expect(preferences.emailNotifications).toBe(defaults.emailNotifications)
      expect(preferences.toastNotifications).toBe(defaults.toastNotifications)
    })
  })

  describe('updateUserPreferences', () => {
    it('should update user preferences successfully', async () => {
      const mockCurrentPreferences = createDefaultNotificationPreferences(mockUserId)
      const mockUpdatedRow = {
        user_id: mockUserId,
        email_notifications: false,
        toast_notifications: true,
        sound_notifications: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        type_preferences: mockCurrentPreferences.typePreferences,
        language: 'en',
        timezone: 'UTC',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      // Mock getting current preferences
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // First call returns empty (defaults)
        .mockResolvedValueOnce({ data: mockUpdatedRow, error: null }) // Second call for update

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const updates: Partial<NotificationPreferences> = {
        emailNotifications: false,
        toastNotifications: true
      }

      const result = await preferencesManager.updateUserPreferences(mockUserId, updates)

      expect(result.emailNotifications).toBe(false)
      expect(result.toastNotifications).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledWith('upsert_user_notification_preferences', expect.objectContaining({
        user_uuid: mockUserId,
        p_email_notifications: false,
        p_toast_notifications: true
      }))
    })

    it('should validate preferences before updating', async () => {
      const invalidUpdates: Partial<NotificationPreferences> = {
        quietHours: {
          enabled: true,
          start: '25:00', // Invalid time
          end: '08:00'
        }
      }

      await expect(
        preferencesManager.updateUserPreferences(mockUserId, invalidUpdates)
      ).rejects.toThrow('Validation failed')
    })

    it('should handle database errors during update', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // Get current preferences
        .mockResolvedValueOnce({ 
          data: null, 
          error: { message: 'Update failed' } 
        }) // Update fails

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const updates: Partial<NotificationPreferences> = {
        emailNotifications: false
      }

      await expect(
        preferencesManager.updateUserPreferences(mockUserId, updates)
      ).rejects.toThrow('Failed to update preferences')
    })
  })

  describe('shouldReceiveNotification', () => {
    it('should return true for enabled notification types', async () => {
      const mockPreferences = createDefaultNotificationPreferences(mockUserId)
      mockPreferences.typePreferences.ticket_created.enabled = true

      mockSupabase.rpc.mockResolvedValue({ 
        data: [{
          user_id: mockUserId,
          email_notifications: true,
          toast_notifications: true,
          sound_notifications: false,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          type_preferences: mockPreferences.typePreferences,
          language: 'en',
          timezone: 'UTC',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }], 
        error: null 
      })

      const shouldReceive = await preferencesManager.shouldReceiveNotification(
        mockUserId, 
        'ticket_created'
      )

      expect(shouldReceive).toBe(true)
    })

    it('should return false for disabled notification types', async () => {
      const mockPreferences = createDefaultNotificationPreferences(mockUserId)
      mockPreferences.typePreferences.ticket_created.enabled = false

      mockSupabase.rpc.mockResolvedValue({ 
        data: [{
          user_id: mockUserId,
          email_notifications: true,
          toast_notifications: true,
          sound_notifications: false,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          type_preferences: mockPreferences.typePreferences,
          language: 'en',
          timezone: 'UTC',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }], 
        error: null 
      })

      const shouldReceive = await preferencesManager.shouldReceiveNotification(
        mockUserId, 
        'ticket_created'
      )

      expect(shouldReceive).toBe(false)
    })

    it('should respect quiet hours for non-high priority notifications', async () => {
      // Mock current time to be within quiet hours
      const mockDate = new Date('2024-01-01T23:30:00Z') // 23:30
      vi.setSystemTime(mockDate)

      const mockPreferences = createDefaultNotificationPreferences(mockUserId)
      mockPreferences.quietHours.enabled = true
      mockPreferences.quietHours.start = '22:00'
      mockPreferences.quietHours.end = '08:00'
      mockPreferences.toastNotifications = true

      mockSupabase.rpc.mockResolvedValue({ 
        data: [{
          user_id: mockUserId,
          email_notifications: true,
          toast_notifications: true,
          sound_notifications: false,
          quiet_hours_enabled: true,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          type_preferences: mockPreferences.typePreferences,
          language: 'en',
          timezone: 'UTC',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }], 
        error: null 
      })

      // Medium priority should be blocked during quiet hours
      const shouldReceiveMedium = await preferencesManager.shouldReceiveNotification(
        mockUserId, 
        'ticket_created',
        'medium'
      )
      expect(shouldReceiveMedium).toBe(false)

      // High priority should be allowed during quiet hours
      const shouldReceiveHigh = await preferencesManager.shouldReceiveNotification(
        mockUserId, 
        'ticket_created',
        'high'
      )
      expect(shouldReceiveHigh).toBe(true)

      vi.useRealTimers()
    })

    it('should default to allowing notifications on error', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'))

      const shouldReceive = await preferencesManager.shouldReceiveNotification(
        mockUserId, 
        'ticket_created'
      )

      expect(shouldReceive).toBe(true)
    })
  })

  describe('getDeliveryMethod', () => {
    it('should return the correct delivery method for notification type', async () => {
      const mockPreferences = createDefaultNotificationPreferences(mockUserId)
      mockPreferences.typePreferences.ticket_created.delivery = 'batched'

      mockSupabase.rpc.mockResolvedValue({ 
        data: [{
          user_id: mockUserId,
          email_notifications: true,
          toast_notifications: true,
          sound_notifications: false,
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          type_preferences: mockPreferences.typePreferences,
          language: 'en',
          timezone: 'UTC',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }], 
        error: null 
      })

      const deliveryMethod = await preferencesManager.getDeliveryMethod(
        mockUserId, 
        'ticket_created'
      )

      expect(deliveryMethod).toBe('batched')
    })

    it('should default to instant delivery on error', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'))

      const deliveryMethod = await preferencesManager.getDeliveryMethod(
        mockUserId, 
        'ticket_created'
      )

      expect(deliveryMethod).toBe('instant')
    })
  })

  describe('caching', () => {
    it('should cache preferences when enabled', async () => {
      const cachedManager = new PreferencesManager({ enableCache: true, cacheTimeout: 1000 })
      
      const mockDbRow = {
        user_id: mockUserId,
        email_notifications: true,
        toast_notifications: true,
        sound_notifications: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        type_preferences: {},
        language: 'en',
        timezone: 'UTC',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValue({ data: [mockDbRow], error: null })

      // First call should hit database
      await cachedManager.getUserPreferences(mockUserId)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await cachedManager.getUserPreferences(mockUserId)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1) // Still 1, not 2
    })

    it('should clear cache when requested', async () => {
      const cachedManager = new PreferencesManager({ enableCache: true })
      
      // Add something to cache
      const mockDbRow = {
        user_id: mockUserId,
        email_notifications: true,
        toast_notifications: true,
        sound_notifications: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        type_preferences: {},
        language: 'en',
        timezone: 'UTC',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValue({ data: [mockDbRow], error: null })
      await cachedManager.getUserPreferences(mockUserId)

      // Clear cache
      cachedManager.clearCache(mockUserId)

      // Next call should hit database again
      await cachedManager.getUserPreferences(mockUserId)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2)
    })
  })

  describe('bulk operations', () => {
    it('should handle bulk preference updates', async () => {
      mockSupabase.rpc
        .mockResolvedValue({ data: [], error: null }) // Get current preferences
        .mockResolvedValue({ 
          data: {
            user_id: mockUserId,
            email_notifications: false,
            toast_notifications: true,
            sound_notifications: false,
            quiet_hours_enabled: false,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00',
            type_preferences: {},
            language: 'en',
            timezone: 'UTC',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }, 
          error: null 
        })

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const updates = [
        { userId: mockUserId, preferences: { emailNotifications: false } }
      ]

      const result = await preferencesManager.bulkUpdatePreferences(updates)

      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle bulk preference retrieval', async () => {
      const userIds = [mockUserId, 'user2']
      
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const result = await preferencesManager.getBulkPreferences(userIds)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result[mockUserId]).toBeDefined()
      expect(result['user2']).toBeDefined()
    })
  })

  describe('utility methods', () => {
    it('should reset preferences to defaults', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // Get current preferences
        .mockResolvedValueOnce({ 
          data: {
            user_id: mockUserId,
            email_notifications: true,
            toast_notifications: true,
            sound_notifications: false,
            quiet_hours_enabled: false,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00',
            type_preferences: {},
            language: 'en',
            timezone: 'UTC',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }, 
          error: null 
        })

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const result = await preferencesManager.resetToDefaults(mockUserId)

      expect(result.emailNotifications).toBe(true)
      expect(result.toastNotifications).toBe(true)
      expect(result.soundNotifications).toBe(false)
    })

    it('should export preferences as JSON', async () => {
      const mockDbRow = {
        user_id: mockUserId,
        email_notifications: true,
        toast_notifications: true,
        sound_notifications: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        type_preferences: {},
        language: 'en',
        timezone: 'UTC',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValue({ data: [mockDbRow], error: null })

      const exported = await preferencesManager.exportPreferences(mockUserId)
      const parsed = JSON.parse(exported)

      expect(parsed.userId).toBe(mockUserId)
      expect(parsed.emailNotifications).toBe(true)
    })

    it('should import preferences from JSON', async () => {
      const preferences = createDefaultNotificationPreferences(mockUserId)
      preferences.emailNotifications = false
      
      const preferencesJson = JSON.stringify(preferences)

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // Get current preferences
        .mockResolvedValueOnce({ 
          data: {
            user_id: mockUserId,
            email_notifications: false,
            toast_notifications: true,
            sound_notifications: false,
            quiet_hours_enabled: false,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00',
            type_preferences: preferences.typePreferences,
            language: 'en',
            timezone: 'UTC',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z'
          }, 
          error: null 
        })

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      })

      const result = await preferencesManager.importPreferences(mockUserId, preferencesJson)

      expect(result.emailNotifications).toBe(false)
    })

    it('should reject invalid JSON during import', async () => {
      const invalidJson = '{ invalid json }'

      await expect(
        preferencesManager.importPreferences(mockUserId, invalidJson)
      ).rejects.toThrow('Failed to import preferences')
    })
  })
})